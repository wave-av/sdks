# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **SBOM-presence GA check (SUPPLY-001, cw#4803)**: this repo publishes no GitHub Release of its
  own (`gh release list` is empty; every `publish-*.yml` job ships straight to a package
  registry), so instead of an in-workflow `sbom` job (not applicable here) it now extends the GA
  evidence tooling — `scripts/ga/sbom-presence.mjs`, wired into `registry-cleanroom.mjs` via a new
  `sbom-presence` check on the `npm-sdk`, `npm-cli`, `npm-mcp-server`, `npm-adk`, and
  `pypi-wave-sdk` targets. For each published package it reads the repository the package's OWN
  metadata declares and checks that repository's latest GitHub Release for a `*.spdx.json` /
  `*.cdx.json` asset — PASS/FAIL is recorded per package, never fabricated (see `GA-READINESS.md`,
  SUPPLY-001: every package fails today, the honest state before any sibling repo has shipped an
  SBOM-producing release workflow). Unit tests: `scripts/ga/__tests__/sbom-presence.test.mjs`.

### Changed

- **BREAKING for Go SDK consumers: the minimum Go version is now 1.25** (`sdk-go/go.mod`,
  raised from `1.24.0`). Go 1.24 reached end-of-life on 2026-02-10; the supported releases are
  1.25 and 1.26. The `go` directive is the minimum Go this published module demands of everyone
  who installs it, so an EOL floor here is advertised to every consumer of
  `github.com/wave-av/sdks/sdk-go`.

  **If you build with an older or pinned toolchain, or with `GOTOOLCHAIN=off`, this is a hard
  build failure** — upgrade to Go 1.25 or later. With the default `GOTOOLCHAIN=auto`, Go fetches
  a suitable toolchain for you and no action is needed.

  **1.25 rather than 1.26 deliberately**: it is the oldest release still receiving security
  fixes, keeping the supported consumer window as wide as possible while no longer pointing at
  an end-of-life toolchain. Nothing downstream needs more — after the bump the highest `go`
  requirement in the whole module graph is this module itself. No source changed.

  Note this is a *separate* exposure from the CI toolchain pin: `setup-go` installed 1.22.12 and
  the toolchain then switched itself **up** to 1.24.0 off this directive, so the workflow pin was
  never the operative version. A floor that ships inside `go.mod` cannot be fixed by a workflow
  change.

  **The bump is applied in the GENERATOR, not only in the emitted file.** `sdk-go/go.mod` is
  codegen output: `codegen/render_go.py` writes the `go` directive on every render, and it
  hardcoded `1.24.0`. Changing the emitted `go.mod` alone would therefore have been **silently
  reverted by the next `codegen/generate.py` run** — the floor would have looked fixed in the
  tree and regressed the moment anyone regenerated. The version now lives in a single named
  constant, `GO_VERSION` in `codegen/render_go.py`, so the generator and its artifact cannot
  drift apart again. Verified by running the real generator: the regenerated `sdk-go/go.mod` is
  byte-identical to the committed one.

### Removed

- **`'dash0'` dropped from the exported `ConsoleSourceResult['source']` union** (`@wave-av/console`).
  Dash0 is retired from the WAVE stack, so the published type no longer advertises it as a valid
  console source. This narrows the public typed surface: consumers switching on `result.source`
  with a `'dash0'` arm or assigning the literal will now fail to typecheck. Type-level only, no
  runtime change. The `@wave-av/adk` `AgentLogger` doc comment and the console module header were
  updated to match (Sentry + OTLP ingest).

### Fixed

- **The registry clean-room gate ignored PyPI yank state (PEP 592), so it could PASS a package a
  real user cannot install** (`scripts/ga/cleanroom-targets.mjs`, `scripts/ga/cleanroom-util.mjs`,
  `scripts/ga/cleanroom-targets.json`). `runPypiTarget` resolved a version from `info.version`,
  picked a wheel/sdist URL out of `meta.urls`, downloaded it directly, and ran
  `pip install <local-file>` — a path that never asks pip's index resolver anything, so PyPI's
  yank flag never had a chance to bite. Workflow run 34208693233 (2026-09-08) installed the
  YANKED `wave-av-sdk` 3.0.0 this way and reported ART-001/SUPPLY-001/VER-001 PASS, while a real
  `pip install wave-av-sdk` fails ("Ignored the following yanked versions: 2.0.0, 3.0.0 ... No
  matching distribution found"). The gate now installs by `pip install "<name>==<version>"` from
  the public index — the same command a user runs — and additionally reads
  `https://pypi.org/pypi/<name>/<version>/json` to fail loud (with the yank reason) when the
  resolved release is yanked, or when an unpinned "latest" resolves to something other than the
  index's highest NON-yanked release (PyPI keeps `info.version` pointed at a release even after
  every file under it is yanked). The `pypi-wave-av-sdk` target — `wave-av-sdk` is the
  deliberately retired legacy package, canonical is `wave-sdk` (current 2.2.0), decision
  IGV-D-024 (2026-09-07) — is inverted into a negative control asserting the package stays fully
  yanked and that `pip install wave-av-sdk` keeps failing, so a future re-publish under that name
  is caught loudly instead of the gate just going quiet. Verified against live PyPI: `wave-sdk`
  2.2.0 installs and imports cleanly; `wave-av-sdk` is correctly refused as yanked.

- **Codegen crashed on any OpenAPI 3.1 nullable union** (`codegen/parse_spec.py`).
  `type: [string, null]` — 3.1's spelling of a nullable field — was passed through to the
  renderers as a Python list, and every renderer keys its type map on that value, so the run died
  with `TypeError: cannot use 'list' as a dict key`. Reproduced against the current
  `wave-av/api-spec` `main` spec, whose `Attestation.sig` / `WaveAttestation.sig` use that form:
  the harness could not generate any SDK from the live contract. `_scalar_type` now collapses the
  union to its concrete member (optionality is already carried by the field's `required` flag).
  The IR for the vendored `codegen/openapi.yaml` is byte-identical before and after, so no
  generated SDK changes.
