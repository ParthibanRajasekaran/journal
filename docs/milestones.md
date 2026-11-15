# Milestones: daily-use MVP

Active milestone: the `active` field in `scripts/agent/scope.json` (changed only by `scripts/agent/advance.py`).
Specification: `docs/spec/` (00 controls scope). Each milestone lists ordered tasks, exit criteria tagged `auto`
(checked by `scripts/agent/milestone-check.py`) or `manual` (owner records evidence, then ticks), an evidence log,
parked items and owner actions. Evidence kinds: mocked test, real-provider run, emulator, physical device.

## M0: Mobile baseline

Goal: real Google sign-in on a physical Android phone against an isolated HTTPS beta backend that works with the Mac off,
with reproducible artifacts and provenance.

Scope: native sign-in client, App boot and Settings, Capacitor and Android/iOS projects, build scripts, backend app
factory, config, health/auth/native-auth routes, Docker and ops, ADRs, release docs.

### Tasks
- [x] 1. `GET /api/v1/version` returning `{api_version, source_sha, migration_head, environment}`; `source_sha` from
  `JOURNAL_SOURCE_SHA` (build arg in `docker/Dockerfile.api`). Add to `docs/openapi.yaml`. Test `@pytest.mark.m0`.
- [x] 2. Migrations in deployment: compose one-shot `migrate` service (`alembic upgrade head`) that `api` depends on.
  `make migrate` exists already; test that the compose file parses with `docker compose config`.
- [x] 3. Release-configuration guards: `web/vite.config.ts` fails `--mode beta|production` when `VITE_API_BASE` is not
  `https://`; `web/scripts/build-android.sh <beta|emulator>` sets `VITE_API_BASE` and `VITE_BUILD_SHA`, refuses
  `JOURNAL_ANDROID_TEST_CLEARTEXT` outside `emulator`, runs `vite build`, `cap sync android`, `gradlew assembleDebug`,
  prints APK SHA-256 and source SHA. Backend: production refuses `cookie_secure=false` and a missing `jwt_secret` at
  startup (Settings validation, test).
- [x] 4. Settings screen shows the app build SHA (`VITE_BUILD_SHA`) and the server `/version` output.
- [x] 5. Beta stack proposal, not activated: `docker/beta/compose.yaml` (project `journal-beta`: `api`, `migrate`,
  `postgres`, own volume, `env_file: .env.beta` never committed) and a Caddy site block for
  `beta.journal.getrendercheck.com` proxying to the beta API on a shared external network. `docs/release/beta-backend.md`:
  deploy, rollback (previous image; restore from backup rather than downgrade), backup/restore test with `ops/backup.sh`
  parameterised by database, DNS record, memory note about stopping the old observability stack.
- [ ] 6. `docs/release/google-oauth.md`: owner checklist for the Android client (package `com.journal.nutrition`, debug
  keystore SHA-1), the web client id (token audience) and the iOS client id; declare `VITE_GOOGLE_WEB_CLIENT_ID` and
  `VITE_GOOGLE_IOS_CLIENT_ID` in `web/src/vite-env.d.ts`.
- [ ] 7. ADR reconciliation (status and notes blocks only) per `docs/spec/03` "ADR reconciliation": ADR-001 natural keys
  and versions, no replay cache or batch sync yet; ADR-002/007 manual build-on-server deploy, backup restore evidence;
  ADR-003 done in Phase 0; ADR-004 actual native flow, real-device evidence as release gate; ADR-005 chat-completions
  text-only, static key encryption, explicit preference pending M1; ADR-006 done in Phase 0.
- [ ] 8. Move `docs/mvp/android-beta-setup.md` to `docs/release/android.md`, rewritten with the current procedure and a
  provenance table (APK SHA-256, source SHA, `/version` output, date).

### Exit criteria
- [ ] auto: `pytest -m m0` passes (version endpoint, production startup guards).
- [ ] auto: `cd web && npx vite build --mode beta` with `VITE_API_BASE=http://x` fails; with `https://` it succeeds.
- [ ] auto: `make gate-full` green.
- [ ] manual: physical Android phone over mobile data with the Mac disconnected: Google sign-in, create, edit and reopen
  a meal, cold restart restores the session, logout, account switch to a disposable account sees nothing. APK SHA-256 and
  `/version` output recorded in `docs/release/android.md`.
