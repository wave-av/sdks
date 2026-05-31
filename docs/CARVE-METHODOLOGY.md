# How the WAVE SDK fleet is built (methodology of record)

This document is the canonical method for how `wave-av/sdks` is produced, kept in sync, and
published. It exists so the process is reproducible by anyone (human or agent) and so nothing
about it is folklore. If you change the method, change this doc in the same PR.

## 1. Source of truth

- **Canonical source = the private `wave-surfer-connect` monorepo, branch `origin/main`.**
  Never the local working tree. Tooling reads bytes with `git show origin/main:<path>` after a
  `git fetch`, so a stale or divergent local checkout can never feed a bad carve. (This is not
  hypothetical: a checkout 5,000+ commits behind on a pre-split branch once nearly produced a
  broken carve. Reading `origin/main` removes that whole class of error.)
- This repo (`wave-av/sdks`) is **public** and is a *curated, allowlisted mirror* of just the SDK
  client sources. **No monorepo git history ever crosses** — only current file content is written.

## 2. The split is intentional — we preserve it 1:1

The monorepo splits each product into a pair, for file-length/readability reasons:

- `src/<product>.ts` — the client logic (the `<Product>API` class + `create<Product>API` factory).
  It **re-exports** its types from the sibling types file.
- `src/<product>-types.ts` — the type definitions (interfaces, enums, request/response shapes).

A few products (e.g. `podcast`) define everything inline and have **no** `-types.ts`. That is fine.

**We keep the split exactly as-is in the SDK packages.** We do not merge the pair back into one
file. Reasons:

1. **1:1 fidelity** — the sync is a dumb allowlisted copy with no merge logic, so the public
   source can never silently drift from canonical.
2. **Respects the monorepo's own file-length discipline** — merging recreates the 700+ line files
   that were split on purpose.
3. **It's proven** — this is exactly how the `clips` pilot shipped.

## 3. The ONLY transform: import-path rewrites (position-dependent)

When a file moves from the monorepo into a package, two rewrites are applied. They are
**position-dependent** — applying the wrong one to the wrong file breaks the build.

| Rewrite | From | To | Applies to |
| --- | --- | --- | --- |
| **brand** | `@wave/sdk/<product>` | `@wave-av/<product>` | every file (incl. `core`) |
| **brand** | `from '@wave/sdk'` (an **import**) | `from '@wave-av/core'` | every file — the client + shared types live in core, matching the README |
| **brand** | bare `'@wave/sdk'` (a **string label**, e.g. telemetry serviceName) | `'@wave-av/sdk'` (the renamed umbrella) | every file |
| **xpkg** | `from './client'` / `from './client-types'` | `from '@wave-av/core'` | **product packages only** |

> The two `@wave/sdk` brand rules are disambiguated by the `from ` prefix: an *import* resolves to
> `@wave-av/core` (where `WaveClient`/`createClient` and shared types live, consistent with every
> README example); a bare *label* (the OTel service name) resolves to the umbrella `@wave-av/sdk`.
> Order in `sed`: subpath first, then import→core, then remaining label→umbrella.

- The sibling import `from './<product>-types'` **stays relative** — both files land in the same
  package directory.
