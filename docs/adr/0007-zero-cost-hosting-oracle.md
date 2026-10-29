# ADR-007: Zero-cost hosting on Oracle Always Free

Status: Accepted by owner (2026-10-29). Supersedes the hosting decision in ADR-002. ADR-002's Docker Compose stack, Caddy, and backup approach still apply.

## Context

The owner requires the whole build to cost nothing. ADR-002 chose a paid VPS (about EUR 6–10 a month). Managed free tiers fail on data persistence (Render's free disk is wiped on restart, Supabase pauses after a week of inactivity), and AWS, Azure, and Google Cloud bill per request, so a flood of attack traffic can create a large bill. Their budget alerts send email but do not stop spending.

## Decision

Host on one Oracle Cloud Always Free Ampere A1 instance in an EU region, running the ADR-002 Compose stack (Caddy, FastAPI, PostgreSQL).

- **Sizing:** one VM.Standard.A1.Flex instance at 2 OCPU and 12 GB RAM. Oracle's documentation gives each account 1,500 OCPU-hours and 9,000 GB-hours a month. Always-on, 2 OCPU × 730 h = 1,460 OCPU-h and 12 GB × 730 h = 8,760 GB-h, both inside the limit. Do not create a second A1 instance. Verify the figures in the console before use, because the sources disagreed before the official page was checked.
- **No paid upgrade:** the account stays on Always Free. Do not add a paid upgrade or other paid services.
- **Backups:** nightly encrypted `pg_dump`, stored off the VM. Destination to be chosen from free options (for example Cloudflare R2's free tier, verified before use).
- **Cost guard:** because the instance size is fixed and no per-request services are used, the monthly cost cannot grow with traffic.

## Throttling against abuse (required)

1. **Edge:** Cloudflare on the free plan in front of the server, which hides the origin address and absorbs floods. Free-plan rate rules are limited, so the app layers below are still required.
2. **Caddy:** per-IP request limits. Stock Caddy has no rate-limit directive, so this needs a plugin, and the plugin must be pinned.
3. **Application:** per-user daily limit on AI estimates, and a global daily cap on AI calls (ADR-006 policy).
4. **AI keys:** the Google key lives in a project with no billing account, so calls stop at the free quota instead of billing.

## Alternatives considered

- **AWS, Azure, Google Cloud free tiers:** rejected. They bill per use, have no reliable hard spending cap (Azure's trial cap only applies during its trial period), and Google Cloud Run requires a billing account.
- **Render, Supabase, Neon free tiers:** rejected for the data path. Persistence, pausing, and expiry rules make them unsuitable for health data.
- **Owner's Mac behind Cloudflare Tunnel:** zero cost, kept as the fallback. It only runs while the Mac is on, and it exposes the home network more than a dedicated server.
- **Paid VPS (ADR-002 default):** rejected for this phase because it is not free. Revisit after release.

## Consequences

- Oracle may reclaim idle or unused instances, and capacity may be unavailable in some regions. Keep a tested restore so a rebuild is quick.
- The Mac fallback must use the same Compose stack and backups, so switching is configuration, not a rewrite.
- Migration to a paid or larger host after release is an explicit later decision (owner's stated plan).

## Open items

- Confirm the Oracle account, EU region, and instance shape in the console before any deployment.
- Choose the free backup destination and verify its limits.
- Confirm the Cloudflare free-plan rate rules and tunnel terms.
