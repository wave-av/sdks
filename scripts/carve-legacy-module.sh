#!/usr/bin/env bash
# carve-legacy-module.sh — carve a "legacy" single-file product module (pre-core-client
# pattern: config-based constructor + raw fetch + apex baseUrl + /api/v1 paths) from the
# CANONICAL monorepo source (origin/main) into a gateway-CORRECT @wave-av/<product> package.
#
# Unlike carve.sh, these modules:
#   - take a WaveClientConfig (not a WaveClient) — so the smoke test is written per-module,
#   - default baseUrl to the APEX 'https://wave.online' and call '/api/v1/...' — both WRONG
#     for the gateway. We NORMALIZE here: apex -> api.wave.online, /api/v1/ -> /v1/, so the
#     published surface matches the gateway's /v1 enforced prefix (task #8) and the other 40
#     products. (The monorepo source still carries the legacy shape — tracked as a WSC
#     follow-up to migrate these 3 to the core-client pattern; until then this carve diverges
#     from canonical, exactly like the mcp-server #59 fix.)
#
# These are PREVIEW (0.0.1): real WSC backends exist (console fully, autopilot/discovery
# partially) but there is NO gateway scope for them yet -> not entitle-able through the
# gateway SDK path. Promotion to 0.1.0 needs: WSC source migration + AVAILABLE_SCOPES entry
# + an OpenAPI tag (see CARVE-METHODOLOGY "graduating a preview").
set -euo pipefail

# HOME guarded so `set -u` doesn't abort when it's unset (e.g. minimal CI shells).
MONO="${MONO:-${HOME:-.}/wave-surfer-connect}"
SDKS="${SDKS:-/tmp/sdks}"
SRCPATH="packages/sdk-typescript/src"
PKGROOT="$SDKS/sdk-typescript/packages"

p="$1"; desc="$2"
dir="$PKGROOT/$p"
mkdir -p "$dir/src"

git -C "$MONO" fetch origin --quiet 2>/dev/null || true
show() { git -C "$MONO" show "origin/main:$SRCPATH/$1" 2>/dev/null; }

# --- carve src/<p>.ts with the import rewrite + gateway normalization ---
show "$p.ts" | sed -E "
  s#from ['\"]\./client-types['\"]#from '@wave-av/core'#g
  s#from ['\"]\./client['\"]#from '@wave-av/core'#g
  s#'https://wave\.online'#'https://api.wave.online'#g
  s#/api/v1/#/v1/#g
" > "$dir/src/$p.ts"
[ -s "$dir/src/$p.ts" ] || { echo "FAIL: $p.ts empty from origin/main"; exit 2; }

# guard: the normalization actually happened (no apex baseUrl default / no /api/v1 left)
if grep -qE "'https://wave\.online'|/api/v1/" "$dir/src/$p.ts"; then
  echo "FAIL: $p.ts still has apex baseUrl or /api/v1 after normalization"; exit 3
fi

# --- src/index.ts ---
echo "export * from './$p';" > "$dir/src/index.ts"

# --- package.json (preview 0.0.1; identical invariants to the product template) ---
cat > "$dir/package.json" <<JSON
{
  "name": "@wave-av/$p",
  "version": "0.0.1",
  "description": "$desc",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "files": ["dist/**/*.js", "dist/**/*.mjs", "dist/**/*.d.ts", "README.md", "LICENSE"],
  "sideEffects": false,
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --clean && tsc --emitDeclarationOnly --declaration --outDir dist",
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  },
  "license": "MIT",
  "author": "WAVE Online, LLC <sdk@wave.online>",
  "repository": {
    "type": "git",
    "url": "https://github.com/wave-av/sdks.git",
    "directory": "sdk-typescript/packages/$p"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true,
    "registry": "https://registry.npmjs.org/"
  },
  "engines": { "node": ">=18.0.0" },
  "peerDependencies": { "zod": "^3.22.0" },
  "dependencies": {
    "@wave-av/core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^25.0.3",
    "tsup": "^8.0.0",
    "typescript": "^5.9.3",
    "vitest": "^4.1.4",
    "zod": "3.25.76"
  }
}
JSON

# --- tsconfig.json (identical clone of the proven clips tsconfig) ---
cp "$PKGROOT/clips/tsconfig.json" "$dir/tsconfig.json"

# --- README.md (preview banner — accurate: real backend may exist but not yet GA via gateway) ---
cat > "$dir/README.md" <<MD
# @wave-av/$p

> ⚠️ **Preview (\`0.0.1\`).** The typed client surface is published ahead of general availability. A backend exists but this product is **not yet entitle-able through the WAVE gateway** (no published scope/contract yet), so live calls return \`401\`/\`403\`/\`404\`/\`503\` until it graduates. Want it prioritized? Upvote at https://github.com/wave-av/sdks/issues (see CONTRIBUTING → product requests).

Typed client for **WAVE ${desc%% —*}** through the WAVE gateway. Entitlement is enforced server-side — installing this package does not grant access.

\`\`\`bash
npm i @wave-av/$p      # pulls @wave-av/core automatically
\`\`\`

Install only the products you use. Part of [\`wave-av/sdks\`](https://github.com/wave-av/sdks). MIT © WAVE Online, LLC.
MD

echo "carved (legacy/preview) @wave-av/$p"