- **`xpkg` must never touch `core`.** Inside `core`, `./client-types` and `./telemetry` are
  *siblings*; rewriting them to `@wave-av/core` makes core import itself (circular alias, TS2303,
  and esbuild can't resolve). So `core` gets **brand only**.
- The rewrite is implemented with BSD-sed-safe regexes: **no backreference in the pattern** (a
  GNU-only extension that silently no-ops on macOS), and `client-types` is rewritten *before*
  `client` (the latter is a prefix of the former).

`scripts/sync-from-monorepo.sh` (`brand()` + `xpkg()`) and `scripts/carve.sh` (`rewrite()`) MUST
produce identical product sources. The sync is idempotent: re-running it over an already-carved
tree yields a byte-identical working tree.

## 4. Package layout (per product)

```
sdk-typescript/packages/<product>/
  src/
    <product>.ts          # carved, xpkg+brand rewritten
    <product>-types.ts    # carved, xpkg+brand rewritten (omitted if monorepo has none)
    index.ts              # export * from './<product>';  (+ types line if present)
    <product>.test.ts     # smoke: factory binds + class is constructable against a core client
  package.json            # @wave-av/<product>@x.y.z, dep @wave-av/core: workspace:*
  tsconfig.json           # identical across packages
  README.md
```

`package.json` invariants (every package): no `"type": "module"` (so tsup emits `.mjs`=ESM +
`.js`=CJS matching the `exports` map); `"sideEffects": false` (see §6); `provenance: true`;
`repository.url = https://github.com/wave-av/sdks.git` (npm provenance requires it to match the
building repo); `@wave-av/core` pinned as `workspace:*` (pnpm rewrites it to the real version at
publish time).

> **Gotcha — never add `"type": "module"`.** With it, tsup flips to `.js`=ESM / `.cjs`=CJS, which
> breaks the `exports` map that expects `import → .mjs` / `require → .js`. The monorepo's proven
> config has no `"type"` field.

## 5. Build & test

- **Build:** `tsup src/index.ts --format cjs,esm --clean` (bundle) + `tsc --emitDeclarationOnly`
  (types). Output: `dist/{index.js,index.mjs,index.d.ts}`.
- **Test:** `vitest run` — a smoke test per package.
- **Order:** `pnpm -r --filter "@wave-av/*" build` builds in topological order
  (`core` → products → `sdk` umbrella). CI uses **pnpm 9** (pnpm 11 gates the esbuild build
  script; locally use `pnpm exec tsup/tsc/vitest` directly to sidestep that check).

## 6. Granularity — why per-product, and not finer

Per-**product** packages are the right unit. Going finer (e.g. splitting `voice` into
`voice-tts` + `voice-cloning`) buys little in JS/TS because **bundlers tree-shake**: with
`"sideEffects": false` and clean ESM, a consumer importing `{ createVoiceAPI }` already drops the
unused surface at *their* build step. So the lever for "smaller/faster for users" is
`sideEffects: false` + clean ESM (which we have), not more packages.

This differs by language, and the codegen (WS3) maps the **same per-product granularity** onto each
language's idiomatic unit:

| Language | Unit | Splitting payoff | Shape |
| --- | --- | --- | --- |
| **TypeScript** | package | low beyond per-product (tree-shaking does the rest) | per-product packages + umbrella; `sideEffects:false` |
| **Python** | package / extra | low (import-time only loads what you import) | per-product subpackages or extras |
| **Go** | package (dir) | automatic — linker strips unused; per-package compile/cache | **one module**, per-product sub-packages (`.../voice`) — *not* a module per product |
| **Rust** | crate | **highest** — per-crate compilation; smaller units compile faster & in parallel | per-product crates in one cargo workspace + a `wave` umbrella crate |

So the per-product split pays off *most* in Rust (and helps Go binary size/compile), and is mostly
a DX/tree-shaking concern in TS/Python. Either way the public shape stays: **install only the
product you call, entitlement enforced server-side.**

## 7. Safety (public repo)

1. **Allowlist sync** — `core`'s explicit map + auto-discovered per-product `<p>.ts`(+`-types.ts`).
   Nothing off this derived list can be synced (no `.env`, server, infra, wrangler).
2. **Fail-closed secret scan** — the staged payload is scanned (built-in pattern set + gitleaks if
   present) *before* anything is written; any hit aborts the whole sync, nothing is copied.
3. **No history** — only file content crosses; the monorepo's git history never reaches here.
4. **Publish = OIDC trusted publishing + provenance** — no long-lived npm token to leak; the
   attestation proves the tarball was built from this public repo.

## 8. Adding a new product

1. `scripts/carve.sh <product> "<Description>"` — scaffolds the package from `origin/main`.
2. `pnpm install && pnpm -r --filter "@wave-av/*" build && pnpm -r --filter "@wave-av/*" test`.
3. Add `export * as <ns> from "@wave-av/<product>";` to `packages/sdk/src/index.ts` and the
   `workspace:*` dep to `packages/sdk/package.json`.
4. `scripts/sync-from-monorepo.sh <checkout>` now auto-discovers it — no script edit needed.

## 9. Folds — whole-package carves (adk, mcp-server, workflow-sdk)

Three SDK surfaces are **not** single modules under `sdk-typescript/src/`; they are already
standalone packages in the monorepo (`packages/adk`, `packages/mcp-server`,
`packages/workflow-sdk`) with their own `package.json`, multi-entry `exports`, own dependencies,
and (mcp-server) a CLI `bin`. We carve the **whole package tree** via
`git -C <mono> archive origin/main packages/<pkg> | tar -x` and then:

- **Prune** non-publishable / non-source: `.DS_Store`, `.turbo/`, `dist/`, `node_modules/`,
  monorepo-internal hook config (`lefthook.yml`), and **network/e2e tests** (e.g. adk's
  `src/__tests__/e2e/staging-api.test.ts`, which fetches `staging.wave.online` with test secrets).
- **Rebase the package metadata only:** `repository.url → https://github.com/wave-av/sdks.git`,
  `repository.directory → sdk-typescript/packages/<pkg>`, `bugs.url → wave-av/sdks/issues`,
  `publishConfig.provenance → true`. Keep `homepage`, `keywords`, real version, deps.
- **Keep each fold's own build config.** The product-rule "never add `type:module`" does NOT apply
  here: adk + mcp-server are ESM-first and their `exports` use `.js`(ESM)/`.cjs`(CJS), so
  `type:module` is *required* and correct. The invariant is "the `type` field and the `exports`
  file extensions must agree," not "never `type:module`." workflow-sdk has no `type` and uses
  `.mjs`/`.js` like the products → it stays `type`-less.
- **Reparent any `extends`.** adk's tsconfig extended the WSC root (`../../tsconfig.json`), which
  does not exist here → replace with a self-sufficient compilerOptions block (omit the extra-strict
  `noUnusedLocals`/`noUnusedParameters` so existing code still type-checks). Make the d.ts step read
  the tsconfig (`tsc -p tsconfig.json --emitDeclarationOnly`) instead of passing bare files.
- **Folds are tooling, NOT product API namespaces** → they are **not** mounted in the `@wave-av/sdk`
  umbrella. adk = agent framework, mcp-server = CLI binary, workflow-sdk = standalone orchestration
  client (its own `WaveWorkflowClient`, not the core `createClient`). Install them directly.
- **Drop dead code that breaks the build.** mcp-server's `src/sdk-server.ts` (an experimental
  in-process Agent-SDK variant) is not imported, not a tsup entry, not in `exports`, and statically
  imports an uninstalled peer (`@anthropic-ai/claude-agent-sdk`) → dropped from the mirror. Re-add
  with a guarded optional peer if in-process mode is productized. Canonical copy persists in WSC.

