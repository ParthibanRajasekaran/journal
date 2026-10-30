# PRD: Storytelling moments

Status: Draft v0.1 · Owner: Product · Depends on: Buddy encouragement (`docs/prd-features/buddy-encouragement.md`, sections 4 to 6 and owner decisions in section 13), Weekly insights, Quiet daily summary and reminders, Today, Week, Settings

This PRD defines the small set of messages Journal may show when something worth noticing happens. It sets the wording, the trigger, the data used, and the timing rules. It is a product spec: it does not change code. Copy in this document is a fixed template list. Every line must pass the UK legal and copy review the owner requested (buddy PRD section 13, decision 6) before it is published.

## 1. Principles

**What the story is.** Journal's story is a calm record of the user's own healthy habits: logging consistently, reaching protein goals in tiers, and a rhythm across the week. A moment is a single, short sentence that marks one of these things at the moment it happens. Most days have no moment at all, and that is correct.

**What the story never is.**
- Never judgement of food, a meal, or the person. No "good" or "bad" food words.
- Never calorie praise, calorie targets, "under" or "over" language, or any calorie figure in a moment (buddy P1 and owner decision 4).
- Never guilt or blame: no "missed", "failed", "behind", "again", day counts for a gap, or "you should".
- Never a streak-loss message, a streak count, or any number that falls because of a missed day (buddy P5).
- Never a comparison with other users, past weeks, or a target the user did not set.
- Never a ranking, badge, confetti, sound, or achievement (buddy P3 and PRD section 4 out of scope).
- Never generated text. All wording comes from the fixed list in section 2.
- Never a notification that carries a moment (see section 5).

**Craft rules.**
- One sentence per moment, at most one exclamation mark, no emojis.
- A moment uses only the user's own entries (owner decision 5). No estimate is presented as a measured value.
- The user can always ignore a moment. Nothing waits for a tap.

## 2. The moment catalogue

Each moment has an ID used by the caps, cool-downs and measures in sections 3 and 7. Figures come from saved meals only. "Local day" means the user's local time zone (`userTz`).

### M0. Calm acknowledgement (every save, not a moment)

- **Trigger:** any saved meal, when no other moment wins the save line (section 3.1).
- **Data:** none.
- **Wording:** "Logged. Nice work keeping track."
- **Note:** this is the confirmation the user expects after a save. It is not counted in any cap.

### M1. First meal, ever

- **Trigger:** the save that makes the account's meal count go from 0 to 1.
- **Data:** meal count only (derived from the saved meal list; no new storage).
- **Wording:** "Your first meal is logged. Good start."
- **Cap:** once per account.

### M2. First log of the day

- **Trigger:** the first save on a local day when that day had zero meals before the save.
- **Data:** count of meals on the day before the save (0).
- **Wording:** "Logged. Nice start to your day."
- **Cap:** once per local day. It replaces M0 on that save only.

### M3. Protein, good tier (80% of target)

- **Trigger:** the day's protein total, including the saved meal, first reaches at least 80% of a set, non-zero protein target. Shown once per day.
- **Data:** the day's protein total and target. No figure is shown.
- **Wording:** "Good progress on protein today."

### M4. Protein, great tier (90% of target)

- **Trigger:** the day's protein total first reaches at least 90% of target. Shown once per day. It can follow M3 on the same day.
- **Data:** as M3.
- **Wording:** "Great! You're close to today's protein goal." (The current code says "nearly at". "Close" is proposed because "nearly" can read as "not yet enough". Copy review to confirm.)

### M5. Protein, amazing tier (100% of target)

- **Trigger:** the day's protein total first reaches the target. Shown once per day. It can follow M3 and M4 on the same day.
- **Data:** as M3.
- **Wording:** "Amazing! You've reached your protein goal for today."

Tier rules: tiers are never printed as percentages (owner decision 3). A tier message never repeats on the same day. A lower tier never shows after a higher tier on the same day. Below 80% there is no protein message at all, and that is not a gap in the story.

### M6. Several meals in one day

