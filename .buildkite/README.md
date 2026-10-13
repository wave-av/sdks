# sdks on Buildkite (shadow mode)

This directory ports this repository's GitHub Actions CI to Buildkite. Steps run on self-hosted
agents, each inside a disposable, isolated guest VM.

**Nothing under `.github/` changes.** The GH workflows stay the gate until the Buildkite pipeline has
been green for 7 consecutive days; swapping the required checks is a separate, owner-gated change.
No Buildkite pipeline exists for this repository yet, and this change does not create one.

## Fork pull requests never build here

This repository is public, so anyone can open a pull request from a fork. **A fork PR never runs on
these agents.** That rests on one pipeline setting, backed by two more checks:

1. **Pipeline setting `build_pull_request_forks: false` (the boundary).** Buildkite never starts a build
   for a fork PR, so no fork-controlled file (including the shim script in this directory) ever
   executes. The setting must stay `false` for this pipeline, and the renderer's approved-fork path (a
   `ci:approved` label) must not be enabled for it either.
2. **Render refusal.** The settings declare `"visibility": "public"`. The renderer treats any PR whose
   head repository is not `wave-av/sdks` as a fork (unknown counts as a fork) and refuses to render it
   without the approval label.
3. **Every repo script refuses a fork PR** (`bk_refuse_fork_pr` in `scripts/lib/common.sh`). This only
   guards against a misconfigured pipeline: a fork could edit the script, which is why (1) is the boundary.

No step holds a secret, so a same-repository PR build has nothing to leak either.
`bk_refuse_credentials` ends any step whose environment carries a credential.

## Layout

| path | role |
|---|---|
| `pipeline.yml` | The thin uploader, identical in every templated repository. Its one step runs the shim with `WAVE_JOB_ACTION=upload`, which renders the pipeline from the settings, caps-lints it with the host's read-only linter, and only then uploads it. Do not edit it. |
| shim (`*.sh` next to `pipeline.yml`) | Fixed content, identical in every templated repository, mode 755. It accepts only a full 40-hex template pin and, inside a job, runs only the guest image's verified template checkout. Do not edit it. |
| settings (`*.json` next to `pipeline.yml`) | Template `custom` (every step is a repo script), `visibility: public`, twelve steps, two `schedules` entries. The language test steps carry `paths` mirroring each workflow's `on.paths`, with `paths_on_default_branch` so `main` pushes filter too. The `wave_ci` key pins the template commit `296cc0cf4faf1f06d0acd4c2a767d6c111d2adf3`. |
| `parked.json` | NOT rendered. Every parked job, with its reason and what unblocks it. |
| `scripts/<step>.sh` | The checked-in scripts the steps run. `command:` is only ever a script path (agents run with no-command-eval). |
| `scripts/lib/common.sh` | Strict mode, the fork and credential refusals, toolchain selection from the guest image's mise (never a download), a deterministic public-registry `npm ci`, the gate runner. |

## Parity: every GitHub workflow job

17 workflow files, 22 jobs. Ported: 12 jobs, as 12 steps and 2 schedules. Parked: 10 jobs, plus
three legs of ported jobs. Every parked item is recorded in `parked.json`.

| workflow | job | Buildkite | paths | notes |
|---|---|---|---|---|
| `_checks.yml` (via `foundation-gate.yml`) | `checks` | `gate-checks` | - | secret scan + file-size gate (max 800); prints `path:line` only |
| `_checks.yml` | `skill-validate` | `gate-skill-validate` | - | python 3.12 from the image; PyYAML baked (pinned-wheel fallback) |
| `_checks.yml` | `verify-routes` | `gate-checks` | - | URL-convention gate; a no-op today (no `wrangler.toml`) |
| `foundation-gate.yml` | `gate` | the three rows above | - | |
| `public-repo-guard.yml` | `guard` | `secrets-content-policy` | - | gitleaks 8.30.1 (image binary), ripgrep PCRE2 probe, content-policy.sh. The private-repo-name rule is parked (needs `GUARD_PRIVATE_REPOS`) |
| `license-consistency.yml` | `licenses` | `license-consistency` | - | node 22, nothing installed |
| `test-go.yml` | `test` | `test-go` | `sdk-go/**`, `codegen/**`, the workflow | go 1.27 from the image's mise, `GOTOOLCHAIN=local`; gofmt, vet, test |
| `test-python.yml` | `test` (3.10) | `test-python-310` | `sdk-python/**`, the workflow | job venv from the image's python; `pip install -e '.[dev]'`; `pytest -q` |
| `test-python.yml` | `test` (3.12) | `test-python-312` | same | same |
| `test-ruby.yml` | `test` (3.1) | `test-ruby-31` | `sdk-ruby/**`, `codegen/**`, the workflow | the image's prebuilt Ruby 3.1; syntax check, gem build, smoke test |
| `test-ruby.yml` | `test` (3.3) | `test-ruby-33` | same | the image's Ruby 3.3 |
| `test-rust.yml` | `test` | `test-rust` | `sdk-rust/**`, `codegen/**`, the workflow | the image's pinned Rust 1.99 (no rustup), no cache; build, test, fmt, clippy `-D warnings` |
| `registry-parity.yml` | `parity` | `registry-parity` + schedule `registry-parity-daily` (`0 14 * * *`) | - | warn-only, as on GH |
| `registry-cleanroom.yml` | `cleanroom` | `registry-cleanroom` + schedule `registry-cleanroom-daily` (`0 9 * * *`) | - | any non-zero fails; `ga-out/**` is a step artifact. The tracking-issue step and the `workflow_run` leg are parked |
| `governance-enforce.yml` | `enforce` | parked | | installs `@wave-av/governance` from GitHub Packages (E403, billing); waits on a self-hosted npm registry and a read credential |
| `publish-npm.yml` | `publish` | parked | | tag-triggered npm publish (OIDC). Deploy-class; off until the owner enables it |
| `publish-pypi.yml` | `build`, `publish` | parked | | tag-triggered PyPI publish (OIDC) |
| `publish-crates.yml` | `verify`, `publish` | parked | | tag-triggered crates.io publish (OIDC). `verify` (build + test + package) is covered by `test-rust` |
| `publish-rubygems.yml` | `verify`, `publish` | parked | | tag-triggered RubyGems publish (OIDC). `verify` (gem build) is covered by `test-ruby-*` |
| `release-go.yml` | `validate-and-warm` | parked | | runs on `sdk-go/v*` tags only (tag builds are off); vet + test are covered by `test-go`; the proxy warm-up is release-class |
| `issue-ops-triage.yml` | `triage` | parked | | event bot (issues) with a PAT + App key; waits on a GitHub-event bridge |

