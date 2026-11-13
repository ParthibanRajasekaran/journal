# Journal: feature status and prioritised plan

Date: 2026-10-30 · Prepared by: Product Owner review (read-only) · Scope: MVP PRD (`docs/prd.md`) and the Today, Add, Week and Settings screens.

## 1. What was run

| Check | Command | Result |
|---|---|---|
| End-to-end (live site, read-only) | `npm run e2e` in `web/` | 12 passed, 8 skipped |
| Web unit tests | `npm test` in `web/` | 31 passed (6 files) |
| API tests (local, PostgreSQL on 5433) | `.venv/bin/python -m pytest -q` in `backend/` | 247 passed, 2 warnings |

- The 8 skipped tests are the signed-in specs in `web/e2e/signed-in.spec.ts`. They skip because `E2E_STORAGE_STATE` is not set. This is expected. No sign-in was attempted and no credentials were used.
- The Playwright config points at the live site by default (`web/playwright.config.ts:7`). The run was read-only.
- The working tree has uncommitted changes that were not in the starting snapshot: `web/e2e/signed-out.spec.ts`, `web/src/screens/SignIn.tsx`, `web/vite.config.ts`, and the untracked `web/src/edge.test.ts`. They were not reviewed or changed here.

## 2. Status rules

- **Working:** a passing automated test covers the behaviour (API, unit or e2e), and the screen code matches it.
- **Not verified:** no passing test covers the UI path, and it needs a signed-in session to check.
- **Not working:** the code or a test shows a defect.
- **Not built:** no code exists for it.

## 3. Feature status

| # | Feature | Status | Evidence |
|---|---|---|---|
| 1 | Sign-in and 18+ confirmation | Working | `web/e2e/signed-out.spec.ts:11` (button stays disabled until "I am 18 or older" is ticked), `:19` (failed sign-in message), `:4` (copy). `web/src/screens/SignIn.tsx`. Backend: `backend/tests/test_auth.py:168`, `:198`, `:209`. |
| 2 | Sign-out | Working | Backend: `backend/tests/test_auth.py:321` (needs CSRF and session, then revokes). Code: header button in `web/src/App.tsx`, and `web/src/screens/Settings.tsx` (Account card). UI click not run. |
| 3 | Account deletion | Working | Backend: `backend/tests/test_days_and_profile.py:140` (meals removed, session ended). Keys and refresh tokens cascade (`backend/app/db/models.py:113`, `:131`). Code: `Settings.tsx` `DeleteAccount` with a two-step confirm. |
| 4 | Daily targets | Working | Backend: `backend/tests/test_days_and_profile.py:95`. Web: `Settings.tsx` `TargetsForm`, `Today.tsx` `SummaryCard`. Gap: the hint says "800–6000" but the client does not enforce it (see item 11). |
| 5 | AI key help and saving keys | Working | Backend: `backend/tests/test_ai_keys.py:85`, `:126`, `:137`, `:145`, `:164`, `:261`. Web: `web/src/api.test.ts:77` (key never in URL), `:85` (consent sent as set). Gap: the paste field in `web/src/screens/KeyHelp.tsx` appears only after a provider link is clicked (see item 5). |
| 6 | Estimates (text), questions and re-estimate | Working | Backend: `backend/tests/test_estimates.py:71`, `:77`, `:83`, `:159`, `:196`, `:228` (max two rounds), `:237`. Code: questions block and replace-guard in `web/src/screens/AddMeal.tsx`. Gap: UI not run. |
| 7 | Manual entry | Not verified | `AddMeal.tsx` ("Enter the numbers myself", `problem()` checks). Backend create and validation: `backend/tests/test_meals.py:121`. No test covers the manual UI, and it needs a session. |
| 8 | Save meal | Working | Backend: `backend/tests/test_meals.py:69` (201), `:79` (replay with same key returns same meal), `:90` (conflicting key refused). Web: `api.test.ts:26` (client id as idempotency key). Gap: failed saves show the raw browser text "Failed to fetch" (see item 2). UI not run. |
| 9 | Edit meal | Working | Backend: `backend/tests/test_meals.py:165` (stale version refused). Code: `web/src/screens/EditMeal.tsx` shows a reload prompt on 412. |
| 10 | Delete meal | Working | Backend: `backend/tests/test_meals.py:192`. Code: confirm step in `Today.tsx`. |
| 11 | Day navigation | Working | `web/src/dates.test.ts:10` (day arithmetic across months and years). Code: prev/next in `Today.tsx`; next is disabled on today. Backend: `backend/tests/test_days_and_profile.py:44`. |
| 12 | Week view | Not verified | Playwright: `web/e2e/signed-in.spec.ts:30` (skipped). API: `backend/tests/test_days_and_profile.py:70` (seven days, zero-filled). Code: `web/src/screens/Week.tsx`. |
| 13 | Protein tiers and save message | Working | Unit: `web/src/encouragement.test.ts:4`, `:12`, `:18`, `:27`. `web/src/edge.test.ts:29`. Code: saved note in `Today.tsx` (4 s, dismissible). Gap: the on-screen note is not e2e-tested. |
| 14 | Buddy switch | Working | Backend: `backend/tests/test_days_and_profile.py:123` (on by default, switch off). Code: `Settings.tsx` `EncouragementCard`; the Week card hides when off. UI not run. |
| 15 | Macro split | Working | Unit: `web/src/screens/MacroSplit.test.ts:5`, `:13`. Code: `MacroSplit.tsx`. |
| 16 | Drinks and other meal type | Working | Backend: `backend/tests/test_days_and_profile.py:114`. Code: "drinks and other" heading in `Today.tsx`; "Other" radio in `TimePicker.tsx`. |
| 17 | Time and meal picker | Working | Unit: `web/src/screens/TimePicker.test.ts:4`, `:14` (rounding, 60 minutes carry), `:25`. `web/src/edge.test.ts:8`, `:12`, `:23`. |
| 18 | Session refresh | Not working (UX) | Mechanics are Working: `web/src/api.test.ts:58` (one refresh, then retry), `:70`; backend `backend/tests/test_auth.py:284` (rotation and reuse revokes). Defect: when the refresh fails, Today, Week and Add show "Couldn't load this day. Sign in required." with "Try again". Only the boot-time `/me` check in `web/src/App.tsx` sends the user to sign-in. See item 1. |
| 19 | Offline behaviour | Not built | No service worker, IndexedDB or local queue in `web/src`. `docs/progress.md` lists the Capacitor shell as not started. PRD FR-8 is a Must. The API already accepts an `Idempotency-Key`, which a queue could reuse. |
| 20 | Photo input | Not built | `AddMeal.tsx` takes text and manual entry only. No photo route in `backend/app/routes/`. PRD section 4, item 4 includes photos. |
| 21 | Export | Not built (out of MVP scope) | PRD section 4 lists codebase and data export as removed from MVP. No export code exists. Owner to confirm. |

