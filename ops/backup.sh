#!/usr/bin/env bash
# Nightly encrypted database backup to Cloudflare R2. Keeps 14 days of backups.
# Runs on the server. Secrets come from the stack's private env file.
#
# Defaults back up the production stack. Override per stack with environment variables, for example the beta stack:
#   BACKUP_COMPOSE_DIR=$HOME/journal/docker/beta BACKUP_ENV_FILE=.env.beta BACKUP_DB_SERVICE=postgres \
#   BACKUP_PREFIX=journal-beta ops/backup.sh
set -euo pipefail

compose_dir="${BACKUP_COMPOSE_DIR:-$HOME/journal/docker}"
env_file="${BACKUP_ENV_FILE:-.env}"
db_service="${BACKUP_DB_SERVICE:-db}"
db_user="${BACKUP_DB_USER:-journal}"
db_name="${BACKUP_DB_NAME:-journal}"
# Names the files and the folder in the bucket, so two stacks never see each other's backups.
prefix="${BACKUP_PREFIX:-journal}"

cd "$compose_dir"
set -a
. "./$env_file"
set +a

AWS="$HOME/awsenv/bin/aws"
r2() {
  AWS_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY" \
  AWS_DEFAULT_REGION=auto \
  "$AWS" --endpoint-url "$BACKUP_R2_ENDPOINT" "$@"
}

stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="${prefix}-${stamp}.sql.gz.enc"
tmp="/tmp/${file}"
# The production stack keeps its original folder name; any other stack gets its own.
folder="db"
if [[ "$prefix" != "journal" ]]; then folder="db-${prefix}"; fi

# Dump, compress, encrypt. The plaintext never touches disk.
sudo docker compose exec -T "$db_service" pg_dump -U "$db_user" -d "$db_name" --no-owner \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_ENCRYPTION_KEY -out "$tmp"

r2 s3 cp "$tmp" "s3://${BACKUP_R2_BUCKET}/${folder}/${file}" --only-show-errors
rm -f "$tmp"

# Delete this stack's backups older than 14 days.
cutoff=$(date -u -d "14 days ago" +%Y%m%d)
r2 s3 ls "s3://${BACKUP_R2_BUCKET}/${folder}/" | awk '{print $4}' | while read -r key; do
  day=$(echo "$key" | sed -nE "s/^${prefix}-([0-9]{8})T.*/\1/p")
  if [[ -n "$day" && "$day" < "$cutoff" ]]; then
    r2 s3 rm "s3://${BACKUP_R2_BUCKET}/${folder}/${key}" --only-show-errors
  fi
done

echo "backup ok: ${file}"
