# Journal daily-use PRD and product review

## Consolidated decisions, 15 November 2026

This document is part of the Journal daily-use specification. `00-Review-and-Claude-Handoff.md` controls delivery order and reconciles the specialist drafts. All new capabilities are proposed; repository changes and deployment are not performed by this review.

The release sequence is M0 verified mobile baseline; M1 reliable offline diary, weights, repeated meals and protein history; M2 camera estimates; M3 actual workouts and recovery; M4 on-demand planning and protein support; M5 personal pilot. The full requested MVP includes M0-M5. A first usable logging beta is M0-M1. A seven-day functional pilot precedes a fourteen-day adoption review; these are not competing definitions. Timed targets: weight <=15 seconds, repeat meal <=20 seconds, text/photo estimate review <=60 seconds excluding provider/network wait. Targets are hypotheses to measure, not current performance claims.

Weight trend rule: retain every measurement; choose one explicitly nominated daily reading, otherwise the earliest local-day reading. Calculate the rolling seven-calendar-day mean of those daily representatives, display observation count, and require three different measured days before drawing a trend. Missing days are gaps. Preserve event timezone/local date across travel; changing display timezone does not silently reassign existing journal days. Corrections can explicitly move an entry.

Confirmed local pending meals count once in provisional totals. Unestimated drafts and unaccepted AI suggestions never contribute invented nutrition. For historical targets, record only what is known: do not backfill today's target as if it had always applied. Old days without a known target show no comparison.

Photo default: local draft until the user requests estimation with consent; sanitized upload expires after processing or a maximum 24-hour pending lifetime, with an operational cleanup test. Meal photo history is deferred in the first release; confirmed nutrition remains. The time is an application retention requirement, not a promise about the AI provider's own retention. Cloud storage backups must be accounted for in deletion documentation.

The initial offline implementation uses IndexedDB for structured records behind a transactional repository interface on web and Capacitor, plus native filesystem storage for media. Validate native process-kill durability in M1. Adopt native SQLite only if that measured spike fails, with a documented migration; do not build two storage engines speculatively. Offline access is restricted to a previously verified owner, cannot authorize network sync, and is unavailable after explicit logout until reauthentication. Do not claim biometrics or encrypted local journal storage without implementing and testing them.

External-assistant handoff, flexible gamification, body-progress photos and unrestricted chat are follow-on capabilities. They do not delay the full requested core loop. Manual logging and saved workout templates remain usable without AI. User API keys are the only automated AI funding source; no shared paid fallback. Provider benefits and credits must be checked for the actual account rather than inferred from a consumer subscription.


Draft for owner review, 15 November 2026. Reviewed source: `mvp/android` at `f03c385eb296b01a86951a9b54593dcd0cf1abf8`; comparison base: `origin/main` at `6af6acc0595bcc69340a8d7180bc2eeb29436f9e`. These are code findings, not a claim that the live service or either physical mobile app runs this code. No live provider call or device journey was performed in this review.

## Product decision

Evolve the existing meal diary into a personal nutrition and training journal. Retain its backend, shared UI, account isolation, estimation review step and native packaging. Deliver working daily journeys in small increments; freeze factory development and defer social/gamification/platform expansion until the daily loop works for two weeks.

The user's desired loop is: log morning weight when convenient; record each meal from a description or camera; review approximate calories and protein; ask for a workout that fits today's time, equipment and recovery; log actual sets; record rest and recovery; review progress with context. The journal should preserve this context so the user does not repeat gym equipment, previous sessions or dietary preferences every day.

## What actually exists

