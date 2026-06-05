#!/usr/bin/env bash
# carve.sh — generate one @wave-av/<product> package in wave-av/sdks from the CANONICAL
# monorepo source (origin/main), faithfully preserving the <p>.ts / <p>-types.ts split.
#
# ONLY transform: cross-package import path  ./client , ./client-types  ->  @wave-av/core
# Sibling import  ./<p>-types  stays relative (both files land in the same package dir).
#
# Source is read via `git show origin/main:` so the stale local working tree is never touched.
set -euo pipefail

MONO="${MONO:-$HOME/wave-surfer-connect}"
SDKS="${SDKS:-/tmp/sdks}"
SRCPATH="packages/sdk-typescript/src"
PKGROOT="$SDKS/sdk-typescript/packages"

git -C "$MONO" fetch origin --quiet 2>/dev/null || true

# show <file>  -> canonical bytes from origin/main, or empty if absent
show() { git -C "$MONO" show "origin/main:$SRCPATH/$1" 2>/dev/null; }
exists() { git -C "$MONO" cat-file -e "origin/main:$SRCPATH/$1" 2>/dev/null; }

# rewrite cross-package imports to @wave-av/core; keep sibling ./<p>-types relative
rewrite() {
  # BSD-sed safe: no backreference in the PATTERN (GNU-only); replacement \1 is fine on BSD.
  # 1) cross-package import path  ./client*  -> @wave-av/core  (client-types FIRST; client is its prefix)
  # 2) stale old-scope JSDoc/labels: @wave/sdk/<product> -> @wave-av/<product> (subpath, FIRST),
  #    then bare @wave/sdk -> @wave-av/sdk (the renamed umbrella). MUST match sync-from-monorepo.sh.
  sed -E "
    s#from ['\"]\./client-types['\"]#from '@wave-av/core'#g
    s#from ['\"]\./client['\"]#from '@wave-av/core'#g
    s#@wave/sdk/([A-Za-z0-9-]+)#@wave-av/\1#g
    s#from ['\"]@wave/sdk['\"]#from '@wave-av/core'#g
    s#@wave/sdk#@wave-av/sdk#g
  "
}

carve_one() {
  local p="$1" desc="$2"
  local dir="$PKGROOT/$p"
  mkdir -p "$dir/src"

  # --- src/<p>.ts (rewrite ./client*; sibling ./<p>-types stays relative) ---
  show "$p.ts" | rewrite > "$dir/src/$p.ts"
  [ -s "$dir/src/$p.ts" ] || { echo "FAIL: $p.ts empty from origin/main"; exit 2; }

  # --- src/<p>-types.ts (optional) ---
  local has_types=0
  if exists "$p-types.ts"; then
    has_types=1
    show "$p-types.ts" | rewrite > "$dir/src/$p-types.ts"
  fi

  # --- discover the API class + factory names from the carved <p>.ts ---
  # Two client conventions exist: class-style (export class FooAPI + createFooAPI) and
  # functional-style (no class, just createFooApi returning an object of methods, e.g. prompter).
  local cls fac ver="${PREVIEW:+0.0.1}"; ver="${ver:-0.1.0}"
  # `|| true` so a non-matching grep (e.g. functional client has no *API class) doesn't abort under set -e
  cls=$(grep -oE "export class [A-Za-z0-9_]+API" "$dir/src/$p.ts" | head -1 | awk '{print $3}' || true)
  fac=$(grep -oE "export function create[A-Za-z0-9_]+[Aa][Pp][Ii]\b" "$dir/src/$p.ts" | head -1 | awk '{print $3}' || true)
  [ -n "$fac" ] || fac=$(grep -oE "export function create[A-Za-z0-9_]+" "$dir/src/$p.ts" | head -1 | awk '{print $3}' || true)
  { [ -n "$cls" ] || [ -n "$fac" ]; } || { echo "FAIL: no API class or create* factory in $p.ts"; exit 2; }

  # --- src/index.ts ---
  {
    echo "export * from './$p';"
    [ "$has_types" = 1 ] && echo "export * from './$p-types';"
  } > "$dir/src/index.ts"

  # --- package.json (clone clips template, swap name/description/directory) ---
  cat > "$dir/package.json" <<JSON
{
  "name": "@wave-av/$p",
  "version": "$ver",
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

  # --- README.md (preview banner when PREVIEW=1) ---
  local banner=""
  [ -n "${PREVIEW:-}" ] && banner="> ⚠️ **Preview.** The typed client surface is published ahead of GA. Calls return \`403\`/\`404\` until the product is live. Want it prioritized? Upvote at https://github.com/wave-av/sdks/issues (see CONTRIBUTING → product requests).

"
  cat > "$dir/README.md" <<MD
# @wave-av/$p

${banner}Typed client for **WAVE ${desc%% —*}** through the WAVE gateway. Entitlement is enforced server-side (401 unauthenticated / 403 under-scoped) — installing this package does not grant access.

\`\`\`bash
npm i @wave-av/$p      # pulls @wave-av/core automatically
\`\`\`

\`\`\`ts
import { createClient } from "@wave-av/core";
import { ${fac:-/* factory */} } from "@wave-av/$p";

const api = ${fac:-/* factory */}(createClient({ apiKey: process.env.WAVE_API_KEY! }));
\`\`\`

Install only the products you use. Part of [\`wave-av/sdks\`](https://github.com/wave-av/sdks). MIT © WAVE Online, LLC.
MD

  # --- src/<p>.test.ts (smoke; 3 cases by client convention) ---
  if [ -n "$cls" ] && [ -n "$fac" ]; then
    cat > "$dir/src/$p.test.ts" <<TST
import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { $cls, $fac } from "./index";

describe("@wave-av/$p", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("$fac returns a $cls bound to the core client", () => {
    expect($fac(client)).toBeInstanceOf($cls);
  });

  it("the API surface is a constructable class", () => {
    expect(new $cls(client)).toBeInstanceOf($cls);
  });
});
TST
  elif [ -n "$cls" ]; then
    cat > "$dir/src/$p.test.ts" <<TST
import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { $cls } from "./index";

describe("@wave-av/$p", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("the API surface is a constructable class bound to the core client", () => {
    expect(new $cls(client)).toBeInstanceOf($cls);
  });
});
TST
  else
    # functional client (no class): factory returns an object exposing method functions
    cat > "$dir/src/$p.test.ts" <<TST
import { describe, it, expect } from "vitest";
import { createClient } from "@wave-av/core";
import { $fac } from "./index";

describe("@wave-av/$p", () => {
  const client = createClient({ apiKey: "wave_test_x", baseUrl: "https://api.wave.online" });

  it("$fac returns a bound client object exposing methods", () => {
    const api = $fac(client);
    expect(api).toBeTruthy();
    expect(typeof api).toBe("object");
    expect(Object.values(api).some((v) => typeof v === "function")).toBe(true);
  });
});
TST
  fi

  echo "carved @wave-av/$p  (class=$cls factory=${fac:-none} types=$([ "$has_types" = 1 ] && echo yes || echo no))"
}

carve_one "$1" "$2"