- **Trigger:** the save that makes the day's meal count reach three. Shown once per day.
- **Data:** count of meals on the day (3). Meal types and names are not used.
- **Wording:** "Three meals logged today. Nice rhythm."

### M7. Week summary (standing card on Week, not a pop-in)

- **Trigger:** the Week screen is shown. The card is always present when the buddy card is on (buddy PRD section 4.3).
- **Data:** days with at least one meal (X of 7), and the counts of days in each protein tier from `weekLines` in `web/src/encouragement.ts`. No calorie figure, average, percentage, or ranking.
- **Wording:** the existing `weekLines` output, unchanged. "You logged on X of 7 days." plus one tier line per tier that occurred, for example "Amazing: you reached your protein goal on Y days." Zero-meal week: "Log a meal and your week will show up here."
- **Rule:** the card is standing content. It does not animate, does not announce itself, and is not counted in caps.

### M8. First full week

- **Trigger:** the first Week view on or after the account's seventh day, provided at least one meal was logged in the account's first seven days. Shown once per account, on that Week view only.
- **Data:** account age in days and the first-seven-days meal count (derived). Needs a stored "seen" flag (section 3.6).
- **Wording:** "This is your first week with Journal. Nicely done."

### M9. Rest day marked (conditional)

- **Trigger:** the user marks a rest day. Only if the owner approves the rest-day feature in buddy PRD section 4.4 (Phase 3). If it is not approved, this moment is dropped.
- **Data:** the mark itself. No meal data.
- **Wording:** "Rest day noted."
- **Cap:** once per mark. It is shown on the save-line slot (section 5).

### M10. Return after days away

- **Trigger:** the first save after three or more consecutive local days with zero meals. The length of the gap is not computed for display and is never shown.
- **Data:** the date of the last meal (used only to decide eligibility).
- **Wording:** "Good to see you back. Logged."
- **Cap:** once per 14 days. It never shows on a day when M1 applies.

### M11. Quiet invitation (after 7 days, not a moment)

- **Trigger:** the app is opened on a local day when the account has had zero meals for seven or more consecutive local days. Shown on Today only, after the empty-day state is visible.
- **Data:** the date of the last meal.
- **Wording:** "Whenever you're ready, add a meal."
- **Cap:** at most once per 14 days, and never by notification. Dismissing it stops it for 14 days.

### Not a moment: quiet day

A day with no meals shows only the neutral Today empty state: "Nothing logged for this day yet." and the "Add your first meal" button. A quiet day never has a moment, a count of days away, or a highlighted gap.

## 3. Timing and frequency rules

### 3.1 One line per save

- Each save shows at most one line on the save line.
- Priority, highest first: M1, M10, M5, M4, M3, M6, M2, M0. If M1 applies, no other moment shows on that save.
- A moment that loses priority on a save is not carried over to a later save. The day's tier still counts on Week (M7).
- This replaces the two-line rule in buddy PRD section 4.2 (calm line plus protein sentence). See open question 1.

### 3.2 Caps

| Cap | Limit (proposed) |
|---|---|
| Moment lines per session (app open until closed or 30 minutes idle) | 2 |
| Moment lines per local day, across all surfaces | 3 |
| Calm lines (M0, M2) | no cap; they are not moments |
| Standing content (M7) | no cap; it is not a moment |
| Moments on Today while the check-in card is visible (evening check-in PRD) | 0; one prompt per screen |

Once a cap is reached, the save line shows M0 and nothing else.

### 3.3 Cool-downs

| Moment | Cool-down |
|---|---|
| M1 | once per account |
| M2 | once per local day |
| M3, M4, M5 | once per local day each; each tier at most once per day |
| M6 | once per local day |
| M8 | once per account |
| M9 | once per mark |
| M10 | once per 14 days |
| M11 | once per 14 days |

Between different moments: no two moments on the same save. Between sessions: a moment that was shown in the last 10 minutes does not repeat on a new session on the same device.

### 3.4 When a moment would repeat

If a moment's cool-down or cap blocks it, the save line falls back to the next eligible line in the priority list, and finally to M0. A moment is never shown twice in place of a blocked one, and a blocked moment is never shown as a different wording.

### 3.5 After a dismissal

