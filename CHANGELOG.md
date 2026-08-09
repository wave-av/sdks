# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Fixed

- **Codegen crashed on any OpenAPI 3.1 nullable union** (`codegen/parse_spec.py`).
  `type: [string, null]` — 3.1's spelling of a nullable field — was passed through to the
  renderers as a Python list, and every renderer keys its type map on that value, so the run died
  with `TypeError: cannot use 'list' as a dict key`. Reproduced against the current
  `wave-av/api-spec` `main` spec, whose `Attestation.sig` / `WaveAttestation.sig` use that form:
  the harness could not generate any SDK from the live contract. `_scalar_type` now collapses the
  union to its concrete member (optionality is already carried by the field's `required` flag).
  The IR for the vendored `codegen/openapi.yaml` is byte-identical before and after, so no
  generated SDK changes.
