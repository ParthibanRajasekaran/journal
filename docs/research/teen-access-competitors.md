# Teen access to calorie trackers: competitor scan

Date: 2026-10-30. Public sources only. No logins, no app decoding.
Legend: **V** = verified against a primary source (official page fetched, quoted). **U** = unverified (secondary, search snippet only, or blocked).

## 1. Competitor comparison

| App | (1) Min age in terms / gate | (2) Hide numbers / ED safeguards | (3) Consent: health data and AI | (4) Store rating and health disclosure | (5) Teen product or policy |
|---|---|---|---|---|---|
| MyFitnessPal | **V** 18. "No individual under the age of 18 may use the Services" (myfitnesspal.com/terms-of-service). Says it uses technical measures to block under-18 accounts. | **U** No hide-calories setting found. ED safeguards not found. | **U** Privacy policy not retrieved. Terms say AI/ML may be used and outputs are not guaranteed. | **V** US listing: 16+. Data linked to user includes Health & Fitness; identifiers used for tracking. | No. Under-18 use prohibited. |
| Lose It! | **U** Terms blocked (403/unable to fetch). Third-party integration doc says 18+ (secondary). | **U** No hide-budget option found. Third-party review points to NEDA. | **U** Not retrieved. | **V** US listing: 18+ with content restrictions. Health & Fitness linked to user. | **U** None found. |
| Cronometer | **V** Under 13 excluded. 13 to age of majority need a parent or guardian to accept the terms as a "Permitted Minor" (cronometer.com/terms). | **U** Not found. | **U** Terms cover AI training bans; privacy notice covers health data (search excerpt). | **U** Store page not retrievable. | Partial. Permitted Minor route for 13+. |
| Carb Manager | **U** Terms not retrieved; help centre says terms are in-app only. | **U** Not found. | **U** Not retrieved. Health app read/write integration (Apple Health). | **U** Conflicting: NO listing 4+, US listing 18+. | **U** None found. |
| Yazio | **V** 16, parental consent below 16 (yazio.com/en/terms). Commits to deleting minors' data collected without consent. | **U** Hide-calories not found. | **V** Terms do not address health-data consent; defer to privacy policy (not retrieved). | **U** 4+ (search snippet). | Parental-consent route for under-16s only. |
| Lifesum | **V** 13 minimum (lifesum.com/policy, Terms). Privacy notice: under 13 or local digital-consent age may not submit data. | **U** Not found. | **V** Privacy notice: health data processed only with explicit consent. AI used for tracking input and multimodal tracking. | **V** US listing: 13+. Health & Fitness linked to user; identifiers used for tracking. | No separate 16/17 policy found. |
| Cal AI | **U** Terms not found. Privacy policy (Google Sites, Jan 2026) mentions photo analysis; AI vendor not named. | **U** Not found. | **U** Photos sent for analysis; consent wording not confirmed. | **V** US listing (fetched): 9+, "Health or Wellness Topics", tracking identifiers. | None found. |
| Teen-focused: WW Kurbo | **U** Launched 2019 for ages 8 to 17 with parental approval (press coverage). Current status not verified. | **U** Heavy ED criticism in 2019 coverage. | **U** Not retrieved. | **U** Not retrieved. | Yes (historically). Confirm status before citing. |
| Teen-focused: DailyCal, AI BiteBuddy | **U** Each says guardian consent for 13 to 18 in its own policy (Netlify and Google Sites hosts, not official). | **U** Not checked. | **U** Consent for meal-photo analysis stated (BiteBuddy). | **U** Not checked. | Small, unofficial examples. |

## 2. External guidance

- **NHS (primary, V):** https://www.nhs.uk/conditions/eating-disorders/ says to see a GP if worried and lists the Beat helpline, 0808 801 0677. It does not mention calorie apps.
- **Beat (secondary, U):** https://www.beateatingdisorders.org.uk/ (search excerpts only). Says calorie-focused tools and ads can harm young people with eating disorders, and that the NHS weight-loss app should not be open to under-18s. Under-18 guide exists. Page fetch blocked.
- **ICO Age Appropriate Design Code (U):** https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/introduction-to-the-childrens-code/ (fetch returned 404; search excerpt says a child is anyone under 18, age bands include 16 to 17, and the code covers services likely to be used by under-18s). Verify against the ICO text before relying on it.
- **Apple App Review Guidelines 5.1.3 and 5.1.4 (V):** https://developer.apple.com/app-store/review/guidelines/ Health data may not be used for advertising or data mining; apps for kids must not include third-party analytics or ads. Guideline 1.4.1 says apps should remind users to check with a doctor.
- **Apple age ratings (V):** https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions 16+ and 18+ tiers; "Health or Wellness Topics" explicitly includes calorie tracking. Developers must answer the medical/wellness questionnaire and can set a higher rating than Apple calculates.
- **Google Play (V for user-data policy; U for health-apps policy):** https://support.google.com/googleplay/android-developer/answer/9888076 Health data is "sensitive"; a prominent disclosure is needed before collection. Families policy applies to child-directed apps. The health-apps policy page (answer/12261419) was not retrieved.
- **Research (secondary, U):** University of Louisville study (105 people with diagnosed eating disorders, 73% said MyFitnessPal contributed) and a Flinders review (correlational). Cite only after checking the original papers.

## 3. Risks specific to 16 and 17 year olds

- UK AADC covers under-18s, so 16 and 17 year olds are in scope for any service likely to be used by them (U, see above). Requires age assurance or applying child standards to all users.
- Apple's 16+ and 18+ tiers apply to calorie tracking as "Health or Wellness". Our listing must answer the questionnaire honestly.
- Several competitors (MyFitnessPal, Yazio, Cronometer) set a higher floor than 13 and use parental consent, so a 16/17 launch is out of step with the market.
- Health data is "sensitive" under Apple and Google rules; explicit consent is needed.
- AI photo or text analysis sends data to third parties; this needs its own consent and a named processor.

## 4. Top five safeguards to copy (in our own words)

1. Age question at sign-up with a guardian route for under-18s, and a hard stop for under-16 or a clear 16 to 17 flow, based on the minimum we decide.
2. A separate, explicit consent screen for health data and for sending meal photos or text to an AI provider, with the processor named.
3. A "neutral" mode for teens: hide calorie totals and budgets, no weight-goal framing, and a floor on targets for minors. (No competitor verified as offering this.)
4. Eating-disorder signposting in the app: Beat helpline, GP advice, and a gentle prompt when logging patterns suggest restriction.
5. Data minimisation and deletion: delete minors' data on discovery, as Yazio commits to in its terms.

## 5. Open questions for the owner

- Is 16 to 17 access a full product or a limited mode (no targets, no photo AI)?
- Which minimum age do we set in our terms (13, 16 or 18), and do we require guardian consent below 18?
- Who is our AI processor, and will we name it in the consent screen?
- Will we set our store rating to 16+ or 18+ and answer the health questionnaire accordingly?
- Do we have clinical or ED-charity review before launch?
- What is our age-assurance method for the AADC?
- Retrieve blocked sources (MyFitnessPal and Cronometer privacy policies, Lose It! terms, Carb Manager terms, ICO and Beat pages) before finalising.