A dismissal is a tap on the line or a keyboard dismissal before its timeout. A timeout is not a dismissal.

- The dismissed moment ID is suppressed for the rest of the session and for 7 days on the device.
- Two dismissals of the same moment ID within 30 days turn that moment off for 60 days.
- Three dismissals of any moments within 7 days pause all moments (M1 to M11 except M7 and M0) for 14 days. The calm line M0 still shows.
- A dismissal never changes M0, M7 or the Week figures.

### 3.6 Where state lives

- Caps, cool-downs and dismissals are kept on the device (localStorage, read and written in try/catch). If storage is unavailable, the app fails closed: M0 only, no moments.
- Once-per-account moments (M1, M8) need a stored flag. Recommendation: a small set of moment IDs on the profile (no food data), so it follows the account. This needs a migration. See open question 5.
- A second device can show a moment that the first device already showed. This is accepted at launch.

## 4. Quiet-period rules

Quiet periods are the most important check on "too little" and "too much". Silence is the default.

| Days since last logged meal (local days) | What the app shows |
|---|---|
| 0 to 1 | Normal. Today shows its normal state. No moment is added. |
| 2 to 6 | Silence. No invitation, no moment, no count of days. Week shows the standing card with its neutral lines. |
| 7 or more | At most one quiet invitation (M11) on Today, once per 14 days. Never a notification. |

Rules:
- Nothing in the app counts days away, shows a gap, or uses words such as "missed", "again", "lost" or "back" as a reproach.
- No notification is sent because of absence. The only reminder is the evening check-in in its own PRD, which is off by default and carries no moment.
- The return message (M10) appears once, on the first save after a gap. It does not repeat on later saves that day.
- The Week card's neutral lines show the week as it is and do not highlight the gap.

## 5. Where each moment appears

| Surface | Carries a moment? | Which |
|---|---|---|
| Save line on Today (after a meal is saved, or a rest day is marked) | Yes | M0 to M6, M9, M10 (priority in section 3.1) |
| Today, otherwise | Only M11 | Quiet invitation, after 7 days, once per 14 days |
| Week card above the day tiles | Standing content | M7; M8 on the first qualifying Week view |
| Notifications, including the evening check-in and any future push | No | Never. The check-in text stays "Time to log today?" with no meal or calorie content |
| Lock screen, email, export, sharing | No | Never |
| Edit and delete confirmations, error and loading states, the AI estimate hourglass | No | Never |
| Add meal form, EditMeal, meal list | No | Never |
| Settings (other than the switch and its helper line) | No | Never |
| Sign-in, onboarding screens | No | Never |

Current code to change to match this PRD (for the owner to note, not to build here):
- `web/src/screens/Today.tsx` fires confetti when the protein tier is "amazing". Buddy PRD section 4.2 and PRD section 4 forbid confetti. Remove it.
- `web/src/screens/Today.tsx` marks calories as over target in amber (`ring over`, bar `over`). Buddy P2 requires removal. See open question 4.

## 6. Settings control

**Recommendation: one switch, and nothing finer at launch.**

- One switch, "Buddy encouragement", as set in buddy PRD section 13. It is on by default and stored as the profile flag `encouragement_enabled`.
- When it is off: no moment, no M0 line, no Week card, no quiet invitation, and no encouragement in notifications (buddy PRD section 4.5). Stored data is kept, and turning it back on restores the views without a reset.
- No per-moment toggles. Each toggle is a decision the user must make, and the owner's direction is few options.
- Possible later option, only if the measures in section 7 call for it: a second setting, "Fewer messages", that halves every cap. Do not build it until the data shows the switch alone is not enough.

Owner decisions:
- Whether a "Fewer messages" choice is offered at all (recommended: not at launch).

## 7. Measures

All measures are aggregate counts. Clients send only daily totals per moment ID. No account identifier, no meal content, no calorie or macro figure, and no timestamp finer than a day is recorded. Any figure built from fewer than 20 accounts is not shown.

### 7.1 Counts

