# Response to the independent review of checkpoint 7260e95

Reviewed commits: bootstrap `7260e95`, web-only candidate `40508e2`, base `b5f296f`.
This response covers the commits after `7260e95`. It does not claim an independent review, and it does not
claim production or native readiness. Rerun review after any change to a candidate.

| Finding | Response | Commits | Evidence |
|---|---|---|---|
| R1 (high). Destructive outbox writes after failed quarantine | Fixed. Reads report whether the stored outbox is safe to rewrite. Every mutation and every send refuses while unsafe. | `e336ee0` | Reproduced on the previous code (4 failures: enqueue, retry/discard, send, invalid JSON). Now 5 new tests pass. |
| R2 (high). Same-tab owner state does not bind requests to the server account | Fixed with a server-side check. The server decides, against the authenticated session, whether the write's expected account matches. A mismatch returns 409 and saves nothing. The client names the owner on every create, and a refusal pauses the queue. | `22dc519` | Reproduced: the cross-tab write returned 201 and saved under B. Now 7 backend tests pass (matching, other account, cross-tab, logout, deletion, malformed, no header). The full suite is 256 tests, with ruff, format and mypy clean. Web: 71 tests pass. |
| R3 (high). Standalone verify lacks post-gate mutation checks | Fixed. One guard (`factory/evidence.py`) is used by the normal run and by standalone verify. It checks identity and cleanliness before and after gates. | `ef13d1c` | Reproduced: standalone verify returned passed true after a gate rewrote the candidate. Now 2 regression tests cover it. A mutation that removes the comparison fails. The guard is not process containment, and the module says so. |
| R4 (policy). Alignment is not enforcement; pending exceptions must not authorize | Enforced in code. Admission refuses a ticket outside the policy unless an owner approval with status `approved` and a named approver is recorded at the base commit. The approvals file is always protected, so a change set cannot approve itself. Change sets are judged by the same rule. `policy-check` gives CI a command. Option A is prepared as a proposal, not applied. | `848c87f`, `29eb38f` | 81 factory tests pass. The enforcement tests cover pending refusal, approved admission, base-commit trust and self-approval refusal. OPA: option A tests pass, 9/9. A Python-versus-OPA check agrees on 16 paths. On the real repository, `policy-check` refuses the outbox candidate with 10 violations, which is correct until an owner approves. CI wiring is a proposal in `docs/factory/proposals/ci-policy-check.md`. |
| R5 (native). Native proposal is unvalidated, and some platform assumptions were wrong | Revision 3. The Browser plugin's iOS mechanism is SFSafariViewController, which cannot return a redirect, so the browser design is withdrawn. The design now uses the platform SDK via a pinned plugin. Exact client configuration is documented. The ADR-004 deviations are listed as an owner amendment. No OAuth client was created, and no native code was written. | `docs/native-auth-proposal.md`, `docs/factory/proposals/adr-004-amendment.md` | Sources are listed in the proposal. The iOS `aud` behaviour and the replay rule are still to be proven in a spike. |

## Follow-up round

| Finding | Response | Evidence |
|---|---|---|
| The nonce downgrade rested on a wrong claim | Corrected. The pinned plugin 8.7.5 does expose `GoogleLoginOptions.nonce` (type definitions; Android `setNonce`; iOS passes it to Google Sign-In, and a nonce login always signs in). The native design now issues a single-use, server-bound nonce, and the backend requires the ID token's nonce to match it, consumed atomically. One-time ID-token use stays as a second check. The ADR-004 amendment no longer lists a nonce deviation. The spike must prove it. | Read from the pinned package. Nothing implemented yet. |
| The proposed CI check could judge itself | Fixed in the CLI and the proposal. `policy-check` takes `--repo` for the pull request, runs before any working-directory configuration loads, and reads the pull request's git data only. The proposed job runs the checker from a trusted base checkout. Regression: a candidate that replaces the checker with a permissive one is rejected by the trusted checker, and the same candidate passes when it judges itself, which shows the hazard. Branch protection and CODEOWNERS are stated as required owner settings. | `factory/tests/test_policy_check_trust.py`, both tests pass. |

## Still open

- No independent review has been performed on any new candidate.
- R2 is a backend contract change, and the production deployment does not yet run it. Deployment is not authorised.
- Option A is not in force. The outbox ticket remains refused at admission until an owner approval is recorded.
- The `ios/` shell has not been moved under `web/`, so no iOS build has been run from this branch.
- Live AI probes remain disabled. No owner attestation exists.
