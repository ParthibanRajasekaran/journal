"""Run lifecycle. The controller decides; adapters only propose work.

A run moves through: planned -> implementing -> verifying -> ready | blocked. A failed gate, failed
review or rejected change sends the run back to implementing while repairs remain. Every model
dispatch reserves budget first, is recorded once, and settles afterwards. Ready needs an independent
review, scope compliance and passing gates on the exact candidate commit.
"""

from __future__ import annotations

import uuid
from pathlib import Path

from factory import gitops, state
from factory.common import FactoryError, now, read_json, sha256_text, write_json
from factory.controller.decision import decide
from factory.gates import run_gate
from factory.ledger import BudgetExceeded, DuplicateDispatch, Ledger
from factory.locks import WorkspaceLock
from factory.scope import check_scope
from factory.ticket import require_valid


class Blocked(Exception):
    """The run cannot proceed. The reason is recorded as the stop reason."""


class Paused(Exception):
    """An operator asked the run to pause. Takes effect at the next dispatch or gate boundary."""


class QuotaExhausted(Exception):
    """A provider reported its quota is used up. The run pauses with a handoff; remaining quota is unknown."""

    def __init__(self, provider: str, stage: str, reason: str):
        super().__init__(reason)
        self.provider = provider
        self.stage = stage
        self.reason = reason


ROUTE = ["orchestrator", "implementer", "independent-reviewer", "verifier"]


