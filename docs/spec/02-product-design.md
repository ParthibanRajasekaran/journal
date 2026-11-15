# Journal daily companion: mobile design specification

## Consolidated decisions, 15 November 2026

This document is part of the Journal daily-use specification. `00-Review-and-Claude-Handoff.md` controls delivery order and reconciles the specialist drafts. All new capabilities are proposed; repository changes and deployment are not performed by this review.

The release sequence is M0 verified mobile baseline; M1 reliable offline diary, weights, repeated meals and protein history; M2 camera estimates; M3 actual workouts and recovery; M4 on-demand planning and protein support; M5 personal pilot. The full requested MVP includes M0-M5. A first usable logging beta is M0-M1. A seven-day functional pilot precedes a fourteen-day adoption review; these are not competing definitions. Timed targets: weight <=15 seconds, repeat meal <=20 seconds, text/photo estimate review <=60 seconds excluding provider/network wait. Targets are hypotheses to measure, not current performance claims.

Weight trend rule: retain every measurement; choose one explicitly nominated daily reading, otherwise the earliest local-day reading. Calculate the rolling seven-calendar-day mean of those daily representatives, display observation count, and require three different measured days before drawing a trend. Missing days are gaps. Preserve event timezone/local date across travel; changing display timezone does not silently reassign existing journal days. Corrections can explicitly move an entry.

Confirmed local pending meals count once in provisional totals. Unestimated drafts and unaccepted AI suggestions never contribute invented nutrition. For historical targets, record only what is known: do not backfill today's target as if it had always applied. Old days without a known target show no comparison.

Photo default: local draft until the user requests estimation with consent; sanitized upload expires after processing or a maximum 24-hour pending lifetime, with an operational cleanup test. Meal photo history is deferred in the first release; confirmed nutrition remains. The time is an application retention requirement, not a promise about the AI provider's own retention. Cloud storage backups must be accounted for in deletion documentation.

The initial offline implementation uses IndexedDB for structured records behind a transactional repository interface on web and Capacitor, plus native filesystem storage for media. Validate native process-kill durability in M1. Adopt native SQLite only if that measured spike fails, with a documented migration; do not build two storage engines speculatively. Offline access is restricted to a previously verified owner, cannot authorize network sync, and is unavailable after explicit logout until reauthentication. Do not claim biometrics or encrypted local journal storage without implementing and testing them.

External-assistant handoff, flexible gamification, body-progress photos and unrestricted chat are follow-on capabilities. They do not delay the full requested core loop. Manual logging and saved workout templates remain usable without AI. User API keys are the only automated AI funding source; no shared paid fallback. Provider benefits and credits must be checked for the actual account rather than inferred from a consumer subscription.


Review date: 15 November 2026. Reviewed source: `mvp/android` at `f03c385eb296b01a86951a9b54593dcd0cf1abf8`. This is source inspection, not a rendered-device usability test. All new screens and behaviors below are proposals.

## 1. What exists, and what to preserve

The current frontend is a meal journal with Today, Week, Add and Settings navigation (`web/src/App.tsx:14`, mobile navigation near the end of the file). It already offers text estimation, optional clarification questions, editable macro totals, time/category selection and manual entry (`web/src/screens/AddMeal.tsx:106-159`, `269-400`). Preserve this review-before-save model. It is the correct foundation for uncertain nutrition estimates.

Today has meal edit/delete, daily totals, protein encouragement, queue status and blocked-meal explanations (`web/src/screens/Today.tsx:91-129`, `148-205`). Preserve account-specific queue handling and its honest distinction between locally saved and synchronized data. Improve presentation rather than replace the underlying safeguards.

Settings already has calorie and protein targets, optional encouragement and user AI keys (`web/src/screens/Settings.tsx:18-38`, `43-138`). Week currently shows meal counts and calories, with optional encouragement (`web/src/screens/Week.tsx:40-59`). It needs protein visibility even when encouragement is disabled.

There are no weight, workout or recovery screens among the current screen files. AddMeal contains no camera picker. These are new features, not finishing touches on implemented screens.

Existing CSS has a calm teal palette, 44px buttons, visible keyboard focus and reduced-motion rules (`web/src/styles.css:2-18`, `62-84`, `239`). Retain these foundations. Source inspection found no `safe-area` CSS rule. Native bottom navigation and sticky actions must be verified against gesture bars, notches and the keyboard.

## 2. Product experience

Primary promise: "Record what happened. Understand your day. Choose your next workout."

The product is a structured journal with assistance at the moment it is useful. Do not replace it with a single chat screen that makes users reconstruct totals, dates or workout history from conversation. A small "Ask about my day" composer can later operate on structured records, but is not required for the first daily-use release.

Three daily actions must be reachable with one tap from Today: Add meal, Log weight, Plan or resume workout. All must work without configuring an AI provider except the optional generation/estimation action. Distinguish an unestimated food record from a zero-calorie meal.

## 3. Information architecture and screen hierarchy

