# ADR-002: Hosting, deployment, and cost

**Status:** Proposed (2026-10-29). Resolves PRD open question 2.

## Context

The backend is FastAPI with PostgreSQL in a container. The web client is a static build. Mobile apps are built separately and distributed through app stores. Constraints: no hard dependency on one cloud vendor, containerized backend, open-source core, small team, and low cost at low traffic.

Working assumptions for the estimate: about 1,000 MAU, roughly 100k API requests per month, a database under 1 GB (photos are deleted after estimation unless saved), and about 5 GB of egress. AI calls are billed to the provider (Gemini free tier by default, or the user's own key), not to hosting.

## Decision

**Default: one EU VPS running Docker Compose with Caddy, FastAPI, and PostgreSQL containers.**

- Caddy terminates TLS (automatic certificates), serves the static web build, and reverse-proxies `/api` to FastAPI.
- PostgreSQL runs on a private Docker network with a named volume.
- Nightly encrypted `pg_dump` is copied to an S3-compatible bucket outside the server. A restore is tested monthly.
- CI builds the backend image and pushes it to a container registry. Deploy is `docker compose pull && docker compose up -d` over SSH. Rollback is the previous image tag.
- The Compose file and Caddyfile are the whole deployment definition, so the stack runs on any Docker host.

**Fallback: Fly.io app plus Neon Postgres in Frankfurt.** Use this if the team does not want to patch and back up a server, or if the VPS provider cannot supply capacity. The container image is unchanged; only the deploy target and database connection string change.

### Deployment diagram

```
 Web browser (static build)        Phone apps (store builds, Capacitor)
          | HTTPS                             | HTTPS
          v                                   v
 +----------------- EU VPS (Docker Compose) ------------------+
 |  Caddy :443  (auto TLS, rate limits at edge)               |
 |    /      -> static web build (volume)                     |
 |    /api/* -> FastAPI container (uvicorn)                   |
 |  PostgreSQL container (private network, named volume)      |
 |  nightly pg_dump (encrypted) --------------------------->  S3-compatible bucket
 +------------------------------------------------------------+
          | outbound HTTPS only
          v
 Google OAuth/OIDC    Gemini / OpenAI / Anthropic APIs
```

## Alternatives considered

| Option | Monthly cost at ~1k MAU (est.) | Ops burden | Data residency | Exit path |
|---|---|---|---|---|
| **VPS + Compose + Caddy (default)** | About EUR 6-10 | Medium: OS patches, backups, monitoring | Choose EU location | Excellent: any Docker host |
| **Fly.io app + Neon Frankfurt (fallback)** | About $9-14 | Low | Neon Frankfurt (EU) | Good: standard container, standard Postgres |
| Render (web + Postgres) | About $13-15 (unverified) | Low | Region set at creation | Good |
| Railway | About $5-10 (usage-based) | Low | Limited EU choice | Good |
| Cloud Run + Neon | About $6-13 | Low | Region set per service | Good, but Google-specific runtime config |
| Supabase Pro | About $25 | Low, but bundles auth and storage we do not need | Specific EU regions available | Moderate: Postgres is portable, the rest is not |

Free tiers do not fit production: Render's free Postgres expires, Supabase's free projects pause after a week idle, and Fly.io has only a trial.

## Consequences

- Lowest fixed cost and full control of data location. Backups and restore tests are our responsibility.
- The fallback needs config changes only. Keep the database URL and bucket credentials as environment settings.
- A single VPS is a single point of failure. Acceptable for MVP; add a standby only when usage justifies it.

## Cost estimate (about 1k MAU, monthly, USD unless noted)

- Default: EUR 6-10 server, plus about $1 for backup storage. Total about $8-12.
- Fallback: $3.69 (shared-cpu-1x 512 MB) plus optional $2 for a dedicated IPv4, plus Neon Launch usage (estimated $5-10). Total about $9-14.
- Budget guard: set a spend alert at $20 per month on all providers.

## Open risks

1. **Hetzner availability.** The cost-optimized page lists CX23 (EUR 5.99) but marks every plan "currently unavailable." Confirm stock before committing, or use another EU VPS.
2. **Backup restore is untested until it is run.** Make the monthly restore test a standing task.
3. **Neon free-plan inactivity deletion.** A Neon page notes that free-plan projects inactive for 90 days may be deleted. Do not hold production data on the free plan.
4. **Cloud Run figures are partly unverified.** The official page did not load in full. Keep Cloud Run out of the default and fallback.
5. **Render prices are unverified.** The official page did not list prices in the fetched text.
6. **Estimates assume low traffic.** Re-check at 10k MAU.

## Sources (read 2026-10-29)

- Fly.io pricing: https://docs.fly.io/about/pricing (fetched; redirected from fly.io/docs/about/pricing)
- Railway plans: https://docs.railway.com/pricing/plans (fetched)
- Neon pricing: https://neon.com/pricing (fetched)
- Neon regions: https://neon.com/docs/introduction/regions (fetched)
- Supabase pricing: https://supabase.com/pricing (fetched)
- Supabase regions: https://supabase.com/docs/guides/platform/regions (fetched)
- Hetzner cost-optimized: https://www.hetzner.com/cloud/cost-optimized/ (fetched; plan list reflects unavailable status)
- Caddy releases: https://github.com/caddyserver/caddy/releases (fetched; latest v2.11.7, 2026-10-03)
- Render pricing: https://render.com/pricing (fetched, prices absent; search snippets only)
- Cloud Run pricing: https://cloud.google.com/run/pricing (fetched, truncated; figures from search snippets, not verified)
- Third-party 2026 pricing articles, search snippets only (2026-10-29): Fly.io, Render, Cloud Run, Hetzner
