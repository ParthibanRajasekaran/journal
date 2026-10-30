# PRD: Buddy encouragement

Status: Draft v0.1 · Owner: Product · Priority: to be ranked by the owner · Depends on: Add meal, Today, Week, Settings, AI estimate contract (PRD sections 4, 5, 7 and 8)

Note: Phases 1 and 2 fit PRD section 4 as written, provided no confetti, badge or achievement is used. Phase 3 (streaks) needs the section 4 amendment in section 11 before build. Phase 4 (fibre and vitamins) needs that amendment and a changed AI estimate contract, and is **not yet approved**.

## 1. Problem

Journal asks people to log every day. Logging is the habit that makes the numbers useful, but today the app gives no feedback beyond totals. A person who logs well gets no sign that it matters, and a person who logs less is shown the same neutral screen. Other nutrition apps reward calorie restriction, show red over-target warnings, or break streaks with "you failed" messages. Those patterns push people toward under-eating and shame, which Journal must not do.

The owner wants Journal to act like a buddy: it notices healthy choices and consistent logging, celebrates real milestones, and never judges food or the person.

## 2. Target user

The primary user from PRD section 2 who logs most days, wants to feel encouraged rather than audited, and may have a rough day or a skipped day without wanting that to be a failure.

## 3. Goal and success metric

| Measure | Target (proposed) |
|---|---|
| Users who keep Buddy encouragement on (not switched off) after 4 weeks | 70% of users who saw it |
| Users who switch encouragement off within 2 weeks of release | under 15%, tracked as a quality signal |
| Encouragement messages that mention calories, under-eating or a missed day in a negative way | 0, checked by copy review and tests |
| Logging days per user per week, before and after release | tracked, no target (baseline) |
| Encouragement shown when the feature is off | 0 |

## 4. Scope

### 4.1 Principles (apply to every phase)

These are requirements, not guidance. Each one has an acceptance check in section 6.

- **P1. Healthy choices and consistency, never calorie intake.** The app may appreciate protein goals reached, days logged, and fibre or vegetable milestones. It never celebrates a low calorie total, restriction, or being "under target".
- **P2. Buddy, not judge.** No message discourages any food. No red marks, no "you failed", no "over target" warnings on calories, no lost-streak messages. Existing over-target styling for calories (see section 7) is removed from Today.
- **P3. Celebrate real moments.** Reaching a protein goal, logging on several days, and fibre or vegetable milestones (Phase 4) are celebrated in calm text. Messages come from fixed templates, never generated text.
- **P4. Glimpse of nutrients, labelled approximate.** Protein, carbohydrate, fibre and vitamin figures are sums of what the user has logged, with no assumed portions or defaults. Every figure derived from estimates carries the caveat "Approximate, based on what you've entered."
- **P5. Rest days.** A missed day never resets, reduces or breaks anything shown to the user. Section 4.4 defines the rule for skip days.
- **P6. Off switch.** The whole experience can be turned off in Settings. Off hides every encouragement element (save line, Week card, streaks, glimpses). See section 4.5.
- **P7. Privacy.** Nothing is shared outside the app. No food name, calorie, macro or photo appears in any notification, log, analytics event or lock-screen text. Encouragement adds no AI call and no third-party service.
- **P8. Accessibility.** Reduced motion is honoured: every animation in this feature has a static path. Every signal is text, not colour alone (check marks are glyphs with words, bars have text equivalents).

### 4.2 Phase 1: Save confirmation (in scope)

- After a meal is saved on Today, a brief check mark and one calm line appear. The line is always "Logged. Nice work keeping track." (fixed text).
- When the day's protein total, including the saved meal, reaches the day's protein target, a second line is added: "You've reached your protein goal for today." The protein line appears only in that case.
- The note disappears on tap or after a timeout (value to confirm, proposed 4 seconds), and is announced once to screen readers through a status region.
- Off-state: when Buddy encouragement is off, nothing is shown after save.

Out of scope for Phase 1: confetti, sounds, badges, calorie lines, any message on a day with no meal, and any note on edit or delete.

### 4.3 Phase 2: Week encouragement (in scope)

A summary card above the seven day tiles on Week, for the displayed week only:

