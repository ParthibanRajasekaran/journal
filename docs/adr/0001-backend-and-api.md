# ADR-001: Backend and API architecture

## Status

Proposed (2026-10-29). Related: ADR-002 (hosting), ADR-003 (mobile), ADR-005 (AI provider port), ADR-006 (guardrail policy, to be written).

## Context

The PRD (`docs/prd.md`) fixes FastAPI and PostgreSQL and requires: idempotent offline sync that never loses photos (FR-8); authentication and rate limiting on every non-public route; Google OIDC with PKCE and rotating refresh tokens; per-user data with no seeded records; a provider-agnostic AI port (ADR-005); server-side guardrails (ADR-006); and API p95 under 300 ms excluding AI calls.

## Decision

**Stack (current stable releases, checked 2026-10-29):**

| Component | Version | Notes |
|---|---|---|
| FastAPI | 0.162.x | Python >= 3.10; emits OpenAPI 3.1 |
| Pydantic | 2.14.x | Request and response models |
| SQLAlchemy | 2.1.x | 2.x API, async engine with asyncpg |
| Alembic | 1.20.x | Migrations run as a separate deploy step |
| PostgreSQL | 18.6 | 14 reaches end of life 2026-11-12; 19 is at RC1 only |

One containerized, stateless API image. PostgreSQL is the only stateful dependency; photos sit in object storage behind an interface.

**Idempotent sync.** Every write carries a client-generated `Idempotency-Key` (UUIDv4). Two layers:
1. Natural key: `meals.client_id` is unique per user, so a late replay returns the existing row even after the header cache is pruned. Offline devices can sync weeks later.
2. Replay cache: `idempotency_keys(user_id, key, request_hash, status, body, created_at)`, unique on `(user_id, key)`, retained at least 24 h. Same key with a different body returns 422; an in-flight duplicate returns 409 with `Retry-After`. This follows Stripe's model: save the first response, compare parameters, allow reuse after pruning ([Stripe](https://docs.stripe.com/api/idempotent_requests)).

**Photos are never lost.** The client uploads the photo first (`POST /photos`, keyed by SHA-256 plus `client_id`). The server returns `photo_id` only after the bytes are durably stored. A meal may reference only an existing `photo_id`. The client drops the local photo only after meal create returns 201. Unsaved estimate photos are deleted after estimation (PRD privacy NFR).

**Errors.** RFC 9457 `application/problem+json` for all 4xx and 5xx: `type` (stable URI), `title`, `status`, `detail`, `instance`, and an `errors` list for field-level validation ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)). Pydantic validation maps to 422.

**Versioning.** URI prefix `/api/v1`. Additive changes are non-breaking; breaking changes ship as `/api/v2`. Deprecated routes send `Deprecation` and `Sunset` headers.

**Auth and limits.** The server verifies the Google ID token (issuer, audience, expiry, nonce). Access JWTs last 15 minutes. Refresh tokens are opaque, stored hashed, rotated on use, with reuse detection. Limits are per user on authenticated routes, per IP on sign-in, and tighter on `/estimates` because it costs money. Counters live in PostgreSQL for MVP; move to Redis if needed. Only `/health` and the sign-in exchange are public.

**MVP resources:**

| Method and path | Purpose |
|---|---|
| POST `/auth/google/exchange`, POST `/auth/refresh`, POST `/auth/logout` | Sign-in (creates account on first use), rotation, revocation |
| GET, PATCH, DELETE `/me` | Profile and targets; delete removes meals, photos, keys |
| GET, PUT `/me/ai-provider` | Provider choice (FR-7) |
| GET, POST `/me/consents` | Per-provider consent (ADR-005) |
| POST `/photos` | Upload; returns `photo_id` |
| POST `/estimates` | Estimate from `photo_id` or text; saves nothing |
| GET, POST `/meals` | List by `date` or range; create |
| GET, PATCH, DELETE `/meals/{id}` | Read, edit, delete |
| GET `/days/{date}`, GET `/week?start=` | Today totals; Week list |
| POST `/sync` | Batch of queued writes; per-item result |
| GET `/health` | Public liveness |

**Example: create meal**

