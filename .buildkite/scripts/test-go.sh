#!/usr/bin/env bash
# Step `test-go`: .github/workflows/test-go.yml job `test`, in sdk-go/: gofmt must be clean, go vet,
# go test -count=1. Go is the guest image's mise go at the workflow's go-version (1.27). GOTOOLCHAIN=local
# keeps go from downloading a different toolchain; module and build caches are job-local temp dirs (the
# workflow runs with cache: false too). Modules come from the public Go module proxy.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

GO_VERSION="1.27"

bk_preflight
go_dir=""
bk_mise_dir go "$GO_VERSION" go_dir
PATH="${go_dir}/bin:${PATH}"
gocache=""
bk_mktemp_dir gocache
export GOTOOLCHAIN=local GOFLAGS=-mod=readonly GOPATH="${gocache}/gopath" GOCACHE="${gocache}/build" \
  GOMODCACHE="${gocache}/mod"
go version
case "$(go env GOVERSION)" in
  go"${GO_VERSION}" | go"${GO_VERSION}".*) ;;
  *) bk_err "go ${GO_VERSION}.x is required; found $(go env GOVERSION)"; exit 1 ;;
esac

cd sdk-go
# shellcheck disable=SC2016 # single-quoted on purpose: expansion happens in the inner bash -c
bk_gate "gofmt (must be clean)" bash -c 'out="$(gofmt -l .)"; if [ -n "$out" ]; then echo "run gofmt -w on:"; printf "%s\n" "$out"; exit 1; fi'
bk_gate "go vet" go vet ./...
bk_gate "go test" go test ./... -count=1
bk_gates_summary
