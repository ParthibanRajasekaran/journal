# Journal: UK consumer, advertising and health-claims review

**Status:** Research memo for solicitor review. Draft v0.1. Date of review: 2026-10-30.

**This is not legal advice.** It is a research memo prepared by a non-lawyer analyst to help a human solicitor scope the questions. Nothing here should be relied on, shipped or published without review by a qualified solicitor.

Labels used throughout:
- **[Confirmed in primary source]**: the point was checked against the cited legislation or guidance text as retrieved on 2026-10-30. Fetch tools summarise pages, so exact wording should be re-checked against the official page before it is quoted in any external document.
- **[Interpretation, needs solicitor]**: a reasoned reading of the sources, or a point where the primary source was not reached or did not answer the question.

---

## 0. Corrections to the brief and what was found in the repo

1. **The CPRs 2008 are revoked.** The Consumer Protection from Unfair Trading Regulations 2008 (SI 2008/1277) were revoked on 6 April 2025 by the Digital Markets, Competition and Consumers Act 2024 (DMCCA). The "misleading actions" and "misleading omissions" rules now sit in DMCCA Part 4 Chapter 1. **[Confirmed in primary source]** legislation.gov.uk/uksi/2008/1277/regulation/5 (revocation note, 6.4.2025). The operative provisions are DMCCA s.226 (misleading actions) and s.227 (misleading omissions), confirmed at https://www.legislation.gov.uk/ukpga/2024/13/section/226 and https://www.legislation.gov.uk/ukpga/2024/13/section/227. Note: SI 2008/1276 is the *Business Protection from Misleading Marketing* Regulations, not the CPRs. Do not cite it for consumer-facing claims.
2. **CAP Code numbering.** Section 13 is "Weight control and slimming", not food. Food and nutrition/health claims are **Section 15**. **[Confirmed in primary source]** https://www.asa.org.uk/codes-and-rulings/advertising-codes/non-broadcast-code.html (section list).
3. **The 80%, 90% and 100% tiers and the words "amazing", "great" and "good" do not exist in the codebase.** `web/src/encouragement.ts` contains only `savedLine` (one calm line, plus the protein sentence at target), `weekLines` (logged-days count and protein-days count) and the approximate caveat. A grep of `web/src` and `backend` for those words and tiers found nothing. The 90% threshold appears only in `docs/prd-features/weekly-insights.md` (proposed), and the buddy PRD counts a day as reached at 100%. Either the brief refers to a draft not yet in the repo, or to a future design. **This memo reviews that future design as a risk, and assesses the copy that does exist.**
4. **Sign-in copy and the actual data flow.** The sign-in screen (`web/src/screens/SignIn.tsx`) says "Only you see your meals in Journal." and "We never sell your data." Meal photos and text are sent to a third-party AI provider chosen by the user (PRD section 4, items 8 and 9; ADR-005). The default provider is Gemini free tier, which the team's own ADR-005 records as possibly using content to improve Google products, with human review (see section 3 below).

---

## 1. Are the encouragement messages health claims, or encouragement of particular eating?

**Current copy (what exists).**
- "Logged. Nice work keeping track." This praises logging, not food. **[Interpretation, needs solicitor]** low risk.
- "Logged. You've reached your protein goal for today." This states a fact about the user's own logged total against a user-set target. **[Interpretation, needs solicitor]** it is not a claim about a food's nutritional properties, but it sits close to CAP rule 15.1 ("nutrition or health claims must be supported by documentary evidence") if the words "protein goal" are read as implying benefit. Keep the wording factual and avoid any benefit ("builds muscle", "keeps you full").
- "You logged on X of 7 days." Factual, low risk.