```http
POST /api/v1/meals
Authorization: Bearer <access_token>
Idempotency-Key: 3f1c2a9e-5b7d-4e8a-9c01-2d6f7a8b9c10

{"client_id": "3f1c2a9e-5b7d-4e8a-9c01-2d6f7a8b9c10", "meal_type": "breakfast",
 "eaten_at": "2026-10-29T08:12:00Z", "name": "Oatmeal with banana",
 "calories": 352, "protein_g": 11.8, "carbs_g": 61.0, "fat_g": 6.2,
 "photo_id": "ph_01JC8Y2K", "source": "ai_confirmed"}
```

```http
HTTP/1.1 201 Created
Location: /api/v1/meals/meal_01JC8Z4P

{"id": "meal_01JC8Z4P", "client_id": "3f1c2a9e-5b7d-4e8a-9c01-2d6f7a8b9c10",
 "meal_type": "breakfast", "eaten_at": "2026-10-29T08:12:00Z", "name": "Oatmeal with banana",
 "calories": 352, "protein_g": 11.8, "carbs_g": 61.0, "fat_g": 6.2,
 "source": "ai_confirmed", "version": 1, "created_at": "2026-10-29T08:12:03Z"}
```

**Example: estimate**

```http
POST /api/v1/estimates
Authorization: Bearer <access_token>

{"photo_id": "ph_01JC8Y2K", "text": null}
```

```http
HTTP/1.1 200 OK

{"estimate_id": "est_01JC8Z9A", "provider": "gemini",
 "estimate": {"name": "Oatmeal with banana", "meal_type": "breakfast",
   "calories": 352, "protein_g": 11.8, "carbs_g": 61.0, "fat_g": 6.2, "confidence": 0.82}}
```

Failures are problems: `503` `.../problems/ai-unavailable` (client offers manual entry, FR-5); `403` `.../problems/consent-required`; `422` `.../problems/estimate-invalid` when output fails schema or range checks (FR-4). Fixed fallback numbers are never returned.

## Alternatives considered

- **Idempotency: header cache only vs. natural keys only.** A cache alone expires and a late sync can duplicate meals; natural keys alone give no replay response. We use both.
- **Idempotency: server-issued IDs.** Needs a round-trip before offline writes are usable. Client UUIDs avoid this.
- **Errors: custom JSON vs. RFC 9457.** Custom is quicker now but every client re-invents it. RFC 9457 is a standard with little extra code.
- **Versioning: URI vs. header.** Headers are cleaner but harder to test and pin. URI matches the OpenAPI output.
- **Rate limiter: PostgreSQL vs. Redis.** Redis adds a stateful service; PostgreSQL counters suit MVP volume behind a swappable interface.
- **Sync vs. async SQLAlchemy.** Async fits the I/O-bound estimate path.

## Consequences

- Clients must persist UUIDs and retry with the same key (contract for ADR-003).
- Two idempotency layers need a cleanup job. Photo storage sits on the create path; the client keeps photos until confirmed.

## Open risks

- **Idempotency-Key is still an IETF draft** (revision -07, October 2025). We follow the header name and semantics only.
- **New library lines.** SQLAlchemy 2.1 and Pydantic 2.14 are recent; plugins may lag. Fall back to the 2.0 API if blocked.
- **AI latency.** Estimate p95 of 8 s sits outside the API budget; use timeouts and a per-user concurrency cap.

## Sources

Read 2026-10-29.

1. FastAPI: https://pypi.org/project/fastapi/ (0.162.0, 2026-10-23)
2. Pydantic: https://pypi.org/project/pydantic/ (2.14.2, 2026-10-29)
3. SQLAlchemy: https://pypi.org/project/SQLAlchemy/ (2.1.6, 2026-10-21)
4. Alembic: https://pypi.org/project/alembic/ (1.20.1, 2026-10-22)
5. PostgreSQL versions and EOL: https://www.postgresql.org/support/versioning/
6. Stripe idempotent requests: https://docs.stripe.com/api/idempotent_requests
7. IETF Idempotency-Key draft -07, via search: https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header
8. RFC 9457, via search: https://www.rfc-editor.org/rfc/rfc9457

