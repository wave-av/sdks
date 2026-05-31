#!/usr/bin/env bash
# sync-from-monorepo.sh — refresh the carved package SOURCES in this PUBLIC repo from the
# CANONICAL monorepo source.
#
# CANONICAL SOURCE = wave-surfer-connect `origin/main` (NOT the local working tree). The script
# reads bytes via `git show origin/main:` after a fetch, so it is immune to a stale or divergent
# local branch. (A local checkout that was 5,000+ commits behind on a pre-split branch once
# nearly produced a broken carve — reading origin/main removes that whole class of error.)
#
# SAFETY MODEL (this repo is PUBLIC; the monorepo's git history has contained leaked secrets):
#   1. ALLOWLIST-ONLY: core's explicit map + auto-discovered per-product <p>.ts (+<p>-types.ts).
#      Nothing off this derived list can ever be synced — no .env, server, infra, or wrangler.
#   2. FAIL-CLOSED secret scan on the staged payload BEFORE writing — any hit aborts (exit 1),
#      nothing is copied.
#   3. No git history crosses: only file CONTENT is written into this repo's working tree.
#   4. The ONLY transform is the cross-package import rewrite (./client* -> @wave-av/core).
#      The <p>.ts / <p>-types.ts split is preserved 1:1 (sibling ./<p>-types stays relative).
#
# Usage: scripts/sync-from-monorepo.sh /path/to/any-wave-surfer-connect-checkout
set -euo pipefail

MONO="${1:?usage: sync-from-monorepo.sh <wave-surfer-connect checkout path>}"
REF="${SYNC_REF:-origin/main}"
SRCPATH="packages/sdk-typescript/src"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKGROOT="$REPO_ROOT/sdk-typescript/packages"

git -C "$MONO" rev-parse --git-dir >/dev/null 2>&1 || { echo "FAIL: $MONO is not a git checkout"; exit 2; }
echo "fetching $REF from $MONO ..."; git -C "$MONO" fetch origin --quiet
git -C "$MONO" cat-file -e "$REF:$SRCPATH/client.ts" 2>/dev/null || { echo "FAIL: $REF:$SRCPATH not found"; exit 2; }

show()   { git -C "$MONO" show "$REF:$SRCPATH/$1" 2>/dev/null; }
exists() { git -C "$MONO" cat-file -e "$REF:$SRCPATH/$1" 2>/dev/null; }
# BSD-sed safe (no pattern backref). Two POSITION-DEPENDENT transforms:
#   brand()  — old-scope rename, applies to ALL files (incl core):
#              @wave/sdk/<product> -> @wave-av/<product> (subpath FIRST), then @wave/sdk -> @wave-av/sdk
#   xpkg()   — cross-package import ./client* -> @wave-av/core. PRODUCT files ONLY.
#              NEVER apply to core: there ./client-types & ./telemetry are SIBLINGS and must stay
#              relative (rewriting them makes core import itself -> circular alias TS2303).
# Product transform = xpkg | brand ; must equal carve.sh rewrite() for reproducibility.
brand() { sed -E "s#@wave/sdk/([A-Za-z0-9-]+)#@wave-av/\1#g; s#from ['\"]@wave/sdk['\"]#from '@wave-av/core'#g; s#@wave/sdk#@wave-av/sdk#g"; }
xpkg()  { sed -E "s#from ['\"]\./client-types['\"]#from '@wave-av/core'#g; s#from ['\"]\./client['\"]#from '@wave-av/core'#g"; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
declare -a WRITES=()   # "src-in-monorepo|dest-in-repo"

# --- core: explicit map (client.ts is the package entry) ---
core_pairs=( "client.ts|core/src/index.ts" "client-types.ts|core/src/client-types.ts" "telemetry.ts|core/src/telemetry.ts" )
for pair in "${core_pairs[@]}"; do
  s="${pair%%|*}"; d="sdk-typescript/packages/${pair##*|}"
  exists "$s" || { echo "FAIL: canonical core source missing: $REF:$SRCPATH/$s"; exit 2; }
  # core: brand rename ONLY — its ./client-types & ./telemetry imports are siblings, stay relative.
  mkdir -p "$TMP/$(dirname "$d")"; show "$s" | brand > "$TMP/$d"; WRITES+=("$d")
done

# --- per-product: AUTO-DISCOVER from the package dirs (config-free). core+sdk excluded. ---
for dir in "$PKGROOT"/*/; do
  p="$(basename "$dir")"
  [ "$p" = "core" ] || [ "$p" = "sdk" ] && continue
  exists "$p.ts" || { echo "WARN: package '$p' has no canonical $REF source ($p.ts) — skipping"; continue; }
  # product: cross-package import rewrite THEN brand rename (== carve.sh rewrite()).
  d="sdk-typescript/packages/$p/src/$p.ts"; mkdir -p "$TMP/$(dirname "$d")"; show "$p.ts" | xpkg | brand > "$TMP/$d"; WRITES+=("$d")
  if exists "$p-types.ts"; then
    dt="sdk-typescript/packages/$p/src/$p-types.ts"; show "$p-types.ts" | xpkg | brand > "$TMP/$dt"; WRITES+=("$dt")
  fi
done

# --- FAIL-CLOSED secret scan on the staged payload. Any hit aborts — nothing written. ---
SECRET_RE='sk_(live|test)_[A-Za-z0-9]{20}|sbp_[a-f0-9]{40}|github_pat_[A-Za-z0-9_]{40}|npm_[A-Za-z0-9]{30}|-----BEGIN [A-Z ]*PRIVATE KEY|Bearer [A-Za-z0-9._-]{20}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}'
if grep -rIEn "$SECRET_RE" "$TMP" ; then
  echo "FAIL-CLOSED: secret-like content found in the sync payload — ABORTING, nothing copied."; exit 1
fi
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-git --source "$TMP" || { echo "FAIL-CLOSED: gitleaks flagged the payload — ABORTING."; exit 1; }
else
  echo "(gitleaks not installed — relied on the built-in pattern scan)"
fi

# --- passed both gates → write into the repo ---
for d in "${WRITES[@]}"; do
  mkdir -p "$REPO_ROOT/$(dirname "$d")"; cp "$TMP/$d" "$REPO_ROOT/$d"; echo "synced  $d"
done
echo "OK: ${#WRITES[@]} files synced from $REF; allowlist + secret scan passed."
