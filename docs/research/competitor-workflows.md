# Competitor workflow analysis for Journal

Status: Draft v0.1 · Date: 2026-10-30 · Owner: Business analysis
Scope: public information only (official help centres, official pages, app-store listings, reputable reviews). No closed-source app was decoded, reverse-engineered or copied, and no account was logged into.

## 1. Method and labels

- **Verified (official)**: the claim was read on an official help page, policy page or official product page during this research.
- **Verified (search snippet)**: the claim appeared in the text of an official page returned by search, but the full page could not be fetched. Treated as **unverified** for requirement purposes.
- **Unverified**: third-party blog, app-store copy, aggregator, forum or review site.

Fetch limits: help.yazio.com, support.cronometer.com, support.myfitnesspal.com and support.loseit.com returned HTTP 403 or fetch errors to this research agent. Every claim sourced to those domains below is therefore **unverified** unless stated otherwise. Cal AI and SnapCalorie have no official help centre found; their statements come from privacy policies copied by third parties or app-store listings.

Competitors covered: MyFitnessPal (MFP), Lose It!, Cronometer, Carb Manager, Yazio, Lifesum, Cal AI (AI logger; SnapCalorie was checked as an alternative and is only partly covered).

## 2. Workflow tables

### 2.1 Choosing the meal and time when logging

| Competitor | How it works | Source URL | Verified or unverified |
|---|---|---|---|
| MyFitnessPal | Meal names are global settings and cannot differ per day (community answer). Time of day is not set as a field per entry in the sources found. | https://community.myfitnesspal.com/en/discussion/10893169/how-to-change-order-of-meals-in-diary | Unverified |
| Lose It! | Could not be checked. Official help site not reachable. | https://support.loseit.com | Unverified (no content retrieved) |
| Cronometer | Diary time entries reported to default to GMT in one bug thread, so a local 14:03 entry can show as 20:03. | https://forums.cronometer.com/discussion/6061/diary-time-entries-default-to-gmt | Unverified (forum) |
| Carb Manager | Logging supports a meal slot and a chosen day; a calendar picker is used to choose the date. | https://help.carbmanager.com/docs/log-one-or-more-foods | Unverified (search snippet only) |
| Yazio | Meal categories (breakfast, lunch, dinner, snacks) are used in the diary; entries sit in a meal category under a selected day. | https://help.yazio.com/hc/en-us/articles/360002401437-How-do-I-copy-Diary-entries-to-another-day | Unverified (search snippet of official page) |
| Lifesum | Not checked in detail. | https://help.lifesum.com/en/category/account-app-settings-yprcp5/ | Unverified |
| Cal AI | The photo is analysed and the result is saved to the account; no published meal-time control was found. | https://apps.apple.com/app/id6535683072 | Unverified (app-store listing) |
| SnapCalorie (partial) | App-store copy says estimates can be changed and the model learns from corrections; no meal-slot detail found. | https://apps.apple.com/app/1574239307 | Unverified |

Note: MacroFactor's official help (https://help.macrofactorapp.com/en/articles/51-log-food-to-future-days) shows a date and time picker before saving ("Log to Date and Time"). It is not in the requested list and is used only as a reference pattern. Verified (official).

### 2.2 Editing a logged meal

