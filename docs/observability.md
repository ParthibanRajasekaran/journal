# Observability plan (OpenTelemetry)

Status: Draft · Date: 2026-10-29 · Related: ADR-001, ADR-002, ADR-006, `docs/design.md`

The aim is to see what the system is doing without ever writing user meal data, photos, or credentials into telemetry. Privacy rules come before convenience.

## 1. Principles

1. **OpenTelemetry everywhere.** Use the OTel SDK for traces, metrics, and logs. Export with OTLP to an OpenTelemetry Collector. Changing the backend later means changing Collector config, not application code.
2. **Redact at the source.** Never add these to spans, metrics, or logs: photo bytes or hashes, meal names or text, eaten-at times tied to a user, email, Google `sub`, tokens, API keys, or request bodies on `/auth`, `/estimates`, `/meals`, `/photos`.
3. **Pseudonymous identifiers only.** Use an internal `user.id` (random) as the only user attribute. Hash it with a server-side salt before export if it must appear in logs.
4. **Sampling keeps costs down.** Head-sample 10% of normal traces; keep 100% of error traces and of AI calls (they cost money).
5. **Alert on symptoms, not noise.** Each alert must link to a runbook entry and have an owner.

## 2. Signals

### Traces

- One span per inbound HTTP request (server span), with child spans for the database, the object store, the OPA check, and the AI provider call.
- Propagate W3C `traceparent` from the client if the client sends it. Clients do not need to send it in MVP.
- Span names use the route template (`POST /api/v1/meals`), never the raw URL (raw URLs contain IDs and dates).

### Metrics

| Metric | Type | Labels (low cardinality only) | Purpose |
|---|---|---|---|
| `http.server.request.duration` | histogram | method, route, status_class | API latency; p95 target under 300 ms |
| `journal.estimate.duration` | histogram | provider, outcome | AI latency; p95 target 8 s |
| `journal.estimate.outcome` | counter | provider, outcome (`ok`, `invalid`, `refused`, `error`, `timeout`) | Provider health; drift signal |
| `journal.policy.decision` | counter | policy, decision (`allow`, `deny`) | Guardrail activity (ADR-006) |
| `journal.idempotency.replay` | counter | outcome (`replayed`, `conflict`, `in_flight`) | Sync health |
| `journal.sync.items` | counter | outcome | Offline queue health |
| `journal.rate_limit.hit` | counter | scope (`user`, `ip`, `estimates`) | Abuse signal |
| `db.client.operation.duration` | histogram | operation | Database health |

Do not label metrics with user ID, meal ID, date, or free text. That creates unbounded cardinality.

### Logs

- Structured JSON, one event per line, with `trace_id` and `span_id`.
- Levels: `INFO` for requests and decisions; `WARN` for rejected estimates and rate limits; `ERROR` for unexpected failures with exception type only, not message bodies that may contain user input.
- A redaction filter runs before export and drops any field named `text`, `name`, `photo*`, `token*`, `key*`, `email`, `password`, `authorization`.

## 3. Collector pipeline

```
App (OTel SDK, OTLP gRPC/HTTP)
   → OTel Collector
        processors: memory_limiter → attributes (redact) → batch → tail_sampling
        exporters:  traces, metrics, logs → chosen backend
```

- `memory_limiter` protects the 1-vCPU VPS from overload (ADR-002).
- The `attributes` processor deletes known-sensitive keys even if application code is wrong. This is a second line of defence.
- Collector listens only on the internal Docker network. It is not exposed through Caddy.

## 4. Backend choice (to confirm in tooling assessment)

Options, all open source:

| Option | Fit | Cost on one VPS | Notes |
|---|---|---|---|
| Jaeger (traces) + Prometheus (metrics) + Loki (logs) | Mature, separate parts | Moderate RAM | Several components to run |
| SigNoz (single platform on ClickHouse) | One UI for all three signals | Higher RAM, ClickHouse | Verify licence of the parts you use |
| Grafana stack (Tempo, Prometheus, Loki) | Strong dashboards | Moderate RAM | Check AGPL obligations before hosting |
| No self-hosted backend in MVP; hosted OTLP endpoint | Least ops | Usage-priced | Conflicts with data-residency aim unless EU-hosted |

Recommendation: start with the Collector writing to Prometheus and Loki (both mature, lighter to run), and add traces via Jaeger when needed. Decide after the tooling assessment confirms licences and RAM use on the chosen VPS.

## 5. What we alert on (MVP)

| Alert | Condition | Owner action |
|---|---|---|
| API down | `/health` fails 3 times in 2 minutes | Restart container; check DB |
| Estimate failures | Outcome `error` or `timeout` above 10% for 15 min, per provider | Switch provider in settings or check provider status |
| Estimate drift | Nightly eval score below threshold (ADR-005) | Pause that adapter; investigate |
| Policy denials spike | `deny` rate jumps 5× baseline | Check for abuse or a broken client |
| Backup failed | Nightly backup job did not finish | Run manual backup; check storage |
| Disk | Above 80% | Prune photos and logs |

## 6. Testing the telemetry

- A unit test asserts that a meal creation request produces no span attribute containing the meal name or photo ID.
- A test asserts that log lines for a rejected estimate contain the reason code and no user text.
- Load test before release checks that the Collector does not drop data under the expected peak.

## 7. Open questions

- Which backend (section 4).
- Retention: proposed 14 days for traces, 30 days for logs, 90 days for aggregated metrics.
- Whether to add client-side telemetry (crash reporting) in MVP. Proposed: crash reports only, no analytics, with consent.
