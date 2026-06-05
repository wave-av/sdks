# wave-av/sdks

> **Open-core home of the WAVE client SDKs.** Public, readable source for every WAVE client library — TypeScript today; Python, Go, Rust, and Ruby via codegen. This is **not** an `*-edge` repo (those are edge-compute spokes). It is where the SDKs are *published from*.

## What this is

- **Canonical source of truth is the private `wave-surfer-connect` monorepo.** This repo is a **curated, allowlisted mirror** of just the SDK sources — synced forward, never a push of the monorepo's git history.
- **Published from here** so npm provenance / Sigstore attestations work (they require a *public* source repo). Auth is **OIDC trusted publishing** — there is no long-lived npm/PyPI token to leak.
- **Layered packages** (AWS-SDK-v3 model — one repo, many packages):
  - `@wave-av/core` — gateway client, auth, shared types. The base.
  - `@wave-av/clips`, `@wave-av/<product>`, … — one typed client per product, each depends on `core`.
  - `@wave-av/sdk` — umbrella that re-exports everything (for humans exploring the platform).

## Install what you need

```bash
npm i @wave-av/clips      # just Clips (recommended — smallest footprint)
npm i @wave-av/sdk        # everything (discovery / "give me it all")
```

Agents and short-lived sandboxes can skip the SDK entirely and call the gateway over HTTP, or via the `wave` MCP `gateway_call` tool — zero install, minimal supply-chain surface.

## Licensing & access

**Entitlement is enforced server-side at the gateway, never at install.** A package is honest typed HTTP — installing `@wave-av/clips` does not grant access. An unauthenticated call gets `401`; an under-scoped key gets `403` with the scopes you do have. Per-product package ↔ per-product SKU.

## Safety (public repo)

- No monorepo git history ever crosses (curated snapshot commits only).
- Allowlist sync — only SDK module sources + README/LICENSE; never `.env`, server code, infra, or secrets.
- Fail-closed outbound secret scan before every sync, plus GitHub push-protection + secret-scanning.
- Only the **client surface** is public (the API shape already at `api.wave.online/openapi.json`). The moat — spoke implementations, the gateway, models — stays private.

## Layout

```
sdk-typescript/packages/{core,clips,sdk}/   # the TS fleet (pnpm workspace)
scripts/sync-from-monorepo.sh               # allowlist sync + fail-closed secret scan
scripts/check-registry-parity.py            # declared-vs-published gate (vendored from wave-foundation)
.github/workflows/publish-npm.yml           # OIDC trusted publishing + provenance
.github/workflows/registry-parity.yml       # parity gate
```

## License

Apache-2.0 © WAVE — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