| Competitor | How it works | Source URL | Verified or unverified |
|---|---|---|---|
| MyFitnessPal | Web: clicking a line item opens a pop-up to change quantity or move it to another meal. Mobile: tap an entry to change serving size. | https://community.myfitnesspal.com/en/discussion/10943613/is-there-an-easy-way-to-delete-edita-food-you-entered | Unverified (community answer and third-party guide) |
| Lose It! | Could not be checked officially. | https://support.loseit.com | Unverified |
| Cronometer | Edit and delete exist; details not fetched. A forum thread about diary entries scrambling order is reported. | https://forums.cronometer.com/discussion/comment/5659/ | Unverified (forum) |
| Carb Manager | "Edit any food entry, including individual foods and recipes." Serving size and amount can be edited. To edit a day other than today, select the day at the top of the screen. Moving entries is only a tip linking to another article. | https://help.carbmanager.com/docs/edit-daily-log-entries | Verified (official) |
| Yazio | Edit icon in the top right of the meal view in the copy flow. | https://help.yazio.com/hc/en-us/articles/360002401437-How-do-I-copy-Diary-entries-to-another-day | Unverified (search snippet) |
| Lifesum | Not checked in detail. | https://help.lifesum.com/en/category/account-app-settings-yprcp5/ | Unverified |
| Cal AI | A third-party copy of its privacy policy lists "editing or deleting individual logs" as a user capability. | https://sites.google.com/view/465calprivacy/home | Unverified (third-party copy of policy) |
| SnapCalorie | App-store copy says users can change any prediction after the scan. | https://apps.apple.com/app/1574239307 | Unverified (app-store listing) |

### 2.3 Correcting a wrong day

| Competitor | How it works | Source URL | Verified or unverified |
|---|---|---|---|
| MyFitnessPal | No official move-to-day option found. Community guidance: delete on the wrong day and log again on the correct day. Date picker used to view a day. | https://community.myfitnesspal.com/en/discussion/10943613/is-there-an-easy-way-to-delete-edita-food-you-entered | Unverified (community) |
| Lose It! | A help page (not confirmed to be Lose It!) describes select, then Move or Copy, then choose a day or meal. Users say a copy-meal feature existed. | https://intercom.help/municorn-limited-9e71b379f21d/en/articles/12582073-how-to-delete-a-food-entry-or-move-copy-it-from-one-meal-day-to-another | Unverified (app not confirmed) |
| Cronometer | A forum thread asks how to edit an entry's date; the answer was not retrieved. A support article covers bulk deletion by date range. | https://forums.cronometer.com/discussion/1508/how-do-i-edit-dates-of-my-food-entree | Unverified (forum) |
| Carb Manager | Whole day: Daily Log, Copy, choose a date, then Copy to [date]. Whole meal: Options > Copy To. Single entry: Expander > Copy. Moving within a day uses Options > Reorder / Move. Copying keeps the original. Moving across days is not described. | https://help.carbmanager.com/docs/copy-and-move-daily-log-entries | Verified (official) |
| Yazio | Copy diary entries to another day: open the calendar, pick the source day, choose the meal category, tap Edit, then select items and the target day. Full steps not retrieved. | https://help.yazio.com/hc/en-us/articles/360002401437-How-do-I-copy-Diary-entries-to-another-day | Unverified (search snippet, first three steps only) |
| Lifesum | Not checked. | https://help.lifesum.com/en/category/account-app-settings-yprcp5/ | Unverified |
| MacroFactor (reference only) | Copy or paste an entry to one or more dates; calendar, date row or swipe to change day. | https://help.macrofactorapp.com/en/articles/95-copy-and-paste | Verified (official), reference only |

### 2.4 Repeating a past meal

| Competitor | How it works | Source URL | Verified or unverified |
|---|---|---|---|
| MyFitnessPal | Not checked officially. | https://support.myfitnesspal.com/hc/en-us/articles/360032622311 | Unverified (no content retrieved) |
| Lose It! | A user says a copy-meal feature was used a lot. | https://community.fitbit.com/t5/Product-Feedback/Fitbit-App-feature/idi-p/5702381 | Unverified (user comment) |
| Cronometer | Copy flow for single entries and meals exists (official article snippet). Repeat option not confirmed. | https://support.cronometer.com/hc/en-us/articles/360018695932 | Unverified (search snippet of official page) |
| Carb Manager | Selected entries can be Copied or Repeated (None, Every Day, Specific Days). Recurring foods can be logged automatically. Favourites: foods, recipes and meals can be favourited. | https://help.carbmanager.com/docs/copy-and-move-daily-log-entries and https://help.carbmanager.com/docs/log-recurring-food-automatically | Verified (official) |
| Yazio | Copy diary entries or meals from a past day to another day (help article). | https://help.yazio.com/hc/en-us/articles/360002401437-How-do-I-copy-Diary-entries-to-another-day | Unverified (search snippet) |
| Lifesum | Not checked. | https://help.lifesum.com/en/category/account-app-settings-yprcp5/ | Unverified |
| Cal AI | No repeat or favourite flow found. | - | Unverified (not found) |