- [ ] manual: iOS simulator build compiles and links the Google plugin (needs Xcode).

### Evidence log
| Date | Source SHA | Artifact | Kind | Result |
|---|---|---|---|---|
| 2026-11-15 | (this commit) | M0 task 1: `GET /api/v1/version` | mocked test | `backend/tests/test_version.py` (m0) and `make gate` pass; `/version` added to the public-route allowlist |
| 2026-11-15 | (this commit) | M0 task 2: compose `migrate` one-shot, `api` depends on `service_completed_successfully` | mocked test | `backend/tests/test_compose.py` (m0) runs `docker compose config`; containers not started |
| 2026-11-15 | 9435ad4 (tree dirty) | M0 task 3: production Settings guards; `vite build --mode beta\|production` HTTPS guard; `web/scripts/build-android.sh` | mocked test + local build | `backend/tests/test_production_settings.py` (m0). `VITE_API_BASE=http://x` and unset fail, `https://x` builds. `build-android.sh beta` with JDK 21 built an unsigned debug APK, SHA-256 `b8a9e76b...2d7a`; not installed on any device |
| 2026-11-15 | f3f0970 (tree dirty) | M0 task 4: Settings "About this build" (app `VITE_BUILD_SHA`, server `/version`) | mocked test | `web/src/screens/Settings.build-info.test.ts` and `make gate` pass; not seen on a device |
| 2026-11-15 | 0429afb (tree dirty) | M0 task 5: beta stack proposal (`docker/beta/*`), `docs/release/beta-backend.md`, `ops/backup.sh` parameterised | mocked test | `backend/tests/test_beta_stack.py` (m0) checks isolation and `docker compose config` parsing. Not activated, no container started, restore never run, Caddy block not validated by Caddy |

### Parked

### Owner actions needed
- Create Google OAuth clients (Android, web audience, iOS); provide a disposable second Google account.
- Approve beta-stack activation on the Oracle VM and the `beta.` DNS record.
- Install Xcode; connect an Android phone with USB debugging (`adb`).

## M1: Everyday logging

Goal: a previously signed-in user opens the app offline, logs meals and weights, repeats meals without AI, and sees honest
daily protein and calories; records sync exactly once.

Scope: all of `web/src`, backend app and migrations. Rule `no-raw-localstorage`: browser storage only inside
`web/src/storage/`.

### Tasks
- [ ] 1. Error codes in `backend/app/errors.py`: `ACCOUNT_CHANGED`, `VERSION_CONFLICT`, `PROVIDER_REQUIRED`,
  `PROVIDER_QUOTA`, `BUDGET_EXHAUSTED`, `MEDIA_EXPIRED`, `GONE` as problem-type suffixes; map existing 409/412 paths.
- [ ] 2. `weight_entries` (owner, `client_id`, `measured_at` UTC, `local_date`, `tz`, `weight_kg` Numeric(5,2),
  `unit_entered`, `context`, `note`, `is_daily_representative`, `version`, `deleted_at`). `GET/POST /weights?from&to`,
  `PATCH/DELETE /weights/{id}` with `If-Match`. Reject nonfinite and out-of-range; >5 kg jump needs `confirm: true`.
- [ ] 3. `daily_targets` (effective_from local date, calories, protein_g, confirmed); migration seeds one row from
  `users.target_*` dated the migration day. `GET/PUT /daily-targets`. `/days` and `/week` use the target effective on
  that day; earlier days have none.
- [ ] 4. `meal_drafts` (owner, `client_id`, text, event local date and tz, state
  `unestimated|estimated_awaiting_confirmation|converted|discarded`, estimate JSON, `converted_meal_id`, `version`).
  `GET/POST /meal-drafts`, `PATCH/DELETE /meal-drafts/{id}`, `POST /meal-drafts/{id}/confirm` creating the Meal once
  under a stable conversion id (retry returns the same meal). Drafts never enter totals.
