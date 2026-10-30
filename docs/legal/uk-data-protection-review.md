# UK data protection review: Journal buddy encouragement, weekly insights and quiet check-in

Date: 2026-10-30
Prepared for: a human solicitor to review
Status: research memo, draft

**This is not legal advice.** It is a research memo prepared by an analyst to help a qualified solicitor. Nothing here should be relied on as a legal conclusion. Every point below is either marked as confirmed in a primary source (with the section or page cited) or as an interpretation that needs a solicitor's judgement.

Labels used:

- **[Confirmed: source]** the text of the cited legislation or ICO page says this (paraphrase unless quoted).
- **[Interpretation, needs solicitor]** the analyst's reading of the sources applied to Journal. Not a conclusion.

Scope: UK GDPR and Data Protection Act 2018 (DPA 2018). EU users are in scope of the product, and EU GDPR applies to them in part (Article 3(2)). EU law is **not** analysed here and needs EU counsel.

Sources read:

- Application docs: `docs/prd-features/buddy-encouragement.md`, `docs/prd-features/weekly-insights.md`, `docs/prd-features/quiet-daily-summary-and-reminders.md`, `docs/progress.md`, `docs/prd.md`, and ADRs 0001 to 0007 (ADR-004, ADR-005, ADR-006 and ADR-007 are the privacy-relevant ones).
- Primary sources: legislation.gov.uk (UK GDPR Articles 4, 8, 9, 22, 35; DPA 2018 s.10 and Schedule 1 Part 1); ICO guidance pages listed in section 11.

Caveat on sources: several ICO pages say their guidance is "under review" because of the Data (Use and Access) Act 2025 (DUAA). The legislation.gov.uk page for Article 22 says it was substituted by Chapter 3, Section 4A of the DUAA, effective 19 June 2025 or 5 February 2026 depending on purpose. Where that matters, the analysis below flags it. Some ICO URLs were reached through search results and not fetched in full. Those are marked.

---

## 0. Summary

| # | Topic | Position in one line | Status |
|---|---|---|---|
| 1 | Special category data | Calorie and protein totals alone are probably not health data, but meal entries can reveal or let someone infer health status, and then they are. Treat as special category. | Partly confirmed; application needs solicitor |
| 2 | Lawful basis and consent | If Article 9 applies, an Article 9(2) condition is needed. Explicit consent (9(2)(a)) is the realistic route for a consumer app. Health-care route (9(2)(h)) is unlikely to fit. | Confirmed (the Article 9(2) list); application needs solicitor |
| 3 | DPIA | A DPIA is strongly advisable and probably required. Art 35(3)(b) covers large-scale special category data. | Confirmed (Art 35); "large scale" needs solicitor |
| 4 | Minimisation of buddy and week summaries | The owner's rules (no calorie averages on the buddy card, figures only from entries) fit Art 5(1)(c). Weekly insights still puts average kcal on the Week card, which is a conflict to resolve. | Confirmed (principle); application needs solicitor |
| 5 | Switch off and stored data | Only a flag needs storing. Keeping rest-day marks while off is defensible only if there is a stated purpose and a retention period. | Interpretation |
| 6 | Age Appropriate Design Code | Applies to services likely to be accessed by under-18s. No age gate is in the docs. Risk assessment needed; the owner's "adult" target is not a control. | Confirmed (scope); application needs solicitor |
| 7 | Notifications | No ICO guidance specific to lock-screen content was found. Keep notification text generic and free of food or health content. | Interpretation (no specific ICO page found) |
| 8 | Profiling and automated decisions | Encouragement is profiling in the Article 4(4) sense. It is not likely a decision with legal or similarly significant effect, so Article 22 probably does not apply, but the DUAA changes must be checked. | Confirmed (definition, ICO reading); application needs solicitor |
| 9 | Retention and deletion of derived data | Store as little as possible, compute on read, and delete on account deletion, including the 14-day backup window. Backups need a "beyond use" statement. | Confirmed (ICO storage limitation); application needs solicitor |

