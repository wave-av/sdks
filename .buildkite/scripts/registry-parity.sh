#!/usr/bin/env bash
# Step `registry-parity`: .github/workflows/registry-parity.yml job `parity`. For every
# sdk-typescript/packages/*/package.json, its declared version must equal npm's published latest
# (scripts/check-registry-parity.py). Warn-only until first publish, exactly like the workflow: a drift
# or a not-yet-published package is a warning and the step passes.
#
# Runs on every build and on the daily schedule `registry-parity-daily` (cron 0 14 * * *, declared in
# the pipeline settings `schedules`). Node 22 and python 3.11 from the guest image, as pinned in the
# workflow; the python script uses the standard library only.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

bk_preflight
bk_use_node 22
py_dir=""
bk_mise_dir python 3.11 py_dir
py="${py_dir}/bin/python3"
"$py" --version

shopt -s nullglob
manifests=(sdk-typescript/packages/*/package.json)
shopt -u nullglob
if ((${#manifests[@]} == 0)); then
  bk_err "no sdk-typescript/packages/*/package.json found; refusing to report parity over nothing"
  exit 1
fi

drift=0
for pj in "${manifests[@]}"; do
  name="$(node -p "require('./$pj').name")"
  ver="$(node -p "require('./$pj').version")"
  bk_section "${name}@${ver}"
  if "$py" scripts/check-registry-parity.py \
    --canonical "$pj" '"version":\s*"([^"]+)"' \
    --registry "npm $name" "https://registry.npmjs.org/$name/latest" '.version'; then
    printf '%s: parity OK\n' "$name"
  else
    printf 'warning: %s not yet published or drifted (expected pre-first-publish)\n' "$name"
    drift=$((drift + 1))
  fi
done
printf '+++ packages with drift/not-published: %s (warn-only until first publish)\n' "$drift"
