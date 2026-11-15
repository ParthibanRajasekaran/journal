# Staff engineering review and delivery design

## Consolidated decisions, 15 November 2026

This document is part of the Journal daily-use specification. `00-Review-and-Claude-Handoff.md` controls delivery order and reconciles the specialist drafts. All new capabilities are proposed; repository changes and deployment are not performed by this review.

The release sequence is M0 verified mobile baseline; M1 reliable offline diary, weights, repeated meals and protein history; M2 camera estimates; M3 actual workouts and recovery; M4 on-demand planning and protein support; M5 personal pilot. The full requested MVP includes M0-M5. A first usable logging beta is M0-M1. A seven-day functional pilot precedes a fourteen-day adoption review; these are not competing definitions. Timed targets: weight <=15 seconds, repeat meal <=20 seconds, text/photo estimate review <=60 seconds excluding provider/network wait. Targets are hypotheses to measure, not current performance claims.

Weight trend rule: retain every measurement; choose one explicitly nominated daily reading, otherwise the earliest local-day reading. Calculate the rolling seven-calendar-day mean of those daily representatives, display observation count, and require three different measured days before drawing a trend. Missing days are gaps. Preserve event timezone/local date across travel; changing display timezone does not silently reassign existing journal days. Corrections can explicitly move an entry.

Confirmed local pending meals count once in provisional totals. Unestimated drafts and unaccepted AI suggestions never contribute invented nutrition. For historical targets, record only what is known: do not backfill today's target as if it had always applied. Old days without a known target show no comparison.

Photo default: local draft until the user requests estimation with consent; sanitized upload expires after processing or a maximum 24-hour pending lifetime, with an operational cleanup test. Meal photo history is deferred in the first release; confirmed nutrition remains. The time is an application retention requirement, not a promise about the AI provider's own retention. Cloud storage backups must be accounted for in deletion documentation.

The initial offline implementation uses IndexedDB for structured records behind a transactional repository interface on web and Capacitor, plus native filesystem storage for media. Validate native process-kill durability in M1. Adopt native SQLite only if that measured spike fails, with a documented migration; do not build two storage engines speculatively. Offline access is restricted to a previously verified owner, cannot authorize network sync, and is unavailable after explicit logout until reauthentication. Do not claim biometrics or encrypted local journal storage without implementing and testing them.

External-assistant handoff, flexible gamification, body-progress photos and unrestricted chat are follow-on capabilities. They do not delay the full requested core loop. Manual logging and saved workout templates remain usable without AI. User API keys are the only automated AI funding source; no shared paid fallback. Provider benefits and credits must be checked for the actual account rather than inferred from a consumer subscription.


Reviewed 15 November 2026. Source snapshot: `mvp/android` at `f03c385eb296b01a86951a9b54593dcd0cf1abf8`; comparison: `origin/main` at `6af6acc0595bcc69340a8d7180bc2eeb29436f9e`. This is source inspection, not a fresh demonstration of real Google, AI, phone or production journeys. No repository source files were changed and no deployment was attempted. The lead reviewer independently passed the web typecheck, 129 tests and build on this SHA; the backend and device suites were not rerun.

## Engineering verdict

The useful foundation is a meal journal with a real API and an unmerged native integration. The requested daily fitness companion is not yet implemented. Preserve the account isolation, idempotent meal writes, review-before-save estimates and native session work. Build new weight, training and recovery domains incrementally. Do not restart the app in another framework, activate the factory, or merge the accumulated native-spike branch wholesale.

The repo contains two clients. `web/` is the canonical current client, confirmed by `web/capacitor.config.ts:7` and `web/package.json`. Root `src/`, `server.ts` and root `package.json` are an older React/Express prototype with unrelated features. README still directs developers to the root client and advertises biometric authentication and PWA behavior (`README.md:3-14`, `:23-80`), so repository appearance overstates current canonical capability.

## Implemented versus missing

