#!/usr/bin/env bash
# Nightly encrypted database backup to Cloudflare R2. Keeps 14 days of backups.
# Runs on the server. Secrets come from the server's private .env file.
set -euo pipefail

cd "$HOME/journal/docker"
set -a
. ./.env
set +a

AWS="$HOME/awsenv/bin/aws"
r2() {
  AWS_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY" \
  AWS_DEFAULT_REGION=auto \
  "$AWS" --endpoint-url "$BACKUP_R2_ENDPOINT" "$@"
}

stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="journal-${stamp}.sql.gz.enc"
tmp="/tmp/${file}"

# Dump, compress, encrypt. The plaintext never touches disk.
sudo docker compose exec -T db pg_dump -U journal -d journal --no-owner \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_ENCRYPTION_KEY -out "$tmp"

r2 s3 cp "$tmp" "s3://${BACKUP_R2_BUCKET}/db/${file}" --only-show-errors
rm -f "$tmp"

# Delete backups older than 14 days.
cutoff=$(date -u -d "14 days ago" +%Y%m%d)
r2 s3 ls "s3://${BACKUP_R2_BUCKET}/db/" | awk '{print $4}' | while read -r key; do
  day=$(echo "$key" | sed -nE 's/^journal-([0-9]{8})T.*/\1/p')
  if [[ -n "$day" && "$day" < "$cutoff" ]]; then
    r2 s3 rm "s3://${BACKUP_R2_BUCKET}/db/${key}" --only-show-errors
  fi
done

echo "backup ok: ${file}"
