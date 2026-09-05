#!/usr/bin/env python3
"""Clean-room assertions for a PyPI artifact, run INSIDE a throwaway venv.

Invoked by scripts/ga/registry-cleanroom.mjs as:
    <venv>/bin/python cleanroom_python_assert.py --dist wave-sdk --module wave_sdk --symbol Wave

It must be run with a cwd that contains no checkout of this repository, so that a source
tree can never satisfy an import the published wheel is supposed to satisfy. The script
re-verifies that itself and refuses to report a pass if the repo is importable.

Prints one JSON object on stdout. Exit code is always 0 — the caller reads `checks`
and decides. (Exiting nonzero here would be indistinguishable from an interpreter crash.)

Two distinct failure modes are separated on purpose, because they are opposite bugs:

  py-import-module    the documented import must WORK from the published artifact
  py-no-stdlib-shadow the distribution must not claim a top-level name that collides
                      with a CPython stdlib module. A collision is a latent disaster in
                      both directions: on a path where the dist wins, every consumer of
                      the stdlib module silently gets the wrong library; on a path where
                      the stdlib wins (the usual one, since the stdlib dir precedes
                      site-packages), the SDK itself becomes unreachable.
"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
import sysconfig


def realpath(p: str) -> str:
    return os.path.realpath(p) if p else ""


def check(name: str, ok: bool, detail: str) -> dict:
    return {"name": name, "ok": bool(ok), "detail": detail}


def dist_top_level(dist_name: str) -> list[str]:
    """Top-level import names the installed distribution claims.

    top_level.txt is the cheap answer but is absent from many modern wheels, so fall back
    to deriving the set from RECORD. Returns [] only when the distribution is missing.
    """
    import importlib.metadata as md

    try:
        dist = md.distribution(dist_name)
    except md.PackageNotFoundError:
        return []

    raw = None
    try:
        raw = dist.read_text("top_level.txt")
    except Exception:
        raw = None
    if raw:
        return sorted({line.strip() for line in raw.splitlines() if line.strip()})

    tops: set[str] = set()
    for f in dist.files or []:
        parts = str(f).split("/")
        if not parts or parts[0].endswith(".dist-info") or parts[0].endswith(".data"):
            continue
        if len(parts) > 1:
            tops.add(parts[0])
        elif parts[0].endswith(".py"):
            tops.add(parts[0][:-3])
    return sorted(tops)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dist", required=True, help="installed distribution name, e.g. wave-sdk")
    ap.add_argument("--module", required=True, help="documented import name, e.g. wave_sdk")
    ap.add_argument("--symbol", default=None, help="symbol the import must expose, e.g. Wave")
    args = ap.parse_args()

    stdlib_dir = realpath(sysconfig.get_paths()["stdlib"])
    site_dirs = [realpath(p) for p in sys.path if "site-packages" in p]
    checks: list[dict] = []

    # Guard: a repo checkout on sys.path would make this whole run meaningless.
    # Keyed on `args.module` (the same name the import check below uses), not a literal
    # "wave" — that literal was the pre-rename package directory name, and after the
    # `wave` -> `wave_sdk` rename (ART-001, this repo's sdk-python and the sibling
    # wave-av/sdk-python repo both moved) a hardcoded "wave" here silently stopped
    # matching either checkout's real layout, leaving this guard permanently blind
    # to the exact repo-on-sys.path leak it exists to catch.
    repo_marker_on_path = [
        p for p in sys.path
        if p and os.path.isdir(os.path.join(p, "sdk-python", args.module))
    ]
    checks.append(check(
        "cleanroom-isolation",
        not repo_marker_on_path,
        "no repo checkout on sys.path" if not repo_marker_on_path
        else f"REPO ON sys.path: {repo_marker_on_path} — results would be untrustworthy",
    ))

    # ---- py-import-module -------------------------------------------------------------
    try:
        mod = importlib.import_module(args.module)
        where = realpath(getattr(mod, "__file__", "") or "")
        from_site = any(where.startswith(s + os.sep) for s in site_dirs)
        if args.symbol and not hasattr(mod, args.symbol):
            checks.append(check(
                "py-import-module", False,
                f"`import {args.module}` succeeded but has no attribute "
                f"`{args.symbol}` (resolved to {where or '<namespace>'})",
            ))
        elif not from_site:
            checks.append(check(
                "py-import-module", False,
                f"`{args.module}` resolved to {where}, which is NOT in site-packages — "
                f"the published artifact did not provide it",
            ))
        else:
            sym = f".{args.symbol}" if args.symbol else ""
            checks.append(check(
                "py-import-module", True,
                f"`from {args.module} import {args.symbol}` OK" if args.symbol
                else f"`import {args.module}`{sym} OK -> {where}",
            ))
    except Exception as e:  # ImportError and anything the package raises at import time
        checks.append(check(
            "py-import-module", False,
            f"`import {args.module}` raised {type(e).__name__}: {str(e)[:200]}",
        ))

    # ---- py-no-stdlib-shadow ----------------------------------------------------------
    tops = dist_top_level(args.dist)
    stdlib_names = set(getattr(sys, "stdlib_module_names", set()))
    collisions = sorted(t for t in tops if t in stdlib_names)
    if not tops:
        checks.append(check(
            "py-no-stdlib-shadow", False,
            f"distribution `{args.dist}` is not installed — cannot determine top-level names",
        ))
    elif collisions:
        detail_parts = []
        for c in collisions:
            try:
                m = importlib.import_module(c)
                w = realpath(getattr(m, "__file__", "") or "")
                winner = "stdlib" if w.startswith(stdlib_dir + os.sep) else "the distribution"
                detail_parts.append(f"`{c}` (import resolves to {winner}: {w})")
            except Exception:
                detail_parts.append(f"`{c}` (unimportable)")
        checks.append(check(
            "py-no-stdlib-shadow", False,
            f"distribution `{args.dist}` claims top-level name(s) that collide with the "
            f"CPython stdlib: " + "; ".join(detail_parts),
        ))
    else:
        checks.append(check(
            "py-no-stdlib-shadow", True,
            f"top-level names {tops} do not collide with the stdlib",
        ))

    print(json.dumps({
        "dist": args.dist,
        "module": args.module,
        "python": sys.version.split()[0],
        "top_level": tops,
        "stdlib_dir": stdlib_dir,
        "site_packages": site_dirs,
        "checks": checks,
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