| Capability | Evidence at this SHA | Verdict |
|---|---|---|
| Meal CRUD, kcal/protein/carbs/fat | `backend/app/db/models.py:72-101`, `backend/app/routes/meals.py`; UI `web/src/screens/AddMeal.tsx` and `EditMeal.tsx` | Keep |
| AI text estimate with up to two questions | `backend/app/routes/estimates.py:33-38,71-125`; `backend/app/ai/estimate.py:100-158` validates totals and macro consistency | Implemented in code; real-provider quality still needs measured evidence |
| BYOK | `backend/app/routes/ai_keys.py`, `backend/app/crypto.py:34-49`, `db/models.py:125-140` | Encrypted on server with owner/provider associated data; not device-only key custody |
| Preferred provider | UI `web/src/api.ts:234-235` sends no provider; backend `routes/estimates.py:79-80` chooses first saved key in OpenAI/Anthropic/Gemini order | Build explicit persisted preference and visible choice |
| Photo/camera meal estimate | Estimate request only has text, provider, answers; Meal has nullable `photo_id` but no photo table or upload route | Missing; a photo_id field is not photo support |
| Daily/weekly protein and calorie sums | `routes/days.py:24-36,62-118`; `Settings.tsx:43-68` manual targets | Keep; add completeness and estimated/confirmed states |
| Weight records and trends | No weight table or route; canonical App screen union `App.tsx:14-15` has today/add/week/settings | Missing |
| Workout plans, sets, workout/rest calendar | No domain models/routes/screens | Missing |
| Recovery check-in and feedback | No domain models/routes/screens | Missing |
| Offline creation | `offline.ts`, account guards and server unique `(user_id, client_id)` at `models.py:76`; create race handling `routes/meals.py:168-220` | Useful but narrower than full offline use |
| Offline cold launch | `App.tsx:25-35` always attempts restore and `/me`; `:87-95` renders error rather than cached journal | Core daily-use gap |
| Offline edits/deletes | API PATCH/DELETE are direct network requests (`api.ts:230-232`); Today deletion `Today.tsx:69-76` | Missing |
| Native sign-in/session transport | `routes/native_auth.py`, `native/auth.ts`, `native/platform.ts`, in-repo Google plugin | Present in unmerged integration; real Google device success not evidenced by this review |
| Production readiness | `docs/mvp/android-beta-setup.md` labels local personal test build; document refers to older SHA and APK | Needs HTTPS daily-use environment and artifact provenance |

## Architecture decisions

Keep a modular monolith: React/TypeScript + Capacitor for UI, FastAPI + PostgreSQL for authoritative records, Alembic for schema changes, existing native secure refresh-token store. Introduce small domain modules for nutrition, measurements, training, recovery and AI usage. No microservices, vector database, autonomous coach agents or generic workflow engine are required.

The AI proposes structured drafts. The application validates them and the user confirms before any durable change. AI must not issue SQL, choose account ownership, alter targets silently, or mark a workout complete. Calculations, local-day membership, totals, and retry semantics remain deterministic code.

Suggested boundaries:

- UI reads a local per-owner projection and writes local operations, then syncs to the server.
- API owns authorization, validation, versions, durable idempotency and authoritative totals.
- AI port has `estimate_meal(input)` and `draft_workout(context)` capabilities; adapters have capability metadata for vision/structured outputs.
- Context builder selects recent confirmed records and constraints. It does not send the entire lifetime journal or other accounts' data.
- Media port accepts owned sanitized bytes and returns an expiring media reference; transport must work with Capacitor native HTTP, including multipart uploads, on both platforms.

## Data model additions

Use additive migrations first; backfill and cut over before removing old fields. Every user-owned row has `user_id`, timestamps and appropriate cascading deletion. Every independently replayable create has `client_id` unique with owner. Every editable synced aggregate has `version`.

