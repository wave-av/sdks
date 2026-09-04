# WAVE GA compliance — wave-av/sdks

> Criterion IDs are global and immutable. `unknown` and a waiver are **not** a pass. A green
> repository is necessary but not sufficient for platform GA.

## Repository declaration

```yaml
repository: wave-av/sdks
revision: 70b2a04a205658a25b3723adec9faf665e204af6
repo_class: sdk
owner: WAVE platform / SDK publishing
last_evaluated_at: 2026-09-04T00:31:56Z
evaluator_version: scripts/ga/registry-cleanroom.mjs
spec_version: 1.0.0
overall_status: fail
```

`overall_status: fail` is the honest reading, and it is an improvement on what came before it:
these criteria were **unknown** until this repository could install what the registries serve and
look. The gate now produces evidence. The evidence says the published artifacts are broken.

## How this repo proves compliance

`scripts/ga/registry-cleanroom.mjs` installs each published artifact from its **public registry**
into a throwaway directory or venv — never from this checkout, never `npm link`, never
`pip install -e` — and asserts it behaves. It emits `ga-out/ga-evidence.json` keyed to criterion
IDs, plus `ga-out/cleanroom-report.json` with per-check detail and artifact digests. The run
output is a CI artifact and is never committed; a committed report would let a stale file
masquerade as current evidence.

The distinction from the sibling `registry parity` workflow matters. Parity asks *"does the
declared version equal the published version"* and never installs anything, so it cannot see a
package whose version number is correct and whose contents are broken. Every artifact regression in
the pre-GA audit was of that second kind.

```bash
# everything the registries currently serve
node scripts/ga/registry-cleanroom.mjs

# a specific release, pinned rather than whatever `latest` points at
node scripts/ga/registry-cleanroom.mjs --versions '@wave-av/cli=1.0.9,wave-sdk=2.1.0'
```

Exit `0` all checks passed · `1` an artifact failed · `2` the gate could not run. Exit 2 is never
to be read as a pass.

Schedule: nightly at 09:00 UTC, after every successful npm publish, on demand, and informationally
on every pull request (`.github/workflows/registry-cleanroom.yml`). Nightly is not decoration — a
published package can break with no commit anywhere, because a published dependency **range** is
resolved on the day a customer installs.

| Criterion | Title | GA must-pass | Repo status | Evidence |
|---|---|---:|---|---|
| ART-001 | Published artifacts install, import, start, identify themselves, and match source | true | **fail** | `ga-out/ga-evidence.json` (evaluator: `scripts/ga/registry-cleanroom.mjs`) |
| SUPPLY-001 | Builds have provenance, signatures, SBOMs, dependency policy, and protected release identity | true | **fail** (partial coverage — see note) | `ga-out/ga-evidence.json` |
| VER-001 | Version and release truth agree from source through deployment | true | **fail** (registry half) | `ga-out/ga-evidence.json` |
| CONTRACT-001 | One promoted contract is the source of truth across spec, gateway, registry, MCP, SDK and CLI | true | unknown | not evaluated by this repo |
| COMPAT-001 | Backward compatibility, versioning, deprecation, and sunset policy are enforced | true | unknown | not evaluated by this repo |
| DX-001 | A new developer can complete one honest golden path from published materials | true | unknown | not evaluated by this repo |
| STATUS-001 | Marketing, registry, preview labels, availability, and status tell the same truth | true | unknown | not evaluated by this repo |

Criteria absent from this table are owned by other repositories and surfaces; this repository makes
no claim about them. Absence here is `unknown` at the platform gate, not `not_applicable`.

## Per-criterion evidence

```yaml
criterion_id: ART-001
status: fail
owner: WAVE platform / SDK publishing
verification_command: node scripts/ga/registry-cleanroom.mjs
verified_revision: 70b2a04a205658a25b3723adec9faf665e204af6
verified_at: 2026-09-04T00:31:56Z
evidence:
  - uri: ci://wave-av/sdks/.github/workflows/registry-cleanroom.yml#cleanroom-report.json
    sha256: 0f03603df2bc33f50958a75c8998777463507c1f9e3ee0fec811d82a3ca1206d
pass_condition_from_spec: >
  All supported runtimes pass from public registries; Python uses a non-stdlib-colliding import;
  source, package metadata, CLI banner, tag and GitHub release agree.
notes: |
  Observed against the live registries on 2026-09-04. Passing:
    @wave-av/sdk@2.1.3        ESM import, CJS require, all 46 declared subpath exports resolve.
    @wave-av/adk@1.0.15       installs and imports.
    @wave-av/mcp-server@0.2.0 starts over stdio, lists 18 tools, serves every tool its shipped
                              README advertises.
  Failing:
    @wave-av/cli@1.0.8        `wave --version` prints 1.0.0. Installs cleanly and `--help` exits 0,
                              so nothing short of running the binary detects this.
    wave-sdk@2.0.0 (PyPI)     `from wave_sdk import Wave` raises ModuleNotFoundError. The wheel's
                              only top-level name is `wave`, which collides with the CPython stdlib
                              module of that name; because the stdlib directory precedes
                              site-packages, `import wave` returns the stdlib WAV reader and the SDK
                              is unreachable by any name. The artifact is unusable as published.
    wave-av-sdk@2.0.0 (PyPI)  identical defect.
```