Other PRDs (`docs/prd-features/`: repeat and favourite meals, weekly insights, storytelling moments, quiet daily summary and reminders) have no code in `web/src` or `backend/app`. Buddy phase 1 and 2 are the only parts built.

## 4. Defects found

1. **Session expiry is a dead end.** `web/src/App.tsx` checks the session only on load. Later 401s reach `Today.tsx` and `Week.tsx`, which show the server text ("Sign in required.") with "Try again". The user is not sent to sign-in unless they reload.
2. **Raw network text.** `web/src/api.ts` does not catch `fetch` rejections. The screens show `err.message`, so offline users see "Failed to fetch" on load, estimate and save.
3. **Key paste gated behind a link.** `web/src/screens/KeyHelp.tsx` shows the paste form only after the user clicks a "Get a key" link. That link opens a new tab. This is the step that unblocks estimates.
4. **Settings target copy.** The hint "Calories (800–6000)" is not checked on the client. Server errors show in a `role="status"` line, not an alert.

## 5. Prioritised plan (12 items at most)

Ordered by how much each item blocks a real user. Blocking items come first, then items that make the experience worse, then polish.

| # | Item | Owner | Effort | Acceptance check |
|---|---|---|---|---|
| 1 | When any request returns 401 after refresh fails, return to the sign-in screen with a calm message. | web | S | Expire the session in a test, then load Today: the sign-in screen shows, with no "Sign in required." text. |
| 2 | Replace "Failed to fetch" with plain copy on load, estimate, save and key save ("Check your connection. Your meal is still here."). | web, copy | S | Block the network, submit a meal: the message is plain and the typed meal is still on screen. |
| 3 | Owner creates a dedicated test account and provides `E2E_STORAGE_STATE` (see section 6). | owner | S | `npm run e2e` shows 0 skipped, 20 passed. |
| 4 | Add signed-in UI tests for: estimate with questions, manual save, edit, delete, key save, Week tap-through. | web | M | Each flow passes on the live site with the test account. |
| 5 | Show the key paste field without requiring a provider link click; keep the links as help. | web, design | S | Open the key help: a paste field is visible at once, and the three provider links still open in a new tab. |
| 6 | Offline logging: queue saves on the device and sync with the existing `Idempotency-Key`. | web, api | L | Save in airplane mode, reconnect: the meal appears once on the server (replay test), and the photo or text is not lost. |
| 7 | Photo input for estimates (PRD job 1), with the photo deleted after estimation unless the meal is saved. | web, api, product | L | Photo to estimate to save works on the live site; a test shows the photo is deleted after estimation. Needs item 8 first. |
| 8 | Decide the default AI provider (Gemini free tier may train on content). | product, legal | M | The decision is recorded in ADR-005 and PRD section 11; FR-7 is tested. |
| 9 | Counsel review of consent and claims copy (the sign-in promises, the key consent line). | legal | M | Written sign-off from a qualified solicitor is filed in `docs/legal/`; copy is frozen. |
| 10 | Update `docs/progress.md`: authentication is shown as "Not started", but auth routes and tests exist. | product, copy | S | The phase table matches the code and the test counts. |
| 11 | Enforce the calorie and protein ranges on the client, or remove the hint, and show errors in an alert. | web, copy | S | Out-of-range values show the range message before any request is sent. |
| 12 | Owner confirms export and voice notes are out of MVP scope, then the PRD says so. | product | S | PRD section 4 lists export and voice as out of scope with no open items. |

## 6. What cannot be tested until the owner acts

Without a dedicated test account, these cannot be verified against the live site:

- The 8 signed-in e2e tests (Today, Add, Settings, Week).
- Save, edit and delete meal in the UI.
- Estimates, questions and re-estimate in the UI.
- AI key save in the UI (the API is covered by tests, but not against the real provider).
- Buddy switch on the live site, the saved-meal note, and the Week summary.
- Session expiry behaviour (item 1).

What to ask the owner for:

1. A dedicated test Google account, used only for Journal tests.
2. A saved browser session for that account, supplied as `E2E_STORAGE_STATE` (a file path on the test machine). Do not share the password in chat or in files.
3. A test AI key with a spending cap, if the owner wants live estimate tests.
4. The decision on the default AI provider (item 8) and the counsel review (item 9).
5. Confirmation that photo input and export are in or out of the MVP (items 7 and 12).
