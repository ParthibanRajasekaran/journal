# Beta backend: isolated HTTPS stack for the Android build

Status: proposal. Nothing here is activated, and nothing in this file has been run on the Oracle VM. The owner approves
activation and the DNS record (see "Owner actions"). The files are `docker/beta/compose.yaml`,
`docker/beta/Caddyfile.beta-site` and `docker/beta/compose.caddy.yaml`; `backend/tests/test_beta_stack.py` checks that they
parse and keep the isolation below. Parsing is the only thing tested.

## What it is

A second Compose project, `journal-beta`, next to production on the same VM, so the phone can sign in over mobile data
with the Mac switched off. It shares nothing with production except the Caddy container that terminates HTTPS.

| | Production | Beta |
|---|---|---|
| Compose project | `journal` | `journal-beta` |
| Services | `caddy`, `api`, `migrate`, `db`, observability | `api`, `migrate`, `postgres` |
| Database | `journal` in volume `pgdata` | `journal_beta` in volume `pgdata_beta` |
| Secrets | `docker/.env` | `docker/beta/.env.beta`, never committed (`.env*` is ignored) |
| Hostname | `journal.getrendercheck.com` | `beta.journal.getrendercheck.com`, API only |
| Network | `internal` | `internal` (its own) plus `beta_edge`, shared with Caddy only |

The beta `api` is reachable from Caddy as `journal-beta-api` on `beta_edge`. The production `api` and `db` are not on that
network, so the two stacks cannot reach each other's database or collide on a service name. The beta stack runs with
`JOURNAL_ENVIRONMENT=production`, so the startup guards apply (secure cookies and a JWT secret are required) and the API
docs are off. Use a Google OAuth web client and a JWT secret that production does not use.

## Deploy

Run on the server, as the owner. Nothing here is run by the agent.

1. DNS: add the `beta.journal.getrendercheck.com` record next to the existing one (same origin, proxied by Cloudflare as in
   ADR-007). Owner action.
2. Create `docker/beta/.env.beta`, mode 600, outside git. Set `POSTGRES_PASSWORD`, `JOURNAL_JWT_SECRET` (32+ random
   characters), `JOURNAL_KEY_ENCRYPTION_KEY` (32 random bytes, base64), `JOURNAL_GOOGLE_CLIENT_ID`,
   `JOURNAL_GOOGLE_CLIENT_SECRET`, and the `BACKUP_*` values `ops/backup.sh` reads. Compose also reads
   `POSTGRES_PASSWORD` for the `--env-file` below.
3. Free memory first (see "Memory").
4. Create the shared network once: `docker network create beta_edge`.
5. Start the stack with the source SHA recorded in the image:
   `JOURNAL_SOURCE_SHA=$(git rev-parse HEAD) docker compose -f docker/beta/compose.yaml --env-file docker/beta/.env.beta up -d --build`.
   `migrate` runs `alembic upgrade head` and exits; `api` starts only after it succeeds.
6. Attach Caddy and add the site block. From `docker/`: append `beta/Caddyfile.beta-site` to `Caddyfile`, then
   `docker compose -f compose.yaml -f beta/compose.caddy.yaml up -d caddy` and
   `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`. Recreating Caddy briefly interrupts production
   HTTPS, so do it when that is acceptable.
7. Check: `curl https://beta.journal.getrendercheck.com/api/v1/health` returns `{"status":"ok"}`, and
   `curl https://beta.journal.getrendercheck.com/api/v1/version` returns the `source_sha` you just built and the newest
   `migration_head`. Record that output in `docs/release/android.md` (provenance table).

## Rollback

Migrations are additive, so the previous image runs against the migrated database. Do not run `alembic downgrade`.

- Bad code, healthy data: check out the previous commit, rebuild with its SHA (same command as step 5). `/version` must
  show that SHA afterwards.
- Bad data or a bad migration: restore from backup rather than downgrade (below), then start the previous image.

## Backup and restore

`ops/backup.sh` takes its target from environment variables; with none set it backs up production exactly as before. For
beta:

```
BACKUP_COMPOSE_DIR=$HOME/journal/docker/beta BACKUP_ENV_FILE=.env.beta BACKUP_DB_SERVICE=postgres \
BACKUP_DB_USER=journal_beta BACKUP_DB_NAME=journal_beta BACKUP_PREFIX=journal-beta ops/backup.sh
```

Files are named `journal-beta-<UTC stamp>.sql.gz.enc` under `db-journal-beta/` in the bucket, so beta retention never
touches production backups. Add it to the user crontab at a different minute from the production job.

Restore test (not yet performed; the M5 exit evidence is the first real run): download one file, decrypt with
`openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_ENCRYPTION_KEY`, gunzip, and load it into a scratch
database, never over the live one:
`docker compose -f docker/beta/compose.yaml exec -T postgres createdb -U journal_beta restore_check`, then pipe the SQL
into `psql -U journal_beta -d restore_check`. Check that `users` and `meals` row counts match the source, then drop
`restore_check`. Record the date, file name and counts here.

## Memory

The VM is one Always Free Ampere A1 with 12 GB (ADR-007). The production stack also runs the observability set
(Prometheus, Grafana, Loki, Jaeger, Alertmanager, the OTel collector and the alert bridge). I have not measured either stack
on the VM. Before starting beta, run `free -h` and `docker stats --no-stream`. If memory is tight, stop the observability
services for the duration of the beta, using whichever compose file starts them on the server (the repository's
`docker/compose.yaml` does not define them, so the service names are not checked here), and note the date here. Stopping them removes dashboards and alerts for production while stopped; do not
leave it that way after the beta window.

## Owner actions

- Approve activation on the Oracle VM and add the `beta.` DNS record.
- Create the beta Google OAuth client values and secrets in `.env.beta` (`docs/release/google-oauth.md`).
- Decide whether stopping the observability stack is acceptable while beta runs.
