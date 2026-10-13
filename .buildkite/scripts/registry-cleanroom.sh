#!/usr/bin/env bash
# Step `registry-cleanroom`: .github/workflows/registry-cleanroom.yml job `cleanroom`. Installs what the
# PUBLIC registries serve (npm, PyPI) into throwaway dirs and checks it (scripts/ga/registry-cleanroom.mjs).
# Exit 0 = every check passed, 1 = an artifact failed, 2 = the gate could not run; any non-zero fails the
# step, as the workflow's Enforce step does. ga-out/ is a Buildkite artifact of this step.
#
# Runs on every build and on the daily schedule `registry-cleanroom-daily` (cron 0 9 * * *, declared in
# the pipeline settings `schedules`). Node 22 and python 3.12 from the guest image.
#
# Not here (parked, see README): the `workflow_run` leg after an npm publish (publishing is parked), the
# "open or update the tracking issue" step (it needs an issues:write GitHub token), and the workflow's
# GITHUB_TOKEN, which only raises the GitHub REST rate limit for the SBOM lookup; this step holds no
# secret and calls the API anonymously.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

bk_preflight
bk_use_node 22
py_dir=""
bk_mise_dir python 3.12 py_dir
"${py_dir}/bin/python3" --version

bk_section "clean-room acceptance against the public registries"
code=0
node scripts/ga/registry-cleanroom.mjs --python "${py_dir}/bin/python3" --out-dir "${BK_REPO_ROOT}/ga-out" || code=$?
if [[ "$code" != 0 ]]; then
  bk_err "published artifacts failed clean-room acceptance (exit ${code}: 1 = an artifact failed, 2 = the gate could not run)"
  exit 1
fi
printf 'registry clean-room acceptance passed\n'
