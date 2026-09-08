# WAVE GA compliance — wave-av/sdks

> Criterion IDs are global and immutable. `unknown` and a waiver are **not** a pass. A green
> repository is necessary but not sufficient for platform GA.

## Repository declaration

```yaml
repository: wave-av/sdks
revision: 61e473c627866e06f7474e843d2a077ae67f76e2  # origin/main tip this branch is based on
repo_class: sdk
owner: WAVE platform / SDK publishing
last_evaluated_at: 2026-09-04T19:59:00Z
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
verification_command: node scripts/ga/registry-cleanroom.mjs --python python3.12
verified_revision: 61e473c627866e06f7474e843d2a077ae67f76e2
verified_at: 2026-09-04T19:59:00Z
evidence:
  - uri: ci://wave-av/sdks/.github/workflows/registry-cleanroom.yml#cleanroom-report.json
    sha256: ddb12dfc51476c1d4406806fac37f096474c68a698e41fce1a5815767ba8f10d
pass_condition_from_spec: >
  All supported runtimes pass from public registries; Python uses a non-stdlib-colliding import;
  source, package metadata, CLI banner, tag and GitHub release agree.
notes: |
  Re-observed against the live registries on 2026-09-04, re-running the same command that
  produced the original 8-failure PR #79 run. One of the 8 originally-failing checks
  (`@wave-av/mcp-server` `mcp-serverinfo-version-matches-package`) has SELF-RESOLVED live — an
  npm publish of 0.2.1 landed independently of this change — but its SOURCE on `origin/main`
  still hardcoded the version literal that caused the original defect (a live pass with a latent
  regression). This change hardens that source (see "Arming window" below). 7 checks remain
  failing against the live registries, ALL already fixed in source somewhere (table below) and
  blocked only on an operator-gated publish:
    @wave-av/sdk@2.1.3        ESM import, CJS require, all 46 declared subpath exports resolve.
    @wave-av/adk@1.0.15       installs and imports.
    @wave-av/mcp-server@0.2.1 starts over stdio, lists 18 tools, serves every tool its shipped
                              README advertises, AND serverInfo.version now correctly matches.
  Failing (root cause fixed in source, publish pending — see the arming-window table below):
    @wave-av/cli@1.0.8        `wave --version` prints 1.0.0.
    wave-sdk@2.0.0 (PyPI)     `from wave_sdk import Wave` raises ModuleNotFoundError — top-level
                              name `wave` collides with the CPython stdlib module of that name.
    wave-av-sdk@2.0.0 (PyPI)  identical defect.
```

```yaml
criterion_id: VER-001
status: fail
owner: WAVE platform / SDK publishing
verification_command: node scripts/ga/registry-cleanroom.mjs --python python3.12
verified_revision: 61e473c627866e06f7474e843d2a077ae67f76e2
verified_at: 2026-09-04T19:59:00Z
evidence:
  - uri: ci://wave-av/sdks/.github/workflows/registry-cleanroom.yml#cleanroom-report.json
    sha256: ddb12dfc51476c1d4406806fac37f096474c68a698e41fce1a5815767ba8f10d
pass_condition_from_spec: >
  Every shipped component resolves to one source revision and version; no newer source is
  represented as deployed; mutable channels are labeled; deployment receipt identifies artifact
  digest.
notes: |
  This repository covers the REGISTRY half of VER-001 — does the artifact agree with itself about
  which build it is. Re-verified 2026-09-04:
    @wave-av/cli@1.0.8        binary self-reports 1.0.0. FIXED in `wave-av/cli` source
                              (commit 91093d5, `src/lib/version.ts` now derives the version from
                              `package.json` at runtime); pending publish.
    @wave-av/mcp-server@0.2.1 serverInfo.version now correctly reports 0.2.1 — self-resolved live.
                              Source on `origin/main` still hardcoded the literal that caused the
                              original defect; hardened in THIS commit (new `src/version.ts`,
                              wired into `server.ts`, regression test added) so the next publish
                              cannot regress it.
  In both cases the package metadata was correct and the code inside it disagreed, so a version
  comparison against the registry alone cannot see the defect — only running the artifact can.
  Tag/GitHub-release/deployed-endpoint agreement is NOT covered here and remains unknown; it belongs
  to the release-ledger check named in the spec's runnable_command.
```

