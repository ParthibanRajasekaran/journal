# Journal: repository verdict and daily-use delivery brief

Consolidated 15 November 2026. Draft product and engineering specification, ready for implementation planning. Prepared from four parallel specialist reviews: product owner, staff engineer, mobile design consultant and a second product owner focused on daily adoption. Their findings were reconciled by the lead reviewer. This is AI technical/product review, not independent human approval.

## 1. Where the repository really is

Journal has a reusable meal-journal foundation and an unmerged native integration. It does not yet implement the requested daily nutrition, weight, workout and recovery companion. Keep the useful code and deliver missing journeys incrementally. Do not restart the framework or make software-factory activation a prerequisite.

GitHub refreshed on 15 November:

| Branch | SHA | Role |
|---|---|---|
| main | 6af6acc0595bcc69340a8d7180bc2eeb29436f9e | Current default branch, behind integrated mobile work |
| mvp/android | f03c385eb296b01a86951a9b54593dcd0cf1abf8 | Recommended implementation baseline; last commit dated 2 November |
| review/native-spike | 323a874a65d7358253482130e90c87862668b72b | Broad accumulated branch, not a clean product delivery unit |

Open PRs observed during the review: #3 broad native/factory work and #8 pending OpenAPI policy exception. Neither is necessary to merge wholesale to implement this product plan. The integrated branch already carries the selected native/outbox/auth work. Recheck heads before implementation; preserve user work and existing history.

### Evidence boundary

- Inspected the canonical frontend, API routes, models, estimation code, native integration, ADRs and setup instructions at f03c385.
- Fresh local verification in an isolated worktree: `npm ci --ignore-scripts`, TypeScript check, all 129 web tests, and production web build passed. Installation lifecycle scripts were deliberately not executed in this review.
- GitHub check-runs on that SHA: `checks` success; `policy-check` skipped. A skipped policy check is not a policy approval.
- Did not rerun the backend suite, secret scanner, native builds, live provider evaluations or real phone journeys in this review. Earlier counts in conversation remain historical evidence.
- The last conversation report identified a missing emulator Google account. This review has no later evidence of successful real sign-in. Do not label authentication failed forever, or verified complete, from that old report.
- Did not inspect production or change deployment, billing, branch protection, source files or remote branches.

### Capability assessment

| Requested use | Actual code state | Remaining delivery |
|---|---|---|
| Text meals and approximate macros | Present, manual entry plus BYOK text estimate/review | Verify live provider quality, preserve item detail and selected provider |
| Daily calories and protein | Present | Incomplete-day labels, target history and pending-record reconciliation |
| Camera/gallery meals | Missing in canonical flow | Capture, durable draft, sanitized image transport, multimodal estimate and confirmation |
| Weight log and trend | Missing | Model, CRUD, offline capture, units and dated trend |
| Workout records | Missing | Equipment profile, sessions, sets, loads/reps/RIR and history |
| Recovery/rest tracking | Missing | Explicit check-ins and calendar; distinguish unlogged days |
| Plan today's workout | Missing | History/context builder, templates, optional validated AI draft |
| Protein/shake ideas | Missing | Contextual optional suggestion, user review before logging |
| Reliable offline use | Partial meal-create outbox | Cold start, cached history, edits/deletes, media and new record types |
| Android/iOS | Native code and shells on integration branch | Real sign-in, device journeys, stable beta backend and release artifacts |

