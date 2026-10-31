# Journal factory runbook

Status: bootstrap. The controller, ledger, gates, scope checks, evidence and a dry-run adapter are
implemented and tested. The Claude CLI adapter is implemented and probed but has not been used for
a real review of a candidate. Read "Known limits" before relying on any result.

## Commands

Run from the repository root. Every command prints a clear message on failure.

| Command | What it does | Spends money? |
|---|---|---|
| `make factory` | Runs the controller test suite (32 tests). | No |
| `python3 -m factory doctor [--json]` | Reports tools, Claude CLI flags, Postgres, Xcode, Android SDK and devices. Writes nothing. | No |
| `python3 -m factory validate` | Checks config, protected gate definitions and every ticket. | No |
| `python3 -m factory plan TICKET` | Shows route, budget and worst-case reservation. Dispatches nothing. | No |
| `python3 -m factory run TICKET` | Runs the ticket with the dry-run adapter (scripted, no model call). | No |
| `python3 -m factory run TICKET --candidate REF` | Verifies an existing commit: scope, gates, then review. Use when a human or another tool made the change. | Only with `--live` |
| `python3 -m factory run TICKET --live` | Dispatches to the Claude CLI. Requires `FACTORY_ALLOW_LIVE=1`. | Yes |
| `python3 -m factory verify RUN` | Re-runs gates on the recorded candidate. Reports stale evidence. | No |
| `python3 -m factory report RUN` | Writes `.factory-local/runs/RUN/report.md`. | No |
| `python3 -m factory pause RUN` | Asks a run to pause at its next dispatch or gate boundary. | No |
| `python3 -m factory resume RUN [--live]` | Continues a paused or interrupted run. | Only with `--live` |
| `python3 -m factory usage TICKET` | Shows cumulative committed spend for a ticket. | No |

Exit codes: 0 for success or ready; 2 for a blocked run or a failed verification; 1 for an operator
error such as an invalid ticket or missing live authorisation.

## How a ticket moves

1. Validation. Unknown gate names, out-of-range budgets and missing acceptance criteria are refused.
2. Worktree. The run gets its own git worktree and branch under `.factory-local/workspaces/`.
3. Implementation. Each dispatch reserves budget first, is recorded once, then settles with reported
   spend. Unknown spend keeps the worst-case reservation and is labelled.
4. Scope. Changed files must match `allowed_paths` and must not match the protected paths in
   `factory/projects/journal.json`. Protected paths win even when also allowed.
5. Gates. Commands come only from the protected project file. A ticket can name a gate, not add one.
6. Review. The reviewer must return an approval that checks every acceptance id. A reviewer from a
   non-independent adapter (the dry-run adapter) blocks readiness.
7. Decision. Ready, repair (up to `max_repairs`), or blocked with a stop reason.

## Budgets

- Each ticket has one lineage. A new run or a resumed run for the same ticket shares its spend.
- Reservations use `per_call_reserve_usd` plus `contingency_usd`. A dispatch that would exceed the
  ticket cap is refused before any call.
- Spend is labelled by basis: `provider-reported`, `dry-run: no provider call`, or `unknown`.
- `--max-budget-usd` is passed to the Claude CLI as an extra limit. It is not a hard cap: in the
  bootstrap probe the CLI reported $0.32 spent against a $0.05 limit. Treat the ledger as the control.

## Resume and crashes

- A dispatch with no recorded outcome after a crash is never repeated automatically. The run is
  blocked with the stage and attempt named, and a person decides what happened.
- Open reservations from a crash stay counted at worst case and are labelled `orphaned`.
- Resume refuses if the configuration or gate definitions changed since the run started.
- Resume refuses to continue if the workspace HEAD is not the recorded candidate.

## Protected files

`factory/**`, `policy/**`, `.github/**`, `.claude/**`, `CLAUDE.md`, lock files, auth routes,
migrations, ADRs, the PRD and the OpenAPI contract cannot be changed by a candidate. A candidate
that edits them is blocked before review. Changing these files needs a reviewed commit by the owner.

## Known limits (read before relying on results)

- The Claude CLI adapter is not yet proven on a real candidate. Live dispatch needs the owner's
  authorisation and a spend decision. See the bootstrap report.
- `--max-turns` is not present in the installed Claude Code CLI (2.1.309). The adapter omits it.
- `pause` does not kill an in-flight provider call; the configured timeout bounds it.
- Worktrees isolate files, not processes. They are not a security sandbox.
- Hooks are not used. The controller and CI are the enforcement points.
- There is no `release-plan` command yet. Release is not implemented.
- Evidence proves what ran on a commit with a given configuration. It does not prove the process
  that produced the commit was trustworthy.
- Gates run as the operator's user with the operator's environment. They are not sandboxed.

## Where state lives

- `.factory-local/ledger.sqlite`: runs, budgets, dispatches, events. Git-ignored. Never production data.
- `.factory-local/runs/<run>/`: ticket copy, evidence, report.
- `.factory-local/workspaces/<run>/`: the run's git worktree.