1. `weight_entries`: id, user_id, client_id, measured_at UTC, recorded local date and IANA zone, weight_kg decimal, optional note/context, version. Preserve multiple real readings in a day. Do not overwrite merely because dates match. Canonical kg with display conversion. Reject nonfinite values and require confirmation for implausible changes rather than silently clamping.
2. `meal_items`: meal_id, item order, name, quantity/value/unit, kcal/protein/carbs/fat, source and assumptions. Persist confirmed itemized estimates rather than losing item explanations when the total is saved. Existing aggregate-only meals remain readable. Persist `estimate_metadata` with provider/model/prompt version and user edits; do not require storage of raw prompts.
3. `meal_media`: id, owner, storage key, MIME, byte size, checksum, expires_at, status. Estimate-only media expires under the retention rule above; retained meal photo history is deferred. No public object URL. The current `photo_id` must become an ownership-checked relationship or be replaced through migration.
4. `training_profiles`: goals, experience, available days, time budget, units, equipment locations, restrictions the user chooses to provide. The user's office and Braunstone equipment lists become editable locations, not hardcoded global defaults.
5. `workout_plans` and `planned_exercises`: proposed/accepted/archived, context snapshot version, model provenance or template version, exercise IDs, planned sets/reps/load guidance/rest/substitutions. Keep accepted plans immutable by revision.
6. `workout_sessions`, `session_exercises`, `performed_sets`: planned-session link optional, started/completed timestamps, active/completed/partial/abandoned/skipped state, exercise snapshot, load and unit, repetitions, optional RIR and note. Distinguish total load, per-hand load, per-side load and machine setting. Do not infer comparable kilogram loads across machines.
7. `recovery_checkins`: local day, sleep duration optional, fatigue/soreness self-report, affected areas, pain/illness flag, user's intended activity, optional note. A missing check-in remains unknown, not a healthy/rest day.
8. `daily_targets` with effective dates and user-confirmed values. Existing User targets initialize an effective target at migration time only; earlier unknown targets remain unknown. Historical progress must not change when tomorrow's target changes.
9. `ai_preferences`, `provider_consents` and `ai_usage`: preferred provider/model, enabled flag, per-task limits, consent copy version, request id/status, estimated and provider-reported token/cost counts when available. No raw keys in telemetry. Existing encrypted AiKey remains until a deliberately chosen custody migration.

### Drafts, completeness and lifecycle contracts

Add `meal_drafts` separately from the existing non-null numeric Meal table: owner, client_id, original text, owned local/media reference, event date/zone, state (`unestimated`, `estimated_awaiting_confirmation`, `converted`, `discarded`), optional validated estimate payload, timestamps/version. Drafts sync as drafts and appear in the timeline, but do not enter nutrition aggregates. Confirmation transactionally creates the numeric Meal once and marks the draft converted, using a stable conversion operation id. A retry returns the same Meal. Do not populate missing macros with zero to satisfy current Meal constraints. Keep pending transport state separate from nutrition confirmation state.

Add `journal_days` keyed by owner/local date, with user-declared logging state (`unknown`, `partial`, `complete`). No AI inference marks a day complete. Nutrition-complete means user marked complete and no unestimated/unconfirmed food remains. Weekly nutrition means use only nutrition-complete days and display the denominator; total logged protein remains available for all days. Adding an unestimated draft invalidates nutrition completeness until resolved. Explicitly recording a complete day with no meals is distinguishable from never logging. This is a diary fact, not dietary advice.

Workout lifecycle is `active` -> `completed` or `partial` or `abandoned`; `skipped` applies to an intended session never performed. A plan is a separate entity. Persist individual set operations during active sessions, including warm-up/work set kind, actual reps/load convention and optional RIR. Completed sets remain recoverable when a session is abandoned. Reopening an active session restores the same session id; completion is idempotent.

Contract acceptance: sync an unestimated meal and reopen it without invented numeric values; confirm once after a lost response; render it once after conversion; mark a partial day then complete it and verify weekly denominator changes; add an unknown meal to that day and expose incompleteness; kill/reopen a workout midway and retain completed sets and original session id.

## API additions and contracts

Retain `/api/v1`; additive routes:

- GET/POST `/meal-drafts`, PATCH/DELETE `/meal-drafts/{id}`, POST `/meal-drafts/{id}/confirm`; GET/PUT `/journal-days/{date}`.
- GET/POST `/weights`, PATCH/DELETE `/weights/{id}`; date-range and cursor queries.
- POST `/media` and DELETE `/media/{id}`; estimate request accepts text and/or media_id with exactly scoped ownership. Validate actual decoded image format, strip EXIF, bound dimensions and bytes before provider calls.
- PATCH `/me/ai-preferences`; GET `/me/ai-usage`; consent creation/revocation endpoints.
- GET/PUT `/training-profile`; GET `/exercises` with equipment filters.
- POST `/workout-plan-drafts`, POST `/workout-plans` after acceptance; GET plans.
- GET/POST `/workout-sessions`; PATCH session and set records with versions.
- GET/POST `/recovery-checkins`; combined GET `/timeline?from=&to=&tz=` for confirmed events.

