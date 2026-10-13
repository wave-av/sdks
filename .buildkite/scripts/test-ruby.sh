#!/usr/bin/env bash
# Steps `test-ruby-31` and `test-ruby-33`: .github/workflows/test-ruby.yml job `test` (matrix ruby-version
# 3.1, 3.3). The version comes from the agent-set BUILDKITE_STEP_KEY, checked against the two legs.
#
# Ruby is the guest image's prebuilt tree under /opt/hostedtoolcache/Ruby/<version>/x64 (the same trees
# ruby/setup-ruby installs on GitHub's runners), exactly one match per leg. The trees are read-only, so
# GEM_HOME is a job-local temp dir.
#
# In sdk-ruby/: a syntax check of every lib/**/*.rb, `gem build`, then the offline smoke suite, as in the
# workflow. The built .gem goes to a temp dir so the checkout stays clean.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

bk_preflight
case "${BUILDKITE_STEP_KEY:-}" in
  test-ruby-31) rb_version=3.1 ;;
  test-ruby-33) rb_version=3.3 ;;
  *) bk_err "run this script as step test-ruby-31 or test-ruby-33 (BUILDKITE_STEP_KEY)"; exit 2 ;;
esac

shopt -s nullglob
trees=(/opt/hostedtoolcache/Ruby/"${rb_version}".*/x64)
shopt -u nullglob
if ((${#trees[@]} != 1)); then
  bk_err "expected exactly one image Ruby ${rb_version}.x tree under /opt/hostedtoolcache/Ruby, found ${#trees[@]}"
  exit 1
fi
PATH="${trees[0]}/bin:${PATH}"
gem_home=""
bk_mktemp_dir gem_home
export GEM_HOME="$gem_home"
ruby --version
case "$(ruby -e 'print RUBY_VERSION')" in
  "${rb_version}" | "${rb_version}".*) ;;
  *) bk_err "ruby ${rb_version}.x was requested but another ruby is first on PATH"; exit 1 ;;
esac

cd sdk-ruby
out=""
bk_mktemp_dir out
bk_gate "syntax check" bash -c 'find lib -name "*.rb" -print0 | xargs -0 -n1 ruby -c'
bk_gate "build gem" gem build wave-sdk.gemspec --output "${out}/wave-sdk.gem"
bk_gate "test (offline)" ruby -Ilib test/smoke_test.rb
bk_gates_summary
