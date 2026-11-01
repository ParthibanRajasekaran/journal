# Deployment: documented configuration versus observed state

Status: evidence note. Read-only checks on 2026-11-01. No server setting was changed, and no secret, `.env` value, or
shell history was read. Owner-owned records (ADR-002, ADR-007) are not edited here.

## What the documents say

- **ADR-002** (superseded for hosting, but its deployment method still applies per ADR-007): CI builds the backend
  image, pushes it to a container registry, and deploys with `docker compose pull && docker compose up -d` over SSH.
- **ADR-007**: one Oracle Always Free VM runs the ADR-002 Compose stack (Caddy, FastAPI, PostgreSQL).
- **DNS**: managed on Vercel. The Vercel team checked has no project linked to this repository.

## What was observed on the server

| Check | Result |
|---|---|
| Deployed code location | `~/journal`, which is **not** a git checkout. Nothing runs `git pull`. |
| Image provenance | `journal-api:latest` was built on the server at 2026-10-31 13:50 UTC. It was not pulled from a registry. |
| Running stack | Compose services: api, db, caddy, and the observability set (Prometheus, Grafana, Loki, Jaeger, Alertmanager, OTel collector, alert bridge). |
| Scheduled jobs | User crontab only: `ops/backup.sh` at 03:15 and `ops/disk-check.sh` hourly. No deploy job. |
| systemd | No journal-specific service or timer. The only Docker unit is `docker.service`. |
| Webhook or poller | No listener or poll process found. Listening ports: 22, 80, 443 (Caddy via Docker), 111, 3000 (loopback). |

## What the repository does

- `.github/workflows/ci.yml` on `main` runs tests, lint, format, types, the OPA policy, and the secret scan. It has **no**
  image build, registry push, SSH, or deploy step.
- No `vercel.json`, Render blueprint, or other hosting configuration is checked in.

## Conclusion

- Merging `main` does not trigger deployment, based on the evidence above. The repo has no deploy step, the server has
  no pull or webhook mechanism, and the image was built by hand on the server.
- Production changes only when someone builds or copies code on the VM and runs Compose there.
- The GitHub webhooks, environments, secret names and deploy keys listed as empty by the account used for this check.
  That account may not see every setting, so a GitHub App deploy path cannot be fully ruled out.

## Documentation gaps to resolve (owner)

1. ADR-002 describes a registry-based deploy that is not implemented. Either implement it, or amend ADR-002 to describe
   the manual build-on-server process.
2. `docs/progress.md` previously said the instance was not yet created. Corrected in this change.
3. Keep this note in step with the server by re-running the checks above when the deploy method changes.