## 10. Legacy single-file modules + the gateway-`/v1` normalization

`autopilot`, `console`, `discovery` are real product modules in `sdk-typescript/src/` that the
first 40-product carve missed. They use the **pre-core-client pattern**: a config-based
constructor (`WaveClientConfig`, not a `WaveClient`) doing raw `fetch`, with an **apex base URL
default (`https://wave.online`) and `/api/v1/` paths** — both wrong for the gateway, which enforces
`api.wave.online` + the `/v1/` prefix (task #8). `scripts/carve-legacy-module.sh` carves them and
**normalizes to the gateway convention**: `'https://wave.online' → 'https://api.wave.online'` and
`/api/v1/ → /v1/`. Their smoke tests construct from a config (or `(baseUrl, apiKey)` for
discovery's class-only `WaveDiscoveryClient`), not from `createClient()`.

These ship as **`0.0.1` preview**, NOT `0.1.0`. "Preview" here = *the API is not yet frozen in the
published OpenAPI contract and has no `AVAILABLE_SCOPES` entry, so it is not entitle-able through
the gateway* — even though a real WSC backend exists (console fully; autopilot async-202;
discovery 503-stub). The discriminator for the `0.1.0` real-API tier is an entry in
`packages/api-spec/openapi.yaml` (exactly the 12 tagged products). **Graduating a preview to
`0.1.0`** requires, upstream in WSC: (1) migrate the module to the core-client `/v1` pattern,
(2) add an `AVAILABLE_SCOPES` scope, (3) add the OpenAPI tag/paths — then re-carve at `0.1.0`.

### Documented divergences from canonical (tracked for upstream fix)

The sync is normally a byte-identical copy. These carves intentionally diverge from
`origin/main` and therefore are **excluded from the dumb product sync** — each is tracked as a WSC
follow-up so the source can be fixed and the divergence retired:

| Divergence | Where | Why | Upstream fix |
| --- | --- | --- | --- |
| apex→gateway base + `/api/v1`→`/v1` | autopilot, console, discovery, mcp-server (#59) | gateway enforces `/v1`; apex/`/api/v1` bypasses metering or 404s | migrate WSC source to core-client `/v1` |
| dropped `sdk-server.ts` | mcp-server | dead code, imports uninstalled peer, breaks build | remove from WSC or make it a guarded optional feature |
| skipped 2 adk runtime tests + fixed tool-name assertions | adk `__tests__` | upstream tests are stale vs shipped v1.0.14 (`wave_` tool prefix; self-defeating `agent.start` mock) | fix the tests in WSC `packages/adk` |
| per-package `LICENSE` added | all packages | each `package.json` lists `LICENSE` in `files[]` but only a repo-root `LICENSE` existed → tarballs omitted it | n/a (mirror-correct) |