### 2.5 Weekly and daily totals across time zones

| Competitor | How it works | Source URL | Verified or unverified |
|---|---|---|---|
| MyFitnessPal | Not checked officially. | - | Unverified (no source) |
| Lose It! | Not checked officially. | - | Unverified (no source) |
| Cronometer | Forum reports: manual time zone does not account for daylight saving; the company suggests automatic time zone. Users report wrong-day entries after travel. | https://forums.cronometer.com/discussion/1470/daylight-saving-time-change-australia-not-reflected-on-web-app | Unverified (forum) |
| Carb Manager | Not checked for time zone. | - | Unverified (no source) |
| Yazio | Not checked. | - | Unverified (no source) |
| Lifesum | Not checked. | - | Unverified (no source) |
| Cal AI | Not checked. | - | Unverified (no source) |
| Fitbit (out of scope, pattern evidence) | Users report food logged on the previous day when the watch and phone time zones differ. Automatic time zone fixed it for some. | https://community.fitbit.com/t5/Android-App/Food-logs-using-wrong-day/td-p/3949810 | Unverified (forum) |

### 2.6 Estimate confirmation and trust (how the app shows where numbers came from)

| Competitor | How it works | Source URL | Verified or unverified |
|---|---|---|---|
| MyFitnessPal | Database entries can be wrong; users can edit food information. Official help says some database information is inaccurate and can be edited. | https://support.myfitnesspal.com/hc/en-us/articles/360032622691-Some-food-information-in-the-database-is-inaccurate-Can-I-edit-it | Unverified (search snippet of official page) |
| Lose It! | Photo logging (Snap It) is reported as Premium-only and inconsistent. | https://kimola.com/reports/dive-into-lose-it-app-reviews-a-comprehensive-analysis-app-store-fi-145724 | Unverified (review aggregator) |
| Cronometer | Not checked. | - | Unverified (no source) |
| Carb Manager | Custom foods, recipes and meals can be created and edited (search snippet of official page). Source of nutrition data not checked. | https://help.carbmanager.com/docs/edit-custom-meals | Unverified (search snippet only) |
| Yazio | Not checked. | - | Unverified (no source) |
| Lifesum | Not checked. | - | Unverified (no source) |
| Cal AI | Privacy policy copies say the app analyses the image to estimate calories, protein, fat and carbohydrate. | https://sites.google.com/view/465calprivacy/home | Unverified (third-party copy of policy) |
| SnapCalorie | App-store copy: computer vision and depth sensing. A review says a person may review photos. Accuracy claims (under 20% error; about 15% average) are unverified; the sources conflict on how estimates are produced. | https://apps.apple.com/app/1574239307 | Unverified |

Journal relevance: none of the sources found shows an official "where this number came from" panel (for example: provider, confidence, portion assumptions, and original vs edited values). This is a clear opening, but it is an absence in the sources found, not a verified fact about every app.

### 2.7 Data export and deletion