class Controller:
    def __init__(self, repo: Path, ledger: Ledger, adapter, config: dict, project: dict, config_hash: str):
        self.repo = Path(repo)
        self.ledger = ledger
        self.adapter = adapter
        self.config = config
        self.project = project
        self.config_hash = config_hash
        self.factory_local = self.repo / ".factory-local"

    # Paths ------------------------------------------------------------------------------------

    def workdir(self, run_id: str) -> Path:
        return self.factory_local / "workspaces" / run_id

    def run_dir(self, run_id: str) -> Path:
        return self.factory_local / "runs" / run_id

    # Planning ---------------------------------------------------------------------------------

    def plan(self, ticket: dict) -> dict:
        """Routes and budgets a ticket without dispatching anything."""
        require_valid(ticket, self.project, self.config["budget"]["max_ticket_usd"], self.config["limits"]["max_repairs"])
        per_call = float(self.config["budget"]["per_call_reserve_usd"])
        repairs = int(ticket["max_repairs"])
        calls = (repairs + 1) * 2  # implementation plus review, for every attempt
        return {
            "ticket": ticket["id"],
            "route": ROUTE,
            "specialists": ticket.get("specialists", []),
            "adapter": self.adapter.name,
            "independent_review": bool(self.adapter.independent),
            "budget_usd": ticket["budget_usd"],
            "per_call_reserve_usd": per_call,
            "worst_case_calls": calls,
            "worst_case_reserved_usd": round(calls * per_call, 4),
            "fits_budget": calls * per_call + float(self.config["budget"]["contingency_usd"]) <= ticket["budget_usd"] + 1e-9,
            "gates": ticket["verification"],
        }

    # Run lifecycle ----------------------------------------------------------------------------

    def run(self, ticket: dict, candidate_ref: str | None = None) -> str:
        require_valid(ticket, self.project, self.config["budget"]["max_ticket_usd"], self.config["limits"]["max_repairs"])
        base = gitops.resolve(self.repo, ticket.get("base_commit") or "HEAD")
        start = gitops.resolve(self.repo, candidate_ref) if candidate_ref else base
        if candidate_ref:
            # A candidate is a commit. Uncommitted corrections in the primary checkout would not be
            # part of it, so verifying them would not verify the commit.
            patterns = list(ticket["allowed_paths"]) + list(ticket.get("protected_paths", [])) + list(self.project.get("protected_paths", []))
            relevant = gitops.relevant_dirty(self.repo, patterns)
            if relevant:
                raise FactoryError(
                    "primary checkout has uncommitted changes the candidate would not contain: "
                    + "; ".join(entry.strip() for entry in relevant)
                    + ". Commit or stash them, then verify the commit."
                )
        run_id = f"run-{uuid.uuid4().hex[:12]}"
        lineage = self.ledger.lineage_for(ticket["id"], float(ticket["budget_usd"]))
        mode = "manual-candidate" if candidate_ref else self.adapter.name
        self.ledger.create_run(run_id, lineage, ticket["id"], base, self.config_hash, mode)
        write_json(self.run_dir(run_id) / "ticket.json", ticket)
        self.ledger.event(run_id, "plan", str(self.plan(ticket)))
        self._transition(run_id, state.PLANNED)

        branch = f"factory/{ticket['id']}/{run_id}"
        workdir = self.workdir(run_id)
        with WorkspaceLock(self.factory_local / "locks", run_id):
            gitops.add_worktree(self.repo, workdir, branch, start)
            gitops.link_dependencies(self.repo, workdir, self.project.get("workspace_links", []))
            self.ledger.event(run_id, "worktree", f"{branch} at {start[:12]}")
            self._drive(run_id, ticket, workdir, base, manual=bool(candidate_ref))
        return run_id

    def resume(self, run_id: str) -> str:
        with WorkspaceLock(self.factory_local / "locks", run_id):
            return self._resume(run_id)

    def _resume(self, run_id: str) -> str:
        run = self.ledger.get_run(run_id)
        if run["state"] in state.TERMINAL:
            return run["state"]
        if run["config_hash"] != self.config_hash:
            raise FactoryError("configuration or gate definitions changed since this run started; start a new run instead")
        if run["state"] == state.PAUSED and self.ledger.open_handoffs(run_id):
            eligibility = self.adapter.eligibility()
            if not eligibility.eligible:
                self.ledger.event(run_id, "resume-deferred", f"still not eligible: {eligibility.reason}")
                return state.PAUSED
        ticket = self._load_ticket(run_id)
        reaped = self.ledger.orphan_open_reservations(run_id)
        if reaped:
            self.ledger.event(run_id, "reaped", f"{reaped} open reservation(s) kept at worst case")
        unknown = self.ledger.started_without_outcome(run_id)
        if unknown:
            self._block(run_id, f"dispatch outcome unknown for {unknown}; not re-dispatched automatically")
            return state.BLOCKED
        self.ledger.update_run(run_id, pause_requested=0)
        workdir = self.workdir(run_id)
        if not workdir.exists():
            self._block(run_id, "workspace is missing; cannot resume safely")
            return state.BLOCKED
        base = run["base_sha"]
        if run["candidate_sha"] and gitops.head(workdir) != run["candidate_sha"]:
            self._block(run_id, "workspace HEAD differs from the recorded candidate; evidence is stale")
            return state.BLOCKED
        if gitops.dirty_entries(workdir):
            self._block(run_id, "workspace has uncommitted or untracked changes; it was modified outside the factory")
            return state.BLOCKED
        self.ledger.update_run(run_id, stop_reason=None)
        if run["state"] == state.PAUSED:
            resume_to = run["resume_state"] or state.PLANNED
            self._transition(run_id, resume_to)
            self.ledger.event(run_id, "resume", f"continuing at {resume_to}")
        else:
            self.ledger.event(run_id, "resume", f"continuing from {run['state']}")
        self._drive(run_id, ticket, workdir, base, manual=run["mode"] == "manual-candidate")
        return self.ledger.get_run(run_id)["state"]

    def pause(self, run_id: str) -> None:
        self.ledger.update_run(run_id, pause_requested=1)
        self.ledger.event(run_id, "pause-requested", "will take effect at the next dispatch or gate boundary")

    def verify(self, run_id: str) -> dict:
        """Re-runs the gates on the exact recorded candidate, without any model call."""
        with WorkspaceLock(self.factory_local / "locks", run_id):
            return self._verify(run_id)

    def _verify(self, run_id: str) -> dict:
        run = self.ledger.get_run(run_id)
        if run["candidate_sha"] is None:
            raise FactoryError("run has no candidate commit to verify")
        workdir = self.workdir(run_id)
        head = gitops.head(workdir)
        if head != run["candidate_sha"]:
            return {"run_id": run_id, "passed": False, "reason": "stale: workspace HEAD is not the candidate"}
        if run["config_hash"] != self.config_hash:
            return {"run_id": run_id, "passed": False, "reason": "stale: gate configuration changed"}
        dirty = gitops.dirty_entries(workdir)
        if dirty:
            return {"run_id": run_id, "passed": False, "reason": "stale: worktree has uncommitted or untracked changes", "dirty": dirty}
        ticket = self._load_ticket(run_id)
        results = [self._gate(workdir, gid) for gid in ticket["verification"]]
        passed = all(r["passed"] for r in results)
        return {"run_id": run_id, "candidate_sha": head, "passed": passed, "gates": results}

    # Internals --------------------------------------------------------------------------------

    def _load_ticket(self, run_id: str) -> dict:
        return read_json(self.run_dir(run_id) / "ticket.json")

    def _gate(self, workdir: Path, gate_id: str) -> dict:
        spec = self.project["gates"][gate_id]
        return run_gate(workdir, gate_id, spec, int(self.project.get("default_gate_timeout_s", 600)))

    def _transition(self, run_id: str, nxt: str) -> None:
        current = self.ledger.get_run(run_id)["state"]
        if current == nxt:
            return
        state.check_transition(current, nxt)
        self.ledger.update_run(run_id, state=nxt, resume_state=current if nxt == state.PAUSED else None)

    def _block(self, run_id: str, reason: str) -> None:
        current = self.ledger.get_run(run_id)["state"]
        if current not in state.TERMINAL:
            state.check_transition(current, state.BLOCKED)
            self.ledger.update_run(run_id, state=state.BLOCKED, stop_reason=reason)
        self.ledger.event(run_id, "blocked", reason)

    def _check_pause(self, run_id: str) -> None:
        if self.ledger.get_run(run_id)["pause_requested"]:
            current = self.ledger.get_run(run_id)["state"]
            self._transition(run_id, state.PAUSED)
            self.ledger.event(run_id, "paused", f"paused from {current}")
            raise Paused()

    def _dispatch(self, run_id: str, lineage: str, stage: str, role: str, call):
        """Reserve, record, call, settle. Each attempt is recorded once and never repeated silently."""
        self._check_pause(run_id)
        eligibility = self.adapter.eligibility()
        if not eligibility.eligible:
            self.ledger.event(run_id, "refused", f"{eligibility.provider}: {eligibility.reason}")
            raise Blocked(f"no-spend policy refused {stage}: {eligibility.reason}")
        cfg = self.config["budget"]
        attempt = self.ledger.next_attempt(run_id)
        try:
            reservation = self.ledger.reserve(
                lineage, run_id, role, stage, float(cfg["per_call_reserve_usd"]), float(cfg["contingency_usd"])
            )
        except BudgetExceeded as exc:
            raise Blocked(str(exc)) from exc
        try:
            self.ledger.start_dispatch(run_id, stage, attempt, reservation)
        except DuplicateDispatch as exc:
            raise Blocked(str(exc)) from exc
        try:
            result = call(float(cfg["per_call_reserve_usd"]))
        except Exception:
            self.ledger.finish_dispatch(run_id, stage, attempt, "failed")
            self.ledger.settle(reservation, None, "")
            raise
        if result.extra.get("refused"):
            self.ledger.finish_dispatch(run_id, stage, attempt, "failed")
            self.ledger.settle(reservation, 0.0, "refused before any provider call")
            raise Blocked(f"no-spend policy refused {stage}: {result.detail}")
        if result.extra.get("quota"):
            self.ledger.finish_dispatch(run_id, stage, attempt, "failed")
            self.ledger.settle(reservation, result.cost_usd, result.basis or "quota exhausted")
            raise QuotaExhausted(eligibility.provider, stage, result.detail)
        self.ledger.finish_dispatch(run_id, stage, attempt, "finished")
        basis = result.basis or getattr(self.adapter, "basis", "") or "unknown"
        spent = result.cost_usd if result.cost_usd is not None else (None if self.adapter.live else 0.0)
        self.ledger.settle(reservation, spent, basis)
        if self.ledger.open_handoffs(run_id):
            self.ledger.consume_handoffs(run_id)
            self.ledger.event(run_id, "handoff-closed", "work continued after the provider became available")
        usage = self.ledger.usage(lineage)
        self.ledger.event(run_id, "dispatch", f"{stage} attempt {attempt}: {basis}; committed ${usage['committed_usd']:.2f}")
        warn_at = float(cfg["warn_fraction"]) * usage["cap_usd"]
        if usage["committed_usd"] >= warn_at:
            self.ledger.event(run_id, "budget-warning", f"committed ${usage['committed_usd']:.2f} of ${usage['cap_usd']:.2f}")
        return result

    def _drive(self, run_id: str, ticket: dict, workdir: Path, base: str, manual: bool) -> None:
        try:
            self._loop(run_id, ticket, workdir, base, manual)
        except Blocked as exc:
            self._block(run_id, str(exc))
        except Paused:
            return
        except QuotaExhausted as exc:
            self._pause_for_quota(run_id, exc)
        except FactoryError as exc:
            self._block(run_id, f"controller error: {exc}")

    def _pause_for_quota(self, run_id: str, exc: QuotaExhausted) -> None:
        """Writes the handoff first, then pauses. A crash between the two leaves an open handoff and a
        failed dispatch, which resume handles safely: the failed attempt is retried, nothing is duplicated."""
        run = self.ledger.get_run(run_id)
        handoff_id = self.ledger.write_handoff(run_id, exc.stage, exc.provider, exc.reason, run["candidate_sha"])
        write_json(
            self.run_dir(run_id) / f"handoff-{handoff_id}.json",
            {
                "run_id": run_id,
                "stage": exc.stage,
                "provider": exc.provider,
                "reason": exc.reason,
                "candidate_sha": run["candidate_sha"],
                "workspace": str(self.workdir(run_id)),
                "quota": {"state": "unknown", "detail": "remaining quota is not reported"},
                "next_action": "resume the run after the provider's quota is restored, or once the owner reviews this handoff",
                "created_at": now(),
            },
        )
        current = run["state"]
        self._transition(run_id, state.PAUSED)
        self.ledger.update_run(run_id, stop_reason=f"paused: {exc.provider} quota exhausted during {exc.stage}; remaining quota unknown")
        self.ledger.event(run_id, "handoff", f"handoff {handoff_id} written at {current}; run paused")

    def _loop(self, run_id: str, ticket: dict, workdir: Path, base: str, manual: bool) -> None:
        run = self.ledger.get_run(run_id)
        lineage = run["lineage_id"]
        max_repairs = int(ticket["max_repairs"])
        repairs = int(run["repairs"])
        feedback: str | None = None
        while True:
            if run["candidate_sha"] is None:
                if manual:
                    candidate = gitops.head(workdir)
                else:
                    self._transition(run_id, state.IMPLEMENTING)
                    result = self._dispatch(
                        run_id, lineage, "implement", "implementer",
                        lambda budget: self.adapter.implement(workdir, ticket, feedback, max_budget_usd=budget),
                    )
                    candidate = None
                    if not result.ok:
                        feedback = f"The implementer reported a failure: {result.detail}"
                    else:
                        candidate = gitops.commit_all(workdir, f"{ticket['id']}: implementation attempt")
                        if candidate is None:
                            feedback = "The previous attempt changed no files."
                    if candidate is None:
                        repairs += 1
                        self.ledger.update_run(run_id, repairs=repairs)
                        if repairs > max_repairs:
                            raise Blocked(f"no reviewable candidate after {repairs} attempt(s): {feedback}")
                        continue
                self.ledger.update_run(run_id, candidate_sha=candidate)
                run = self.ledger.get_run(run_id)

            self._transition(run_id, state.VERIFYING)
            evidence = self._verify_candidate(run_id, ticket, workdir, base, lineage)
            verdict, reasons = decide(evidence, ticket)
            self._write_evidence(run_id, evidence)
            if verdict == "ready":
                self._transition(run_id, state.READY)
                self.ledger.event(run_id, "ready", f"candidate {evidence['candidate_sha'][:12]} passed all gates and independent review")
                return
            if verdict == "repair" and not manual and repairs < max_repairs:
                repairs += 1
                self.ledger.update_run(run_id, repairs=repairs, candidate_sha=None)
                run = self.ledger.get_run(run_id)
                feedback = "; ".join(reasons)
                self.ledger.event(run_id, "repair", feedback)
                continue
            raise Blocked("; ".join(reasons))

    def _verify_candidate(self, run_id: str, ticket: dict, workdir: Path, base: str, lineage: str) -> dict:
        before = gitops.snapshot(workdir)
        candidate = before["head"]
        changed = gitops.changed_paths(workdir, base)
        violations = check_scope(
            changed,
            ticket["allowed_paths"],
            list(ticket.get("protected_paths", [])) + list(self.project.get("protected_paths", [])),
        )
        if not changed:
            violations.append("the candidate changes no files")
        if before["dirty"]:
            # Evidence is for a commit. Any uncommitted or untracked file means the tested tree is not that commit.
            violations.append("worktree is not clean: " + "; ".join(entry.strip() for entry in before["dirty"]))
        gates: list[dict] = []
        review: dict | None = None
        if not violations:
            for gate_id in ticket["verification"]:
                self._check_pause(run_id)
                gates.append(self._gate(workdir, gate_id))
            self._check_pause(run_id)
            diff = gitops.diff_text(workdir, base)
            result = self._dispatch(
                run_id, lineage, "review", "reviewer",
                lambda budget: self.adapter.review(workdir, ticket, diff, max_budget_usd=budget),
            )
            review = {
                "independent": bool(self.adapter.independent),
                "ok": result.ok,
                "detail": result.detail,
                "decision": (result.payload or {}).get("decision") if result.ok else None,
                "checked_acceptance": (result.payload or {}).get("checked_acceptance", []) if result.ok else [],
                "findings": (result.payload or {}).get("findings", []) if result.ok else [],
            }
        after = gitops.snapshot(workdir)
        if after != before:
            # Something changed the tree while gates or the reviewer ran. These results describe a state that is not the commit.
            violations.append(f"candidate changed during verification (head {before['head'][:12]} -> {after['head'][:12]}, dirty {len(after['dirty'])})")
        return {
            "run_id": run_id,
            "ticket_id": ticket["id"],
            "candidate_sha": candidate,
            "worktree": {"before": before, "after": after, "mutated": after != before},
            "base_sha": base,
            "config_hash": self.config_hash,
            "ticket_hash": sha256_text(repr(sorted(ticket.items()))),
            "adapter": self.adapter.name,
            "scope": {"changed": changed, "violations": violations},
            "gates": gates,
            "review": review,
            "spend": self.ledger.usage(lineage),
            "generated_at": now(),
        }

    def _write_evidence(self, run_id: str, evidence: dict) -> None:
        write_json(self.run_dir(run_id) / f"evidence-{evidence['candidate_sha'][:12]}.json", evidence)