```yaml
criterion_id: VER-001
status: fail
owner: WAVE platform / SDK publishing
verification_command: node scripts/ga/registry-cleanroom.mjs
verified_revision: 70b2a04a205658a25b3723adec9faf665e204af6
verified_at: 2026-09-04T00:31:56Z
evidence:
  - uri: ci://wave-av/sdks/.github/workflows/registry-cleanroom.yml#cleanroom-report.json
    sha256: 0f03603df2bc33f50958a75c8998777463507c1f9e3ee0fec811d82a3ca1206d
pass_condition_from_spec: >
  Every shipped component resolves to one source revision and version; no newer source is
  represented as deployed; mutable channels are labeled; deployment receipt identifies artifact
  digest.
notes: |
  This repository covers the REGISTRY half of VER-001 — does the artifact agree with itself about
  which build it is. Two published artifacts do not:
    @wave-av/cli@1.0.8        binary self-reports 1.0.0
    @wave-av/mcp-server@0.2.0 serverInfo.version reports 0.1.0
  In both cases the package metadata is correct and the code inside it disagrees, so a version
  comparison against the registry cannot see the defect — only running the artifact can.
  Tag/GitHub-release/deployed-endpoint agreement is NOT covered here and remains unknown; it belongs
  to the release-ledger check named in the spec's runnable_command.
```

```yaml
criterion_id: SUPPLY-001
status: fail
owner: WAVE platform / SDK publishing
verification_command: node scripts/ga/registry-cleanroom.mjs
verified_revision: 70b2a04a205658a25b3723adec9faf665e204af6
verified_at: 2026-09-04T00:31:56Z
evidence:
  - uri: ci://wave-av/sdks/.github/workflows/registry-cleanroom.yml#cleanroom-report.json
    sha256: 0f03603df2bc33f50958a75c8998777463507c1f9e3ee0fec811d82a3ca1206d
pass_condition_from_spec: >
  Release artifacts are built by approved CI from an immutable source revision, provenance is
  verifiable, SBOM is attached, critical known vulnerabilities are resolved or explicitly
  risk-accepted, and publisher accounts require strong MFA.
notes: |
  PARTIAL COVERAGE — this evaluator checks two of the five clauses. A `fail` here is therefore
  sound, but a future `pass` would NOT be sufficient to pass SUPPLY-001 on its own.
  Covered and failing:
    provenance      @wave-av/cli@1.0.8 carries no npm provenance attestation (dist.attestations is
                    null), while sdk, mcp-server and adk each carry a
                    https://slsa.dev/provenance/v1 attestation. The CLI was published outside the
                    provenance-emitting pipeline and cannot be traced to an approved CI build.
    dependency      @wave-av/cli@1.0.8 declares `@wave-av/sdk: "^2.0.11"`. What a customer receives
    policy          is decided by npm's resolver on the day they install; today that is 2.1.3. The
                    published artifact is not reproducible, and this is the precise mechanism by
                    which a broken SDK shipped inside a CLI that no one had changed.
  NOT covered here, still unknown: SBOM attachment, vulnerability posture, publisher MFA and
  branch-protection attestation.
```

## Operator actions to finish these criteria

1. **Make the release gate blocking.** The clean-room job hard-fails on schedule, release and
   dispatch, but it is not yet a *required* status check. Add
   `registry clean-room acceptance / cleanroom` to the default branch's required checks. It runs on
   every pull request with no path filter precisely so it can be made required without going
   permanently unreported.
2. **Fix the three artifact defects the gate found** (each needs a publish, which is a named floor
   and not this lane's to cross): the CLI version constant, the MCP server's `serverInfo.version`,
   and the Python distribution's top-level module name.
3. **Republish the CLI through the provenance-emitting workflow** so `dist.attestations` is
   populated, and exact-pin its first-party dependency.
