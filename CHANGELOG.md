# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Removed the retired `dash0` value from `ConsoleSourceResult['source']`** in the TypeScript Console
  module. Dash0 is retired from the WAVE stack; the union now reads
  `'argus' | 'sentry' | 'supabase' | …`. **Breaking** for any consumer switching on the `'dash0'`
  member — it now type-errors, which is the point (no Dash0 console backend exists to query).

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
