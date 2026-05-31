# Contributing to wave-av/sdks

## Product requests & prioritization (preview packages)

Some `@wave-av/*` packages are **preview** (version `0.0.x`, with a banner in their README).
Their typed client surface is published ahead of GA — calls return `403`/`404` until the product
is live. We publish the surface early so you can build against it and tell us what to prioritize.

**Want a preview product promoted to GA?** Open an issue at
https://github.com/wave-av/sdks/issues titled `product-request: <package>` (e.g.
`product-request: @wave-av/marketplace`) and 👍 it. Upvotes are the demand signal we use to
sequence which previews get a live backend first.

`0.0.x` = preview (surface only) · `0.1.0+` = backend live (real responses).

## How the SDKs are built

This repo is a **curated, allowlisted mirror** of the SDK client sources from the private
`wave-surfer-connect` monorepo. Do not hand-edit the carved package sources — they are
regenerated. See **[docs/CARVE-METHODOLOGY.md](docs/CARVE-METHODOLOGY.md)** for the full method
(source of truth, the `<p>.ts`/`<p>-types.ts` split, import rewrites, build/test, granularity).

- Add a product: `scripts/carve.sh <product> "<Description>"` (set `PREVIEW=1` for a preview package).
- Refresh sources from canonical `origin/main`: `scripts/sync-from-monorepo.sh <checkout>`
  (auto-discovers packages, fail-closed secret scan, idempotent).
- Build/test: `pnpm -r --filter "@wave-av/*" build` then `pnpm -r --filter "@wave-av/*" test`.

## Publishing

Publishing is **OIDC trusted publishing + provenance** (no long-lived token). Preview packages
publish under the `preview` npm dist-tag so `npm i @wave-av/<pkg>` (latest) does not resolve to a
preview unless explicitly requested (`@wave-av/<pkg>@preview`).
