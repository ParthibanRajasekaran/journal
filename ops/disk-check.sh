#!/usr/bin/env bash
# Hourly disk check. Sends a push notification when the root disk passes 80% full.
# The ntfy topic is a private, unguessable name kept in the server's .env file.
set -euo pipefail

cd "$HOME/journal/docker"
set -a
. ./.env
set +a

used=$(df --output=pcent / | tail -1 | tr -dc '0-9')
if (( used >= 80 )); then
  curl -fsS -m 15 -H "Title: Journal server disk ${used}% full" -H "Priority: high" \
    -d "The server disk is ${used}% full. Free space or resize before the API stops." \
    "https://ntfy.sh/${NTFY_TOPIC}" >/dev/null
  echo "$(date -u +%FT%TZ) alert sent: ${used}%"
fi
