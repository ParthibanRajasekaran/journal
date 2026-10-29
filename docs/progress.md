# Progress

Last updated: 2026-10-29. This file is the checkpoint for planning work. Update it when a phase changes state. Agents and humans should read it before starting work.

## Phase status

| Phase | Item | Status | Owner | Notes |
|---|---|---|---|---|
| 0 | Clean up repo (move to root, README, .gitignore) | Done | Human | Pushed to origin/main (5 commits) |
| 1 | PRD (`docs/prd.md`) | Draft v0.1 | Product | Defaults listed in PRD section 11 |
| 1 | Architecture decisions (`docs/adr/0001` to `0006`) | Proposed | Architects | All six written; none accepted yet |
| 1 | Design doc (`docs/design.md`) | Draft | Architecture | Describes components and flows |
| 1 | OpenAPI spec (`docs/openapi.yaml`) | Draft | Backend | MVP surface; schema fields pending ADR-005 decision |
| 1 | Observability plan (`docs/observability.md`) | Draft | Platform | OpenTelemetry conventions and redaction rules |
| 1 | Tooling assessment (`docs/tooling-assessment.md`) | Draft | Architecture | Free and open-source options, with security view |
| 1 | Client architecture (`docs/client-architecture.md`) | Draft | Architecture | Server-driven UI versus native versus hybrid |
| 0 | Quality gates (`make check`, pre-commit, CI) | Done | Platform | Verified: gates fail on broken spec, leaked key, oversized file |
| 2 | Policy-as-code (`policy/`) | Estimate policy tested (10/10); authz and consent untested | Security | Tests for authz and consent land with steps 3, 4, 6 |
| 2 | Backend skeleton (FastAPI) | Not started | | Blocked on ADR acceptance |
| 2 | Mobile and web shell (Capacitor) | Not started | | Blocked on ADR acceptance |
| 3 | Eval set (150 labelled meals) | Not started | | Needed for ADR-005 drift gate |
| 3 | Authentication (ADR-004) | Not started | | Needs Apple `biometryCurrentSet` spike first |

## Open decisions (blocking acceptance)

1. **Default AI provider.** Gemini free tier may use meal content to improve Google products (ADR-005, ADR-006). Options: paid or no-training Gemini as default; free Gemini behind explicit training acknowledgement; or OpenAI or Anthropic default. Owner: product. Affects PRD section 11 and FR-7.
2. **Estimate schema.** ADR-001 uses `calories` and numeric `confidence`. ADR-005 uses `calories_kcal` and `low|medium|high`. Neither has `is_food`. Pick one set and update both ADRs.
3. **EU transfer basis and Article 9 status.** Counsel to confirm the transfer mechanism for US AI providers and whether meal and photo data is special-category health data.
4. **Refresh-token lifetime (90 days) and re-auth window (5 min).** Proposed in ADR-004. Confirm.
5. **Hosting target.** ADR-002 default is a single EU VPS. Confirm the Hetzner plan is in stock, or choose the Fly.io fallback.
6. **Client approach.** Capacitor hybrid (ADR-003) versus native. See `docs/client-architecture.md`.

## Verification still needed

- Run `opa check` and `opa test` on all `policy/` files. Tests have not run.
- Confirm Apple `biometryCurrentSet` behaviour on a device (ADR-004).
- Confirm vision plus structured output on OpenAI and Anthropic (ADR-005).
- Confirm Render and Cloud Run prices from official pages (ADR-002).
- Restore a PostgreSQL backup end to end once the backup job exists (ADR-002).

## Next actions

1. Owner answers open decisions 1 to 3.
2. Accept or amend ADR-001 to ADR-006; mark each Accepted with a date.
3. Install OPA and run the policy tests.
4. Write the eval set before any AI adapter is merged.