---

## 1. Are meal logs and derived protein or calorie summaries special category data?

**Legal text.**
- Article 9(1) prohibits processing "data concerning health" unless an Article 9(2) condition applies. **[Confirmed: legislation.gov.uk, UK GDPR Article 9(1)]**
- Article 4(15): "data concerning health" means personal data related to the physical or mental health of a natural person. **[Confirmed: legislation.gov.uk, UK GDPR Article 4(15)]**

**ICO reading.**
- The ICO's test is whether the information "reveals something about health status". Its own examples: a GP appointment alone does not; a series of physiotherapy invoices might. Step counts are not necessarily health data; a recorded heart rate or BMI can be. **[Confirmed: ICO, "What is special category data?", https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/]**
- Inference counts. Where processing intends to make an inference linked to a special category, the inferred data is special category data "regardless of how confident you are that the inference is correct". Profiling to infer health status requires an Article 9 condition. **[Confirmed: same ICO page]**
- The ICO page does not address food or diet records directly. **[Confirmed: absence in same ICO page]**

**Application.**
- A row of "protein 85 g, kcal 1,900" on its own is arguably not information that reveals health status. **[Interpretation, needs solicitor]**
- Meal logs with free text or photos can reveal conditions and diets (for example coeliac, diabetes, renal or allergy-driven diets, or medical nutrition products). The app does not ask for this, but nothing prevents it, and the AI estimate step receives the photo or text. **[Interpretation, needs solicitor]**
- Protein and calorie "goals" and "targets" set by the user may reveal a health aim, which the ICO reading would support as health-related. **[Interpretation, needs solicitor]**
- The product's own docs treat the question as open: `docs/progress.md` open decision 3, and the buddy PRD section 8 and the weekly insights PRD section 11 both say the card must use meal-data safeguards "until counsel confirms". **[Confirmed: repo docs]**

**Analyst view (not a conclusion).** The safer working assumption is that meal entries and any figure derived from them are special category data, because a meal log can reveal health conditions and the app cannot control what users type or photograph. A solicitor should decide whether to adopt that as the design basis.

---

## 2. Lawful basis, and whether explicit consent is needed

**Legal text.**
- Article 9(2)(a): explicit consent "to the processing of those personal data for one or more specified purposes". **[Confirmed: legislation.gov.uk, UK GDPR Article 9(2)(a)]**
- Article 9(2)(h): processing necessary for preventive or occupational medicine, health or social care, on the basis of domestic law or a contract with a health professional, subject to Article 9(3). **[Confirmed: legislation.gov.uk, UK GDPR Article 9(2)(h)]**
- DPA 2018 s.10(1) and (2): for points (b), (h), (i) and (j) the UK-law basis is met only if a Part 1 Schedule 1 condition is satisfied. Schedule 1 Part 1 paragraph 2 is the "health or social care purposes" condition, which requires processing "necessary for health or social care purposes". **[Confirmed: legislation.gov.uk, DPA 2018 s.10; Schedule 1 Part 1 para 2]**
- No DPA condition is needed for explicit consent under Article 9(2)(a); the consent route stands on its own. **[Interpretation, needs solicitor]**
- Article 6(1) lists the general lawful bases (consent (a), contract (b), legitimate interests (f), and others). **[Not fetched in this review; the sub-paragraph letters are from general knowledge and need checking against legislation.gov.uk Article 6]**

**ICO reading on consent.**
- Consent must be freely given, specific, informed and unambiguous. Pre-ticked boxes and inactivity do not count. **[Confirmed: ICO, "What is valid consent?", https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/what-is-valid-consent/]**
- Explicit consent must be "expressly confirmed in words" and specifically describe the processing. **[Confirmed: same ICO page]**
- Consent should not be a condition of a service unless the processing is necessary for that service. The ICO says legitimate interests is usually better in that case. **[Confirmed: same ICO page]**