Use four stable mobile destinations: **Today, Food, Training, Progress**. Place Settings behind a labeled profile button. Keep Add meal as the primary Today action and as an accessible action within Food. Avoid a fifth tab reserved for one operation.

**Today**, in order:
1. Selected date with previous/next day and a calendar picker; visible sync state.
2. Protein and calories summary, equally legible. Example: "Protein 82 g of 120 g" and "Calories about 1,650 kcal". Values are illustrative, not prescribed targets.
3. Quick actions: Add meal, Log weight, Start workout or Resume workout.
4. Today's meals, with pending and unestimated records included as visible rows.
5. Training/recovery card showing recorded state, followed by a suggestion if requested. "No workout recorded" must not become "Rest day" automatically.
6. Latest weight with actual measurement date. A reading from Tuesday must not look like today's weight.

**Food**: date history, frequent meals, saved recipes and meal detail/edit. Keep a meal's original description and correction history accessible. Show nutrition source: user entered, label, AI estimate, or edited estimate.

**Training**: Plan, Active session and History. Show the next useful action rather than three competing dashboards. Provide office and main-gym equipment presets, user-editable and optional. Avoid brand-specific assumptions for other users.

**Progress**: weight trend, protein by day, workout calendar and recovery check-ins. Missing measurements remain gaps. A seven-day rolling weight trend requires three measured local days; below that show readings and "More readings needed" rather than an authoritative trend.

## 4. Meal journeys

### Text capture

Add meal opens a focused composer with Describe, Camera and Manual choices. Example placeholder: "2 egg dosa, coconut chutney, tea with milk". Accept rough portions and regional food names. Time defaults to now but can be changed before saving, including backdated meals.

After Describe, the user can **Estimate** or **Save for later**. The latter records food text without fabricated nutrition and keeps it out of numeric totals while showing "1 meal needs nutrition". Offline estimation shows "Saved on this device. Estimate when connected" if the draft was durably stored. It must never say saved following a failed storage write.

Estimate review shows an item list with quantity, calories and protein, followed by meal totals. Put one important assumption directly under the totals, for example "Assumes medium dosa and 2 eggs". Expand to see all assumptions. Current assumptions are hidden behind Show details (`AddMeal.tsx:353-373`); the most consequential portion/oil assumption should be visible without expansion.

Ask at most two high-value clarification questions in the usual path, with "Not sure" retained. Prefer questions that change portion, ingredients or oil substantially. Do not interrogate every ingredient. A user who selects Not sure sees the assumption adopted.

Every estimate requires confirmation. Re-estimation must preserve the existing record until the new result is accepted. Editing an item updates the visible total. Item-level editing is new; current code edits overall macro fields.

### Camera capture

On first use, explain "Photograph your meal to get an approximate estimate" before requesting camera permission. Offer camera and photo library separately. After capture, offer retake, remove and optional description. Give a clear indication before the image is sent to the selected AI provider, with a remembered preference for later use.

A photograph cannot reliably reveal oil, preparation, portion mass or hidden ingredients. Prompt for these only when material. Show uncertainty as a plain explanation such as "Portion uncertain; check the amount". Do not invent a confidence percentage. If numeric ranges are supported later, label them as model-estimated ranges, not calibrated statistical intervals.

If the image cannot be interpreted, keep it attached locally and offer Describe or Manual. Camera denial offers library/text entry immediately. Large-image reduction, orientation correction and metadata stripping happen before upload. A pending image survives app restart; camera support should not ship until durable photo draft behavior exists.

Use ephemeral cloud images for estimation and delete them under the retention rule above. Photo-history settings are deferred; confirmed nutrition remains in the diary. Delete successful local capture drafts after confirmed save, and expose deletion for abandoned drafts.

### Repeated meals and shakes

"Repeat meal" creates a new meal record with a new identifier; it never reuses the original save operation. Portion adjustment is offered before confirmation. A saved shake recipe can specify milk, yogurt, banana, oats, nuts and optional protein powder, then record one serving in two taps. Recipe edits affect future entries, not historical totals. Drinks, supplements and snacks use the same meal system to avoid double-counted protein.

## 5. Weight journey

Log weight opens a compact sheet: value, unit, date/time and optional context such as "Morning, before breakfast". Remember units and context preference, but do not prefill the previous weight as a new measurement. Support multiple real measurements on one day with an explicit edit/delete path; use a documented daily representative value for trend aggregation.

After save, show "76.6 kg recorded for Friday morning" with Undo where safe. The trend does not reward individual downward readings. Treat fluctuations neutrally. Optional notes can capture travel or illness without interpreting them as diagnoses.

## 6. Workout and recovery journey

Plan workout starts with duration, location/equipment and a brief readiness check: energy, soreness, pain or illness, plus optionally sleep. Prefill the user's usual location and duration; show the most recent relevant completed session. RIR remains optional and is explained as "Reps you felt you could still do".

