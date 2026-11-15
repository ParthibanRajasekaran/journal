# Daily-use delivery review

## Consolidated decisions, 15 November 2026

This document is part of the Journal daily-use specification. `00-Review-and-Claude-Handoff.md` controls delivery order and reconciles the specialist drafts. All new capabilities are proposed; repository changes and deployment are not performed by this review.

The release sequence is M0 verified mobile baseline; M1 reliable offline diary, weights, repeated meals and protein history; M2 camera estimates; M3 actual workouts and recovery; M4 on-demand planning and protein support; M5 personal pilot. The full requested MVP includes M0-M5. A first usable logging beta is M0-M1. A seven-day functional pilot precedes a fourteen-day adoption review; these are not competing definitions. Timed targets: weight <=15 seconds, repeat meal <=20 seconds, text/photo estimate review <=60 seconds excluding provider/network wait. Targets are hypotheses to measure, not current performance claims.

Weight trend rule: retain every measurement; choose one explicitly nominated daily reading, otherwise the earliest local-day reading. Calculate the rolling seven-calendar-day mean of those daily representatives, display observation count, and require three different measured days before drawing a trend. Missing days are gaps. Preserve event timezone/local date across travel; changing display timezone does not silently reassign existing journal days. Corrections can explicitly move an entry.

Confirmed local pending meals count once in provisional totals. Unestimated drafts and unaccepted AI suggestions never contribute invented nutrition. For historical targets, record only what is known: do not backfill today's target as if it had always applied. Old days without a known target show no comparison.

Photo default: local draft until the user requests estimation with consent; sanitized upload expires after processing or a maximum 24-hour pending lifetime, with an operational cleanup test. Meal photo history is deferred in the first release; confirmed nutrition remains. The time is an application retention requirement, not a promise about the AI provider's own retention. Cloud storage backups must be accounted for in deletion documentation.

The initial offline implementation uses IndexedDB for structured records behind a transactional repository interface on web and Capacitor, plus native filesystem storage for media. Validate native process-kill durability in M1. Adopt native SQLite only if that measured spike fails, with a documented migration; do not build two storage engines speculatively. Offline access is restricted to a previously verified owner, cannot authorize network sync, and is unavailable after explicit logout until reauthentication. Do not claim biometrics or encrypted local journal storage without implementing and testing them.

External-assistant handoff, flexible gamification, body-progress photos and unrestricted chat are follow-on capabilities. They do not delay the full requested core loop. Manual logging and saved workout templates remain usable without AI. User API keys are the only automated AI funding source; no shared paid fallback. Provider benefits and credits must be checked for the actual account rather than inferred from a consumer subscription.


Reviewed 15 November 2026. Source: mvp/android at f03c385eb296b01a86951a9b54593dcd0cf1abf8. Perspective: second product owner, personal adoption and release readiness. This is a code/document review, not device or production verification.

## Verdict

The repository contains a useful meal-diary foundation, not yet the daily nutrition and training companion requested. A credible first delivery needs one complete daily loop on a real phone, with the backend available when the Mac is off. Do not make the factory, store publication, social features, wearables, gamification or an open-ended chatbot prerequisites.

## Evidence and highest-value gaps

- `web/src/App.tsx:14` defines Today, Add, Week and Settings only. Weight, exercise and recovery are new product areas.
- `web/src/App.tsx:25-35,87-95` requires session restoration and a server profile before showing the app. An offline outbox does not provide offline cold start.
- `backend/app/routes/estimates.py:32-37` accepts text, an optional provider and clarification answers, but no image. `backend/app/routes/estimates.py:83-86` chooses the first saved provider when the caller supplies none. Explicit user choice is needed for predictable billing.
- `web/src/screens/Today.tsx:232-257` already exposes calorie and protein totals against user targets. Keep that work.
- `web/src/screens/Settings.tsx:44-95` permits manual targets. Preserve unset targets instead of inventing a calorie prescription.
- `docs/mvp/android-beta-setup.md` describes a loopback-only backend and synthetic server journeys. Its artifact and branch references are older than the reviewed head. Its own device-journey section says real sign-in and subsequent phone journeys remain undemonstrated.

## Smallest complete daily product