**Future tiers (the brief's proposal: "amazing" at 100%, "great" at 90%, "good" at 80%).**
- **Risk: a grading of intake.** Tiers keyed to a percentage of a target score the user's eating against a number. That is close to the "under target" and "over target" judgement the buddy PRD (P1, P2) rejects. **[Interpretation, needs solicitor]** It could be read as the app endorsing eating close to a target, and as implying that a day below 80% is worse. The UK rule is that a commercial practice is a misleading action if it contains false or misleading information, or an overall presentation likely to deceive the average consumer, about a product or a matter relevant to a transactional decision (DMCCA s.226(1)(a)-(b), (2), (3)) **[Confirmed in primary source]**. A grading that implies a food pattern is "good" could be argued as misleading if the app's health basis is not evidenced.
- **Risk: unfair practice.** A tier that makes a user feel they have failed at 80% could be argued as an aggressive or harmful practice, and it cuts against the PRD's own P5 and P2. **[Interpretation, needs solicitor]** This is more a product and ethics issue than a clear legal breach, but it should not ship without review.
- **Recommendation:** drop percentage tiers and any adjective that grades the user's intake ("amazing", "great", "good"). Use the fixed factual lines already in the code.

**Eating disorder context.** The buddy PRD names users who may have a rough day or a history of restriction. Any grading or streak feature can reinforce restriction for those users. This links to section 4 below.

---

## 2. Copy rules to adopt, and whether "never discourage" is itself a claim

**Recommended copy rules** (each should become a test or a review checklist item):

1. No message grades what the user ate, or implies any food or meal is good, bad, better or worse. No "good", "bad", "healthy", "clean", "junk" or "treat" applied to food.
2. No message refers to calories, "under", "over", "limit", "allowance" or a percentage of target. (Buddy PRD P1, P2 already require this.)
3. No message uses "failed", "lost", "broken", "reset", "missed" or "streak lost". (Buddy PRD Phase 3 acceptance 4.)
4. Protein or other nutrient lines state only the user's logged total and whether the user's own target was reached. No benefit words ("builds", "keeps you full", "for your health", "boosts").
5. Every figure derived from an estimate carries "Approximate, based on what you've entered." (Already in code.)
6. Messages come from fixed templates only (buddy PRD P3). No generated text in encouragement.
7. No weight-loss, body-shape or condition-specific wording. CAP Section 13 (weight control and slimming) applies if any weight claim is made. **[Confirmed in primary source]** https://www.asa.org.uk/type/non_broadcast/code_section/13.html (section title, per section list above).
8. Any nutrition or health claim must be documentary-evidenced (CAP rule 15.1), and general "good health" benefit wording must be linked to an authorised claim (CAP rule 15.2). **[Confirmed in primary source]** https://www.asa.org.uk/type/non_broadcast/code_section/15.html (rules as retrieved by summarising fetch; verify exact text on page).

**Is "never discourage" a claim?** Yes, in substance. A statement such as "Journal never discourages any food" is a factual claim about the app's behaviour. **[Interpretation, needs solicitor]** It needs evidence (tests, copy audit, a dated review log), must be true at all times, and would be misleading if an unreviewed string or an AI-generated message breaks it. CAP rule 3.7 requires documentary evidence for objective claims consumers are likely to rely on **[Confirmed in primary source]** https://www.asa.org.uk/type/non_broadcast/code_section/03.html (rule 3.1 and 3.7 quoted). **Recommendation:** do not use "never" in public copy. Use "Journal is designed not to judge food", which describes intent, and keep the test suite as internal evidence. Solicitor to confirm.

---

## 3. Sign-in promises: "Only you see your meals" and "We never sell your data"

Each promise is an objective factual statement made to consumers at sign-in, so each must be true and provable.

**"Only you see your meals in Journal."**
- **Problem:** meal photos and text are sent to the user's chosen AI provider (PRD section 4, items 8 and 9; ADR-005). A third party therefore does see the meal content as part of processing. The consent gate exists because of this. **[Confirmed in primary source]** the team's own PRD and ADR text (internal), not an external source.
- Within Journal's own users, the statement may be true (no other account can read another user's meals). Read literally, "only you see" is inaccurate, and the consent screen contradicts it.
- The DMCCA s.226(1)(a) and s.227(1)(a) test (false or misleading information, or an omitted material fact that the average consumer needs) applies. **[Interpretation, needs solicitor]** It is a likely misleading statement as written.
- **Evidence needed to make a narrower version true:** access controls tested for other-user access (PRD FR-9 and security tests); a list of the processors that receive content; the provider terms for each option.

**"We never sell your data."**
- Not provably true without evidence. "Sell" is not defined in UK law in the consumer context, so the solicitor should decide the meaning. The team needs: a written commitment from the company, provider terms showing no sale, data processing agreements (DPAs) with each AI provider, and a data inventory.
- **Gemini free tier:** ADR-005 and ADR-006 record that the pricing page says free-tier content is "used to improve our products" and that human reviewers may read input. Whether that is "selling" is for the solicitor, but it makes an unqualified "never" statement risky. **[Interpretation, needs solicitor]** The ADR cites the Gemini pricing page (updated 2026-10-28). I did not verify it at the primary source in this run.
- **Recommendation:** replace with a precise, provable statement, for example: "We don't sell your personal data. Meal text and photos are sent to the AI provider you choose to estimate them." Solicitor to approve.

