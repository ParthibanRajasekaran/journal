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

## Provider routes and the no-spend policy

Factory development execution and Journal runtime AI are separate systems. The factory never reads
Journal's stored API keys, and a stored key is not evidence of a free or subscription route.

Default policy: no additional spend. `factory/providers.py` is the only place routes are decided.
A dispatch is refused before any reservation or provider call unless every check passes:

| Route | Eligible when | Status in this checkout |
|---|---|---|
| Claude Code subscription (`claude-code`) | Toggle on; CLI reports `authMethod: claude.ai` and `apiProvider: firstParty`; no API-billing variables are set; owner has attested extra usage is off | Refused until the owner runs `attest` (see below) |
| Codex through ChatGPT sign-in (`codex`) | Not implemented | Refused: no verified adapter, CLI not installed |
| Gemini free tier (`gemini`) | Not implemented | Refused: no verified adapter, CLI not installed |
| Any API-key or purchased-credit route | Never | Always refused |

Quota is always shown as `unknown`. The factory does not estimate it.

Setup the owner must do (the factory will not do these):

1. Confirm in the Claude account settings that extra usage is off. The CLI cannot report this.
2. Record that attestation: `python3 -m factory attest claude-code extra-usage-disabled`.
3. Enable the route if you want it: `python3 -m factory provider-toggle claude-code on` (already the default).
4. Make sure no `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or similar variable is exported in the shell that runs the factory. The factory refuses and names the variable, never its value.
5. Check with `python3 -m factory providers`.

## Quota exhaustion and handoffs

- A provider reporting a usage or rate limit pauses the run, rather than failing it. The handoff is
  written first, to the ledger and to `.factory-local/runs/<run>/handoff-N.json`, with quota `unknown`.
- `python3 -m factory handoffs RUN` lists them. A handoff closes when work resumes successfully.
- `python3 -m factory resume RUN` checks eligibility first. If the route is still refused, the run
  stays paused and records `resume-deferred`. If the route is eligible, it attempts the stage; a
  renewed quota error pauses again with a new handoff, and nothing is repeated silently.
- A crash between writing the handoff and pausing leaves the run in its working state with an open
  handoff. Resume retries the stage. The failed attempt is not counted as work.

## Workspace ownership

Every `run`, `resume` and `verify` holds an OS file lock (`.factory-local/locks/<run>.lock`) for the
whole operation. A second controller on the same run is refused with the holder's pid. The lock is
released by the OS if the process dies, so it cannot go stale.

## Known limits (read before relying on results)

- No live Claude run has been verified under the policy. Claude dispatch is refused until the owner
  makes the attestation above. Fake-CLI tests prove the paths; they do not prove the real CLI's
  quota messages. The classifier matches "usage limit", "rate limit", "quota", "limit reached",
  "too many requests" and HTTP 429 text, which should be checked against a real quota error.
- Codex and Gemini have no adapter and no verified billing route. Both are refused.
- `--max-turns` is not present in the installed Claude Code CLI (2.1.309). The adapter omits it.
- `pause` does not kill an in-flight provider call; the configured timeout bounds it.
- The CLI's `total_cost_usd` is a list-price estimate on the subscription route, not a bill. The USD
  ledger is therefore an estimate guard, not a billing record.
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
