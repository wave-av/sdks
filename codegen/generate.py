#!/usr/bin/env python3
"""WAVE polyglot SDK codegen harness (#101).

Parses the gateway OpenAPI contract (codegen/openapi.yaml) into a neutral IR and
renders idiomatic, layered SDKs for Go / Rust / Ruby. The TypeScript and Python
SDKs are hand-carved (they predate and drift from the frozen contract — see
codegen/README.md); these three are generated, so they are the most
contract-accurate clients in the fleet.

Usage:
    python3 codegen/generate.py [--lang go,rust,ruby] [--spec codegen/openapi.yaml]

Deterministic: no timestamps, no network. Re-running overwrites the generated
trees (sdk-go/, sdk-rust/, sdk-ruby/) in place.
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parse_spec import build_ir  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _maybe_fmt(cmd: list[str], tool: str) -> None:
    """Run a formatter if it is installed, so the committed tree stays canonical.
    Silently skips when the tool is absent (CI formats/checks anyway)."""
    import shutil
    import subprocess

    if shutil.which(cmd[0]):
        subprocess.run(cmd, check=False)
    else:
        print(f"  ({tool} not found — skipping format; CI will check)")


def _go_tidy(root: str) -> None:
    """Restore go.mod's indirect requires + go.sum after rendering. The base SDK is pure net/http, but
    the hand-written x402 signer (sdk-go/wave/x402.go) imports go-ethereum, so a regen needs `go mod tidy`
    to reconcile the module graph. Skips silently if `go` is absent (CI runs it anyway)."""
    import shutil
    import subprocess

    if shutil.which("go"):
        subprocess.run(["go", "mod", "tidy"], cwd=root, check=False)
    else:
        print("  (go not found — skipping `go mod tidy`; CI will run it)")


def _fmt_rust(root: str) -> None:
    """rustfmt every generated .rs so the committed Rust is canonical (CI runs
    `cargo fmt --check` as a required gate). Tries `cargo fmt`, then a bare
    `rustfmt` on PATH, then the rustup toolchain binary; skips if none found."""
    import glob
    import os as _os
    import shutil
    import subprocess

    manifest = _os.path.join(root, "Cargo.toml")
    if shutil.which("cargo"):
        r = subprocess.run(["cargo", "fmt", "--manifest-path", manifest], check=False)
        if r.returncode == 0:
            return
    rustfmt = shutil.which("rustfmt")
    if not rustfmt:
        hits = glob.glob(_os.path.expanduser("~/.rustup/toolchains/*/bin/rustfmt"))
        rustfmt = hits[0] if hits else None
    if not rustfmt:
        print("  (rustfmt not found — skipping format; CI will check)")
        return
    rs_files = [p for p in glob.glob(_os.path.join(root, "**", "*.rs"), recursive=True)
                if f"{_os.sep}target{_os.sep}" not in p]
    if rs_files:
        subprocess.run([rustfmt, "--edition", "2021", *rs_files], check=False)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="go,rust,ruby")
    ap.add_argument("--spec", default=os.path.join(REPO, "codegen", "openapi.yaml"))
    args = ap.parse_args()
    langs = [x.strip() for x in args.lang.split(",") if x.strip()]

    ir = build_ir(args.spec)
    print(f"IR: {len(ir['products'])} products, "
          f"{sum(len(p['operations']) for p in ir['products'])} operations, "
          f"{len(ir['schemas'])} schemas, version {ir['version']}")

    if "go" in langs:
        import render_go
        go_root = os.path.join(REPO, "sdk-go")
        files = render_go.render(ir, go_root)
        _maybe_fmt(["gofmt", "-w", os.path.join(go_root, "wave")], "gofmt")
        _go_tidy(go_root)  # the hand-written x402 signer pulls go-ethereum; reconcile go.mod/go.sum
        print(f"go:   {len(files)} files -> sdk-go/")
    if "rust" in langs:
        import render_rust
        rust_root = os.path.join(REPO, "sdk-rust")
        files = render_rust.render(ir, rust_root)
        _fmt_rust(rust_root)
        print(f"rust: {len(files)} files -> sdk-rust/")
    if "ruby" in langs:
        import render_ruby
        files = render_ruby.render(ir, os.path.join(REPO, "sdk-ruby"))
        print(f"ruby: {len(files)} files -> sdk-ruby/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