The strongest source anchors are [App.tsx](https://github.com/ParthibanRajasekaran/journal/blob/f03c385eb296b01a86951a9b54593dcd0cf1abf8/web/src/App.tsx), [database models](https://github.com/ParthibanRajasekaran/journal/blob/f03c385eb296b01a86951a9b54593dcd0cf1abf8/backend/app/db/models.py), [estimate request](https://github.com/ParthibanRajasekaran/journal/blob/f03c385eb296b01a86951a9b54593dcd0cf1abf8/backend/app/routes/estimates.py), [estimation implementation](https://github.com/ParthibanRajasekaran/journal/blob/f03c385eb296b01a86951a9b54593dcd0cf1abf8/backend/app/ai/estimate.py), and [beta guide](https://github.com/ParthibanRajasekaran/journal/blob/f03c385eb296b01a86951a9b54593dcd0cf1abf8/docs/mvp/android-beta-setup.md). File references in companion documents refer to this exact source snapshot.

## 2. Product scope and the daily loop

The target is a personal adult nutrition/training journal: morning weight; every meal including drinks/snacks/shakes; approximate calories/protein; a workout request that knows available time, location and recent sessions; completed sets; recovery/rest; useful weekly reflection. AI assists structured records. It does not become the database or autonomously rewrite the user's history.

Illustrative acceptance scenarios drawn from the owner's routine:

- Record a morning measurement, backdate a forgotten reading, and see the trend without filling missing dates with zero.
- Describe egg dosa, chutney and tea; photograph a paneer-and-chapati meal; correct quantities or hidden oil; save only the accepted estimate.
- Repeat a familiar yogurt/milk/banana/nuts shake without paying for another estimate; a suggestion does not count as eaten until confirmed.
- Ask for a 30-minute office session or a longer main-gym session, with the correct equipment and recent actual lifts in context.
- Record 10/5/5 actual repetitions against a planned 3x10, including per-side versus total load, and resume after closing the app.
- Mark recovery deliberately; missing workout data does not become a rest day. An unusually tiring session informs the next suggestion.
- Use the app away from the Mac, lose connectivity, reopen it, record data and reconnect without duplicates or account mixing.

These are fixtures and optional onboarding suggestions, not personal data silently seeded into every account. Historical chat import needs user-selected records, preview, duplicate handling and confirmation. It is not part of the first implementation slice.

## 3. Keep, retire and defer

**Keep:** React/TypeScript in web/, Capacitor shells, FastAPI/PostgreSQL/Alembic, native session and secure token handling, owner checks, idempotent writes, reviewed outbox safeguards, manual targets, estimate confirmation, accessibility foundations and relevant tests.

**Retire from active delivery:** misleading root-prototype build instructions and duplicate root client after checking references and any data migration needs. Do not delete history. Correct unsupported photo, biometric, full-offline, free-provider and runtime-policy claims. Remove implicit first-key provider selection.

**Build:** the missing product domains and reliable daily operation described in the matrix.

**Defer:** new factory features, public app-store launch, leaderboards, body-photo analysis, wearables, broad autonomous chat and biometric unlock. Optional gentle encouragement can stay. Do not reward restriction, rapid weight loss or training through pain.

## 4. Architecture and design decisions

Retain a modular monolith and one shared UI. Add measurement, training, recovery, media and AI-usage domains. Use additive migrations and versioned contracts. Build structured history before generating personalized plans.

Four mobile destinations: Today, Food, Training, Progress; Settings via a labeled profile control. Today exposes Add meal, Log weight and Start/Resume workout. Plain-language sync status and assumptions are first-class interface elements. The design specification is a screen/component/interaction design, not a tested visual prototype; visual implementation and device usability checks remain delivery tasks.

Local records and their queued operations must commit atomically. Start with IndexedDB behind a shared repository interface and native filesystem media. Validate durability on actual Capacitor devices; introduce SQLite only if the measured need justifies it. Existing localStorage queues must be migrated by copy, verification and only then removal. Never rename away stranded data.

The full contract, schema and offline state model are in 03-Architecture-and-Implementation.md. Resolved defaults at the top of each companion document override tentative alternatives later in its specialist draft.

### ADR treatment

All seven existing ADRs are proposed and some describe controls absent from the application. Update them to reflect verified behavior and narrowly scoped new decisions. Keep Python/SQL authorization and validation rather than add OPA solely to satisfy prose. Reconcile native SDK authentication, actual key custody and hosting with their ADRs. Secure refresh-token storage is not proof of biometric unlock. Repository agent policy and end-user authorization are separate concerns.

## 5. AI that does not create a developer-funded token bill

Manual logging, repeated meals, calculations and saved workout templates work with AI disabled. Optional automated estimation/planning uses the user's explicitly selected provider and own key, processed through the existing backend proxy. Explain that custody honestly: the backend can decrypt the key for the request; it is not end-to-end secret from the server operator.

The app must show the provider before dispatch, enforce request/output limits and durable allowance reservations, and stop rather than silently fall back to a developer key or paid provider. If price or entitlement is unknown, show unknown and require explicit opt-in before paid requests. A free-only choice must fail closed when eligibility cannot be established, leaving manual mode available. App-side estimated spend is not the user's complete external provider bill.

Official provider documentation reviewed for this proposal establishes separate API billing/entitlement surfaces. Some accounts may have promotional or subscription-associated API credits, so do not make blanket assumptions either way. Gemini's pricing documentation offers free access to selected models with limits and flags different data-use terms. Confirm model availability, region, billing and terms for the actual account at setup. Do not promise unlimited or permanently free AI.

Sources:
- https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform
- https://support.claude.com/en/articles/9876003-why-is-claude-api-usage-billed-separately-from-my-paid-claude-plan
- https://ai.google.dev/gemini-api/docs/pricing

A later user-mediated copy/share and validated paste-back flow can reuse the user's chosen chat assistant without automated API calls. Do not scrape consumer sessions or rotate accounts to evade quotas. This feature is optional after the requested core MVP.

## 6. Ordered implementation plan

| Milestone | Deliverable | Depends on | Completion evidence |
|---|---|---|---|
| M0 Mobile baseline | Real sign-in, session restore/logout, reproducible Android artifact, isolated HTTPS beta backend and current runbook | Existing integration, user Google consent, approved deployment destination | Real phone creates/edits/reopens meal over mobile data with Mac disconnected; exact app/API versions recorded |
| M1 Everyday logging | Offline cold start and safe queue migration, weights, repeats, protein completeness and target history | M0 for device release; implementation can start concurrently | Kill/reopen offline and reconnect; records persist once; units/timezones/account switching pass |
| M2 Camera estimates | Camera/gallery, local drafts, sanitized expiring upload, one proven vision provider, editable items and clear consent | M1 local repository; explicit provider/usage controls | Real mixed-meal photo reaches review; correction saved; permission denial, expiry and quota failures preserve input |
| M3 Training and recovery | Equipment profiles, templates, actual sessions/sets/RIR, rest and recovery calendar | M1 data and sync contracts | Complete and resume a real workout offline; distinguish planned, partial, completed and unlogged days |
| M4 Personal assistance | On-demand plan from actual history/readiness, constraints and protein/shake suggestions | M3 records; M2 AI controls | Time/equipment/history-grounded plan can be changed or rejected; AI-off template path works |
| M5 Daily-use release | Seven-day functional pilot, backup restore/export, updated Android and iOS device builds, then fourteen-day adoption review | M0-M4 | Pilot matrix passes; no account isolation/data-loss blockers; diary useful without daily developer assistance |

Weight schema/forms and training catalog preparation can proceed while the owner finishes Google consent. M2 and M3 can run in parallel once M1 contracts are stable. The roadmap is an ordering of deliverables, not a promise that all work is nearly finished. Re-estimate after M0/M1 expose real integration and device costs.

Use one or a few cohesive PRs per milestone; do not force a fixed file count. Keep the first vision provider narrow and hide unverified vision capabilities for other providers. Existing supported text adapters can remain. Store publication is not required for a personal installable beta, but install/signing/update procedures must be repeatable for each platform.

## 7. Engineering acceptance refinements

- Calendar dates: retain UTC timestamps and event IANA zone/local day. Explicit backdating is supported; travel does not silently move historical entries.
- Trend: one daily representative weight, user-nominated else earliest; seven-day mean of measured days only; show count, require three days for a trend.
- Nutrition: confirmed pending records counted once and labeled provisional; unknown meals show incompleteness; edits/deletes recalculate; no invented missing-day intake.
- Training: enforce exercise/equipment identifiers, duration and load conventions outside the model. Actual sets are authoritative. Missing readiness is unknown. No diagnosis, automatic target changes or automatic completed sessions.
- Provider quality: create a small representative set of consented, weighed/labelled meals and known workout constraints. Record estimation error and correction burden. Do not set accuracy claims from the model's own confidence number. A practical starting set is 20 meals spanning simple, mixed, packaged, ambiguous and non-food inputs, plus 12 workout scenarios. This is an initial evaluation set, not population validation.
- AI limits: reject malformed/nonfinite outputs, hidden owner IDs and unknown exercise IDs; no database tools exposed to generated content. Preserve drafts through errors. Evaluate provider calls only when authorized and budgeted.
- Operations: safe isolated E2E base URL must be explicit. Existing Playwright config defaults to the live site; do not run it casually. Verify backup restoration on disposable data and expose a nonsecret build version endpoint.
- Deletion: test all new tables, local caches, media and queued operations using disposable accounts. Account deletion is never tested against the user's real diary without permission.

## 8. Claude handoff

Copy the following instruction and provide all five Markdown files:

> Build Journal toward the daily-use MVP specified in this package. Start by refreshing main and mvp/android and report any delta from f03c385. Preserve existing work and use web/ as the canonical UI. Follow 00-Review-and-Claude-Handoff.md for scope and resolved decisions, 01-PRD.md for behavior, 02-Product-Design.md for interactions, 03-Architecture-and-Implementation.md for technical slices, and 04-Pilot-and-Acceptance.md for real-use evidence.
>
> Freeze new factory features. Start M0 and prepare M1 in an isolated integration branch. Resolve routine conflicts and complete implementation, tests, local builds and review preparation autonomously. Do not stop for permission on every mechanical step. Ask only for genuinely missing account actions or approval of a concrete deployment/merge/cost decision.
>
> First deliver real mobile sign-in, a reproducible phone build, and a proposed isolated HTTPS beta backend setup that works away from the development Mac. Prepare the deployment and rollback instructions before asking to activate it. While account steps are pending, implement the weight and repeat-meal slice against the agreed offline/data contracts.
>
> Keep records structured and owner-scoped. Every AI result is an editable draft. Preserve existing outbox safety and migrate data with verification. No developer-funded AI fallback, silent provider switch or assumption that consumer chat usage is reusable API quota. Do not seed my private historical records without a preview and my confirmation.
>
> Report progress by working user journeys, exact source/artifact versions, observed failures and remaining blockers. Separate mocked tests, real-provider evidence, emulator evidence and physical-device evidence. A passed build does not mean a completed product feature. Keep production, merges to main, paid services and live development-agent probes unchanged unless separately authorized. Present concrete changes for the final merge decision.

## 9. Package map and decision status

1. This review and delivery brief: authoritative synthesis and Claude instruction.
2. 01-PRD.md: user jobs, functional requirements and acceptance criteria.
3. 02-Product-Design.md: navigation, screen flows, input states, accessibility and visual tokens.
4. 03-Architecture-and-Implementation.md: schema, endpoints, sync migration, AI controls and ADR reconciliation.
5. 04-Pilot-and-Acceptance.md: real-use release matrix and scope discipline.

This package recommends decisions; it does not record owner approvals, merge branches, activate pending policy exceptions or deploy a service. Existing approvals remain as previously granted. The next concrete delivery is M0/M1, not another general factory specification.