## Differences from GH, on purpose

- **Toolchains come from the guest image, never a download.** Go 1.27, python 3.10/3.11/3.12, node 22
  resolve through the image's mise (`mise where`, from `/`, repo config files ignored) and must sit under
  the image's root-owned installs. Ruby 3.1 and 3.3 are the image's prebuilt trees. Rust is the image's
  pinned 1.99 where GH installs the floating `stable`: a newer clippy lint can reach GH first.
- **Path filters.** Each language step's `paths` is its workflow's `pull_request.paths`. GH's `push`
  paths on `main` are narrower (no `codegen/**`); with `paths_on_default_branch` the step uses the PR
  list on `main` too, a small superset.
- **Triggers.** Buildkite builds `main` pushes and same-repository PRs. `registry-parity` and
  `registry-cleanroom` therefore also run on `main` pushes (GH: PRs and the schedule), a superset.
  `workflow_dispatch` becomes a manual build of `main`; tag triggers are off.
- **No caches.** Go, cargo and pip caches are job-local and discarded with the guest.
- **One run reports every failure.** A gate script runs all of its gates and summarises.

## Toolchain coverage

Every language leg has its toolchain in the guest image pins: node 22, python 3.10 / 3.11 / 3.12,
Go 1.27.1, Rust 1.99.0, Ruby 3.3.12 and 3.1.7. No language is parked for a missing toolchain. The
Ruby trees are the newest image additions, so the Ruby steps need a guest image that includes them.

## Guest-image prerequisites

- linux x86_64; the toolchains above; gitleaks 8.30.1; ripgrep with PCRE2; `gcc` (cgo in the Go
  module's dependencies); `git`, `bash`, `find`, `xargs`.
- Egress: `registry.npmjs.org`, `pypi.org` + `files.pythonhosted.org`, `proxy.golang.org` +
  `sum.golang.org`, `index.crates.io` + `static.crates.io`, `api.github.com` (anonymous SBOM lookup).

## Credentials

None. No step declares a secret, so every step runs on the no-secrets queue and the renderer's
`--allowlist-rows` prints no row. The parked legs that would need one are listed in `parked.json` for
a decision; each would be a `main_only` step.

## Caps

caps-lint passes on the uploader and on every render (PR, main, path-filtered PR and main builds, and both schedules: at most 12 steps, 36 worst-case jobs, one file). Every step sets `agents.queue`,
`timeout_in_minutes` and the agent-loss-only retry; no plugins, no secret values, no
`cancel_on_build_failing`.

## Run locally

With the template repository checked out at the pin as `<tpl>`:

```sh
node <tpl>/bin/<render script> --settings <settings json> --context <ctx.json> --out-dir <dir>
node <tpl>/tools/caps-lint/bin/caps-lint.mjs --warnings-as-errors <dir>/part-1.yml
node <tpl>/tools/caps-lint/bin/caps-lint.mjs --warnings-as-errors .buildkite
.buildkite/scripts/gate-checks.sh            # no install, no network
.buildkite/scripts/secrets-content-policy.sh # needs gitleaks 8.30.1 and rg on PATH
```

Steps that select a toolchain need the guest image's mise layout. Off the image, point
`BK_TEST_MISE_INSTALLS` at a tree of `<tool>/<version>/bin` directories and put a `mise` on PATH whose
`mise where <tool>@<version>` prints the matching directory (the override is ignored inside any
Buildkite job). Run every script with a clean environment: each refuses to start when a credential
variable is set.