| Capability | Source evidence at reviewed SHA | Product status |
|---|---|---|
| Text description and manual meal entry | `web/src/screens/AddMeal.tsx:275`, `backend/app/routes/estimates.py:38` | Implemented. Text-only estimate request, at most two clarifying questions, human confirmation. Live provider performance not verified here. |
| Approximate calories/protein/carbs/fat | `backend/app/ai/estimate.py:20`, `:43`, `:132`; `web/src/screens/Today.tsx:231` | Implemented totals and editable estimates. Prompt references food tables but is not an actual database retrieval integration. |
| Personal calorie/protein targets | `backend/app/db/models.py:49`, `web/src/screens/Settings.tsx:45` | Implemented user-entered targets. No weight-driven personal goal model. |
| Seven-day diary | `backend/app/routes/days.py:93`, `web/src/screens/Week.tsx` | Implemented with timezone-aware aggregation. Uses current target rather than a dated history of targets. |
| Bring-your-own AI keys | `backend/app/routes/ai_keys.py:58`, `backend/app/ai/providers.py:14`, `web/src/screens/Settings.tsx:159` | Three adapters, encrypted key storage. No product usage ledger or strong monetary budget controls. Default selection is first stored provider in OpenAI/Anthropic/Gemini order when request omits provider. |
| Safer offline meal replay | `web/src/offline.ts:7`, `web/src/App.tsx:38` | Implemented owner-scoped localStorage outbox, bounded retries and idempotent meal creates. This is not a general offline database. |
| Offline app restart | `web/src/App.tsx:25`, `:87` | Gap. Startup requires session restore/profile call; network failure renders an unavailable screen instead of local journal. |
| Native Google auth | `web/src/native/`, `backend/app/routes/native_auth.py`, custom plugin | Implemented on integration branch. Real sign-in remains unproven by current repository evidence. |
| Photo/camera meal estimate | `EstimateRequest` accepts only `text`; current AddMeal is text/manual; `Meal.photo_id` is only a field | Missing end-to-end. Do not equate schema placeholder with photo support. |
| Weight entries/trends | No model, route or screen in current application | Missing. |
| Workout plan generation and actual session tracking | No model, route or screen | Missing. |
| Recovery/rest calendar | No model, route or screen | Missing. |
| Cross-day personal coaching memory | No context/profile model beyond targets and display name | Missing. |

The screen union in `web/src/App.tsx:14` is Today/Add/Week/Settings. The registered routers in `backend/app/main.py:46` are health, auth, me, meals, days, ai_keys, estimates and native_auth. The database models are User, Meal, RefreshToken, AiKey and NativeAttempt. These jointly support the absence findings.

`docs/prd.md` and `docs/design.md` describe unimplemented biometrics, photo uploads, photo retention, SQLite and batch sync. Their free-Gemini-default claim also differs from implementation. Supersede these claims with verified status, rather than treating them as completed requirements. `docs/mvp/android-beta-setup.md:7` records an older artifact and commit than current integration; replace it with a current release record before handing out builds.

## Users, principles and scope

Primary user: an adult doing recreational strength training and tracking food, using their own AI account if desired. Initial product is a personal beta, not a coach dashboard or social network. Remain 18+ for this release.

Principles: estimates are approximate; saved facts are distinguishable from suggestions; no AI service is necessary to keep a diary; recovery counts as purposeful activity; data survives routine app restarts and connectivity loss; only confirmed records affect totals. No exercise calories are automatically deducted from food intake. No automatic calorie-target reduction because a day's weight increased.

The owner's profile is a test scenario, not a hardcoded default: two gyms, about 30-45 or 45-60 minutes available, three guaranteed training days with an optional fourth, equipment availability, mixed Indian/British meals and body-recomposition goals. New users enter their own profile. Historic chat records should only be imported through a separately reviewed preview and confirmation workflow.

## Requirements and acceptance criteria

### P0: Usable application foundation

**JRN-001 Account and installable beta.** Existing Google authentication works on a physical Android phone against an HTTPS beta backend available away from the development laptop. iOS simulator and then signed device builds follow the same flow. Backend and client provenance are recorded. A successful launch screen or synthetic token is insufficient evidence.

Acceptance: real sign-in, cold restart/session restore, logout, account switch and deleted-account refusal pass; account A never reads or syncs B's records; expired/revoked sessions reconnect safely; debug HTTP exceptions are absent from release configuration. User controls credentials and consent. Remote beta hosting requires an explicit owner deployment decision.

**JRN-002 Offline diary continuity.** Previously signed-in users can open locally cached diary data and capture records without network, including after process termination. Clearly identify stale data, pending edits and unsynced photos. Local data is scoped to the last verified owner; it is not authority to send to the server.

Acceptance: create a meal offline, kill app, reopen offline, find draft/entry, reconnect and save once; auth expiry pauses replay without deleting local content; switching accounts cannot expose another account's cache; storage-full failure never claims successful persistence. New edits and deletions have an explicit conflict rule rather than silently overwriting concurrent changes.

### P1: Daily nutrition and weight loop

**JRN-010 Text meal capture.** Enter natural language, including quantities, preparation and mixed dishes. Ask at most two high-value clarifications; display component estimates and assumptions before confirmation. Allow editing servings, components and nutrition. Never silently save an AI answer.

