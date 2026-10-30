# PRD: Weekly insights

Status: Draft v0.1 · Owner: Product · Priority: 2 of 3 · Depends on: Week screen, daily targets (PRD sections 4 and 5)

Note: PRD section 4 currently lists "trend charts beyond the Week list" as out of scope for MVP. This feature is a post-MVP proposal. The owner needs to amend that line before build.

## 1. Problem

The Week screen shows a list of seven days with totals, but it does not say what the week means. A user who wants to know "am I hitting protein most days?" must read seven rows and do the arithmetic. Competitors place insights and trend views behind paywalls (Cronometer Gold lists "deeper insights"; Cal AI and SnapCalorie advertise trend tracking; see Section 10). Journal can offer a plain weekly read for free because it needs no AI call.

## 2. Target user

The primary user from PRD section 2 who reviews the past week (Job 3) and cares about one or two nutrition habits, most often protein.

## 3. Goal and success metric

| Measure | Target (proposed) |
|---|---|
| Users who open Week at least once a week | 50% of weekly actives by week 6 |
| Users who set a protein target after seeing insights | 20% of users who view insights |
| Correction rate: meals edited after a Week review | tracked, baseline |
| AI calls made for insights | 0 |

## 4. Scope

### In scope

A summary card at the top of the Week screen, showing for the displayed week:

- Days logged (count of days with at least one meal), out of 7.
- Average calories per logged day, against the calorie target if set.
- Days that met the protein target, out of logged days, if a protein target is set.
- A seven-bar strip, one bar per day, height equal to protein eaten as a share of the protein target (bars capped at 100%; a day with no meals shows an empty slot).
- One plain sentence describing the week (for example: "You hit protein on 4 of 6 logged days."). Sentences come from fixed templates; no generated text.
- If no protein target is set, the card shows the first three figures and a single link to Settings to set one.

### Out of scope

- Monthly, yearly, or custom ranges.
- Micronutrients, weight, sleep, or activity.
- AI-written commentary or advice.
- Charts beyond the seven-bar strip.
- Medical or condition-specific guidance (PRD section 4 out-of-scope list).
- Export and sharing.

## 5. User flow (plain steps)

1. The user opens Week. The summary card sits above the seven day tiles.
2. The card shows days logged, average kcal, and protein days, followed by the bar strip and one sentence.
3. The user taps a bar. The app opens that day on Today (existing behaviour).
4. If there is no protein target, the user taps "Set a protein target", which opens Settings with the field focused.
5. The user changes the week with the existing arrows. The card updates for the new week.

## 6. Acceptance criteria

1. The card values match the sum of the saved meals for each day, computed in the user's local time zone (tested with a fixture crossing midnight in a non-UTC zone).
2. "Days that met the protein target" counts only days with at least one meal, and a day counts as met at 90% or more of the protein target (a value to confirm; see open questions).
3. No meal data is sent to an AI provider or to any third-party service to produce the card.
4. With no protein target, the card hides the protein figures and shows the link to Settings; no error appears.
5. The card renders with the same figures when a week has zero meals (days logged 0, averages shown as an em dash, no division by zero).
6. The bar strip has a text equivalent for screen readers (for example, "Monday: 82% of protein target") and meets WCAG 2.2 AA contrast.
7. The card loads within the API p95 target of 300 ms for a week of data.
8. The sentence template never states a health claim; the test suite includes a check that all templates come from the fixed list.
9. Changing a meal on a day updates the card on return to Week (no stale cache beyond the existing refresh behaviour).

## 7. Dependencies on existing code

- `web/src/screens/Week.tsx`: add the card above the list; the current component fetches `api.week(start, tz)` and renders day tiles.
- `web/src/api.ts`: `Totals` needs a `protein_g` field (confirm the field is present in the response; `Totals` currently drives the tile). `api.week` already takes `tz`.
- `web/src/api.ts` `Profile.daily_targets`: the protein target is read from here; `api.updateMe` writes it.
- Backend week endpoint (`GET /week`): confirm it returns protein per day, or add it. Keep the computation server-side so the client does not need all meals.
- `web/src/dates.ts`: `mondayOf`, `addDays`, `localDay` are reused.

## 8. Privacy and data notes

- The feature derives statistics from data the user already has. It adds no new collection, storage, or sharing.
- It is health-adjacent: the sentence templates must describe the user's own numbers and must not label foods as good or bad.
- Weekly figures must not be cached in a shared store or sent in analytics events. If analytics are added, only the event "insights viewed" with no values.
- The Article 9 status of meal data is still an open decision (progress.md, open decision 3). Treat these figures with the same safeguards as meal data until counsel confirms.

## 9. Open questions

1. What counts as "met" for protein: at least 100% of target, or at least 90%? (Proposed: 90%, to avoid penalising a near miss.)
2. Should averages include days with fewer than three meals? (Proposed: include, with the logged-days figure shown next to it.)
3. Does the owner accept a bar strip as the only chart, or is it still "trend charts" that need an amendment to PRD section 4?
4. Should the card also appear on Today as a one-line summary? (Proposed: no, to keep Today simple.)

## 10. Competitor sources

- Cronometer Gold lists "deeper insights" among paid features: https://apps.apple.com/us/app/cronometer-nutrition-tracker/id1145935738 (fetched 2026-10-30).
- Carb Manager advertises "advanced insights" on its public page, and says premium recipes and meal plans are paid: https://www.carbmanager.com/ (fetched 2026-10-30). Which insights are free is unverified.
- SnapCalorie advertises "smart insights: trend tracking and goal monitoring" on its public page, with core features described as free: https://www.snapcalorie.com/ (fetched 2026-10-30). The "free forever" claim is the vendor's own and is unverified.
- Cal AI App Store listing: "food scanning analysis results require a subscription": https://apps.apple.com/us/app/cal-ai-calorie-tracker/id6480417616 (fetched 2026-10-30).
- MyFitnessPal Premium and Premium+ feature split: the official support page returned HTTP 403 on fetch; the App Store listing says Premium+ includes "full nutrition-focused meal planning": https://apps.apple.com/us/app/myfitnesspal-calorie-counter/id341232718. Insight-specific details are unverified.

## 11. Dependencies on privacy decisions

Owner decision needed before build: whether Article 9 applies to meal data (progress.md open decision 3). The card works either way but its storage and logging rules depend on the answer.