- [ ] 5. `journal_days` (owner, local_date, `logging_state unknown|partial|complete`, note). `GET/PUT /journal-days/{date}`.
  `/days` and `/week` return `logging_state`, `nutrition_complete`, `pending_drafts`, and averages over
  nutrition-complete days with the denominator.
- [ ] 6. `meal_items` and `estimate_metadata` (provider, model, prompt version, user_edited) on meals; `POST /meals`
  accepts optional `items`; aggregate-only meals stay readable.
- [ ] 7. `meal_templates` (owner, name, per-serving items/macros, version), CRUD under `/meal-templates`. Repeating is a
  normal `POST /meals` with a fresh `client_id`; no AI call.
- [ ] 8. `ai_preferences` (preferred_provider, ai_enabled); `PATCH /me/ai-preferences`. `POST /estimates` requires a
  provider or stored preference, else 400 `PROVIDER_REQUIRED`; delete the first-saved-key fallback.
- [ ] 9. Soft delete with tombstones: `deleted_at` on meals and weights; `PATCH` on a deleted row returns 410 `GONE`;
  `GET /meals?since=` and `/weights?since=` include tombstones.
- [ ] 10. Expected-account header enforced on every mutating route through a shared dependency.
- [ ] 11. `web/src/storage/`: `Repository` interface and IndexedDB implementation (`idb`). Stores `meals`, `weights`,
  `drafts`, `journalDays`, `templates`, `outbox`, `meta`. Record and outbox operation commit in one transaction. Tests
  with `fake-indexeddb`.
- [ ] 12. Migrate `journal.outbox.v2` and `journal.quarantine.v1` from localStorage into IndexedDB: read, validate,
  copy, verify count and ids, record completion, then remove. Tests: interrupted copy, repeated startup, storage full.
- [ ] 13. Sync engine `web/src/sync.ts`: create/update/delete per entity, stable op ids, `Idempotency-Key`, `If-Match`,
  expected-account header, retry/pause/block/conflict classes; conflicts become `needs attention`. Retire `offline.ts`
  while keeping its tested behaviours.
- [ ] 14. Offline cold start in `App.tsx`: network failure with a cached last-verified owner renders the diary in
  "offline, verified on <date>" mode with capture allowed; sync gated on a valid session; logout locks the cache;
  401 still goes to SignIn.
- [ ] 15. Navigation: Today, Food, Training (placeholder until M3), Progress; Settings behind a labeled profile button;
  `viewport-fit=cover`, `env(safe-area-inset-bottom)`, 48 px targets.
- [ ] 16. Today: DateHeader with sync badge, NutritionSummary (protein and calories, completeness and pending labels),
  quick actions (Add meal, Log weight, Start workout disabled), meals including drafts, latest weight with its date.
- [ ] 17. WeightEntrySheet: value, kg/lb (canonical kg), date and time, context, note; undo; list with edit and delete;
  nominate the daily representative; no prefilled previous value.
