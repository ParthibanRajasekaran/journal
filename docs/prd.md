# Journal — Product Requirements Document (MVP)

Status: Draft v0.1 · Owner: Product · Scope: MVP

## 1. Problem and vision

Most nutrition apps ask people to log too much, too often, and show them numbers they cannot act on. A person who wants to eat reasonably needs to answer three questions quickly: what have I eaten today, what do I still need, and what should I eat next.

**Vision:** Journal lets one person log a meal in under 30 seconds and see today's progress at a glance, on web, Android, and iOS, with their data under their control.

## 2. Users and jobs

- **Primary user:** an adult aged 18 or over tracking their own meals for general health. Uses the phone for logging and a browser for review. MVP access is 18+ only; 16 to 17 year olds are not admitted until a separate, reviewed plan exists (see `docs/research/teen-access-competitors.md`).
- **Job 1:** log a meal quickly from a photo, a text description, or a voice note.
- **Job 2:** see today's totals against a daily target.
- **Job 3:** review the past week and correct mistakes.

## 3. Goals and success metrics

| Goal | Metric | MVP target |
|---|---|---|
| Fast logging | Median time from "Add meal" to saved | < 30 s |
| Trust in estimates | Users who edit an AI estimate before saving | Tracked; baseline set after 4 weeks |
| Retention | Users logging on ≥ 4 of 7 days | ≥ 40% at week 4 |
| Safe onboarding | Accounts created with a biometric unlock enabled | ≥ 60% of new accounts |
| Privacy | Meal data sent to a third-party AI without explicit consent | 0 |

## 4. MVP scope

### In scope

1. **Sign-in with Google** (OAuth 2.0 / OpenID Connect, authorization code flow with PKCE). The first sign-in creates the account.
2. **Biometric unlock** after account creation. Offered once the account exists. Falls back to Google sign-in.
3. **Today screen:** calorie and protein totals against target, four meal slots (breakfast, lunch, dinner, snack), a single add button.
4. **Add meal:** from a photo, a text description, or manual entry. AI estimates nutrition; the user confirms or edits before saving.
5. **Edit and delete** any saved meal.
6. **Week screen:** seven-day list with daily totals. Tapping a day opens it on Today.
7. **Settings:** profile (daily targets), AI provider choice, biometric on/off, sign out, delete account and data.
8. **AI provider choice (model-agnostic):** the user picks Google Gemini (free tier, default), OpenAI, or Anthropic. The user can bring their own API key. The app never depends on one vendor's SDK in core logic.
9. **Consent gate:** before any photo or text is sent to a third-party AI provider, the user sees which provider receives it and agrees once per provider.
10. **Offline logging:** meals logged offline are saved locally and synced when online. Photos are not lost on sync.
11. **Platforms:** web (responsive), Android, iOS, sharing one UI codebase.

### Out of scope for MVP

- Codebase or data export, backup, and import (remove; revisit with a proper data-portability feature later).
- PWA install prompts.
- Pro tier, paywalls, achievements, badges, confetti, and coach tips. Buddy encouragement is in scope (see `prd-features/buddy-encouragement.md`) and can be switched off in Settings. Streaks stay out until that PRD's phase 3 is signed off.
- Next-meal recommender and generated/seed meal history.
- Micronutrient dashboard, analytics dashboards, and trend charts beyond the Week list. A fibre and vitamin glimpse is allowed only after the owner approves phase 4 of the buddy PRD.
- Hydration tracking, multi-user households, sharing, social features, and wearable integrations.
- Medical advice or condition-specific diet plans.

## 5. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | A new user signs in with Google and gets an account created on first sign-in. | Must |
| FR-2 | After account creation, the user may enable biometric unlock on the device. The unlock does not replace Google sign-in on a new device. | Must |
| FR-3 | No default or hard-coded PIN or passcode exists anywhere in the product. | Must |
| FR-4 | Meal estimates return a validated structure (name, meal type, calories, protein, carbs, fat, confidence). Invalid or out-of-range model output is rejected or flagged, never silently replaced with fixed numbers. | Must |
| FR-5 | When an AI estimate fails, the user is told and can enter values manually. | Must |
| FR-6 | Logged meals are stored per user. No fabricated or seeded meals are created. | Must |
| FR-7 | A user can change the AI provider at any time; the next estimate uses the new provider. | Must |
| FR-8 | Offline meal entries sync without losing photos. | Must |
| FR-9 | A user can delete their account, and all their meals, photos, and keys, within 30 days of request (immediate in MVP). | Must |
| FR-10 | Logs of meal content do not include photos or personal text. | Must |

## 6. Non-functional requirements

- **Security:** OAuth 2.0 with PKCE; short-lived access tokens; rotating refresh tokens; all API traffic over TLS; API keys for AI providers encrypted at rest; rate limits on all endpoints; no unauthenticated routes except health and sign-in.
- **Privacy:** data minimization; per-provider consent; photos deleted after estimation unless the user saves the meal.
- **Performance:** API p95 < 300 ms excluding AI calls; AI estimate p95 < 8 s; app cold start < 2 s on a mid-range phone.
- **Lightweight:** web bundle and mobile app kept small; no large downloads served from the app or repo.
- **Accessibility:** WCAG 2.2 AA contrast; 44 px minimum touch targets; text scales with system settings.
- **Portability:** no hard dependency on a single cloud vendor; containerized backend; open-source core stack.
- **Reliability:** the core logging path works offline; sync is idempotent.

## 7. Architecture constraints (for the ADRs)

- Backend: FastAPI (Python).
- Web and mobile share one UI codebase.
- Mobile: open-source cross-platform framework, targeting Android and iOS.
- Authentication: Google OAuth 2.0 / OIDC.
- AI: provider-agnostic port with adapters for Gemini, OpenAI, and Anthropic.
- Guardrails and authorization are policy-as-code and enforced server-side, independent of which model produces the estimate.

## 8. Key user flows

1. **First run:** Open app → Sign in with Google → Choose AI provider (Gemini free tier is preselected) → Consent to provider → Offer biometric unlock → Today screen.
2. **Log a meal:** Tap add → Photo, text, or manual → AI estimate (or error + manual) → Review and edit → Save → Today totals update.
3. **Return visit:** Open app → Biometric unlock (if enabled) → Today.
4. **Correct a past day:** Week → Tap day → Edit or delete meal.

## 9. Acceptance criteria (MVP launch)

- All Must requirements pass automated tests and a manual test pass on Android, iOS, and web.
- The repository contains no tarball or binary export of the app.
- No default PIN or credential exists in source or storage.
- A penetration check of the `/api` routes shows authentication and rate limiting on every non-public route.
- A model-swap test shows the same validated output shape from Gemini, OpenAI, and Anthropic adapters on the evaluation set.

## 10. Open questions

1. Daily target defaults: use a standard calorie formula, or ask the user for inputs at onboarding? (Proposed: ask at onboarding; leave blank until set.)
2. Hosting target: which managed or self-hosted environment? (ADR-002 proposes options.)
3. Retention of meal photos: never stored long-term in MVP (proposed), or stored for user review?

## 11. Decisions made as defaults (change if needed)

- Mobile: one React codebase wrapped by Capacitor (MIT). Final choice in ADR-003.
- Backend: FastAPI + PostgreSQL.
- Gemini free tier is the default AI provider.
- No seeded or demo data in production builds.