**"Delete everything, any time, from Settings."**
- Settings has a "Delete account" flow ("Yes, delete everything"). PRD FR-9 says deletion within 30 days, "immediate in MVP". Keep "any time" only if the deletion is immediate and includes provider-held copies where the provider allows it. **[Interpretation, needs solicitor]**

**Other sign-in text.** "We use your Google account only to confirm it's you." needs checking against what Google data the app receives and stores (scope list). Not checked in this run.

---

## 4. Equality Act 2010 and accessibility

- **Disability definition.** s.6(1): a person has a disability if they have a physical or mental impairment with a "substantial and long-term adverse effect" on normal day-to-day activities. **[Confirmed in primary source]** https://www.legislation.gov.uk/ukpga/2010/15/section/6. An eating disorder may meet this test. **[Interpretation, needs solicitor]**
- **Service provision.** s.29(1)-(2) prohibits discrimination by a service-provider who provides a service to the public, for payment or not. **[Confirmed in primary source]** https://www.legislation.gov.uk/ukpga/2010/15/section/29. Journal is likely a service-provider. Whether a reasonable-adjustments duty (s.20) applies is **[Interpretation, needs solicitor]** (s.20 not fetched in this run).
- **Practical risk.** Streaks, run lengths, rest-day counts and numerical targets can harm a user with a history of restriction. The buddy PRD's off switch (P6, section 4.5) is a key mitigation. The solicitor should consider whether the default should be off for users who have declared such a history, or whether a "hide numbers" option is needed.
- **Colour alone.** The PRD already requires text signals (P8). Over-target amber must be removed (buddy PRD section 7). **[Interpretation, needs solicitor]** WCAG 2.2 success criterion 1.4.1 (use of colour) is the relevant standard; the W3C page was not fetched in this run, so cite it only after check.
- **Public sector duty.** s.149 (public sector equality duty) applies to public authorities only and does not apply to Journal. **[Interpretation, needs solicitor]**

---

## 5. Consumer Rights Act 2015 and digital content for a free app with the user's own AI key

- **Digital content quality and description.** CRA s.34 (satisfactory quality) and s.36 (as described) apply to digital content contracts. **[Confirmed in primary source]** https://www.legislation.gov.uk/ukpga/2015/15/part/1/chapter/3 (sections list and wording).
- **Free content.** CRA s.33 applies to content supplied free only where it is supplied free with goods, services or other content that is paid for, or where the consumer pays a price. Entirely free content with no paid element is not covered by s.33(1) or (2). **[Confirmed in primary source]** same page, s.33. Journal's core app is free, so the CRA may not apply to Journal itself. **[Interpretation, needs solicitor]** The user's payment to an AI provider is a payment to a third party, not to Journal, so it is unlikely to bring Journal within s.33. This needs confirming.
- **Costs the user pays their AI provider.** Settings already says: "so you pay your provider directly for what you use." That is accurate and should stay. **[Interpretation, needs solicitor]** Recommended text:
  - "Journal is free to use. If you add your own AI key, your AI provider charges you directly for what you use. Journal doesn't set or receive those charges."
  - Avoid "free" unqualified in store listings or sign-in copy. CAP rule 3.23 says a product must not be described as "free" if the consumer pays more than the unavoidable cost of responding or collecting. **[Confirmed in primary source]** https://www.asa.org.uk/type/non_broadcast/code_section/03.html (rule 3.23 as retrieved). If the user needs a paid AI key to estimate meals, "free" risks being misleading. Use "Free to download and use, with your own AI key" and make the key requirement visible before sign-up.
- **Free-tier default (Gemini).** Choosing a default that the user may not realise trains on their content is a consent and clarity issue, not only a cost issue. See section 3.

---

## 6. Online Safety Act 2023

- **Definition.** A "user-to-user service" is an internet service where user-generated content may be encountered by another user. **[Confirmed in primary source]** https://www.legislation.gov.uk/ukpga/2023/50/section/3 (s.3(1) and (2)). Sub-section (2)(a) says the test is met where the service has functionality that allows sharing, whether or not sharing happens.
- **Current scope.** The MVP PRD excludes sharing and social features (section 4, out of scope). Meals are private to the account. On that basis the MVP is likely **outside** the definition. **[Interpretation, needs solicitor]** The solicitor should confirm, since Schedule 1 exclusions and s.4 were not reached in this run.
- **Trigger for review.** Any comment, sharing, export-to-others, public profile, or friend or buddy feature would bring the service into scope, and the name "buddy" should not imply a social feature. **[Interpretation, needs solicitor]** Note that the buddy PRD names "buddy" for the encouragement voice only.

