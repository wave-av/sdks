# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- **`'dash0'` dropped from the exported `ConsoleSourceResult['source']` union** (`@wave-av/console`).
  Dash0 is retired from the WAVE stack, so the published type no longer advertises it as a valid
  console source. This narrows the public typed surface: consumers switching on `result.source`
  with a `'dash0'` arm or assigning the literal will now fail to typecheck. Type-level only, no
  runtime change. The `@wave-av/adk` `AgentLogger` doc comment and the console module header were
  updated to match (Sentry + OTLP ingest).

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
