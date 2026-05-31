#!/usr/bin/env bash
# sync-from-monorepo.sh — refresh the carved package SOURCES in this public repo from a LOCAL
# wave-surfer-connect checkout.
#
# SAFETY MODEL (this repo is PUBLIC; the monorepo's git history has contained leaked secrets):
#   1. ALLOWLIST-ONLY: copies exactly the SDK module sources mapped below — never .env, server
#      code, infra, wrangler, or anything off-list. Off-list files physically cannot be synced.
#   2. FAIL-CLOSED secret scan on the staged payload BEFORE writing into the repo — any hit
#      aborts the whole sync (exit 1), nothing is copied.
#   3. No git history crosses: this writes file CONTENT into the repo's own working tree; the
#      monorepo's history never reaches the public repo.
#
# Usage: scripts/sync-from-monorepo.sh /path/to/wave-surfer-connect
set -euo pipefail

MONO="${1:?usage: sync-from-monorepo.sh <wave-surfer-connect path>}"
SRC="$MONO/packages/sdk-typescript/src"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -d "$SRC" ] || { echo "FAIL: $SRC not found (is that a wave-surfer-connect checkout?)"; exit 2; }

# Allowlist: monorepo source file → destination in this repo. ONLY these are mirrored.
declare -a SYNC_PAIRS=(
  "client.ts|sdk-typescript/packages/core/src/index.ts"
  "client-types.ts|sdk-typescript/packages/core/src/client-types.ts"
  "telemetry.ts|sdk-typescript/packages/core/src/telemetry.ts"
  "clips.ts|sdk-typescript/packages/clips/src/clips.ts"
  "clips-types.ts|sdk-typescript/packages/clips/src/clips-types.ts"
)

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
for pair in "${SYNC_PAIRS[@]}"; do
  s="${pair%%|*}"
  [ -f "$SRC/$s" ] || { echo "FAIL: allowlisted source missing: $SRC/$s"; exit 2; }
  cp "$SRC/$s" "$TMP/$s"
done

# Cross-package import rewrites (mirror what the carve does): ./client + ./client-types → @wave-av/core
for f in clips.ts clips-types.ts; do
  [ -f "$TMP/$f" ] || continue
  sed -i.bak -E "s#from ['\"]\\./client(-types)?['\"]#from '@wave-av/core'#g" "$TMP/$f" && rm -f "$TMP/$f.bak"
done

# FAIL-CLOSED secret scan on the staged payload. Any hit aborts — nothing is written.
SECRET_RE='sk_(live|test)_[A-Za-z0-9]{20}|sbp_[a-f0-9]{40}|github_pat_[A-Za-z0-9_]{40}|npm_[A-Za-z0-9]{30}|-----BEGIN [A-Z ]*PRIVATE KEY|Bearer [A-Za-z0-9._-]{20}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}'
if grep -rIEn "$SECRET_RE" "$TMP" ; then
  echo "FAIL-CLOSED: secret-like content found in the sync payload — ABORTING, nothing copied."
  exit 1
fi
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-git --source "$TMP" || { echo "FAIL-CLOSED: gitleaks flagged the payload — ABORTING."; exit 1; }
else
  echo "(gitleaks not installed — relied on the built-in pattern scan)"
fi

# Passed both gates → write into the carved packages.
for pair in "${SYNC_PAIRS[@]}"; do
  s="${pair%%|*}"; d="${pair##*|}"
  cp "$TMP/$s" "$REPO_ROOT/$d"
  echo "synced  $s  →  $d"
done
echo "OK: allowlist sync complete; secret scan passed."
