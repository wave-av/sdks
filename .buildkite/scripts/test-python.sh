#!/usr/bin/env bash
# Steps `test-python-310` and `test-python-312`: .github/workflows/test-python.yml job `test` (matrix
# python-version 3.10, 3.12). The version comes from the agent-set BUILDKITE_STEP_KEY, checked against
# the two legs. Python is the guest image's mise python at that version.
#
# In sdk-python/: a job-local venv (the image's python trees are read-only), `pip install --upgrade pip`,
# an editable install with the dev extras, then the offline suite (`python -m pytest -q`), as in the
# workflow. Packages come from the public PyPI.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

bk_preflight
case "${BUILDKITE_STEP_KEY:-}" in
  test-python-310) py_version=3.10 ;;
  test-python-312) py_version=3.12 ;;
  *) bk_err "run this script as step test-python-310 or test-python-312 (BUILDKITE_STEP_KEY)"; exit 2 ;;
esac

py_dir=""
bk_mise_dir python "$py_version" py_dir
venv=""
bk_mktemp_dir venv
"${py_dir}/bin/python3" -m venv "${venv}/py"
py="${venv}/py/bin/python"
"$py" --version
case "$("$py" -c 'import sys; print("%d.%d" % sys.version_info[:2])')" in
  "$py_version") ;;
  *) bk_err "python ${py_version} was requested but the venv runs another version"; exit 1 ;;
esac

cd sdk-python
bk_section "install (editable + dev extras)"
PIP_DISABLE_PIP_VERSION_CHECK=1 "$py" -m pip install --upgrade pip
PIP_DISABLE_PIP_VERSION_CHECK=1 "$py" -m pip install -e '.[dev]'

bk_section "test (offline)"
"$py" -m pytest -q