Acceptance: 'two egg dosas, coconut chutney and tea with milk' produces a reviewable structured estimate, or an honest error with manual fallback. Unknown oil/portion sizes are visible assumptions. Confirm, edit, delete and backdate update the correct local day's totals. Preserve original description and corrected estimate metadata without logging it to telemetry.

**JRN-011 Camera and gallery.** Take or select a meal photo, optionally add text such as 'only half eaten', estimate with the selected provider, review then save. Recognize that a photo alone cannot determine exact weight, oil or hidden ingredients. Show approximate values, never clinical precision.

Acceptance: camera denial offers gallery/text; interrupted upload retains a local draft; rotation/compression and image limits handled; no upload before provider-specific consent; nonsensical/non-food input produces a usable refusal; repeated upload/estimate retry cannot create duplicate meals. Default retained journal record stores the confirmed nutrition and description; photo history is deferred for the first release. Estimate-only uploads expire after processing or at the maximum 24-hour pending lifetime defined above. Offline photo drafts remain local until the user returns online and confirms estimation.

**JRN-012 Daily protein and calories.** Show consumed calories and protein even when targets are unset. Show remaining protein where a target exists; display 'above target' neutrally. Count confirmed meals and confirmed local pending meals exactly once, and label the latter. Unknown/unestimated meals display a completeness warning, not zero nutrition.

Acceptance: item edits recalculate totals; timezone/DST changes do not duplicate records; drinks, shakes and snacks are normal meals; past-day targets retain their historical values; the user can record a day as partially logged rather than receiving misleading deficit advice.

**JRN-013 Weight log.** Record weight with date/time, kg or lb and optional notes (morning, after meal, etc.). Support backfill, edit and deletion. Store a canonical quantity and entered unit. Show individual readings and a rolling seven-calendar-day average of available observations, with reading count and no imputed zeros. Multiple readings remain visible; nominate one daily comparison reading or show an explicit daily aggregation rule.

Acceptance: 76.8 kg entered on a date survives restart and sync; switching units round-trips without material drift; an accidental duplicate can be removed; missing days appear as missing; charts do not suggest rapid single-day changes are body-fat change. No plan or target changes solely from one weigh-in.

**JRN-014 Repeat meals and quick protein entries.** Save a confirmed meal as a reusable template, duplicate a previous meal and adjust portion. Include manual product-label values. This reduces logging work and AI spend for familiar breakfasts and protein shakes.

Acceptance: duplicating creates a new meal identity and time, never edits the original; template corrections do not rewrite history; serving scaling adjusts all macros consistently; adding a repeated meal makes no AI request.

### P2: Training and recovery loop

**JRN-020 Training profile.** Save goals, experience, weekly availability, equipment per location, preferred movements and constraints entered by the user. Record whether a load means total, per side or per dumbbell. Ask today's location and available minutes before planning when not already specified.

Acceptance: office and leisure-centre profiles produce plans using their own available equipment; unavailable equipment has an alternative; profile edits affect future suggestions, not past sessions. No personal values copied from owner's profile into other users.

**JRN-021 On-demand workout plan.** 'What should I do today?' uses recent completed sessions, actual performance, recovery check-in, available time and equipment. Return a structured draft with exercises, sets, reps, effort target, rest and concise reasons. User accepts or changes it. Offer a non-AI saved template when provider is unavailable.

Acceptance: a 30-minute plan fits the stated duration; proposed exercises have stable identifiers; a recent difficult shoulder session affects the next suggestion; plans may recommend rest or lighter activity; regeneration creates a version and cannot erase performed sets. A recommendation never counts as completed training. AI cannot add exercises or load data directly to confirmed history.

**JRN-022 Session logging.** Start from a plan or manually. Record completed/skipped exercises, actual sets/reps/load, optional effort and start/end time. Allow a shortened session. Keep working session available offline and through process restart.

Acceptance: changing planned '3 x 10' to actual '10, 5, 5' stores actual performance; per-side and total loads are never compared as equivalent; resume interrupted session; completion appears on the calendar once; past session edits preserve clear history and recalculate derived insights.

**JRN-023 Recovery and rest.** Quick optional check-in: energy, soreness, sleep and pain/illness flag. Calendar distinguishes completed workout, partial workout, explicit rest and unlogged day. Recommendations describe their evidence and uncertainty, not a fabricated recovery score.