```yaml
criterion_id: SUPPLY-001
status: fail
owner: WAVE platform / SDK publishing
verification_command: node scripts/ga/registry-cleanroom.mjs --python python3.12
verified_revision: 61e473c627866e06f7474e843d2a077ae67f76e2
verified_at: 2026-09-04T19:59:00Z
evidence:
  - uri: ci://wave-av/sdks/.github/workflows/registry-cleanroom.yml#cleanroom-report.json
    sha256: ddb12dfc51476c1d4406806fac37f096474c68a698e41fce1a5815767ba8f10d
pass_condition_from_spec: >
  Release artifacts are built by approved CI from an immutable source revision, provenance is
  verifiable, SBOM is attached, critical known vulnerabilities are resolved or explicitly
  risk-accepted, and publisher accounts require strong MFA.
notes: |
  PARTIAL COVERAGE — this evaluator now checks three of the five clauses (provenance, dependency
  policy, and — as of this change (cw#4803, ci/sbom-on-release) — SBOM attachment). A `fail` here
  is therefore sound, but a future `pass` would NOT be sufficient to pass SUPPLY-001 on its own.
  Covered and failing (both already fixed in `wave-av/cli` source, pending publish — verified
  2026-09-04 against `wave-av/cli`'s `origin/main`):
    provenance      @wave-av/cli@1.0.8 carries no npm provenance attestation (dist.attestations is
                    null), while sdk, mcp-server and adk each carry a
                    https://slsa.dev/provenance/v1 attestation. `.github/workflows/release.yml`
                    already runs `npm publish --provenance` under OIDC trusted publishing —
                    `1.0.8` predates that pipeline; the next publish carries provenance.
    dependency      @wave-av/cli@1.0.8 declares `@wave-av/sdk: "^2.0.11"`. `package.json` on
    policy          `origin/main` already pins it exact (`2.0.14`); pending publish.
  NOT covered here, still unknown: vulnerability posture, publisher MFA and branch-protection
  attestation.

  ## SBOM attachment (SUPPLY-001, added this change — cw#4803)

  This repo publishes NO GitHub Release itself (`gh release list --repo wave-av/sdks` returns
  `[]`; no workflow here runs `gh release create`/`softprops/action-gh-release`/
  `actions/upload-release-asset` — every `publish-*.yml` job ships straight to a package registry
  — npm, PyPI, crates.io, RubyGems — via OIDC trusted publishing, never a GitHub Release asset).
  So there is no in-repo release job to attach an SBOM to here (path 2a from cw#4803 does not
  apply to this repo). What this repo DOES own is the evidence side: `scripts/ga/sbom-presence.mjs`
  is a new ecosystem-agnostic check, wired into `registry-cleanroom.mjs` via
  `cleanroom-targets.json`'s `sbom-presence` check on `npm-sdk`, `npm-cli`, `npm-mcp-server`,
  `npm-adk`, `pypi-wave-sdk`. It reads each package's OWN declared repository (npm
  `repository.url`, PyPI `project_urls.Repository` — never a hardcoded owner/repo map, so it does
  not drift the next time a package's canonical repo moves) and asks that repo's GitHub Releases
  API (`GET /repos/{owner}/{repo}/releases/latest`) whether the release carries a `*.spdx.json` or
  `*.cdx.json` asset.

  Real, non-fabricated run against the LIVE registries and LIVE GitHub Releases, 2026-09-08
  (`node scripts/ga/registry-cleanroom.mjs`, local pre-merge verification — not yet a CI artifact
  URI, since this is the change introducing the check; the `registry-cleanroom.yml` `pull_request`
  trigger produces the CI-artifact version of this same evidence once this change is a PR):

    @wave-av/sdk@2.1.3        FAIL — wave-av/sdk@sdk-v2.1.3 release carries only
                              `wave-av-sdk-2.1.3.tgz`, no SBOM asset.
    @wave-av/cli@1.0.10       FAIL — wave-av/cli@v1.0.10 release carries only
                              `wave-av-cli-1.0.10.tgz`, no SBOM asset.
    @wave-av/mcp-server@0.3.0 FAIL — wave-av/mcp-server@v0.3.0 release carries NO assets at all.
    @wave-av/adk@1.0.15       FAIL — wave-av/adk@v1.0.6 release carries NO assets at all (repo tag
                              lags the npm-published 1.0.15; either way, no SBOM).
    wave-sdk@2.2.0 (PyPI)     FAIL — wave-av/sdk-python@v2.2.0 release carries only the wheel and
                              sdist, no SBOM asset.

  Every checked package fails today — this is the honest negative control cw#4803 requires (no
  sibling repo has shipped an SBOM-producing release workflow yet; this lane's sibling lanes are
  landing that in parallel in `wave-av/sdk`, `wave-av/cli`, `wave-av/mcp-server`,
  `wave-av/sdk-python`). Nothing here is fabricated as a pass. `scripts/ga/sbom-presence.mjs`
  passes when a real `*.spdx.json`/`*.cdx.json` asset is observed on the target repo's LATEST
  release, fails on "no asset found" AND on "could not check" (unresolvable repository, network
  error, timeout, rate-limited, non-2xx/404 API response) alike — a lookup failure never reads as
  health. A rate-limited lookup is reported distinctly ("RATE LIMITED", never merged into the "no
  SBOM" message) so a reader can tell GitHub throttling the check apart from a genuine gap;
  `registry-cleanroom.yml` now passes `GITHUB_TOKEN` to this step so a real run authenticates at
  5,000 req/hour instead of risking the 60 req/hour unauthenticated limit.

  KNOWN SCOPE LIMITS (raised in PR review, both deliberate for this pass): (1) presence is
  filename-only — `checkSbomPresence` accepts any asset named `*.spdx.json`/`*.cdx.json` and does
  NOT parse, validate, or verify a signature over its contents, so a same-named empty or malformed
  file would read as a pass; the GA criterion this closes is "is an SBOM attached", not "is the
  SBOM correct", and content/signature validation is a natural follow-up, not silently claimed
  here. (2) it always checks the repository's LATEST release, matching cw#4803's literal
  instruction ("verify the latest GitHub Release carries a *.spdx.json/*.cdx.json asset") — an
  npm/PyPI target resolved via an explicit `--versions` pin is checked against its OWN declared
  repository (fixed in this PR to read the resolved version's metadata, not the project-level
  document — a package's canonical repo can and has moved between versions), but still against
  that repository's newest release, not a release matching the pinned version number; per-version
  release matching is out of scope for this check and would need the pinned artifact's own release
  tag, not just its repository, threaded through.

  Unit coverage: `scripts/ga/__tests__/sbom-presence.test.mjs` (18 tests, `node --test`, no live
  network call — fixtures are the real observed shapes above, trimmed).
```