- **Impressions:** a moment line rendered, per moment ID per day.
- **Dismissals:** a moment line dismissed by tap or keyboard before its timeout, per moment ID per day.
- **Repeat impressions:** an impression of the same moment ID on the same device within 7 days. Counted on the device and sent as a daily total.
- **Moments per active day:** the number of moment lines shown per day, for accounts that logged that day. Median and 95th percentile per week.
- **Switch-off rate:** the share of accounts that turn the switch off within 2 weeks of a moment being shown to them. Counted from the switch change, not from any moment.
- **Logging days per week:** for accounts in the moments-on group and the holdout group.
- **Holdout:** about 10% of accounts see no moments (M0 and M7 only), assigned by a salted hash at runtime. The holdout is not exported as a list.

### 7.2 Thresholds that turn a moment down

| Measure | Threshold | Action |
|---|---|---|
| Dismiss rate for one moment (dismissals ÷ impressions) over 2 weeks | above 20% | Halve that moment's cool-down |
| Dismiss rate for one moment over 2 weeks | above 35% | Turn that moment off until the wording is reviewed |
| Repeat impressions (repeat ÷ impressions) over 1 week | above 5% | Treat as a bug in the cool-down; fix before any other change |
| Repeat impressions over 4 weeks | above 10% | Turn the moment off |
| Moments per active day | median above 2, or 95th percentile above 3 | Treat as a cap breach; fix |
| Switch-off rate within 2 weeks of a launch | above 15% (buddy PRD target) | Stop adding moments; review all wording and caps |
| Switch-off rate | above 20% | Turn M1 to M11 off and keep M0 and M7 only |
| Logging days per week, moments-on minus holdout, after 4 weeks | below minus 0.3 days | Reduce the caps to 1 moment per day |
| Logging days per week, moments-on minus holdout, after 8 weeks | between minus 0.1 and plus 0.1 days | The moments are not helping. Review the catalogue; do not add more |
| Share of active weeks with no moment for accounts with four or more logged days | above 60% | Too little. Review triggers; do not raise caps |

Measures are reviewed every 2 weeks after launch. A threshold is a trigger for review, not an automatic decision, unless the table says "turn off".

## 8. Open questions for the owner

1. **Save line content.** Buddy PRD section 4.2 asks for the calm line and the protein sentence together. This PRD proposes one line per save, chosen by priority (section 3.1), which matches the current code. Confirm, and say whether the buddy PRD should be updated.
2. **Confetti.** The current Today screen fires confetti on the top protein tier. Buddy PRD says no confetti. Confirm removal (recommended).
3. **Calorie over-target styling.** Confirm removal of the amber calorie states on Today (buddy P2 and open question 4). Owner decision 4 covers the insights card only.
4. **Caps.** Confirm 2 moment lines per session and 3 per local day. Both are proposals.
5. **Once-per-account flags.** Store M1 and M8 flags on the profile (needs a migration, follows the account) or per device (no migration, may repeat on a second device)? Recommended: profile.
6. **Rest-day moment.** M9 depends on the Phase 3 rest-day feature, which is not approved. Drop M9 if Phase 3 is not approved.
7. **Protein caveat on moments.** Buddy P4 requires "Approximate, based on what you've entered." on every figure derived from estimates. Save-line tier messages show no figure. Recommended: the caveat appears on the Week card (where it already does) and not on the save line. Confirm.
8. **Wording review.** Confirm the proposed "close" wording for M4, and the legal and copy review before publication (owner decision 6). No line may be published before that review.
9. **Holdout.** Confirm a 10% holdout with moments off, for 8 weeks, is acceptable.
10. **Eating-disorder safety signposting.** The teen-access research (safeguard 4) recommends signposting when logging suggests restriction. Moments never reward low intake, but the app has no signpost today. Decide whether a separate safety PRD should cover this, and whether this PRD should wait for it. Recommended: a separate safety PRD, reviewed by clinical or charity input, before launch.
11. **Evening check-in and moments.** Confirm that on any screen where the check-in card is visible, no moment shows (section 3.2).
12. **Dismiss by timeout.** The note timeout is 3.5 seconds in code and 4 seconds in buddy PRD. Confirm one value. Timeouts do not count as dismissals in this PRD.