Acceptance: a blank day is not labelled rest; planned workout is not labelled completed; a rest day can include a note; pain/illness suppresses aggressive progression and produces appropriate advice to stop or seek qualified assessment where relevant. Rest does not break a success streak. The user remains in control of exercising.

**JRN-024 Protein support and next meal.** Optional request for a shake/snack idea uses confirmed logged protein, the user's target, food preferences and available ingredients. Show the shortfall as approximate when intake is uncertain. Proposed recipes never change totals until logged.

Acceptance: familiar ingredients can be selected; allergies/exclusions are respected; portion/macros are reviewable; an incomplete day does not trigger a definitive claim about insufficient intake; the app does not claim supplements are needed.

### P3: Personal assistant and weekly review

**JRN-030 Contextual questions.** Constrain first release to named intents: plan today's workout, summarize nutrition, suggest protein option, explain recent trend. Show what records informed the answer. Ask before saving inferred activities or changing goals. Defer an unrestricted autonomous chat agent.

**JRN-031 Weekly review.** Combine logged meals, average protein on complete days, weight observations, completed sessions and explicit recovery. Distinguish missing data. Suggestions are optional and editable. Offer portable JSON/CSV export of user's own records, correcting the old blanket 'no export' scope.

## AI ownership and cost

Manual and template-based journaling remains available with no provider key. Initial AI integration reuses the existing backend proxy and encrypted per-user keys, with clear disclosure that the backend processes those keys. The app owner supplies no shared paid key.

Require explicit provider/model choice and consent for the payload category (meal text, image or fitness context). Never silently fail over to another provider, key or paid account. Add request/token usage and user-configured application limits before broad beta. Application limits are an additional brake, not a guarantee of the provider's billing total. Provider-side budgets/quotas and current eligibility remain the user's responsibility.

Do not promise that a ChatGPT/Claude consumer subscription grants API access, or that any provider remains free. For users unwilling to connect API keys, a later copy/share prompt with structured paste-back import can use their existing assistant manually; label this as user-mediated, never automated consumer-account scraping. The importer still validates data and asks before saving.

## Deferred and removed claims

Defer factory features, autonomous agents in the shipped app, multi-user households, leaderboards, social sharing, wearable ingestion, barcode catalog, body-image analysis, voice recording, biometric unlock, supplements marketplace and calorie expenditure estimation. Remove misleading UI/documentation claims of working camera, biometrics, free AI or full offline support until delivered. Keep gentle optional encouragement, but no punitive streaks, food guilt or recovery penalties.

## Success and launch evidence

Personal-beta success is a 14-day diary trial: user can log meals on at least 10 days, record at least three weights, complete at least three logged sessions plus explicit rest/recovery, and retrieve those records across restarts. Measure manual/repeat meal save under 20 seconds and text/camera review flow under 60 seconds when provider responds normally. These are proposed acceptance targets, not current benchmarks.

Release blocker set: account-isolation breach, data loss, impossible core journey, unbounded app-funded AI, invalid nutrition silently saved, or real sign-in failure. Nonblocking polish is recorded without expanding scope. Verify on a physical Android device first, then iOS. Emulator screenshots and automated test counts are supporting evidence, never replacements for user journeys.

## Product sequencing

1. Prove real auth and a remote HTTPS beta route; fix cold-start offline access and record artifact provenance.
2. Ship weight logging, repeat meals and reliable protein/day views using existing text/manual capture.
3. Ship camera estimation and durable media drafts, with consent and cost controls.
4. Ship actual workout/rest logging and training profile before generated plans, so the planner has trustworthy history.
5. Add constrained workout generation, contextual protein suggestions and weekly review.
6. Run the 14-day trial; correct friction and data reliability before inviting more users or building optional engagement.

This order deliberately produces a useful diary before all coaching capabilities are available, while the full daily-use MVP requires items 1-5. Avoid a single large rewrite or wholesale merge of the native/factory accumulation branch.

## Shared state contract

Unestimated meals are persisted and synchronized as meal drafts, separate from confirmed numeric meals; never use zero as unknown nutrition. Converting a draft to a meal is idempotent. Days are explicitly unknown, partial or complete; nutrition averages use days marked complete with all food nutrition confirmed and display the sample count. Actual workout sessions have active, completed, partial, abandoned and skipped states, separate from plans. Active sessions and completed sets survive process termination. See the architecture document for the exact lifecycle contract.
