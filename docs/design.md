# Journal — System design (MVP)

Status: Draft · Date: 2026-10-29 · Read with: `docs/prd.md`, `docs/adr/0001` to `0006`

This document shows how the parts fit together. Each decision is recorded in its ADR; this file does not repeat the reasoning.

## 1. Context

Journal is a meal logging app for one person. Clients are a web app and Android and iOS apps, all sharing one React UI. A FastAPI backend holds all data and makes all AI calls. Users sign in with Google. Meal photos and text are sent to an AI provider the user has chosen and consented to.

```
 Browser (web)        Android / iOS (Capacitor)
      │                        │
      │  HTTPS, Bearer JWT     │  HTTPS, Bearer JWT
      └────────────┬───────────┘
                   ▼
        Caddy (TLS, rate limits at edge)            ADR-002
                   ▼
        FastAPI API (stateless container)           ADR-001
          ├─ auth: Google OIDC, own tokens          ADR-004
          ├─ policy: OPA sidecar or in-process      ADR-006
          ├─ AI port → Gemini | OpenAI | Anthropic  ADR-005
          └─ telemetry → OpenTelemetry Collector    observability.md
                   │
          ┌────────┴─────────┐
          ▼                  ▼
     PostgreSQL 18     Object storage (photos, S3-compatible)
```

## 2. Components

| Component | Responsibility | Decided in |
|---|---|---|
| Client UI (React, Vite) | Today, Add meal, Week, Settings; offline queue; biometric unlock | ADR-003 |
| Native shell (Capacitor) | Packaging, biometric plugin, secure storage, SQLite | ADR-003 |
| API (FastAPI) | Resources in `openapi.yaml`; validation; idempotency; rate limits | ADR-001 |
| Auth module | Google ID-token verification, session issuance, refresh rotation, device-bound unlock | ADR-004 |
| AI port | One interface, three adapters, one output schema, no silent fallback | ADR-005 |
| Guardrails | Authorization, consent, output validity, agent change policy | ADR-006 |
| Database | Users, meals, consents, provider settings, idempotency keys, sessions | ADR-001 |
| Object storage | Photos until estimation completes or the meal is saved | ADR-001 |
| Observability | Traces, metrics, logs with redaction | `observability.md` |

## 3. Key flows

### 3.1 Log a meal from a photo

1. Client uploads the photo: `POST /api/v1/photos`. Server stores it and returns `photo_id`.
2. Client calls `POST /api/v1/estimates` with `photo_id`. Server checks auth, consent for the chosen provider, and rate limit.
3. AI port calls the provider with a fixed prompt and requests structured output.
4. Server validates the reply against the schema and policy. Invalid or out-of-range output returns `422 estimate-invalid`; nothing is saved and no fixed numbers are substituted.
5. Client shows the estimate. The user edits and confirms.
6. Client calls `POST /api/v1/meals` with `Idempotency-Key` and `client_id`. Server saves the meal and returns `201`.
7. Client deletes the local photo copy only after `201`.

### 3.2 Offline logging and sync

1. With no network, the client writes the meal and photo to local SQLite with a `client_id` (UUID) and marks it `pending`.
2. On reconnect, the client calls `POST /api/v1/sync` in batches. Each item is retried with the same key.
3. Duplicate replays return the existing row (natural key on `client_id`), so a retry never creates a second meal.
4. Per-item results are returned; failed items stay `pending` with the error.

### 3.3 Sign-in and biometric unlock

1. First sign-in: Google authorization code flow with PKCE. The server verifies the ID token, creates the account, and issues a 15-minute access token plus a rotating refresh token.
2. After sign-in, the user may enable biometric unlock. The device creates a non-exportable key gated by biometrics. The refresh token is stored only wrapped by that key.
3. Return visit: biometric prompt unlocks the wrapped token; the client refreshes. Refresh tokens rotate, and reuse revokes the whole family.

### 3.4 Provider change and consent

1. User selects a provider in Settings. Server checks for an active consent record; if none, the UI shows the provider's data-use terms and waits for acknowledgement.
2. Consent is stored per user and per provider, with the version of the terms that was shown. Revoking consent blocks further calls to that provider immediately.

## 4. Data model (MVP sketch)

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, google_sub (unique), email, created_at, deleted_at | Email is personal data; minimize |
| `meals` | id, user_id, client_id (unique per user), meal_type, eaten_at, name, calories, protein_g, carbs_g, fat_g, photo_id, source, version | Natural idempotency key |
| `photos` | id, user_id, sha256, storage_key, created_at | Deleted on estimate or save as per PRD |
| `consents` | user_id, provider, terms_version, granted_at, revoked_at | Checked by OPA before every AI call |
| `ai_settings` | user_id, provider, api_key_ciphertext | Keys encrypted at rest; BYOK optional |
| `idempotency_keys` | user_id, key, request_hash, status, body, created_at | Pruned after 24 h |
| `refresh_tokens` | id, user_id, family_id, token_hash, expires_at, used_at | Hash only; reuse detection |

## 5. Non-functional design

- **Latency:** API p95 under 300 ms excluding AI. AI calls have a timeout (proposed 8 s) and a per-user concurrency cap.
- **Failure:** AI outage shows a clear error and manual entry. Database outage fails writes with `503` and keeps the offline queue intact.
- **Scale target:** about 1,000 monthly users on one VPS (ADR-002). Scale-out path: more API containers behind Caddy, managed PostgreSQL.
- **Security:** deny by default; TLS everywhere; secrets from environment, not source; no photos or meal text in logs.
- **Privacy:** data minimization, per-provider consent, account deletion removes meals, photos, keys, and sessions.

## 6. Deployment

- One Docker Compose stack: Caddy, API, PostgreSQL, OTel Collector.
- Nightly encrypted `pg_dump` to S3-compatible storage (ADR-002). Restore test is a release gate.
- Migrations run as a separate step before the new API version starts.

## 7. Open design questions

- Whether OPA runs as a sidecar or as an in-process policy library. Trade-off in ADR-006.
- Exact estimate schema fields (see `progress.md`, open decision 2).
- Whether photos are stored after save. PRD proposes no long-term storage.