| Competitor | How it works | Source URL | Verified or unverified |
|---|---|---|---|
| MyFitnessPal | Official deletion: app More > Help > Delete Account, or web My Home > Settings > Delete Account. Data is removed permanently. Export: no official article found; third-party sources conflict. | https://support.myfitnesspal.com/hc/en-us/articles/360032622451-How-do-I-delete-or-cancel-my-account | Unverified (search snippet of official page; fetch blocked) |
| Lose It! | A competitor blog says Settings > Account > Export Data produces a CSV of diary, weight and exercise. | https://nutrola.app/en/blog/lose-it-got-worse-after-update | Unverified (competitor blog, promotional) |
| Cronometer | Account Data: CSV export by date range and export type; bulk delete of diary by date range; full Delete Account option; deleted data cannot be recovered. | https://support.cronometer.com/hc/en-us/articles/360018760151 | Unverified (search snippet of official page; fetch blocked) |
| Carb Manager | Individual entries and whole meals/days can be deleted from the daily log. | https://help.carbmanager.com/docs/delete-daily-log-entries | Verified (official) for log deletion; export not checked |
| Yazio | Not checked. | - | Unverified (no source) |
| Lifesum | Export: website only, nutritional data from the past 7 days, and a 7-day limit per export. Deletion: Profile > Settings > Account Settings > Delete Account; irreversible; does not cancel subscription. | https://help.lifesum.com/en/category/account-app-settings-yprcp5/ | Verified (official) |
| Cal AI | Privacy policy copy: account deletion is a request by email (privacy@calai.app). Food photos said to be discarded after nutrition is extracted. Imported health records may remain until deletion is requested. | https://sites.google.com/view/465calprivacy/home | Unverified (third-party copy of policy; official policy not retrieved) |

### 2.8 Onboarding and first log

| Competitor | How it works | Source URL | Verified or unverified |
|---|---|---|---|
| MyFitnessPal | Not checked. | - | Unverified (no source) |
| Lose It! | Not checked. | - | Unverified (no source) |
| Cronometer | Not checked. | - | Unverified (no source) |
| Carb Manager | Not checked. | - | Unverified (no source) |
| Yazio | Not checked. | - | Unverified (no source) |
| Lifesum | Age limit exists per help article. Not checked further. | https://help.lifesum.com/en/category/account-app-settings-yprcp5/ | Verified (official) for age-limit article title only |
| Cal AI | Not checked. | - | Unverified (no source) |

Gap: onboarding flows were not verified for any competitor in this pass. Treat the workflow as an open research item, not a finding.

### 2.9 Reminders

| Competitor | How it works | Source URL | Verified or unverified |
|---|---|---|---|
| MyFitnessPal | Not checked. | - | Unverified (no source) |
| Lose It! | Not checked. | - | Unverified (no source) |
| Cronometer | Not checked. | - | Unverified (no source) |
| Carb Manager | Not checked. | - | Unverified (no source) |
| Yazio | Reminders: Profile > Settings > Reminders. Separate time per meal (breakfast, lunch, dinner, snacks). Water and streak reminders. Notifications only if the device allows them. A feature request says meal reminders cannot be switched individually. | https://help.yazio.com/hc/en-us/articles/4406890595601-Set-Up-Reminders-in-Yazio | Unverified (search snippet of official page) |
| Lifesum | Notification Settings in Settings; toggles for each option. | https://help.lifesum.com/ru/category/account-app-settings-1pjz5zc | Unverified (search snippet of official page in another language) |
| Cal AI | Not checked. | - | Unverified (no source) |

## 3. Repeated user complaints

