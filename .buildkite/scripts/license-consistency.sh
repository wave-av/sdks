#!/usr/bin/env bash
# Step `license-consistency`: .github/workflows/license-consistency.yml job `licenses`. Every publishable
# package must ship the license text it declares. Dependency-free: node 22, nothing installed.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

bk_preflight
bk_use_node 22

bk_section "declared license vs shipped license text"
node scripts/license-consistency.mjs