Proposed plan displays duration, exercises, sets, rep ranges and rest, plus why it fits the user's history. Recommended loads remain suggestions requiring confirmation. User can swap an exercise by available equipment, shorten the session or select a rest/recovery option. Do not invent prior lifts. Missing history is explicitly labeled.

Start workout turns the plan into an active session. Each exercise shows previous performance where available and large load/reps controls. Mark set done with one action. Distinguish load per side from total load, and machine-specific values from universal strength measures. Allow warm-up sets, skipped sets and substitutions without losing the original plan. Autosave locally after every completed set. Leaving or closing the app must preserve the session.

Finish session asks only what was actually completed, session effort and optional recovery note. Planned, started, completed, partially completed and abandoned are distinct. Calendar markers use text/icons as well as color.

Recovery is a user check-in plus a suggestion, not a physiological certainty score. "You reported tiredness after yesterday's session" is useful; "Your body is 92% recovered" is unsupported. A missed workout is not automatically a rest day. Users can explicitly mark Rest, Light activity or Workout. Pain/illness responses change the suggestion and avoid pushing progression. The product should not diagnose injury or prescribe treatment.

## 7. Visual system and components

Retain existing teal `#0f766e`, text `#111827`, muted `#4b5563`, white surface and background `#f5f7f8`. Use solid surfaces for input and data cards to improve predictable contrast. Keep amber for attention and red for destructive/error states, not calorie overshoot. Nutrition targets are context, not moral judgments.

Proposed tokens: spacing 4/8/12/16/24/32 px; radius 12px controls and 16px cards; body 16px with 1.5 line height; captions at least 13px; headline 24px; tabular numerals for measurements. Main touch targets 48px; never below 44px. Use `env(safe-area-inset-bottom)` for the action area and navigation, with enough scroll padding for the keyboard and fixed controls. Check computed contrast instead of relying on CSS comments.

Reusable components: DateHeader, NutritionSummary, RecordSyncBadge, MealReviewItem, AssumptionNotice, CaptureComposer, WeightEntrySheet, TrendChartWithTable, ReadinessCheckIn, ExercisePlanCard, SetRow, SessionResumeBanner and ProviderStatusCard. Components should derive labels and totals from domain state rather than keep competing local copies.

## 8. Offline, error and privacy states

A top-level network failure currently replaces the entire app with Try again (`web/src/App.tsx`, profile error branch). This is a critical daily-use experience gap: an offline cold start should show the authenticated account's cached diary and permit durable capture under that account, without claiming the account is freshly verified. Never show another account's cache.

Every record has one visible status: saved on device, syncing, synced, needs attention. Pending records appear once in the day list and provisional totals, then become the corresponding server record without duplication. Clarify which totals include unconfirmed estimates or unsynced entries.

Provider errors preserve input and offer retry, another configured provider with explicit consent, or manual entry. Show provider limit reached as a service condition, not a lost meal. No silent paid-provider fallback. AI key settings should explain API billing separately from consumer chat subscriptions, without promising free usage.

Account deletion explains device cleanup as well as server deletion. If local cleanup fails, show an actionable warning. Do not claim successful removal merely because the remote deletion succeeded.

## 9. Accessibility and gentle engagement

Keep existing focus management, status announcements and reduced motion. Extend focus styles to textarea, implement focus trapping/restoration for sheets, label icon buttons and associate errors with fields. Test VoiceOver and TalkBack, 200% text scaling, keyboard navigation, 320px width, landscape, reduced motion and screen-reader chart alternatives. All chart values must be available in a table.

Keep encouragement opt-in. Celebrate logging consistency, completing the user's chosen sessions and taking planned recovery. Never award points for under-eating, rapid weight loss, training through pain or logging more personal data. Weekly goals can be flexible counts rather than a streak that resets after one missed day. Gamification follows dependable core logging and is not a launch blocker.

## 10. Design acceptance evidence

Before daily-use release, observe the owner completing these tasks on a phone, then repeat the same flow on iOS simulator and later physical iOS: log weight in under 15 seconds; describe and confirm a familiar meal; capture and correct a meal photo; repeat a shake; identify today's protein total; start and resume a workout after app termination; record a rest day; recover a pending meal after loss of connectivity; sign out and confirm another account cannot see drafts.

The time targets are proposed usability goals, not measured results. Also verify that unestimated food is not displayed as zero intake, the last weight's date stays visible, a skipped session is not shown as completed, and a provider failure leaves user input recoverable. Record observed failures rather than substitute unit-test counts for usability evidence.

## Shared state contract

Unestimated meals are persisted and synchronized as meal drafts, separate from confirmed numeric meals; never use zero as unknown nutrition. Converting a draft to a meal is idempotent. Days are explicitly unknown, partial or complete; nutrition averages use days marked complete with all food nutrition confirmed and display the sample count. Actual workout sessions have active, completed, partial, abandoned and skipped states, separate from plans. Active sessions and completed sets survive process termination. See the architecture document for the exact lifecycle contract.
