"""Operator commands. Every command either performs its stated action or fails with a clear message."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from factory import gitops
from factory.adapters import ClaudeCliAdapter, DryRunAdapter
from factory.common import FactoryError, read_json, sha256_text
from factory.controller import Controller
from factory.ledger import Ledger
from factory.providers import CLAUDE, KNOWN_PROVIDERS, ProviderPolicy, quota_status
from factory.ticket import load_ticket

REQUIRED_CLAUDE_FLAGS = ["-p", "--output-format"]
LIVE_FLAG_ENV = "FACTORY_ALLOW_LIVE"


class Context:
    """Paths and configuration for one repository. Loaded fresh for each command."""

    def __init__(self, cwd: Path | None = None):
        self.repo = gitops.repo_root(cwd or Path.cwd())
        self.factory_dir = self.repo / "factory"
        self.config_path = self.factory_dir / "config.json"
        self.config = read_json(self.config_path)
        self.project_path = self.factory_dir / "projects" / "journal.json"
        self.project = read_json(self.project_path)
        self.config_hash = sha256_text(self.config_path.read_text() + self.project_path.read_text())
        self.ledger = Ledger(self.repo / ".factory-local" / "ledger.sqlite")

    def adapter(self, live: bool):
        if not live:
            return DryRunAdapter()
        if os.environ.get(LIVE_FLAG_ENV) != "1":
            raise FactoryError(f"live execution needs --live and {LIVE_FLAG_ENV}=1; nothing was dispatched")
        binary = self.config["execution"]["claude_binary"]
        if shutil.which(binary) is None:
            raise FactoryError(f"'{binary}' was not found on PATH; live execution is unavailable")
        info = ClaudeCliAdapter.probe(binary)
        missing = [f for f in REQUIRED_CLAUDE_FLAGS if f not in info["flags"]]
        if missing:
            raise FactoryError(f"installed Claude CLI lacks required flags {missing}; upgrade or use dry-run")
        return ClaudeCliAdapter(
            binary,
            set(info["flags"]),
            timeout=int(self.config["execution"]["timeout_seconds"]),
            use_bare=bool(self.config["execution"]["use_bare_mode"]),
            policy=self.policy(),
        )

    def policy(self) -> ProviderPolicy:
        return ProviderPolicy(self.repo / ".factory-local", self.config, self.config["execution"]["claude_binary"])

    def controller(self, live: bool) -> Controller:
        return Controller(self.repo, self.ledger, self.adapter(live), self.config, self.project, self.config_hash)


def _print(data, as_json: bool) -> None:
    if as_json:
        print(json.dumps(data, indent=2, sort_keys=True, default=str))
    elif isinstance(data, str):
        print(data)
    else:
        for key, value in data.items():
            print(f"{key}: {value}")


def _run_safe(argv: list[str], timeout: int = 30) -> tuple[int, str] | None:
    """Runs a probe command. A missing executable, a permission error or a timeout returns None, never raises."""
    try:
        proc = subprocess.run(argv, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.SubprocessError):
        return None
    return proc.returncode, (proc.stdout or "") + (proc.stderr or "")


def cmd_doctor(ctx: Context | None, args) -> int:
    """Reports what is available. Every probe tolerates a missing tool, so the doctor always finishes."""
    checks: list[dict] = []

    def check(name: str, ok: bool, detail: str) -> None:
        checks.append({"check": name, "status": "available" if ok else "missing", "detail": detail})

    def version_of(binary: str) -> str | None:
        if shutil.which(binary) is None:
            return None
        result = _run_safe([binary, "--version"])
        if result is None:
            return "found on PATH but did not answer --version"
        first = result[1].strip().splitlines()
        return first[0] if first else "installed"

    for name in ["git", "uv", "node", "npm", "opa", "gitleaks", "gradle", "java", "docker"]:
        v = version_of(name)
        check(name, v is not None and not v.startswith("found on PATH but"), v or "not on PATH")

    claude = shutil.which("claude")
    if claude is None:
        check("claude-cli", False, "not on PATH")
    else:
        try:
            info = ClaudeCliAdapter.probe(claude)
            missing = [f for f in REQUIRED_CLAUDE_FLAGS if f not in info["flags"]]
            check("claude-cli", not missing, f"{info['version']}; " + ("required flags present" if not missing else f"missing {missing}"))
        except (OSError, subprocess.SubprocessError):
            check("claude-cli", False, "found on PATH but did not answer the probe")

    pg = _run_safe(["pg_isready", "-h", "127.0.0.1", "-p", "5433"], timeout=10)
    if pg is None:
        check("postgresql-5433", False, "pg_isready not on PATH; cannot check (needed for backend tests)")
    else:
        check("postgresql-5433", pg[0] == 0, "accepting connections" if pg[0] == 0 else "not reachable (needed for backend tests)")

    xs = _run_safe(["xcode-select", "-p"], timeout=10)
    xcode = xs[1].strip() if xs and xs[0] == 0 else ""
    full_xcode = xcode.endswith("Xcode.app/Contents/Developer")
    check("xcode-full-app", full_xcode, xcode or "xcode-select not configured or not on PATH")

    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or ""
    adb = Path(sdk) / "platform-tools" / "adb" if sdk else None
    check("android-sdk", bool(adb and adb.exists()), sdk or "ANDROID_HOME unset")
    if adb and adb.exists():
        result = _run_safe([str(adb), "devices"])
        lines = result[1].splitlines()[1:] if result else []
        connected = [d for d in lines if d.strip().endswith("device")]
        check("android-device", bool(connected), f"{len(connected)} authorised device(s) connected" if result else "adb did not answer")
    else:
        check("android-device", False, "adb not available")

    if args.json:
        _print({"checks": checks}, True)
    else:
        for c in checks:
            print(f"{c['status']:<10} {c['check']:<18} {c['detail']}")
    return 0


def cmd_validate(ctx: Context, args) -> int:
    from factory.ticket import validate_ticket

    problems = []
    for key in ("default_mode",):
        if key not in ctx.config["execution"]:
            problems.append(f"config.execution.{key} missing")
    for gate_id, spec in ctx.project.get("gates", {}).items():
        if not isinstance(spec.get("argv"), list) or not spec["argv"]:
            problems.append(f"gate {gate_id} needs an argv list")
    for path in sorted((ctx.factory_dir / "tickets").glob("*.json")):
        errors = validate_ticket(load_ticket(path), ctx.project, ctx.config["budget"]["max_ticket_usd"], ctx.config["limits"]["max_repairs"])
        for e in errors:
            problems.append(f"{path.name}: {e}")
    if problems:
        for p in problems:
            print(f"invalid: {p}")
        return 1
    print("valid: config, project gates and tickets")
    return 0


def cmd_plan(ctx: Context, args) -> int:
    ticket = load_ticket(args.ticket)
    plan = ctx.controller(False).plan(ticket)
    _print(plan, args.json)
    return 0


def cmd_run(ctx: Context, args) -> int:
    ticket = load_ticket(args.ticket)
    controller = ctx.controller(args.live)
    run_id = controller.run(ticket, candidate_ref=args.candidate)
    run = ctx.ledger.get_run(run_id)
    _print({"run": run_id, "state": run["state"], "stop_reason": run["stop_reason"] or "", "candidate": run["candidate_sha"] or ""}, args.json)
    return 0 if run["state"] == "ready" else 2


def cmd_verify(ctx: Context, args) -> int:
    result = ctx.controller(False).verify(args.run)
    _print(result, args.json)
    return 0 if result.get("passed") else 2


def cmd_report(ctx: Context, args) -> int:
    run = ctx.ledger.get_run(args.run)
    usage = ctx.ledger.usage(run["lineage_id"])
    events = ctx.ledger.events(args.run)
    evidence_files = sorted((ctx.factory_dir.parent / ".factory-local" / "runs" / args.run).glob("evidence-*.json"))
    lines = [
        f"# Factory report: {args.run}",
        "",
        f"- Ticket: {run['ticket_id']}",
        f"- State: {run['state']}",
        f"- Stop reason: {run['stop_reason'] or 'none'}",
        f"- Mode: {run['mode']}",
        f"- Base: {run['base_sha']}",
        f"- Candidate: {run['candidate_sha'] or 'none'}",
        f"- Config hash: {run['config_hash'][:16]}",
        f"- Budget: ${usage['committed_usd']:.2f} committed of ${usage['cap_usd']:.2f} "
        f"({usage['unknown_spend_entries']} entries with unknown spend, {usage['open_or_orphaned']} open or orphaned)",
        "",
        "## Reservations",
    ]
    for r in ctx.ledger.reservations(args.run):
        lines.append(f"- {r['stage']} / {r['role']}: {r['status']}, reserved ${r['reserved_usd']:.2f}, basis: {r['spend_basis'] or 'pending'}")
    lines += ["", "## Events"]
    lines += [f"- {e['kind']}: {e['detail']}" for e in events]
    lines += ["", "## Handoffs"]
    handoff_rows = ctx.ledger._conn.execute("select * from handoffs where run_id = ? order by id", (args.run,)).fetchall()
    lines += [f"- #{h['id']} {h['status']}: {h['stage']} via {h['provider']}: {h['reason']}" for h in handoff_rows] or ["- none"]
    lines += ["", "## Evidence files"]
    lines += [f"- {p.relative_to(ctx.repo)}" for p in evidence_files] or ["- none"]
    report = "\n".join(lines) + "\n"
    out = ctx.repo / ".factory-local" / "runs" / args.run / "report.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(report, encoding="utf-8")
    print(report)
    print(f"written: {out.relative_to(ctx.repo)}")
    return 0


def cmd_pause(ctx: Context, args) -> int:
    ctx.controller(False).pause(args.run)
    print(f"pause requested for {args.run}")
    return 0


def cmd_resume(ctx: Context, args) -> int:
    controller = ctx.controller(args.live)
    final = controller.resume(args.run)
    print(f"{args.run}: {final}")
    return 0 if final == "ready" else 2


def cmd_providers(ctx: Context, args) -> int:
    policy = ctx.policy()
    rows = []
    for name in KNOWN_PROVIDERS:
        elig = policy.evaluate(name)
        quota = quota_status(name)["state"]
        rows.append(
            {
                "provider": name,
                "enabled": policy.toggles().get(name, False),
                "eligible": elig.eligible,
                "route": elig.route,
                "quota": quota,
                "reason": elig.reason,
            }
        )
    if args.json:
        _print({"policy": "no additional spend", "providers": rows}, True)
    else:
        print("Policy: no additional spend. Unknown or paid routes are refused; quota is never estimated.")
        for r in rows:
            state_text = "ELIGIBLE" if r["eligible"] else "refused"
            print(f"- {r['provider']}: {state_text} (enabled={r['enabled']}, quota={r['quota']})")
            print(f"    {r['reason']}")
    return 0


def cmd_provider_toggle(ctx: Context, args) -> int:
    policy = ctx.policy()
    policy.set_toggle(args.provider, args.state == "on")
    print(f"{args.provider}: {'enabled' if args.state == 'on' else 'disabled'} (local toggle; eligibility is still checked on every dispatch)")
    return 0


def cmd_attest(ctx: Context, args) -> int:
    policy = ctx.policy()
    policy.attest(args.provider, args.key)
    print(f"recorded owner attestation {args.provider}/{args.key} in .factory-local/owner-attestations.json")
    return 0


def cmd_handoffs(ctx: Context, args) -> int:
    rows = ctx.ledger._conn.execute("select * from handoffs where run_id = ? order by id", (args.run,)).fetchall()
    if not rows:
        print("no handoffs recorded for this run")
        return 0
    for r in rows:
        print(f"#{r['id']} {r['status']}: stage={r['stage']} provider={r['provider']} candidate={(r['candidate_sha'] or 'none')[:12]}")
        print(f"    reason: {r['reason']}")
    return 0


def cmd_usage(ctx: Context, args) -> int:
    lineage_rows = ctx.ledger._conn.execute("select id, ticket_id from lineages where ticket_id = ?", (args.ticket,)).fetchall()
    if not lineage_rows:
        print(f"no spend recorded for {args.ticket}")
        return 0
    for row in lineage_rows:
        _print({"ticket": row["ticket_id"], **ctx.ledger.usage(row["id"])}, args.json)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="factory", description="Journal AI software factory")
    parser.add_argument("--json", action="store_true", help="machine-readable output where supported")
    # Also accepted after the subcommand, as the runbook shows. SUPPRESS keeps the top-level value.
    json_after = argparse.ArgumentParser(add_help=False)
    json_after.add_argument("--json", action="store_true", default=argparse.SUPPRESS, help="machine-readable output where supported")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("doctor", parents=[json_after], help="report capabilities and missing prerequisites")
    sub.add_parser("validate", parents=[json_after], help="check config, gates and tickets")
    p = sub.add_parser("plan", parents=[json_after], help="route and budget a ticket without dispatch")
    p.add_argument("ticket", type=Path)
    p = sub.add_parser("run", parents=[json_after], help="run a ticket (dry-run unless --live)")
    p.add_argument("ticket", type=Path)
    p.add_argument("--live", action="store_true", help=f"dispatch to the Claude CLI (also needs {LIVE_FLAG_ENV}=1)")
    p.add_argument("--candidate", help="verify an existing commit instead of dispatching an implementer")
    p = sub.add_parser("verify", parents=[json_after], help="re-run gates on the recorded candidate")
    p.add_argument("run")
    p = sub.add_parser("report", parents=[json_after], help="write and print a run report")
    p.add_argument("run")
    p = sub.add_parser("pause", parents=[json_after], help="ask a run to pause at its next boundary")
    p.add_argument("run")
    p = sub.add_parser("resume", parents=[json_after], help="resume a paused or interrupted run")
    p.add_argument("run")
    p.add_argument("--live", action="store_true")
    p = sub.add_parser("usage", parents=[json_after], help="show cumulative spend for a ticket")
    p.add_argument("ticket")
    sub.add_parser("providers", parents=[json_after], help="show which development routes are eligible, and why not")
    p = sub.add_parser("provider-toggle", parents=[json_after], help="enable or disable a development route locally")
    p.add_argument("provider", choices=list(KNOWN_PROVIDERS))
    p.add_argument("state", choices=["on", "off"])
    p = sub.add_parser("attest", parents=[json_after], help="record an owner attestation the CLI cannot verify itself")
    p.add_argument("provider", choices=[CLAUDE])
    p.add_argument("key", choices=["extra-usage-disabled"])
    p = sub.add_parser("handoffs", parents=[json_after], help="list durable handoffs for a run")
    p.add_argument("run")
    return parser


COMMANDS = {
    "validate": cmd_validate,
    "plan": cmd_plan,
    "run": cmd_run,
    "verify": cmd_verify,
    "report": cmd_report,
    "pause": cmd_pause,
    "resume": cmd_resume,
    "usage": cmd_usage,
    "providers": cmd_providers,
    "provider-toggle": cmd_provider_toggle,
    "attest": cmd_attest,
    "handoffs": cmd_handoffs,
}


def main(argv: list[str]) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "doctor":
            return cmd_doctor(None, args)
        ctx = Context()
        return COMMANDS[args.command](ctx, args)
    except FactoryError as exc:
        print(f"factory: {exc}", file=sys.stderr)
        return 1
    except KeyError as exc:
        print(f"factory: unknown run {exc}", file=sys.stderr)
        return 1
