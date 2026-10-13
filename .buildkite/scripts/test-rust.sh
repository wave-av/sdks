#!/usr/bin/env bash
# Step `test-rust`: .github/workflows/test-rust.yml job `test`, in sdk-rust/: cargo build, cargo test,
# cargo fmt --check, cargo clippy --all-targets -D warnings (all four are hard gates in the workflow).
#
# The workflow installs the floating `stable` toolchain with rustfmt + clippy and restores a cargo cache.
# Here the toolchain is the guest image's pinned Rust (RUST_VERSION, rustc + cargo + rustfmt + clippy,
# no rustup), and there is no cache: CARGO_HOME and the target dir are job-local temp dirs. Crates come
# from the public crates.io index. A newer `stable` lint can therefore land on GH before the image is
# repinned; that is the one intended difference.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

RUST_VERSION="1.99"

bk_preflight
bk_require_tools cargo rustc
case "$(rustc --version)" in
  "rustc ${RUST_VERSION}".*) ;;
  *) bk_err "rust ${RUST_VERSION}.x is required (the guest image pin); found: $(rustc --version)"; exit 1 ;;
esac
cargo --version
cargo fmt --version
cargo clippy --version

cargo_tmp=""
bk_mktemp_dir cargo_tmp
export CARGO_HOME="${cargo_tmp}/home" CARGO_TARGET_DIR="${cargo_tmp}/target" CARGO_TERM_COLOR=always

cd sdk-rust
bk_gate "build" cargo build --all
bk_gate "test" cargo test --all
bk_gate "rustfmt (check)" cargo fmt --all --check
bk_gate "clippy (deny warnings)" cargo clippy --all-targets -- -D warnings
bk_gates_summary