---

## 7. Advertising rules if sponsored content or affiliate links are ever shown

- **Recognition.** Commercial content must be clearly identifiable as marketing. **[Confirmed in primary source]** CAP Section 2 (summary: rule 2 covers recognition of marketing communications; full rule text not retrieved). https://www.asa.org.uk/codes-and-rulings/advertising-codes/non-broadcast-code.html
- **Misleading advertising.** Rule 3.1 (must not materially mislead) and rule 3.7 (documentary evidence for objective claims). **[Confirmed in primary source]** CAP Section 3 (as retrieved).
- **Nutrition and health claims in ads.** Section 15 applies to any food or supplement claim in an ad, including a sponsored food product. **[Confirmed in primary source]** CAP Section 15 rules 15.1 to 15.3 (as retrieved).
- **Data for marketing.** Section 10 (use of data for marketing) applies if meal logs are used to target ads. **[Confirmed in primary source]** section title only. The direct rule text was not retrieved. Targeting by health data is a major risk and should be excluded by policy. **[Interpretation, needs solicitor]**
- **Affiliate links.** Recognition, and the "free" rule, apply. The DMCCA s.226 misleading-action test also applies to affiliate-driven recommendations. **[Interpretation, needs solicitor]**
- **Recommendation:** no sponsored or affiliate content while Journal processes meal data for estimates, unless the solicitor signs off on the data basis.

---

## Open questions for the solicitor

1. Is the Article 9 UK GDPR question (special category health data) answered for meal and photo data? This affects every consent and "only you see" statement. (progress.md, open decision 3.)
2. Is "only you see your meals" saveable in narrowed form, or must it be rewritten? Confirm the meaning of "sell".
3. Confirm the Gemini free-tier default position: keep, change, or require explicit training acknowledgement (ADR-005 open risk 1).
4. Does CRA s.33 apply to Journal, or is the core app outside it entirely? Confirm the "free" wording for store listings.
5. Confirm the DMCCA penalty regime for breaches of ss.226-227 (the CMA direct enforcement power and the maximum penalty). This memo could not confirm the turnover percentage from the fetched text.
6. Does the Equality Act s.20 duty apply in practice, and should the default for buddy encouragement change for users with a declared history of restriction?
7. Confirm the OSA position for any future feature that shares, and whether the "buddy" name needs changing.
8. Confirm the CAP rules 15.1 to 15.3 and 3.23 text against the official PDF before any external use.
9. Should tiers or grading be removed entirely from the buddy design (recommended here), or is there a version the solicitor would approve?

---

## Sources (primary, as retrieved 2026-10-30)

- DMCCA 2024, s.226: https://www.legislation.gov.uk/ukpga/2024/13/section/226
- DMCCA 2024, s.227: https://www.legislation.gov.uk/ukpga/2024/13/section/227
- CPRs 2008 revocation note: https://www.legislation.gov.uk/uksi/2008/1277/regulation/5
- CRA 2015, Part 1 Ch. 3 (digital content, s.33-36): https://www.legislation.gov.uk/ukpga/2015/15/part/1/chapter/3
- Equality Act 2010, s.6 and s.29: https://www.legislation.gov.uk/ukpga/2010/15/section/6 and https://www.legislation.gov.uk/ukpga/2010/15/section/29
- Online Safety Act 2023, s.3: https://www.legislation.gov.uk/ukpga/2023/50/section/3
- CAP Code (non-broadcast), section list and rules: https://www.asa.org.uk/codes-and-rulings/advertising-codes/non-broadcast-code.html
- CAP sections 3, 13, 15: https://www.asa.org.uk/type/non_broadcast/code_section/03.html, .../13.html, .../15.html

Not reached in this run: DMCCA penalty provisions and Schedule 20 (banned practices), CRA s.20 (Equality Act), OSA Schedule 1, CAP sections 2 and 10 full text, UK GDPR Article 9.

---

**This is not legal advice.** A qualified solicitor must review every conclusion marked "interpretation, needs solicitor" before any copy, consent text, store listing or policy is published.