| Theme | What users say | Source | Verified or unverified |
|---|---|---|---|
| Barcode and core features paywalled | Barcode scanning moved behind premium; described as the loudest single complaint in the category. Dates disagree (2022 vs 2023). | https://unstar.app/blog/is-myfitnesspal-premium-worth-it-paywall-app-reviews-2026 | Unverified (competitor-run review analysis) |
| Redesign and ads | MyNetDiary's May 2026 scorecard gives MyFitnessPal 1.82 from 795 written App Store reviews it analysed, with complaints about a redesign that buries the diary, the barcode paywall and ads. This is a competitor's sample, not an official rating. | https://www.mynetdiary.com/diet-app-scorecard-may-2026.html | Unverified (competitor scorecard) |
| Unskippable ads | Long unskippable video ads in free tier; ads shown to paying subscribers. | https://unstar.app/blog/is-myfitnesspal-premium-worth-it-paywall-app-reviews-2026 | Unverified |
| Lose It! ads and premium creep | Interstitial ads after saving; banner ads on logging screen; useful features moved to Premium. | https://kimola.com/reports/dive-into-lose-it-app-reviews-a-comprehensive-analysis-app-store-fi-145724 | Unverified (review aggregator) |
| AI portion and hidden-ingredient errors | Portion estimates weaker than ingredient detection; oils, sauces and mixed bowls missed; one reviewer's 355-kcal breakfast estimated at 780 kcal even after manual edits. | https://slashdot.org/story/25/11/21/1724242/ai-nutrition-tracking-stinks and https://digitpatrox.com/i-used-ai-powered-calorie-counting-apps-and-they-were-even-worse-than-i-expected/ | Unverified (secondary reporting) |
| AI accuracy in studies | A study of four photo-based apps found calorie and fat estimates about one-third too low on average. | https://www.newsweek.com/popular-diet-tracking-apps-may-be-missing-hundreds-of-calories-study-finds-12252848 | Unverified (secondary reporting of a study; study not retrieved) |
| Correction burden | Users must correct recognised data frequently. | https://kimola.com/reports/unveil-user-insights-on-cal-ai-calorie-tracker-app-store-us-155190 | Unverified |
| Subscription surprises (AI loggers) | Unexpected costs; features locked behind payment. | https://kimola.com/reports/unveil-user-insights-on-cal-ai-calorie-tracker-app-store-us-155190 | Unverified |
| Sync and integration | Sync failures after updates; Fitbit sync complaints. | https://marlvel.ai/apps/com-fitnow-loseit/vs and https://kimola.com/reports/dive-into-lose-it-app-reviews-a-comprehensive-analysis-app-store-fi-145724 | Unverified |
| Wrong day and time zones | Entries land on the previous day after travel or when watch and phone time zones differ. Cronometer DST and GMT default reported. | https://community.fitbit.com/t5/Android-App/Food-logs-using-wrong-day/td-p/3949810 ; https://forums.cronometer.com/discussion/6061/diary-time-entries-default-to-gmt | Unverified (forums) |
| Cannot move past entries | Community answer: past entries cannot be reordered; meal names are global. | https://community.myfitnesspal.com/en/discussion/10893169/how-to-change-order-of-meals-in-diary | Unverified |
| Export limits | Full-range export times out for ranges over about a month (Cronometer forum). Lifesum export limited to 7 days. | https://forums.cronometer.com/discussion/comment/20809 ; https://help.lifesum.com/en/category/account-app-settings-yprcp5/ | Unverified (forum) for Cronometer; Verified (official) for Lifesum limit |
| Data deleted or lost | Users report data disappearing; third-party guides on recovery. | https://forums.cronometer.com/discussion/comment/14210 | Unverified (forum) |

Reviewer note: Several sources are competitor blogs (Nutrola, Unstar, MyNetDiary, Marlvel). They are promotional or interested parties. Use them as direction, not evidence of frequency.

## 4. Requirement gaps for Journal

Each row maps to the PRD (docs/prd.md) or is a new requirement. Acceptance criteria are written so a tester can run them.

