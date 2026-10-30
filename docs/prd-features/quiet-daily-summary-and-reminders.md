# PRD: Quiet daily summary and time-zone-aware reminders

Status: Draft v0.1 · Owner: Product · Priority: 3 of 3 · Depends on: Today, Settings, auth (ADR-004), native shell (ADR-003)

## 1. Problem

Users forget to log. The MVP has no reminder, so a day can pass with nothing on Today and the user only notices at the end of the week. Other apps add reminders and streak messages, which many users find noisy. The owner's direction is simple flows with few options, so the feature must be opt-in, rare, and quiet.

A reminder also has a time-zone problem. A user who travels or changes the device's time zone should not get a 19:30 nudge at 03:30 local time, and a reminder must not reveal meal content on a lock screen.

## 2. Target user

The primary user from PRD section 2 who has said they want to log more often and does not want a noisy app. Likely on the phone, with the web as the review surface.

## 3. Goal and success metric

| Measure | Target (proposed) |
|---|---|
| Users who turn the summary on | 30% of active users within 4 weeks of release |
| Logging days per user per week, opted-in vs not | +1 day per week for opted-in users, after 4 weeks |
| Reminders that fire at the wrong local time | 0 in test; 0 reported in beta |
| Users who turn it off within 2 weeks | under 20% (tracked as a quality signal) |

## 4. Scope

### In scope

- **Opt-in** in Settings: one switch, "Evening check-in", and one time, default 19:30 local time.
- **Rule:** the check-in only happens on a day with no meals logged by the chosen time. It sends at most once per day.
- **In-app first:** on Today, a single quiet card ("Nothing logged yet today. Add a meal?") shown after the chosen time on days with no meals. Works on web and mobile with no permissions.
- **Native push (mobile only, phase 2 of this PRD):** one local notification per day, same rule, text "Time to log today?" with no meal or calorie content.
- **Time zone:** the reminder time is stored as local time plus the IANA zone name. When the device zone changes, the next app open recalculates the next fire time in the new zone.
- **Quiet hours:** no notification before 08:00 or after 22:00 local time, regardless of the chosen time.

### Out of scope

- Multiple reminders per day, or meal-by-meal reminders.
- Streaks, badges, or messages about missed days beyond the single card.
- Email or SMS reminders.
- Web push notifications (browser push is unreliable when the tab is closed and needs its own consent flow; revisit later).
- Daily or weekly digests sent by email.
- Using any AI provider to write reminder text.

## 5. User flow (plain steps)

1. In Settings, the user turns on "Evening check-in". A time picker shows 19:30; the user can change it. The current time zone is shown in small text.
2. On a day with no meals, once the chosen time has passed, Today shows the quiet card. Tapping it opens Add meal.
3. On mobile, a local notification arrives at the chosen time on days with no meals. Tapping it opens Today.
4. If the user logs any meal before the time, the card and notification are skipped for that day.
5. If the user travels, the next app open uses the new zone; the user does not need to change anything.
6. The user can switch the check-in off at any time; the card and notifications stop immediately.

## 6. Acceptance criteria

1. The check-in is off by default. Turning it on requires one tap in Settings and no other consent prompt.
2. The card and notification appear only when there are zero meals for the local day at the chosen time (tested at boundary times 19:29, 19:30, and midnight).
3. No more than one notification or card per local day, including after a time-zone change within the same day.
4. Notification text and card text contain no meal names, calories, macros, or photos (checked against a fixed string list).
5. When the device time zone changes, the next scheduled time is recalculated in the new zone within one app open, with no duplicate notification.
6. No notification is sent between 22:00 and 08:00 local time, even if the chosen time falls in that window (the nearest allowed time is used instead).
7. Turning the feature off removes the stored preference and cancels all scheduled local notifications on the device.
8. Account deletion removes the stored time, zone name, and any push token (FR-9).
9. The feature adds no AI call and no third-party service that receives meal data.
10. The in-app card shows only on Today, only on days with zero meals, and never before the chosen time. It does not fire when the app is closed; that is by design on web.

## 7. Dependencies on existing code

- `web/src/screens/Settings.tsx`: new section "Evening check-in" with a switch and a time field, in the same card pattern as the targets form.
- `web/src/screens/TimePicker.tsx`: reuse the time component for choosing the reminder time.
- `web/src/screens/Today.tsx`: quiet card in the empty-day state (the current `empty-day` card is the place to start).
- `web/src/dates.ts` and `web/src/api.ts`: `userTz` already exists and is sent with day and week calls; store the zone name in the profile.
- Backend `PATCH /me` and the `Profile` model: add `reminder_time` (local time string) and `reminder_tz` (IANA name). A migration is needed.
- Mobile: a local-notifications plugin under an open licence (for example from the Capacitor community; licence and maintenance to be verified). Schedule locally so no server push is needed for phase 2.
- ADR-003 (client framework) decides the shell; ADR-004 (auth) decides where the device token lives.

## 8. Privacy and data notes

- Health-adjacent: the reminder reveals the user's logging habit. Keep the text generic so a lock screen never shows food data.
- Local notifications keep data on the device. This avoids a server push service and a push token, which is the privacy-preserving default.
- If a server-side push is later added, store the token encrypted, tie it to the account, and delete it on sign-out and account deletion.
- No analytics event may include the chosen time or the zone name with a user identifier.

## 9. Open questions

1. Is the time zone name needed, or is the device local time enough? (Proposed: store the zone name so a travelling user is handled predictably; owner to confirm.)
2. Should the card show on Week too, or only Today? (Proposed: Today only.)
3. Phase 2 requires an app store developer account. Apple charges an annual fee for its developer programme; the owner must confirm this fits the free-to-run constraint, or choose web-only for now. Verify the current price at https://developer.apple.com/programs/ before deciding.
4. Should the quiet hours (08:00 to 22:00) be fixed or adjustable? (Proposed: fixed, to keep the flow simple.)
5. Are reminders on Android allowed without extra permission on recent Android versions? (Unverified; check during build.)