Use stable error codes such as `ACCOUNT_CHANGED`, `VERSION_CONFLICT`, `PROVIDER_QUOTA`, `BUDGET_EXHAUSTED`, `MEDIA_EXPIRED`. Do not expand exact-text coupling. Extend existing `If-Match` editing pattern. The expected-owner defense must cover queued mutations across new domains, not only meal POST.

For offline use, either domain endpoints or a small typed batch endpoint can dispatch operations; the implementation must not execute arbitrary client-described actions. Responses need operation id, resource id, accepted version and retry classification. Deletes need tombstones or equivalent durable operation history so a stale device cannot resurrect deleted records.

## Offline design and migration

Replace localStorage as the growing journal store with a transactional local repository abstraction. For the first implementation, choose IndexedDB behind the shared repository interface on web and native WebViews; verify native durability before considering a SQLite adapter, as resolved above. Native photos belong in the app filesystem, not base64 in localStorage. Do not ship two independent business logic implementations.

State model: local draft -> pending operation -> syncing -> synced, with separate blocked/conflict states. Persist the resource and its outbox entry atomically. Keep a stable operation id across ambiguous network outcomes. Reading or rendering never mutates storage. Derived totals merge local pending records with confirmed server records by stable identifiers and label pending totals.

At startup, restore the last verified owner and that owner's cache without requiring network. A cached profile is permission to show local data, not proof of current server authentication. Online sync is gated on a valid refreshed session and matching server account. Explicit logout locks or clears that owner's local view. Account switching never exposes the previous owner's cache. Token/key storage remains separate.

Migrate the existing named queues without renaming them away: read and validate, copy into the new store, verify checksum/count/owner/ids, record migration completion, then remove the source. Keep malformed/unowned legacy data quarantined. A failed migration retains the old data and a recoverable status. Test storage-full, interrupted copy, process kill and repeated startup. Include deletion obligations in the migration.

## AI reliability and cost

The current estimate endpoint requires the user's API key, which supports the owner's no-subsidy goal. It does not provide a hard monetary budget: a shared in-memory write limiter is the only broad request throttle (`limits.py:1-4`, `auth/deps.py:41-45`), and provider requests use 30-second timeouts (`ai/estimate.py:172-223`).

Add explicit user-selected provider and manual/no-AI mode, persisted consent before every eligible provider task, request concurrency/call caps, bounded output tokens and image dimensions, and a durable usage ledger. Reserve an app allowance atomically before dispatch. Release only known-unused reservations; ambiguous provider outcomes remain recorded. Show approximate monetary estimates as approximate; provider-side spend controls remain authoritative. Never silently switch providers or enable billing. Do not assume a consumer subscription funds API calls; verify any separately provisioned API credit benefit, and never promise free tiers remain available.

Keep manual text/numeric logging and deterministic workout templates usable with AI disabled. Photo estimates and model-generated personalization require an enabled, configured, supported provider. Future external-chat handoff can export a minimal prompt and import a validated draft but must not scrape signed-in chats or bypass quotas.

For meal quality, begin a consented set of representative weighed meals, labels and mixed dishes, including dosa/egg dosa, chapati/paneer, buffet plates, shakes and ambiguous portions. Report error against references and uncertainty, not an uncalibrated confidence percentage as accuracy. Require item sums to match totals, finite bounded numbers and review-before-save. For workouts, evaluate constraints, equipment compatibility, duration, available history, progression reason and pain/illness handling. No medical diagnosis or automatic load escalation.

## ADR reconciliation

All seven ADR documents are marked Proposed. They are design intentions, not proof of implemented controls.

- ADR-001: keep API/PostgreSQL direction; update actual natural-key and version semantics. Photo upload/storage, idempotency replay cache and batch sync are not implemented as described.
- ADR-002/007: retain portable deployment, document the actual manual Oracle setup and verified backup/restore. Do not promise zero operational cost or infer current deployment SHA from branch state.
- ADR-003: keep Capacitor; replace stale root-client references. Biometric binding and SQLite are not implemented in canonical client. Treat native secure storage and biometric unlock as separate capabilities.
- ADR-004: record the actual Google SDK/nonce attempt native flow and browser flow; real-device evidence remains an explicit release gate.
- ADR-005: retain thin provider boundary and no silent fallback. Reconcile actual chat-completions/text-only requests, static encryption key versus proposed envelope encryption, absent persistent preference, and missing photo capability. Avoid large automatic paid evaluation runs.
- ADR-006: runtime API has Python validation and SQL ownership, not OPA invocation. Document actual controls. Keep repository path policy separate from product request authorization; do not build runtime OPA merely to match a stale proposal.