1. Release foundation: finish real Google sign-in on Android, verify expiry/restore/logout, and provide an isolated HTTPS beta backend with persistent data, a tested backup restore and a recorded deployed SHA. Use a separately authorized environment on existing infrastructure if suitable; do not silently reuse production databases or assume hosting is permanently free. A USB-forwarded backend is for development, not daily use.
2. Reliable daily capture: offline cold start for an already authenticated owner, local drafts and pending records, retained stable operation IDs, conflict handling, clear sync state. New users still authenticate online. Logging must not depend on an AI response.
3. Weight plus meals: dated manual weight and recent trend; text, camera/gallery and manual meal capture; editable portion assumptions and approximate calorie/protein estimates; repeat meals. Missing nutrition remains unknown, never zero. User confirmation is mandatory before estimates affect confirmed totals.
4. Training loop: location/equipment/time selection, a saved reusable workout, set-by-set weight/reps and optional RIR, completion/partial completion, and an explicit rest/recovery day. Plan is separate from completion. On-demand AI may adapt the saved plan from recent actual sessions and the user's recovery check-in; a deterministic template remains usable without AI.
5. Weekly reflection: weight measurements, logged meals/protein, completed sessions and explicit rest days, with incomplete logging stated. Rest is not a broken streak, and low calorie intake is not an achievement.

Deliver the first usable loop before polishing broad conversational coaching. User's office versus Braunstone equipment and short versus long available sessions should be simple editable profiles, not hard-coded personal behaviour. Paneer, dosa, mixed dishes and shakes should be included in the estimation evaluation set.

## Own-AI economics

The user's account supplies the selected provider key. No developer-funded fallback. Make manual mode first-class; display the provider before a request; retain corrections without asking the model again; bound request size, retries and daily usage. Stop when the configured allowance is reached. A generic app switch cannot guarantee external API billing is disabled: show verified versus user-declared billing state and link provider controls. Do not promise consumer chat subscriptions are transferable API quotas. A later copy/paste context export can help users consult an assistant they already use without an automatic API request, but it is not required to ship the first logging loop.

## Seven-day personal pilot

Precondition: exact APK/source SHA, matching beta backend migration/deployed SHA, working real account, HTTPS access away from development machine, and no production writes. Use the user's normal food and gym choices; do not prescribe a new exercise or dietary regime just to test the app.

| Day | User journey | Acceptance evidence |
|---|---|---|
| 1 | Sign in on real Android over mobile data; record morning weight and text breakfast; set optional protein goal | Saved records survive force-close/reopen, correct owner and local date, confirmed estimate distinguishable from manual values |
| 2 | Photograph a real mixed meal; correct portion/oil assumption; log a saved repeat meal | Permission denial has gallery/manual alternatives; corrected totals match items; provider and approximate nature visible |
| 3 | Log an actual scheduled workout, or use a labelled test session if this is a rest day | Available equipment/time reflected; sets persist after interruption; only completed/partial sessions count as performed |
| 4 | Record recovery/rest and request the next workout | Explicit rest day persists; suggestion cites recent sessions/check-in; user edits or rejects it without altering past data |
| 5 | Cold-start in airplane mode, capture meal/weight/workout changes, reconnect | Pending status clear; entries survive restart; no duplicates; server totals converge exactly once; pending images handled explicitly |
| 6 | Exercise logout/account switching using disposable test accounts, and simulate exhausted AI allowance | No former-account data visible or replayed; manual capture still works; no silent provider or paid fallback |
| 7 | Review week, correct a backdated meal and weight, compare records with notes | Weight points and dates correct; protein aggregate recalculates; missing days labelled; no unexplained data loss or duplicate entries |

Delete-account testing uses disposable test data, never the user's real week without explicit consent. iOS follows the same matrix after simulator and real sign-in checks, with physical signing handled separately.

## Pilot exit and evidence

A seven-day pilot passes when every recorded entry remains recoverable, the selected critical journeys pass, and the user can log normal meals and a weight without assistance after setup. Proposed usability targets to validate: repeat meal within 20 seconds, weight within 15 seconds, text/photo review within 60 seconds excluding provider/network latency. Track assistance needed, failed saves, estimate correction effort, duplicate count and data-loss count, rather than test-suite size. These are acceptance targets, not measured results.

## Scope discipline

Block release for cross-account access, lost confirmed records, duplicate counting, real sign-in failure, inaccessible backend, or unusable core capture. Record cosmetic defects and optional coaching limitations. Do not repeatedly redesign policy enforcement to satisfy a personal-beta checklist. Security-sensitive changes still receive focused review, but review evidence and the factory's status can be recorded separately.

## Shared state contract

Unestimated meals are persisted and synchronized as meal drafts, separate from confirmed numeric meals; never use zero as unknown nutrition. Converting a draft to a meal is idempotent. Days are explicitly unknown, partial or complete; nutrition averages use days marked complete with all food nutrition confirmed and display the sample count. Actual workout sessions have active, completed, partial, abandoned and skipped states, separate from plans. Active sessions and completed sets survive process termination. See the architecture document for the exact lifecycle contract.