## Arming window (2026-09-04 false-green remediation)

`registry-cleanroom.yml`'s `pull_request` trigger used to run the same checks and then paper
over a failure with a `::warning` while still exiting `0` — so the GitHub check conclusion read
**SUCCESS** on a PR whose own log ended `REGISTRY CLEAN-ROOM FAILED: 8 check(s)`. sdks#79 merged
2026-09-04T18:25:54Z on the strength of that green rollup. As of this commit, every trigger
(including `pull_request`) hard-fails the job when a check fails — the gate can no longer report
green while failing.

It is **not yet a required branch-protection status check**, deliberately. `cleanroom` also
tests artifacts published from **two other repositories** — `wave-av/cli` (`@wave-av/cli`) and
`wave-av/sdk-python` (`wave-sdk` on PyPI) — that an `sdks` PR cannot fix by itself. Requiring it
today would red every future `sdks` PR for a defect it did not introduce, training reviewers to
override rather than read it.

**Re-verified 2026-09-04 (this change): all 8 originally-failing checks are now root-cause fixed
in source, across three repositories. None remains an open defect — every one is either already
live or blocked ONLY on an operator-gated publish, which this lane may not cross.**

| # | Check | Source fix | Where | Status |
|---|---|---|---|---|
| 1 | `@wave-av/cli` `npm-provenance-attested` | `release.yml` already runs OIDC trusted publishing with `npm publish --provenance` | `wave-av/cli` (verified: `.github/workflows/release.yml`) | fixed in source; `1.0.8` predates it — next publish carries provenance |
| 2 | `@wave-av/cli` `bin-version-matches-package` | `src/lib/version.ts` derives `CLI_VERSION` from `package.json` at runtime instead of a hardcoded literal | `wave-av/cli` commit `91093d5` (2026-09-03, "fix(version): derive every CLI version surface from package.json (VER-001)") | fixed in source; pending publish (`package.json` already at `1.0.9`) |
| 3 | `@wave-av/cli` `declared-dep-ranges-pinned` | `@wave-av/sdk` dependency changed from `^2.0.11` to an exact `2.0.14` | `wave-av/cli` `package.json` (verified on `origin/main`) | fixed in source; pending publish |
| 4 | `@wave-av/mcp-server` `mcp-serverinfo-version-matches-package` | live artifact `0.2.1` already reports the correct `serverInfo.version` — BUT `src/server.ts` on `origin/main` still hardcoded `version: "0.1.0"` in the `McpServer` constructor, a latent regression: the next publish built from unmodified `main` would have reintroduced the exact defect. | **this repo, this commit** — new `sdk-typescript/packages/mcp-server/src/version.ts` (mirrors the CLI's pattern: walk up from the module's own location to find `package.json`, verify its `name` matches, read `version`), wired into `server.ts`; regression test `__tests__/version.test.ts` added; `vitest`/`test` script added to `package.json` (was silently absent — no other package in the workspace lacks it) | **source hardened and verified** (`tsc --noEmit` clean, `vitest run __tests__/version.test.ts` 2/2 pass, and the built `dist/index.js` was probed live over stdio JSON-RPC: `serverInfo.version` now reads `0.1.8`, this repo's current `package.json` version, not a literal) |
| 5 | `wave-sdk` (PyPI) `py-import-module` | top-level module renamed `wave` → `wave_sdk` | `wave-av/sdk-python` (**separate repo** — this PyPI distribution is built from `github.com/wave-av/sdk-python`, not this monorepo's `sdk-python/`; confirmed via the live package's own `project_urls.Repository`) — already on `origin/main` at version `2.1.0`, package dir is `wave_sdk/` | fixed in source in that repo already; pending publish; **out of this repo's scope to publish or PR** |
| 6 | `wave-sdk` (PyPI) `py-no-stdlib-shadow` | same rename as #5 | `wave-av/sdk-python` | same as #5 |
| 7 | `wave-av-sdk` (PyPI) `py-import-module` | top-level module renamed `wave` → `wave_sdk`, `pyproject.toml` `include` updated, all internal imports + tests + docs updated, version bumped `2.0.1` → `3.0.0` | **this repo, this commit** — `sdk-python/` | fixed in source; verified with a real build (`python -m build` + fresh venv install + the actual `cleanroom_python_assert.py` probe: `py-import-module` OK, `py-no-stdlib-shadow` OK); `pytest` 31/31 pass; pending publish |
| 8 | `wave-av-sdk` (PyPI) `py-no-stdlib-shadow` | same rename as #7 | same as #7 | same as #7 |

Sequence to close the arming window and make `cleanroom` a required check:

1. Publish `wave-av/cli` (carries fixes #1–#3).
2. Publish `wave-av/sdk-python` under the `wave-sdk` PyPI project (carries fixes #5–#6) — a
   different repo and a different operator action than this one.
3. Publish `wave-av-sdk` from a `sdk-python-v3.0.0` tag on **this** repo (carries fixes #7–#8).
4. Once `node scripts/ga/registry-cleanroom.mjs` reports zero failing checks against the live
   registries, add `registry clean-room acceptance / cleanroom` to the default branch's required
   status checks. It already runs on every PR with no path filter, so it can be made required
   without a permanently-unreported gap.

None of steps 1–3 is a source change this lane is blocked on producing — they are blocked on an
operator triggering a publish (npm/PyPI Trusted Publisher, `pypi-publish` environment
required-reviewer), which is explicitly outside what an automated lane may do.

## Operator actions to finish these criteria

1. **Publish** `wave-av/cli`, `wave-av/sdk-python`, and this repo's `sdk-python-v3.0.0` tag — the
   only remaining action; every source defect the gate found is already fixed (table above).
2. **Make the release gate blocking** once all three publishes land and `cleanroom` reports zero
   failures against the live registries.