- "You logged on X of 7 days." (X counts days with at least one saved meal, in the user's local time zone.)
- "You reached your protein goal on Y days." Shown only when a protein target is set and Y is at least 1. A day counts when its protein total is at least the target (100%, matching Phase 1).
- When X is 0: "Log a meal and your week will show up here." No protein line, no error.
- Any line showing a protein figure carries "Approximate, based on what you've entered."

Out of scope for Phase 2: calorie figures and averages (these belong to the separate weekly insights PRD, and are not part of the buddy card), percentages of target, rankings, comparisons with other users or past weeks, and any AI-written text.

### 4.4 Phase 3: Streak with rest days and the Settings switch (pending owner sign-off)

Phase 3 is **not to be built until the owner signs off**. It is specified here so the owner can decide.

Definitions:
- **Logged day:** the local day has at least one saved meal.
- **Rest day (skip day):** a day the user marks as a rest day from Today or Week. A rest day needs no meals and counts as "kept" in the run. The user may mark at most 2 rest days in any rolling 7 days (proposed limit, to confirm). A marked rest day can be removed on the same day only.
- **Run:** consecutive days, counting back from today (or from yesterday while today has no meal yet), where each day is a logged day or a rest day.

Rules:
- An unmarked, unlogged day does not reset anything. The current run ends, a new run starts from the next logged or rest day, and the best run ever is kept.
- No displayed number ever decreases because of a missed day. Best run and total logged days only go up.
- No message says a streak was lost, broken, reset or failed. The copy on a new run is "Starting a new run today. Good to see you."
- Run length is shown as text, e.g. "Current run: 5 days", and never as a red or amber state.
- Rest days are presented as "Rest day" in text. They are never presented as failures, and no food is discouraged on them.

Settings switch (see also section 4.5): one switch, "Buddy encouragement", in a new Settings card. It is on or off for the whole experience. This PRD asks for the switch with the first release that shows any encouragement (see open question 1).

### 4.5 Switch-off behaviour (all phases)

When the switch is off:
- No save line, no check mark, no protein line.
- No Week card, no run counter, no rest-day controls, no glimpse of any nutrient.
- No encouragement in notifications or the in-app reminder card (PRD: quiet daily summary).
- Stored data is kept (rest-day marks, favourites), but nothing is shown from it.
- Turning it back on restores the views from stored data without a reset.

### 4.6 Phase 4: Fibre and vitamin glimpse (not yet approved)

Adds a glimpse of fibre and selected vitamins on the Week card (and optionally Today), with a milestone such as "You logged fibre-rich foods on 4 days." Requires the data and contract changes in section 10. **Not approved. Do not start until the owner has approved it and the open questions in section 12 are answered.**

Out of scope for Phase 4: a micronutrient dashboard, percentages of recommended daily intake, deficiency language, and any vitamin target that could be read as "under".

## 5. User flow (plain steps)

1. The user saves a meal on Today. The check mark and "Logged. Nice work keeping track." appear. If the day's protein target is reached, the protein line follows.
2. The user opens Week. The buddy card sits above the day tiles with the logged-days line and, if a protein target is set, the protein-days line with the approximate caveat.
3. (Phase 3, after sign-off) The user marks a rest day on Today. The day counts as kept in the run. The run counter updates as text.
4. (Phase 3) The user misses a day. Nothing is reset. The next logged day starts the new run without any message about the earlier run.
5. The user turns "Buddy encouragement" off in Settings. Every encouragement element disappears. Turning it on again restores it.

## 6. Acceptance criteria

### Phase 1

1. Saving a meal shows a check mark glyph and the fixed calm line; the check mark is `aria-hidden` and the words carry the meaning.
2. The protein line appears only when the day's protein total, including the saved meal, is at least the day's protein target (target non-null and greater than 0). Tested at 119, 120 and 121 g against a 120 g target, and with no target set (no protein line).
3. The note contains no food name, calorie figure, macro figure other than the protein-goal sentence, or the words "under", "over", "failed" or "missed".
4. The note is announced once through a `role="status"` region and is dismissible by tap or keyboard.
5. With the OS reduced-motion setting on, the check mark has no animation and the note appears without transition. The tap ripple (`web/src/ripple.ts`) is off under reduced motion.
6. With Buddy encouragement off, no note appears after save (automated test toggles the switch and saves a meal).
7. Protein total used for the check is the same figure shown in the day's summary.

### Phase 2

1. The card appears on Week above the day tiles and updates when the user changes week with the existing arrows.
2. "Logged on X of 7 days" counts only days with at least one saved meal in the user's local time zone, tested with a meal logged at 23:50 and one at 00:10 in a non-UTC zone.
3. "Reached your protein goal on Y days" counts only days with at least one meal and protein at or above the target. A zero-meal day never counts, even if the target is 0 (a target of 0 is treated as not set).
4. With no protein target, the protein line is hidden and no error appears.
5. A week with zero meals shows the invitation line and no division or NaN appears (checked with a zero-data fixture).
6. Any line with a protein figure shows "Approximate, based on what you've entered."
7. The card contains no calorie figure, average, percentage or ranking (checked with a fixed string list and a template test).
8. All copy comes from a fixed template list; a test fails if a new string is added outside it.
9. The card loads within the existing Week response; no new network call to an AI provider or third-party service (test fails if one is made).
10. Changing a meal on a day updates the card on return to Week.
11. With Buddy encouragement off, the card is not rendered.

### Phase 3 (applies only after owner sign-off)

1. A logged day and a rest day both keep the run going; an unmarked day does not reduce the run counter or the best run (unit tests on fixtures with a missed day in the middle and at the start).
2. A user can mark no more than 2 rest days in a rolling 7 days; a third mark is refused with a neutral message and does not change the run.
3. The best run and total logged days never decrease (property test over random sequences of logged, rest and missed days).
4. No string shown in the feature contains "lost", "broken", "reset", "failed", "streak lost" or any food-discouraging word (checked with a fixed string list).
5. Run length is shown as text; no coloured state is used for it.
6. The Settings switch turns every encouragement element off and on (section 4.5), and no stored data is deleted by switching off.
7. Account deletion removes rest-day marks and any stored run data.

### Phase 4 (provisional, not approved)

1. A fibre or vitamin figure is shown only when at least one saved meal in the period has a recorded value. A meal with no value is excluded and the card says how many meals had no value.
2. Old meals with no value are shown as "not estimated", never as zero.
3. Every figure carries "Approximate, based on what you've entered."
4. No percentage of recommended intake, no target, and no "under" or "low" wording is shown.
5. The AI estimate contract change passes the model-swap test (Gemini, OpenAI and Anthropic return the same validated shape on the evaluation set).
6. The migration leaves every existing meal unchanged and does not invent values (no backfill).
7. An out-of-range fibre or vitamin value is rejected or flagged, never silently replaced (FR-4).

## 7. Dependencies on existing code

- `web/src/encouragement.ts`: already contains `savedLine`, `weekLines`, `proteinGoalReached` and the approximate caveat text. Phase 1 and 2 build on this file. The current `savedLine` already returns the calm line for every save and adds the protein sentence only when reached, which matches Phase 1. The save note in Today already renders the check mark as an `aria-hidden` glyph beside the text. Note that `savedLine` currently returns either the calm line or the protein line, not both; Phase 1 needs the calm line plus the protein sentence when reached.
- `web/src/screens/Today.tsx`: the save note (`saved-note`, check mark `.check`) already exists. Add the Buddy switch check. Over-target styling is applied to calories at line 160 (`ring ${over ? "over" : ""}`) and line 188 (`value > goal ? "over" : ""`). P2 requires removing these calorie over-target states (see open question 4).
- `web/src/styles.css`: `--alert` (amber) is used for over-target (`.ring.over`, `.bar > span.over`). Remove the calorie over-target styling. The `pop-check` animation (line 253) must have a reduced-motion path; `prefers-reduced-motion` is already handled at line 240, so confirm it covers the new note.
- `web/src/ripple.ts`: tap ripple already checks reduced motion (line 6). Keep it.
- `web/src/screens/Week.tsx`: add the card above the day tiles. Week must return `meal_count` and `protein_g` per day from `GET /week`; confirm the response, or add the fields.
- `web/src/api.ts`: `Totals` already has `protein_g` (line 18) and `DaySummary.targets.protein_g` (line 40). `updateMe` already writes `daily_targets.protein_g` (line 135).
- `web/src/screens/Settings.tsx`: new "Buddy encouragement" card in the same pattern as the Daily targets card (line 66).
- `web/src/dates.ts`: `localDay`, `mondayOf` and `addDays` are reused for the local-day count.
- Backend: Phase 3 rest-day marks need a small table or a `rest_day` field and an Alembic migration (`backend/migrations/versions`). Phase 3 run counts are computed on read, not stored. A Buddy switch needs a profile flag (`buddy_enabled`) and a migration, or can live in the client if the owner accepts a per-device setting (open question 6).
- Phase 4: see section 10.

## 8. Privacy and data notes

- The feature derives its figures from meals the user already has. It adds no AI call and no third-party service (P7).
- Encouragement text never goes into a notification, a lock-screen message, a log line or an analytics event. Analytics may record only "buddy card viewed" with no values and no user identifier.
- Run counts and rest-day marks reveal logging habits. Keep them on the server with the account, delete them on account deletion (FR-9), and never cache them in a shared store.
- Fibre and vitamin figures (Phase 4) are health-adjacent. They use the same safeguards as meal data. The open Article 9 decision (progress.md, open decision 3) applies: Phase 4 must not start until counsel confirms.
- Nothing in this feature is shown to other users, and no sharing or export is added.

## 9. Accessibility and reduced motion

- Every signal is text. The check mark is a glyph next to words. Bars or dots, if any, have text equivalents such as "Monday: protein goal reached".
- No colour carries meaning. The removed calorie over-target amber is not replaced by another warning colour.
- Animations (check mark pop, any card entrance) are off or static under `prefers-reduced-motion: reduce`.
- Text meets WCAG 2.2 AA contrast and scales with system text size; the card reflows at phone width without horizontal scroll.
- Touch targets for rest-day marks and the switch are at least 44 px.

## 10. Phase 4 risks: data, contract, migration and accuracy

Not yet approved. Listed so the owner can decide.

**Data (new stored fields).**
- Candidate per-meal fields: `fibre_g`, and a small set of vitamins (for example vitamin C, vitamin A, vitamin D, folate). The owner must pick the list. Each is nullable, with units stored explicitly.
- Local offline store must add the same fields, so offline meals keep their values and sync (PRD FR-8).

**Contract (AI estimate).**
- The validated estimate structure (FR-4) gains the new fields. All three adapters (Gemini, OpenAI, Anthropic) need updated prompts and output parsing.
- Each new field needs a validation range. Out-of-range values are rejected or flagged, never replaced with fixed numbers.
- The model-swap acceptance test (PRD section 9) must be extended to the new shape and re-run on the evaluation set.
- Output grows, which adds latency and token cost on the user's own key. Check the AI estimate p95 target of 8 s (PRD section 6).
- Older clients that do not send or read the new fields must still work. The API must accept requests without them.

**Migration.**
- An Alembic migration adds nullable columns only. Existing meals stay as they are. No backfill, and no default zero, because that would fabricate data (FR-6).
- Idempotent sync (PRD section 6, reliability) must hold when the new fields are present on one side only.
- Rollback path: the columns can be dropped, but estimates already saved are lost with them; plan a rollback that keeps the data.

**Accuracy.**
- LLM estimates of vitamins and fibre are weaker than calorie and protein estimates, and the model may return plausible but wrong numbers. Users may read them as measured values.
- Mitigations under consideration: show fibre only and not vitamins; show ranges; show a visible "estimate" label on every value; keep the glimpse to milestones rather than totals.
- The app cannot verify these numbers. The caveat is required, not optional.

**Other risks.**
- Vitamin figures can read as "not enough" even without a target. Keep copy to milestones and avoid comparing to any recommended amount.
- Health-adjacent data may fall under Article 9 (open decision, see section 8).

## 11. Amendment needed to PRD section 4 (out of scope)

PRD section 4 currently lists, under "Out of scope for MVP":

- Line 48: "Pro tier, paywalls, achievements, streaks, confetti, and coach tips."
- Line 50: "Micronutrient dashboard, analytics dashboards, and trend charts beyond the Week list."

Proposed replacement text, to be made by the owner in `docs/prd.md` (this file does not edit it):

> 48. Pro tier, paywalls, achievements, badges, confetti, and coach tips. Streaks are out of scope unless they follow `docs/prd-features/buddy-encouragement.md` section 4.4: a missed day never resets or reduces any shown value, and no streak-lost message is shown. Buddy encouragement (save confirmation and Week encouragement) is in scope as described in that file, and must be switchable off in Settings.
>
> 50. Micronutrient dashboard, analytics dashboards, and trend charts beyond the Week list. A glimpse of fibre and vitamin intake, labelled approximate and based only on logged meals, is out of scope for MVP and is allowed only after the owner approves Phase 4 of `docs/prd-features/buddy-encouragement.md`.

Phases 1 and 2 do not need this amendment as long as no confetti, badge or achievement is used. Phase 3 needs it before build. Phase 4 needs it before build and a separate approval of the AI contract change.

## 12. Open questions for the owner

1. **Switch timing.** The brief places the Settings switch in Phase 3, but principle 6 requires it for any encouragement shown. This PRD proposes the switch ships with Phase 1. Confirm.
2. **Default state.** Should Buddy encouragement be on or off by default? (Proposed: on, with the switch visible in Settings on first run.)
3. **Protein threshold.** Phase 1 and 2 count a day as reached at 100% of target (matching the existing `proteinGoalReached` code). The weekly insights PRD proposes 90%. Choose one value for both.
4. **Calorie over-target styling.** Today marks calories as over target with amber (`ring.over`, `bar span.over`). P2 says no. Confirm removal, and confirm whether calorie totals should keep a neutral bar at all.
5. **Calorie figures on Week.** The weekly insights PRD includes average kcal on the Week card. Should that card and the buddy card sit side by side, or should calories stay only in the insights card and never in the buddy card? (Proposed: calories never in the buddy card.)
6. **Where the switch is stored.** A profile flag (synced across devices, needs a migration) or a per-device setting (no migration, but a second phone may still show encouragement)? (Proposed: profile flag.)
7. **Rest-day limit.** Is 2 rest days per rolling 7 days the right limit? Should a rest day need no mark, with an automatic rest day after a missed day? (Proposed: manual marks only, so the user chooses.)
8. **Streak model.** Keep the run model in section 4.4, or use a simpler rolling "days logged in the last 7 days" count with no streak word at all? The second is simpler and carries no loss-shaped risk.
9. **Protein and carbohydrate glimpse.** Those fields already exist. Ship the protein and carbohydrate glimpse with Phase 2, or hold it for Phase 4 with fibre? (Proposed: Phase 4, so all nutrient glimpses ship together.)
10. **Vitamins at all?** Estimate accuracy for vitamins is weak. Should Phase 4 show fibre only, or fibre plus named vitamins, or no vitamins until a reliable source exists? (Proposed: fibre only until the accuracy check passes.)
11. **Vitamin list.** If vitamins are shown, which ones, and in which units?
12. **Milestone thresholds.** What counts as a fibre or vegetable milestone (for example, a day with 25 g of fibre estimated), and is the threshold a fixed value or user-set? Fixed values are proposed.
13. **Phase 4 approval and Article 9.** Phase 4 must wait for counsel's view on Article 9 for meal data (progress.md, open decision 3). Confirm the timing.
14. **Notifications.** Confirm that encouragement is never sent in a notification, including the planned evening check-in.


## 13. Owner decisions (2026-10-30)

1. The Settings switch ships with phase 1.
2. The experience is on by default. The switch is a profile flag (`encouragement_enabled`), so it follows the account.
3. Protein tiers: 80% of target is "good", 90% is "great", 100% is "amazing". The tiers are never printed as percentages, following the UK consumer review.
4. Average calories stay in the insights card, not the buddy card.
5. Only figures calculated directly from the user's own entries are shown. Phase 4 nutrients need a separate decision.
6. The UK legal reviews are in `docs/legal/`. They are research memos only and need a qualified solicitor before any copy, consent text or store listing is published.