| ID | Requirement (testable) | Basis | Priority |
|---|---|---|---|
| BR-101 | Before saving a meal, the user can set the meal slot (breakfast, lunch, dinner, snack) and the time. Time defaults to now and is editable. Saving with a changed slot stores the chosen slot, not the default. | PRD 4.4, FR-4; competitor complaints on wrong day and time | Must |
| BR-102 | Editing a saved meal lets the user change name, meal slot, date, time, quantities and macros. After save, Today and Week totals update in the same session (no reload). Test: change a 500 kcal meal to 300 kcal; both Today and Week show the new total. | PRD 4.5 | Must |
| BR-103 | A saved meal can be moved to another date without re-entering it. The original entry is removed. Test: move a lunch from Monday to Tuesday; Monday total drops and Tuesday total rises by the same amount. | Competitor gap: MFP and Cronometer require delete and re-log | Must |
| BR-104 | A saved meal can be copied to today (or another date) in one action, with a new time. The original is kept. Test: copy yesterday's breakfast to today; yesterday is unchanged and today has one new entry. | Carb Manager Copy and Repeat (verified) | Must |
| BR-105 | Each entry stores its timestamp with the user's UTC offset at the time of logging. Today and Week assign entries to a day using the stored local time, not the device's current zone. Test: log at 23:30 in zone A, travel to zone B, the entry stays on the day it was eaten. | Time-zone complaints (Cronometer, Fitbit forums) | Must |
| BR-106 | Daily and weekly totals use the same day boundary as BR-105. A daylight-saving change does not move any entry to a different day. Test: entries at 01:30 on the DST change date stay on that date in the Week list. | Cronometer DST complaint | Must |
| BR-107 | Every AI estimate confirmation screen shows the provider used, the model or version identifier, the confidence level from FR-4 (low, medium or high, or the agreed schema), and the portion basis (for example, the stated amount or "estimated from photo"). Test: an estimate from each of the three providers shows the provider name before save. | Trust gap; FR-4, FR-7; PRD 3 metric | Must |
| BR-108 | The saved meal keeps both the original AI estimate and the user-edited values, with a flag showing whether the user changed any value. The flag feeds the PRD metric "users who edit an estimate before saving". Test: edit one macro before save; stored record has original and final values and edited = true. | PRD section 3 metric, FR-4 | Must |
| BR-109 | Full data export: the user can export all their meals (all dates, not a rolling window) as CSV and JSON, with no time-range cap. Test: export of 12 months of seeded test data contains every entry and the export completes within 30 s. Note: PRD section 4 currently puts export out of scope. This requirement needs a PRD decision (see Section 5). | Competitor limits (Lifesum 7 days; Cronometer timeouts over about one month) | Should, pending PRD decision |
| BR-110 | Account deletion removes meals, photos and stored AI keys, and shows a confirmation that names what will be removed. The subscription note is not needed in MVP. Test: after delete, the API returns no meal rows for the user and the key store has no entry for the user. | PRD FR-9; Lifesum and MFP official deletion flows | Must |
| BR-111 | A new user can log their first meal without completing optional steps. Biometric unlock and daily targets can be skipped. Test: from first sign-in, Add meal is reachable from Today within two taps when the biometric and target steps are skipped. | PRD 8 first-run flow; PRD open question 1 | Must |
| BR-112 | Today shows totals with no daily target set; progress bars are hidden and a "Set target" link is shown. Test: a new account with no target shows totals and no error. | PRD open question 1 | Must |
| BR-113 | Meal reminders are off by default. The user can set a time for each meal slot. The device permission is requested only when the user turns a reminder on. Reminder text contains no meal names or personal text. Test: no notification permission prompt appears before a reminder is enabled; the notification body contains no food data. | Yazio reminder model (verified snippet); PRD FR-10 | Should |
| BR-114 | Offline entries show a "not yet synced" state until the server confirms. If the same meal is edited on two devices offline, the later save wins and the other edit is kept as a visible conflict notice. Test: edit on two offline devices, reconnect; one result is kept and the user sees a notice. | PRD FR-8, reliability NFR | Must |
| BR-115 | Core logging, editing, moving, copying, deleting and export are never locked behind payment in the MVP. Test: a free account can complete every action in BR-101 to BR-110. | Competitor paywall complaints (MFP barcode, Lose It! Snap It) | Must |

## 5. Open decisions raised by this analysis

1. **Export scope.** PRD section 4 removes export, but BR-109 and the competitor evidence say users expect it. Product should decide before MVP.
2. **Estimate trust fields.** BR-107 and BR-108 depend on the open estimate-schema decision in docs/progress.md (ADR-001 vs ADR-005). Pick one schema before build.
3. **Onboarding and reminders.** No competitor onboarding or reminder flow was verified beyond Yazio and Lifesum snippets. Run a short hands-on comparison on public trial accounts with a legal review of terms before adding more competitor claims.

## 6. Sources (all accessed 2026-10-30)

Official or verified:
- https://help.lifesum.com/en/category/account-app-settings-yprcp5/
- https://help.carbmanager.com/docs/copy-and-move-daily-log-entries
- https://help.carbmanager.com/docs/edit-daily-log-entries
- https://help.carbmanager.com/docs/delete-daily-log-entries
- https://help.carbmanager.com/docs/log-recurring-food-automatically
- https://help.macrofactorapp.com/en/articles/51-log-food-to-future-days (reference only)
- https://help.macrofactorapp.com/en/articles/95-copy-and-paste (reference only)

