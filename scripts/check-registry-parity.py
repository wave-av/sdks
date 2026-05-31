# VENDORED from wave-av/wave-foundation scripts/check-registry-parity.py — do NOT fork the logic.
# Refresh by re-copying from wave-foundation@master. Generic cross-registry 'declared == published' gate (#61).
#!/usr/bin/env python3
"""check-registry-parity — generic cross-repo "registries match canonical" gate.

Use when a repo ships the SAME version across multiple package registries (PyPI / npm / crates.io /
RubyGems / pkg.go.dev / Hex / Maven / etc.). The bug class this prevents: silent multi-version
drift on a public SDK because the per-registry check was too lenient ("something exists" instead of
"the canonical version exists"). Reference incident: wave-dispatch's Go SDK sat on v0.1.0 through
4 releases (0.5.0 → 0.5.1 → 0.5.2 → 0.6.0) because proxy.golang.org reads tags directly from git
and the unified release-sdks workflow tagged `sdks-v<X>` (wrong shape for a Go sub-module — needs
`sdk/go/v<X>`). The nonempty registry check passed every time.

Generic + parametric: caller supplies the canonical-version source and each registry's lookup
recipe. No registry hardcoded — works for any future combination.

Usage (any consumer repo, in CI):
  python3 wave-foundation/scripts/check-registry-parity.py \
    --canonical dispatch.yaml '^version: "([^"]+)"' \
    --registry 'npm @wave-av/dispatch'   'https://registry.npmjs.org/@wave-av/dispatch/latest'  '.version' \
    --registry 'PyPI wave-dispatch'      'https://pypi.org/pypi/wave-dispatch/json'             '.info.version' \
    --registry 'crates.io wave-dispatch' 'https://crates.io/api/v1/crates/wave-dispatch'        '.crate.newest_version' \
    --registry 'RubyGems wave-dispatch'  'https://rubygems.org/api/v1/gems/wave-dispatch.json'  '.version' \
    --registry 'pkg.go.dev sdk/go'       'https://proxy.golang.org/github.com/wave-av/dispatch-edge/sdk/go/@latest' '.Version[1:]'

Exit code:
  0  every registry matches the canonical
  1  at least one drift
  2  bad invocation (missing canonical, unreachable, etc.)

`--registry` JSONPath supports:
  '.foo.bar'       — nested dict lookup
  '.field[1:]'     — strip first character (useful for Go's leading 'v')
"""
import argparse
import json
import re
import sys
import urllib.request


def jsonpath(data, expr):
    """Tiny JSONPath subset: .foo.bar, .foo[1:], .foo[0]. No general expression engine — just enough
    for "navigate to a string in a JSON document and optionally strip leading chars". Strict on
    errors so a typo in a recipe is obvious."""
    cur = data
    for part in re.findall(r"\.[A-Za-z_][A-Za-z0-9_]*(?:\[\d+:?\d*\])?", expr):
        m = re.match(r"\.([A-Za-z_][A-Za-z0-9_]*)(?:\[(\d+):?(\d*)\])?", part)
        key, lo, hi = m.group(1), m.group(2), m.group(3)
        if not isinstance(cur, dict):
            raise ValueError(f"jsonpath: tried to dict-index a non-dict at '.{key}'")
        cur = cur.get(key)
        if cur is None:
            raise ValueError(f"jsonpath: key '.{key}' missing in document")
        if lo is not None:
            if not isinstance(cur, str):
                raise ValueError(f"jsonpath: slice on non-string at '.{key}'")
            cur = cur[int(lo): int(hi) if hi else None]
    return cur


def extract_canonical(path, pattern):
    """Read `path` and return the first group of `pattern`. Strict — a missing file or no-match
    canonical means the gate can't run, which is itself a build failure."""
    try:
        with open(path, encoding="utf-8") as f:
            src = f.read()
    except OSError as e:
        sys.stderr.write(f"canonical: cannot read {path}: {e}\n")
        sys.exit(2)
    m = re.search(pattern, src, re.M)
    if not m or not m.group(1):
        sys.stderr.write(f"canonical: pattern {pattern!r} matched no version in {path}\n")
        sys.exit(2)
    return m.group(1)


def fetch_registry_version(url, jsonpath_expr, timeout=20):
    """Fetch URL, parse JSON, extract version via jsonpath. Returns (version, None) on success or
    (None, error_message) on any failure — caller decides how to render. Network/parse errors are
    DRIFT-CLASS (the gate can't confirm the registry matches the canonical), so they fail."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "wave-foundation/registry-parity"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read())
        v = jsonpath(data, jsonpath_expr)
        if not isinstance(v, str):
            return None, f"jsonpath returned non-string: {v!r}"
        return v, None
    except Exception as e:
        return None, f"{type(e).__name__}: {str(e)[:80]}"


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--canonical", nargs=2, metavar=("FILE", "PATTERN"), required=True,
                    help="File + regex (first group = version)")
    ap.add_argument("--registry", action="append", nargs=3, metavar=("NAME", "URL", "JSONPATH"),
                    default=[], help="Repeat once per registry to check")
    ap.add_argument("--allow-ahead", action="store_true",
                    help="Treat registry > canonical as warning, not failure (default: any drift fails)")
    args = ap.parse_args()

    if not args.registry:
        sys.stderr.write("at least one --registry required\n")
        sys.exit(2)

    canon = extract_canonical(args.canonical[0], args.canonical[1])
    print(f"canonical ({args.canonical[0]}): {canon}")
    print()

    drifts = 0
    for name, url, jp in args.registry:
        v, err = fetch_registry_version(url, jp)
        if err is not None:
            print(f"  ? {name:<40} unreachable ({err})")
            drifts += 1
            continue
        if v == canon:
            print(f"  ✓ {name:<40} @ {v}")
        elif args.allow_ahead and _semver_gt(v, canon):
            print(f"  ! {name:<40} @ {v}  (ahead of canonical {canon} — allowed)")
        else:
            print(f"  ✗ {name:<40} @ {v}  (canonical {canon} — DRIFT)")
            drifts += 1

    print()
    if drifts == 0:
        print(f"registry parity: ✓ all {len(args.registry)} registries match canonical")
        sys.exit(0)
    print(f"registry parity: ✗ {drifts} of {len(args.registry)} registries drift from canonical")
    sys.exit(1)


def _semver_gt(a, b):
    """Strict-numeric semver compare. Returns False if either side is non-numeric (e.g. has a
    pre-release suffix) — in that case we conservatively treat it as 'not strictly ahead' so the
    gate doesn't silently allow drift that needs human review."""
    def parse(s):
        try:
            return tuple(int(x) for x in s.split("."))
        except (ValueError, AttributeError):
            return None
    pa, pb = parse(a), parse(b)
    return pa is not None and pb is not None and pa > pb


if __name__ == "__main__":
    main()