**Application.**
- Article 9(2)(h) is unlikely to fit a consumer self-tracking app with no health professional in the loop. **[Interpretation, needs solicitor]**
- Explicit consent (9(2)(a)) is the realistic Article 9 route. It must be a separate, specific statement covering meal data and health-related inferences, and it must be withdrawable without losing the core service. The PRD consent gate (PRD section 4, item 9) covers third-party AI providers only; it does not cover the in-app encouragement features. **[Confirmed: `docs/prd.md` item 9 in repo; the gap is the analyst's reading]**
- Encouragement features (buddy card, run counter, the check-in) are derived from the user's own entries and do not go to a third party. They could arguably be part of the core service (Article 6(1)(b), contract) for the meal-data processing, but the Article 9 condition is still needed for the health-related part. **[Interpretation, needs solicitor]**
- The buddy PRD's switch (section 4.5) lets users turn encouragement off. That helps with "freely given" for the feature, but it does not give an Article 9 condition for meal logging itself. **[Interpretation, needs solicitor]**
- Consent for AI estimates must name the provider, and ADR-005 says Gemini free may use content for training and human review. A consent that does not disclose that would not be "informed". **[Confirmed: ADR-005 table, repo; the legal effect is interpretation, needs solicitor]**

---

## 3. Is a DPIA required, and what should it cover?

**Legal text.**
- Article 35(1): a DPIA is required before processing "likely to result in a high risk". **[Confirmed: legislation.gov.uk, UK GDPR Article 35(1)]**
- Article 35(3)(b): a DPIA is specifically required for "processing on a large scale of special categories of data referred to in Article 9(1)". **[Confirmed: legislation.gov.uk, UK GDPR Article 35(3)(b)]**
- Article 36 prior consultation: if a DPIA finds high residual risk, the ICO must be consulted before processing starts. **[Confirmed by the ICO DPIA page (search extract), not by the Article 36 text, which was not fetched]**

**ICO reading.**
- The ICO says a DPIA is needed before processing that is likely to be high risk, and that a DPIA is recommended for any major new project using personal data even without a specific high-risk indicator. **[Confirmed: ICO, DPIA "When do we need to do a DPIA?", https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/ (reached via search; page content summarised from search extract)]**
- The ICO's examples list includes health monitoring software, large-scale profiling including "fitness or lifestyle" software, and innovative technology such as AI. **[Confirmed: ICO, examples of high-risk processing, https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/examples-of-processing-likely-to-result-in-high-risk/]**
- The ICO says that if in doubt, do a DPIA. **[Confirmed: same ICO DPIA page as above]**

**Application.**
- A DPIA is strongly advisable. Whether Article 35(3)(b) is triggered depends on "large scale", which the UK GDPR does not define; the analyst cannot say whether a small user base counts. **[Interpretation, needs solicitor]**
- Triggers likely to apply on the ICO list: AI processing of photos and text, health-related profiling (encouragement and run counts), and tracking of behaviour over time. **[Interpretation, needs solicitor]**
- Suggested DPIA contents (standard Article 35(7) items, applied to Journal): description of processing and purposes; necessity and proportionality (including minimisation choices in section 4 below); risks to the person (exposure of health-adjacent data, notifications leaking content, inferences, transfers to US AI processors, UK hosting for EU users, backups); measures (encryption, consent, switch, notification rules, deletion); and whether residual risk is high. **[Interpretation, needs solicitor. Article 35(7) was not fetched; the list is the analyst's draft, to be checked against the text]**
- The DPIA must be redone when purposes, scope or context change (for example, when Phase 4 adds fibre and vitamins, or when a second AI provider is added). **[Confirmed: ICO DPIA page, change in nature, scope, context or purposes]**

---

## 4. Data minimisation for the buddy and week summaries

**Legal text.** Article 5(1)(c): personal data must be "adequate, relevant and limited to what is necessary" for the purposes. **[Not fetched from legislation.gov.uk in this review; wording as generally known, to be checked. The ICO page below is the read source]**

**ICO reading.** Adequate means enough for the purpose; relevant means a rational link to it; limited means not holding more than needed. Collecting data on the chance it may be useful is not allowed. **[Confirmed: ICO, "Principle (c): data minimisation", https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/ (reached via search; summarised from search extract; the page says it is under review)]**

**Application against the owner's rules.**

- The buddy PRD (sections 4.2 to 4.3) and the owner's decision (no calorie averages on the buddy card) are consistent with minimisation. Calorie averages do not serve the buddy purpose. **[Interpretation, needs solicitor]**
- **Conflict:** `weekly-insights.md` section 4 puts "average calories per logged day" on the Week summary card, and open question 5 in `buddy-encouragement.md` asks whether calories sit beside the buddy card. The two PRDs must agree before build. Calorie averages on the Week card are a separate health-adjacent output that the DPIA must cover. **[Confirmed: repo docs; the minimisation view is interpretation]**
- The buddy PRD acceptance criteria (Phase 2, item 7) say the card contains no calorie figure, average, percentage or ranking. That is a good minimisation control. **[Confirmed: repo docs]**
- The Week endpoint is to return `meal_count` and `protein_g` per day (buddy PRD section 7). Returning only the derived counts the card shows (not per-meal detail) fits minimisation better. **[Interpretation, needs solicitor]**
- Protein per day is still a derived health-adjacent figure. Storing only the counts and boolean "goal reached" flags, and computing them on read, is the more minimal design. The buddy PRD already says run counts are computed on read (section 7). **[Confirmed: repo docs; the minimisation effect is interpretation]**
- The buddy PRD's analytics rule ("buddy card viewed", with no values and no user identifier) still leaves a risk: an event with a timestamp and a device or session identifier can be personal data. **[Interpretation, needs solicitor]**

---

## 5. The on/off switch: what must be stored, and what happens to derived data when it is off

**Repo facts.**
- Buddy PRD section 4.5: when off, nothing is shown, but "stored data is kept (rest-day marks, favourites)". Turning on again restores views. **[Confirmed: repo docs]**
- Buddy PRD section 7 and open question 6: the switch is a profile flag (`buddy_enabled`) or a per-device setting. **[Confirmed: repo docs]**
- Quiet PRD: turning the check-in off "removes the stored preference and cancels scheduled local notifications". **[Confirmed: repo docs]**

**Analysis.**
- Only a single preference needs storing to honour the switch. That is the minimum. **[Interpretation, needs solicitor]**
- Under the storage limitation principle (Article 5(1)(e)), data should not be kept longer than needed for the purpose. Keeping rest-day marks and run data while the feature is off has a purpose only if the user is expected to turn it back on. A retention period for that state is needed. **[Confirmed: ICO storage limitation page, https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/ (retention must be decided and justified, not kept "just in case")]**
- Recommendation for the solicitor to test: while off, do not compute or show derived data; keep rest-day marks only for a stated period (for example 12 months of inactivity, to be decided) and then delete them. **[Interpretation, needs solicitor]**
- A per-device setting avoids a server flag but means a second device may still show derived data. That is a transparency and consistency question, not only a storage one. **[Interpretation, needs solicitor]**
- The switch does not reduce the Article 9 question (section 2): it only controls display. **[Interpretation, needs solicitor]**

---

## 6. Age Appropriate Design Code (children's data)

**Legal and ICO text.**
- The Code applies to information society services that process personal data and are "likely to be accessed by children". A child is anyone under 18, following the UNCRC. **[Confirmed: ICO, "Services covered by this code", https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/services-covered-by-this-code/]**
- "Likely" means more probable than not, judged on the service's nature, appeal to children, and access controls. Services aimed at adults are not expected to become child-friendly, but the provider should prevent child access in that case. **[Confirmed: same ICO page; and the age-restricted service point from the ICO code guidance surfaced in search, not fetched in full]**
- UK GDPR Article 8 sets 13 as the age for consent to information society services offered directly to a child, where Article 6(1)(a) consent is the lawful basis. **[Confirmed: legislation.gov.uk, UK GDPR Article 8(1)]**

**Application.**
- `docs/prd.md` section 2 says the primary user is "an adult". There is no age gate, age confirmation or age-restricted listing in the docs. **[Confirmed: repo docs]**
- Journal is a general health app on public app stores, with Google sign-in and no age check. Under the ICO test, that may well be "likely to be accessed by children". **[Interpretation, needs solicitor]**
- If the team chooses adult-only (for example, age confirmation and a 18+ listing), the ICO says the Code should not apply once access is effectively restricted. Whether an age confirmation tick is effective is for the solicitor and the ICO's current guidance. **[Confirmed: ICO code scope text as surfaced in search, not fetched in full; application is interpretation]**
- Article 8 is unlikely to be triggered if the lawful basis is not consent. If explicit consent is used (section 2), the team must decide how age is handled. **[Interpretation, needs solicitor]**
- Google account age rules and app store age ratings are not verified here. **[Not verified]**

---

## 7. ICO guidance on notifications, and what must stay out of them

**What was found.**
- The ICO's Children's Code FAQ says push notifications sent to all users, without targeting, are outside the Code. Notifications based on personal data (for example, only to under-18s) need their purpose considered; a notification essential to the service, such as a diary reminder, can be on by default. **[Confirmed (search extract): ICO, FAQs on the 15 standards, https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/faqs-on-the-15-standards-of-the-children-s-code/]**
- The ICO's right-to-be-informed guidance warns against approaches that give people constant alerts about their information. **[Confirmed (search extract): ICO, https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-methods-can-we-use-to-provide-privacy-information/]**
- No ICO page specific to lock-screen content was found. **[Not found]**

**Application.**
- Notification text must not reveal food names, calories, macros, photos, or the protein-goal sentence. The quiet PRD says the fixed text "Time to log today?" with the same rule. The buddy PRD (P7) says encouragement text never goes into notifications. **[Confirmed: repo docs]**
- The check-in notification reveals only that the app was not used that day. That is still health-adjacent behaviour data, so keep it generic and allow lock-screen hiding (OS setting). **[Interpretation, needs solicitor]**
- The buddy PRD's open question 14 asks about the planned "evening check-in" and encouragement. The answer should be recorded in the DPIA. **[Confirmed: repo docs]**
- Local notifications keep data on the device (quiet PRD section 8). This is the privacy-preserving default; a server push later needs its own review. **[Confirmed: repo docs; the privacy effect is interpretation]**

---

## 8. Profiling and automated decisions: implications of the encouragement feature

**Legal text.**
- Article 4(4): profiling is "any form of automated processing of personal data" that evaluates personal aspects, including health, behaviour, and preferences. **[Confirmed: legislation.gov.uk, UK GDPR Article 4(4)]**
- Article 22 restricts decisions "based solely on automated processing, including profiling" that produce legal or similarly significant effects. **[Confirmed (heading and scope from legislation.gov.uk Article 22, which says Article 22 was substituted by DUAA 2025 Chapter 3 Section 4A, effective 19 June 2025 or 5 February 2026 depending on purpose; the paragraph text was not retrieved, so the wording above is from the adopted text as understood, needs solicitor to check the current version)]**

**ICO reading.**
- Article 22 covers decisions made with no human involvement that have legal or similarly significant effects. "Similarly significant" means the decision must seriously affect the person. **[Confirmed: ICO, "Rights related to automated decision making including profiling", https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/rights-related-to-automated-decision-making-including-profiling/]**
- Profiling that does not lead to such decisions is outside Article 22, but still needs a lawful basis, transparency, and a way to object. **[Confirmed: same ICO page]**
- The ICO's ADM guidance is under review because of the DUAA. **[Confirmed: ICO individual rights page, and search extract]**

**Application.**
- The buddy and run features evaluate behaviour (logging days, rest-day marks, protein goals). That is profiling in the Article 4(4) sense. **[Interpretation, needs solicitor]**
- Encouragement messages produce no legal effect and no decision about access, pricing or services. Article 22 is probably not engaged. **[Interpretation, needs solicitor]**
- Rule-based templates (fixed text, no generated text) keep the feature out of Article 22 territory. The AI estimate step produces nutrition values that the user confirms before saving, so a human is in the loop. **[Interpretation, needs solicitor]**
- Consequences if profiling applies: the right to object must be offered, and the lawful basis for profiling must be recorded. **[Confirmed: ICO ADM page (search extract) says organisations must draw attention to the right to object to profiling; the lawful-basis point follows from the ICO's "identify and record a lawful basis" wording]**
- If a future feature restricts access or changes what the user sees based on inferred health, the Article 22 analysis must be redone, and the ICO's "inference" rule in section 1 applies. **[Interpretation, needs solicitor]**
- The buddy PRD's requirement that encouragement never shames or judges (P1, P2) reduces the risk of "similarly significant" harm but is not a legal control. **[Interpretation, needs solicitor]**

---

## 9. Retention and deletion of derived data

**Legal and ICO text.**
- Article 5(1)(e): data kept no longer than necessary. **[Not fetched from legislation.gov.uk in this review; the ICO storage limitation page below is the read source]**
- The ICO says there are no fixed UK GDPR time limits; the controller must set and justify periods, record them where possible, and review data regularly. Offline storage is not deletion. Deleted data should be put "beyond use", including in backups. Pseudonymised data remains personal data. The ICO says its guidance does not specifically address derived data beyond this. **[Confirmed: ICO storage limitation page, https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/]**

**Repo facts.**
- Account deletion: immediate in MVP; deletes meals, photos and keys (ADR-004, FR-9). Buddy PRD acceptance criterion (Phase 3, item 7) says delete rest-day marks and run data. Quiet PRD criterion 8 says delete the stored time, zone and push token. **[Confirmed: repo docs]**
- Backups: nightly encrypted dumps, 14-day retention, to an EU Cloudflare R2 bucket (`docs/progress.md` operations status). **[Confirmed: repo docs]**
- Run counts are computed on read and not stored (buddy PRD section 7). **[Confirmed: repo docs]**
- Photos are deleted after estimation unless the meal is saved (ADR-002 and PRD FR). **[Confirmed: repo docs]**

**Application.**
- Derived figures that are computed on read do not need their own retention. They fall away with the source data. **[Interpretation, needs solicitor]**
- Any derived field that is stored (for example a cached week summary, an analytics event, or a rest-day mark) needs an explicit row in the retention schedule and deletion path. **[Interpretation, needs solicitor]**
- The 14-day backup window means deleted data persists for up to 14 days in backups. The ICO's "beyond use" concept may cover this if backups are not restored into live use and the controller can say so. **[Interpretation, needs solicitor]**
- Account deletion "immediate" in MVP should be checked against FR-9's 30-day outer limit in the PRD. The docs say both, which is consistent; the solicitor should confirm the deletion of backups and the AI provider copies (ADR-005 retention table, for example OpenAI abuse-monitoring logs up to 30 days and Anthropic "typically 30 days"). **[Confirmed: repo docs; the legal effect is interpretation, needs solicitor]**
- Keep a documented retention schedule with, at minimum, these rows: meal entries and photos; AI provider copies; rest-day marks; run data (if stored); the buddy switch; reminder time and zone; analytics events; backups. **[Interpretation, needs solicitor]**

---

## 10. Other points the solicitor should see

- **Transfers.** UK hosting (ADR-007, London) and US AI processors (ADR-005) mean transfer rules apply. EU users need EU-side analysis. Progress open decision 3 lists the transfer basis as open. **[Confirmed: repo docs; analysis not done here]**
- **Controller or processor roles.** The AI providers may act as processors or controllers depending on terms (Gemini free training terms, ADR-005). This is not analysed here. **[Not analysed]**
- **Article 9 decision timing.** The buddy PRD makes Phase 4 wait for counsel. Phase 1 and 2 are also built on meal data and should not wait for a different answer, but the solicitor should confirm whether that is acceptable. **[Interpretation, needs solicitor]**

---

## 11. Sources

Primary legislation (legislation.gov.uk):
- UK GDPR Article 4: https://www.legislation.gov.uk/eur/2016/679/article/4
- UK GDPR Article 8: https://www.legislation.gov.uk/eur/2016/679/article/8
- UK GDPR Article 9: https://www.legislation.gov.uk/eur/2016/679/article/9
- UK GDPR Article 22: https://www.legislation.gov.uk/eur/2016/679/article/22 (substituted by DUAA 2025; text not retrieved)
- UK GDPR Article 35: https://www.legislation.gov.uk/eur/2016/679/article/35
- DPA 2018 s.10: https://www.legislation.gov.uk/ukpga/2018/12/section/10
- DPA 2018 Schedule 1: https://www.legislation.gov.uk/ukpga/2018/12/schedule/1

ICO guidance:
- Special category data: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/
- Valid consent: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/what-is-valid-consent/
- DPIA, when required: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/
- DPIA, examples of high risk: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/examples-of-processing-likely-to-result-in-high-risk/
- Data minimisation: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/
- Storage limitation: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/
- Age Appropriate Design Code, services covered: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/services-covered-by-this-code/
- Children's Code FAQs (notifications): https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/faqs-on-the-15-standards-of-the-children-s-code/
- Right to be informed (constant alerts): https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-methods-can-we-use-to-provide-privacy-information/
- Automated decision-making and profiling: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/rights-related-to-automated-decision-making-including-profiling/

Not reached or not retrieved: the ICO Age Appropriate Design Code "What is the code" page (returned 404 at the URL tried); the ICO DPIA landing page (404); UK GDPR Articles 5, 6, 21, 36 (summarised from headings or search, not read in full).

---

## 12. Open questions for the solicitor

1. Is meal-entry data, and the protein and calorie totals derived from it, special category data for Journal's purposes, given that users can type or photograph anything? If yes, is explicit consent (Article 9(2)(a)) the right route, and what must the consent say?
2. Is any Article 9(2) condition other than explicit consent available for a consumer self-tracking app?
3. Is the "large scale" test in Article 35(3)(b) met at the planned user numbers (about 1,000 MAU, ADR-002)? Is a DPIA required, and is it required before any beta?
4. Does the Week card's average kcal (weekly insights PRD) conflict with the owner's decision, and should calories be removed from the Week card as well as the buddy card?
5. Should the Age Appropriate Design Code be addressed by an 18+ or 16+ age confirmation, by a risk assessment showing the service is not likely to be accessed by children, or by both? What evidence is needed?
6. Does the Data (Use and Access) Act 2025 change the Article 22 position for the encouragement and check-in features? What does the current Article 22 text say?
7. Does a notification that reveals only "Time to log today?" (no meal data) raise any issue under the UK GDPR, given that the fact of non-logging is behaviour data?
8. What retention period should apply to rest-day marks and run data while the buddy switch is off?
9. Does the 14-day backup window need a "beyond use" statement in the privacy notice?
10. Who are the controllers and processors for AI providers, and does the Gemini free training term make the consent copy insufficient?
11. What is the transfer basis for UK hosting and US AI providers, for UK and EU users?
12. Does the planned analytics event ("buddy card viewed" with no user identifier) remain personal data if it carries a session or device identifier?

---

## 13. Limitations

This memo is research, not legal advice. It is based on a quick reading of selected primary sources and ICO pages, several of which are marked under review because of the Data (Use and Access) Act 2025. Several ICO pages were read through search extracts rather than in full. EU law is not analysed. A qualified solicitor should review every conclusion marked "interpretation, needs solicitor" before any product, consent or privacy-notice decision is taken.
