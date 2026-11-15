#!/usr/bin/env bash
# Build a debug APK and print its provenance.
#   web/scripts/build-android.sh beta      HTTPS only; JOURNAL_BETA_API_BASE (default https://beta.journal.getrendercheck.com)
#   web/scripts/build-android.sh emulator  plain HTTP to the host loopback (default http://10.0.2.2:8000); never a release
# Needs JDK 21 (Capacitor 8) and the Android SDK; set JAVA_HOME, e.g. /opt/homebrew/opt/openjdk@21 on macOS.
set -euo pipefail

target="${1:-}"
web_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd "$web_dir/.." && pwd)"

case "$target" in
  beta)
    api_base="${JOURNAL_BETA_API_BASE:-https://beta.journal.getrendercheck.com}"
    if [ "${JOURNAL_ANDROID_TEST_CLEARTEXT:-}" != "" ]; then
      echo "refusing: JOURNAL_ANDROID_TEST_CLEARTEXT is only allowed for the emulator target" >&2
      exit 1
    fi
    unset JOURNAL_ANDROID_TEST_CLEARTEXT
    case "$api_base" in
      https://*) ;;
      *) echo "refusing: beta needs an https:// API base, got $api_base" >&2; exit 1 ;;
    esac
    mode=beta
    ;;
  emulator)
    api_base="${JOURNAL_EMULATOR_API_BASE:-http://10.0.2.2:8000}"
    export JOURNAL_ANDROID_TEST_CLEARTEXT=1
    mode=emulator
    ;;
  *)
    echo "usage: build-android.sh <beta|emulator>" >&2
    exit 2
    ;;
esac

source_sha="$(git -C "$repo_dir" rev-parse HEAD)"
if [ -n "$(git -C "$repo_dir" status --porcelain)" ]; then
  source_sha="$source_sha-dirty"
fi

export VITE_API_BASE="$api_base"
export VITE_BUILD_SHA="$source_sha"

cd "$web_dir"
npx vite build --mode "$mode"
npx cap sync android
(cd android && ./gradlew assembleDebug)

apk="$web_dir/android/app/build/outputs/apk/debug/app-debug.apk"
echo
echo "target:     $target"
echo "api base:   $api_base"
echo "source sha: $source_sha"
echo "apk:        $apk"
echo "apk sha256: $(shasum -a 256 "$apk" | cut -d' ' -f1)"