Official, snippet only (page not fetched):
- https://help.yazio.com/hc/en-us/articles/360002401437-How-do-I-copy-Diary-entries-to-another-day
- https://help.yazio.com/hc/en-us/articles/4406890595601-Set-Up-Reminders-in-Yazio
- https://support.cronometer.com/hc/en-us/articles/360018760151
- https://support.cronometer.com/hc/en-us/articles/360018695932
- https://support.myfitnesspal.com/hc/en-us/articles/360032622451-How-do-I-delete-or-cancel-my-account
- https://support.myfitnesspal.com/hc/en-us/articles/360032622691-Some-food-information-in-the-database-is-inaccurate-Can-I-edit-it
- https://help.lifesum.com/ru/category/account-app-settings-1pjz5zc

Third-party, forum, review and policy copies (unverified):
- https://community.myfitnesspal.com/en/discussion/10943613/is-there-an-easy-way-to-delete-edita-food-you-entered
- https://community.myfitnesspal.com/en/discussion/10893169/how-to-change-order-of-meals-in-diary
- https://intercom.help/municorn-limited-9e71b379f21d/en/articles/12582073-how-to-delete-a-food-entry-or-move-copy-it-from-one-meal-day-to-another
- https://forums.cronometer.com/discussion/6061/diary-time-entries-default-to-gmt
- https://forums.cronometer.com/discussion/1470/daylight-saving-time-change-australia-not-reflected-on-web-app
- https://forums.cronometer.com/discussion/comment/20809
- https://forums.cronometer.com/discussion/comment/14210
- https://community.fitbit.com/t5/Android-App/Food-logs-using-wrong-day/td-p/3949810
- https://sites.google.com/view/465calprivacy/home (Cal AI privacy policy copy)
- https://apps.apple.com/app/id6535683072 (Cal AI listing)
- https://apps.apple.com/app/1574239307 (SnapCalorie listing)
- https://unstar.app/blog/is-myfitnesspal-premium-worth-it-paywall-app-reviews-2026
- https://www.mynetdiary.com/diet-app-scorecard-may-2026.html
- https://kimola.com/reports/dive-into-lose-it-app-reviews-a-comprehensive-analysis-app-store-fi-145724
- https://kimola.com/reports/unveil-user-insights-on-cal-ai-calorie-tracker-app-store-us-155190
- https://slashdot.org/story/25/11/21/1724242/ai-nutrition-tracking-stinks
- https://digitpatrox.com/i-used-ai-powered-calorie-counting-apps-and-they-were-even-worse-than-i-expected/
- https://www.newsweek.com/popular-diet-tracking-apps-may-be-missing-hundreds-of-calories-study-finds-12252848
- https://nutrola.app/en/blog/lose-it-got-worse-after-update (competitor blog)
- https://marlvel.ai/apps/com-fitnow-loseit/vs (aggregator)

## 7. Claims that could not be verified

- MyFitnessPal: move or copy of entries to another day; export of data; onboarding; reminders; time zone handling. Official pages returned 403.
- Lose It!: all workflows. support.loseit.com was not reachable and the search tool was blocked for loseit.com. The Municorn help page mentions Move/Copy but does not name the app.
- Cronometer: export and deletion steps (official snippet only); GMT default (forum); copy and repeat details (official snippet only).
- Yazio: copy-to-day full steps (snippet only); reminders (snippet only).
- Lifesum: reminders (Russian help page snippet only); onboarding not checked.
- Carb Manager: time-zone handling and onboarding not checked.
- Cal AI: all claims come from third-party copies of its privacy policy and app-store listings. No official help centre was found. Photo-deletion timing and the privacy@calai.app address need confirmation from Cal AI.
- SnapCalorie: accuracy figures (under 20%; about 15%) and the claim that a person reviews photos conflict across sources. Unverified.
- Complaint frequencies: no source gives counts; the MyNetDiary scorecard figures are from a competitor's monthly sample.