## Ordered implementation slices

| Slice | Concrete result and main work | Exit evidence |
|---|---|---|
| 0. Establish one baseline | Reconcile mvp/android with current main in one reviewed integration; correct README/build guide; archive root prototype after reference checks; record commit, migrations and APK configuration. Finish real Android Google sign-in and equivalent iOS configuration. | One user creates/edits/reopens a meal, restores session, logs out, changes accounts; no token logging. Installable artifact and deployed test API report matching source versions. |
| 1. Daily meal reliability | Transactional local store/cache and migrations; offline cold start; queued edits/deletes; visible sync status; explicit AI provider; HTTPS test environment accessible away from laptop. | Airplane-mode cold launch, manual meal capture, process kill/reopen, reconnect and duplicate response all preserve exactly one owned record. Other account cannot see it. |
| 2. Weight and nutrition history | Weight schema/API/form/trend; date-effective targets; accurate local-day protein summaries and missing-day semantics; repeated meal templates with fresh IDs. | Log 76.6 kg on a chosen day, correct/delete/replay it; correct historical meal totals; changing target today leaves prior-day target history intact. DST and midnight tests pass. |
| 3. Camera estimation | Capture/gallery/permission flow, sanitized expiring media, multimodal adapter, itemized editable estimates, save-confirmation link, interrupted upload handling. | Real camera photo creates a reviewable approximate estimate; user corrects portion; saved item totals match; non-food/refusal/provider quota offers manual path; expiration and delete remove owned media. |
| 4. Training log and recovery | Exercise/equipment catalog and profiles; manual/templated sessions, sets, RIR, workout calendar, recovery check-ins. | Log a full office session offline, resume after restart, mark partial/rest explicitly; history accurately distinguishes planned, completed, skipped and unknown days. |
| 5. On-demand workout assistant | Context builder, deterministic candidate templates, optional AI draft, constraint validator, confirmation and revision. Protein suggestions use remaining user target and preferences. | Request a 30-minute office workout after a recent session; plan fits equipment/time, cites relevant history, respects exclusions, and can be edited/accepted. AI-off mode still gives an editable template. |
| 6. Personal daily beta | Install/update both platforms; backup/restore, export, account deletion across new domains, privacy copy, concise runbook and staged release. | Seven consecutive real-use days covering meals/photos/weights/workouts/rest and one offline interruption; no unresolved data-loss/account-isolation failures. Physical iOS evidence recorded separately from simulator. |

These are dependency-ordered deliverables, not calendar promises. Weight schema work and exercise catalog/design can proceed while device sign-in is being completed. Avoid making every new slice wait for the full factory. A small reviewed PR per vertical slice is preferable to another accumulated branch.

## Meaningful tests and release gates

Reuse existing web/native unit tests and PostgreSQL concurrency tests. Add contract tests for new routes and real interaction tests for core UI. Highest-value scenarios: two accounts switching during sync; same-id concurrent retries; stale edit after deletion; offline cold start; media copy interrupted before commit; malformed model output; provider failure after request acceptance; timezone/DST boundaries; kg/lb and per-hand load handling; zero logged meals versus zero intake; logout and deletion with queued records.

Use one Playwright browser journey per critical loop plus physical Android and iOS smoke evidence for native bridge, camera, secure storage and lifecycle. Keep mock and real provider results labeled. Store reproducible artifact source SHA, API version and migrations in release records. Native release builds must reject local HTTP configuration and test credentials. Operational acceptance includes a successful backup restore, not merely a backup script.

## Keep, retire, defer

Keep the canonical web client, FastAPI backend, ownership checks, stable-id outbox behaviors, validated estimate confirmation, timezone logic, accessibility work, tests and useful observability.

Retire the root prototype from active build instructions and packaging after checking it owns no user data that requires migration. Remove stale biometric/PWA/photo feature claims, fake or unsupported health claims, dead docs links and hardcoded provider priority. Do not erase historical branches to clean the presentation.

Defer factory activation/features, complex gamification, public social feeds, wearable integrations, automatic body-photo analysis, autonomous diet changes and store publication until the daily personal loop works. Lightweight optional encouragement can remain if it never rewards restriction or penalizes recovery days.
