# PRD: Repeat and favourite meals

Status: Draft v0.1 · Owner: Product · Priority: 1 of 3 · Depends on: MVP Add meal, Today, and sync (PRD sections 4 and 8)

## 1. Problem

Most people eat the same handful of meals every week (porridge, a usual lunch, a default dinner). Today, logging one of them means describing it again and waiting for an AI estimate, or typing the numbers by hand. That repeats an AI call on the user's own key, costs time, and is the main reason a 30-second log can slip past a minute. Competitors make this a standard feature: Cronometer lists "Repeat items" among its Gold features, and Lose It! and MyFitnessPal offer recent and saved foods (see Section 11).

## 2. Target user

The primary user from PRD section 2 who logs the same breakfast or lunch on most days and wants to finish in a few taps.

## 3. Goal and success metric

| Measure | Target (proposed) |
|---|---|
| Median time from "Add meal" to saved, for a repeated meal | under 10 s |
| Share of saved meals created from a recent meal or favourite | 25% or more by week 4 after release |
| Repeat meals that are later edited before saving | tracked, no target (baseline) |
| Repeat flow that makes an AI call | 0 |

## 4. Scope

### In scope

- **Repeat** action on each meal in Today (opens Add meal pre-filled with that meal's name and four values; time and meal type set to now).
- **Recent** list at the top of Add meal: the last 10 distinct meal names from the past 14 days, newest first, one tap to fill.
- **Favourite** toggle on a meal (star). Favourites appear first in the Recent list. Maximum 20 favourites per user.
- Repeat and favourite fills never call the AI provider. The saved meal is marked as a repeat, not as an estimate.
- Editing any repeated meal before saving works exactly as an edited estimate does today.

### Out of scope

- Recipes, ingredient lists, or multi-item meals.
- Automatic suggestions or machine-learned meal prediction.
- Sharing favourites with other users.
- Importing foods from other apps.
- Barcode lookup.

## 5. User flow (plain steps)

1. The user taps **Add meal**. The top of the sheet shows **Recent**: up to 10 names, favourites first.
2. The user taps a name. The name, calories, protein, carbs, and fat fill in. Meal type and time stay at their defaults (time is now, as in the current build).
3. The user taps **Save**. The meal appears in Today and the totals update.
4. To favourite a meal, the user taps the star on a Today row, or on the Recent item. The star toggles and the list updates at once.
5. To repeat yesterday's meal, the user opens that day, taps **Repeat** on the row, changes the time if needed, and taps **Save**.

## 6. Acceptance criteria

1. Tapping a Recent item fills name and four values from the source meal without any network call to an AI provider (verified by a test that fails if `POST /estimates` is called).
2. The Recent list shows at most 10 distinct names (case-insensitive match) from the last 14 days in the user's local time zone.
3. Favourites are listed before non-favourites and never exceed 20 per user; the 21st star shows a message and does not save.
4. A repeated meal saved with no edits is stored with a source value of `repeat`, distinct from AI estimates.
5. Repeat and favourite data are available offline (the list is read from the local store); a repeated meal logged offline syncs once without duplication, using the existing idempotency key.
6. Deleting a favourite does not delete the meals that used it.
7. The save path for a repeated meal completes in under 10 s median in a manual test on a mid-range phone and on web.
8. Edit and delete on repeated meals behave as they do for other meals (optimistic version check via `If-Match` still applies).
9. Account deletion removes favourites along with meals (FR-9).
10. Meal content does not appear in logs or analytics events (FR-10).

## 7. Dependencies on existing code

- `web/src/screens/AddMeal.tsx`: add the Recent list above the describe field and the pre-fill path; `source` must be set to `repeat`.
- `web/src/screens/Today.tsx`: add Repeat and star controls to each `li.meal-item`.
- `web/src/screens/EditMeal.tsx`: no change expected, but confirm it preserves `source`.
- `web/src/api.ts`: `createMeal` (`NewMeal` with `client_id` and `source`) is reused; add a favourites call or field on `Meal`.
- Backend: a `favourite` flag on meals or a small favourites table (needs an Alembic migration; `backend/migrations`). A query for distinct recent names needs an index on user and `eaten_at`.
- Offline store (PRD FR-8): the Recent list must be derived from locally stored meals.

## 8. Privacy and data notes

- Meal names and macros are health-adjacent. The feature stores no new category of data beyond a favourite flag and a `repeat` source label.
- No new third party. Repeat flows never send text or photos to an AI provider, so the consent gate (PRD section 4 item 9) is not triggered.
- Recent names are computed from the user's own meals and are never shown to anyone else.
- Favourites are deleted with the account and included in any future data export (PRD section 4 out-of-scope list).

## 9. Open questions

1. Should the Recent list look back 14 days, or the full history? (Proposed: 14 days, to keep the list short.)
2. Should a repeat copy the original time, or always use now? (Proposed: now, consistent with the current default.)
3. Is a favourite a per-name setting or per-row? (Proposed: per name, so a favourite applies to every future repeat.)
4. Does the owner want favourites to appear on Week, or only in Add meal and Today?

## 10. Notes on the competitor evidence

Cronometer's "Repeat items" under Gold is taken from its App Store listing at https://apps.apple.com/us/app/cronometer-nutrition-tracker/id1145935738 (fetched 2026-10-30). Competitor claims about recent and saved foods in Lose It! and MyFitnessPal are unverified, as the official pages were not retrievable.

## 11. Sources

- Cronometer App Store listing, Gold features including "Repeat items": https://apps.apple.com/us/app/cronometer-nutrition-tracker/id1145935738
