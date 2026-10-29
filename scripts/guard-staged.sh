#!/usr/bin/env bash
# Blocks staged files that should never be committed: archives, env files, and anything over 1 MB.
set -euo pipefail

max_bytes=$((1024 * 1024))
status=0

while IFS= read -r -d '' file; do
  case "$file" in
    *.tar|*.tar.gz|*.tgz|*.zip|*.key|*.p12|*.pem)
      echo "blocked: $file is an archive or key file" >&2; status=1 ;;
    .env|.env.*|*/.env|*/.env.*)
      [[ "$file" == *.example ]] || { echo "blocked: $file looks like a secrets file" >&2; status=1; } ;;
  esac
  if [[ -f "$file" ]]; then
    size=$(wc -c < "$file")
    if (( size > max_bytes )); then
      echo "blocked: $file is $size bytes (limit $max_bytes)" >&2; status=1
    fi
  fi
done < <(git diff --cached --name-only --diff-filter=ACM -z)

exit $status
