# WAVE polyglot SDK codegen

Generates the **Go / Rust / Ruby** SDKs from the WAVE gateway OpenAPI contract. These three
languages have no hand-written source (unlike the carved TypeScript and Python SDKs), so they are
generated and are the **most contract-accurate clients in the fleet**.

## Run

```bash
python3 codegen/generate.py                 # all three
python3 codegen/generate.py --lang go       # one language
python3 codegen/generate.py --lang go,rust  # a subset
```

Requires Python 3.10+ and `pyyaml` (`pip install pyyaml`). Deterministic: no timestamps, no network
— re-running on an unchanged spec produces no diff. Output overwrites `sdk-go/`, `sdk-rust/`,
`sdk-ruby/` in place.

## How it works

```
codegen/openapi.yaml      vendored gateway contract (source of truth)
  └─ parse_spec.py        → neutral IR (products, operations, schemas)
       ├─ render_go.py     → sdk-go/    (module github.com/wave-av/sdks/sdk-go)
       ├─ render_rust.py   → sdk-rust/  (workspace: wave-core + wave)
       └─ render_ruby.py   → sdk-ruby/  (gem wave-sdk)
  render_common.py         shared naming + the core-owned schema skip-list
```

The IR derives method names from `operationId` with the product noun stripped (`createCaptionJob`
→ `captions.createJob`); the full `operationId` is kept in each method's doc comment for
traceability. See `docs/CARVE-METHODOLOGY.md` §11 for the full faithfulness rules (error envelope,
pagination, retry policy, model coverage).

## Refresh the spec

The vendored `openapi.yaml` is a copy of WSC `packages/api-spec/openapi.yaml`. When the contract
changes:

```bash
# from a WSC checkout:
git -C <wsc> show origin/main:packages/api-spec/openapi.yaml > codegen/openapi.yaml
python3 codegen/generate.py
# then run the per-language gates: go test ./... ; cargo test --all ; ruby -Ilib test/smoke_test.rb
```

## Why not openapi-generator?

It produces flat, monolithic clients and requires a Java runtime. This harness produces the fleet's
layered **core ← product ← umbrella** shape, hand-writes the core to match the gateway's *real*
behavior (which the component schemas document incompletely), and has zero non-Python dependencies.