- [ ] 18. Progress: readings and seven-day rolling mean over measured days (three distinct days required, else "More
  readings needed"), table alternative; protein by day with completeness.
- [ ] 19. Food: history by date, templates (save confirmed meal, repeat with serving scale, new id and time), meal detail
  with source (manual, label, AI estimate, edited estimate) and assumptions.
- [ ] 20. Add meal: Describe or Manual; "Save for later" makes a draft; provider shown before dispatch; top assumption
  under totals; item-level editing recalculates; re-estimate keeps the old result until accepted.
- [ ] 21. Settings: explicit provider and AI on/off, key-custody disclosure (docs/spec/01 "AI ownership and cost"),
  effective-dated targets.
- [ ] 22. Journey tests `[M1]`: offline cold start; create offline, reload, reconnect, record appears once; duplicate
  response; account switch isolation; DST and midnight boundaries; kg/lb round trip; template scaling.

### Exit criteria
- [ ] auto: `pytest -m m1` passes.
- [ ] auto: `vitest -t "[M1]"` passes.
- [ ] auto: contract drift test green with every new route in `docs/openapi.yaml`; `make gate-full` green.
- [ ] manual: on the phone, airplane-mode cold launch shows the cached diary; log a meal and a weight; kill and reopen;
  reconnect; exactly one of each on the server; the second account sees nothing. Recorded with APK and API versions.

### Evidence log
| Date | Source SHA | Artifact | Kind | Result |
|---|---|---|---|---|

### Parked

### Owner actions needed

## M2: Camera estimates

Goal: photograph or pick a meal image, get an editable approximate estimate from the owner's chosen provider with consent
and limits, and never lose the draft.

### Tasks
- [ ] 1. Owner decision: the single vision provider to prove first. Other adapters stay `supports_vision=false` and the
  UI hides camera estimation for them.
- [ ] 2. `meal_media` (owner, storage key, mime, bytes, checksum, expires_at, status). `POST /media` (multipart; decode
  with Pillow, verify format, strip EXIF, bound 2048 px and 4 MB, non-public storage), `DELETE /media/{id}`. Expiry after
  processing or 24 h; cleanup job `backend/scripts/cleanup_media.py` with a test that expired media is removed.
- [ ] 3. `POST /estimates` accepts `media_id` and/or `text`; ownership check; `MEDIA_EXPIRED`; vision call with bounded
  output tokens; validator reuses `parse_reply` plus item assumptions.
- [ ] 4. `provider_consents` (provider, payload category `meal_text|meal_image|fitness_context`, copy version, granted,
  revoked) and `ai_usage` (request id, task, provider, model, status, tokens, estimated cost). Reserve before dispatch,
  release only known-unused, `BUDGET_EXHAUSTED` at the user's daily cap. `GET /me/ai-usage`. No key material in logs.
- [ ] 5. Web: `@capacitor/camera` and `@capacitor/filesystem`; first-use explanation before permission; camera and
  library separately; denial falls back to library/text; resize, orientation and metadata strip on device; draft file
  survives restart; consent dialog naming provider and category, remembered; retake/remove; interrupted upload keeps the
  draft; non-food refusal offers Describe or Manual; drafts deleted after confirmed save; abandoned drafts deletable.
- [ ] 6. Authorized real-provider eval on the 20-meal set (`backend/scripts/eval_provider.py`); report in `docs/evals/`;
  add three consented real photos as fixtures.
- [ ] 7. Journey tests `[M2]` with a stubbed provider and mocked Capacitor plugins.

### Exit criteria
- [ ] auto: `pytest -m m2` passes (media validation, EXIF stripping, expiry cleanup, consent gating, reservation, ownership).
- [ ] auto: `vitest -t "[M2]"` passes.
- [ ] manual: a real mixed-meal photo on the phone reaches review; a portion is corrected; saved totals match items;
  permission denial, expiry and quota paths keep the input; the real-provider eval report is recorded.

### Evidence log
| Date | Source SHA | Artifact | Kind | Result |
|---|---|---|---|---|

### Parked

### Owner actions needed
- Choose the vision provider and authorize one eval run with your key.

## M3: Training and recovery

Goal: log actual sessions set by set, offline, with equipment profiles and explicit rest and recovery, before any plan
generation.

### Tasks
- [ ] 1. Exercise catalog `backend/data/exercises.json` (about 60 entries: id, name, movement pattern, equipment tags,
  default load convention); `GET /exercises?equipment=`; test ids unique and conventions valid.
- [ ] 2. `training_profiles` and `equipment_locations` (name, equipment tags, usual minutes); `GET/PUT /training-profile`.
  Nothing seeded from the owner's profile.
- [ ] 3. `workout_templates`, `workout_sessions` (`active|completed|partial|abandoned|skipped`, started, ended, location,
  optional plan link), `session_exercises`, `performed_sets` (warmup/work, reps, load value, convention
  `total|per_side|per_hand|machine_setting`, unit, optional RIR, note). Set-level `PATCH` with versions; completion
  idempotent; reopening returns the same active session id.
- [ ] 4. `recovery_checkins` (local date, energy, soreness, areas, pain/illness flag, optional sleep, intended activity,
  note). Missing check-in is unknown.
- [ ] 5. `GET /timeline?from&to&tz` with per-day states: completed, partial, explicit rest, light activity, unlogged.
- [ ] 6. Web: Training tab with Plan, Active session (previous performance, large controls, one-tap set done,
  warmup/skip/substitute, autosave after every set, SessionResumeBanner), History; finish flow (completed, partial,
  abandoned; effort; recovery note); ReadinessCheckIn; Progress calendar with text labels; pain or illness suppresses
  progression hints.
- [ ] 7. Journey tests `[M3]`: offline session, reload mid-session keeps id and sets, finish as partial; blank day is
  not rest; planned is not completed.

### Exit criteria
- [ ] auto: `pytest -m m3` passes.
- [ ] auto: `vitest -t "[M3]"` passes.
- [ ] manual: a real office session on the phone, interrupted and resumed; a rest day recorded; calendar states correct.

### Evidence log
| Date | Source SHA | Artifact | Kind | Result |
|---|---|---|---|---|

### Parked

### Owner actions needed

## M4: Personal assistance

Goal: on-demand workout and protein suggestions grounded in actual history, with a working AI-off template path.

### Tasks
- [ ] 1. Context builder `backend/app/training/context.py`: recent N completed sessions, profile, today's check-in, time
  and location. Bounded; never other owners. Test the bound.
- [ ] 2. Deterministic candidates `backend/app/training/templates.py` from saved templates and the catalog (AI-off path).
- [ ] 3. AI port `draft_workout(context)` with strict validation (known exercise ids, duration fits, no load above last
  actual under pain/illness, no owner ids, finite numbers); reject to the deterministic candidate with an explanation.
  `POST /workout-plan-drafts` (versioned), `POST /workout-plans` on acceptance (immutable revisions). Consent category
  `fitness_context` and the usage ledger from M2.
- [ ] 4. `POST /protein-suggestions`: confirmed intake, target, preferences and exclusions; approximate shortfall on
  incomplete days; nothing logged until confirmed.
- [ ] 5. Weekly review on Progress (averages over nutrition-complete days with sample count, weights, sessions, rest);
  `GET /export?format=json|csv`.
- [ ] 6. Tests from `backend/tests/evals/workouts.jsonl` (`@pytest.mark.m4`), one per scenario; journey tests `[M4]`.

### Exit criteria
- [ ] auto: `pytest -m m4` passes including all 12 workout scenarios.
- [ ] auto: `vitest -t "[M4]"` passes.
- [ ] manual: a 30-minute office plan requested on the phone after a recent session fits time and equipment, cites
  history, can be edited or rejected; AI-off still gives a template.

### Evidence log
| Date | Source SHA | Artifact | Kind | Result |
|---|---|---|---|---|

### Parked

### Owner actions needed

## M5: Daily-use release and pilot

Goal: installable Android and iOS builds, backup restore proven, deletion complete across all domains, a seven-day pilot
and a fourteen-day adoption review.

### Tasks
- [ ] 1. Account deletion covers every table, media objects, IndexedDB stores and filesystem drafts; tested with
  disposable accounts; UI explains device cleanup and warns when local cleanup fails.
- [ ] 2. Backup and restore test on the beta database recorded in `docs/release/beta-backend.md`.
- [ ] 3. Privacy and consent copy checked against `docs/legal/claims-register.md`; no biometric, free-AI or full-offline
  claims remain.
- [ ] 4. Release builds: signed Android APK procedure in `docs/release/android.md`; iOS device build in
  `docs/release/ios.md`.
- [ ] 5. `docs/release/pilot.md`: the seven-day matrix from `docs/spec/04` with observed results, assistance needed,
  failed saves, duplicates, data loss, correction effort; then the fourteen-day adoption review.

### Exit criteria
- [ ] auto: `pytest -m m5` passes (deletion across domains, export).
- [ ] auto: `make gate-full` green.
- [ ] manual: pilot matrix passes with no account-isolation or data-loss blocker; both platform builds recorded with
  provenance.

### Evidence log
| Date | Source SHA | Artifact | Kind | Result |
|---|---|---|---|---|

### Parked

### Owner actions needed
