"""
Packaging / distribution-metadata guards.

These tests exist because of a class of defect that NO other gate in this repo caught
offline, and that only became visible once the package was on PyPI — where it is
unfixable, since PyPI refuses a re-upload of an already-published version.

Every published `wave-av-sdk` release through `2.0.1` shipped a top-level package named
`wave`. CPython's standard library ships `Lib/wave.py` (WAV audio I/O), and the stdlib
directory sits AHEAD of `site-packages` on `sys.path`. So `import wave` in a fresh
`pip install wave-av-sdk` resolved to the stdlib module and the entire SDK was
unreachable — the artifact was 100% unimportable via its own documented entry point, on
every Python version (`scripts/ga/registry-cleanroom.mjs` in this repo proved this
against the live PyPI artifact: `py-import-module` / `py-no-stdlib-shadow`, both FAIL on
`wave-av-sdk@2.0.0`). The repo checkout hid it during development: the checkout
directory is first on `sys.path`, so the local `wave/` package won `import wave` under
pytest, and `pip install -e .` (an editable install, which also just points back at the
checkout) hid it in CI too — neither ever exercised a real built-and-installed wheel.

`.github/workflows/test-python.yml` (the `smoke-install` job) guards the same class at
the wheel level: build -> fresh venv -> install -> import using this repo's own
`scripts/ga/cleanroom_python_assert.py`, the exact probe the GA gate runs against the
live registry. These tests are the cheap, always-on half: they fail at PR time, in the
normal unit run, before a wheel is ever built.

Guarded here:
  1. No top-level package this repo ships may shadow a stdlib module name.
  2. `import wave` (bare) must still resolve to the stdlib, from inside the checkout.
  3. `wave_sdk.__version__` must equal `[project] version` in pyproject.toml.
  4. `[project] name` must still be the distribution name README/CHANGELOG promise.
"""

from __future__ import annotations

import sys
import sysconfig
from pathlib import Path

try:  # tomllib is stdlib from 3.11; tomli is the dev-extra fallback below that.
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - exercised on 3.10 only
    import tomli as tomllib

REPO_ROOT = Path(__file__).resolve().parent.parent
PYPROJECT = REPO_ROOT / "pyproject.toml"


def _pyproject() -> dict:
    with PYPROJECT.open("rb") as fh:
        return tomllib.load(fh)


def _stdlib_top_level_names() -> set[str]:
    """Every name `import <name>` could resolve to from the standard library.

    `sys.stdlib_module_names` is 3.10+ (this package's floor), so that alone would
    suffice, but the on-disk scan is unioned in too: it costs nothing and it means this
    guard does not silently get weaker if it is ever backported below 3.10.
    """
    names = set(sys.builtin_module_names)
    names |= set(getattr(sys, "stdlib_module_names", ()))
    stdlib_dir = Path(sysconfig.get_paths()["stdlib"])
    if stdlib_dir.is_dir():
        for entry in stdlib_dir.iterdir():
            if entry.suffix == ".py":
                names.add(entry.stem)
            elif entry.is_dir() and (entry / "__init__.py").exists():
                names.add(entry.name)
    return names


def _shipped_top_level_packages() -> list[str]:
    """Top-level importable packages in the checkout that setuptools will ship.

    Derived from the filesystem (any root-level directory with an `__init__.py`) rather
    than from the pyproject include-glob (`wave_sdk*`), because the failure mode being
    guarded is exactly someone re-adding a directory the glob would sweep up — reading
    the glob back would make this test agree with the very config that could regress.
    `tests`, `scripts` and `examples` are excluded: none is in
    `[tool.setuptools.packages.find] include`, so none is ever part of the distribution.
    """
    skip = {"tests", "scripts", "examples"}
    return sorted(
        p.name
        for p in REPO_ROOT.iterdir()
        if p.is_dir()
        and not p.name.startswith((".", "_"))
        and p.name not in skip
        and (p / "__init__.py").exists()
    )


def test_repo_ships_the_wave_sdk_package():
    """Control for the shadow test below: prove the scan sees anything at all.

    Without this, a bug that made `_shipped_top_level_packages()` return `[]` would turn
    the shadow guard into a test that can never fail.
    """
    assert "wave_sdk" in _shipped_top_level_packages()


def test_no_shipped_package_shadows_a_stdlib_module():
    """A distribution package named after a stdlib module is permanently unimportable.

    site-packages comes AFTER the stdlib on sys.path, so the stdlib always wins.
    """
    stdlib = _stdlib_top_level_names()
    collisions = [name for name in _shipped_top_level_packages() if name in stdlib]
    assert collisions == [], (
        f"top-level package(s) {collisions} collide with a Python standard-library "
        f"module name. The stdlib precedes site-packages on sys.path, so a user who "
        f"runs `pip install wave-av-sdk` could never import them. Rename the package "
        f"(this is exactly the defect that shipped as wave-av-sdk 2.0.0's `wave`)."
    )


def test_import_wave_still_resolves_to_the_standard_library():
    """The specific regression: re-adding a top-level `wave/` here would break users.

    Run from the repo checkout, the checkout is first on sys.path — so if a `wave/`
    package reappears, this assertion fails HERE, which is the one place the old bug
    was invisible (both under pytest and under `pip install -e .`).
    """
    import wave  # noqa: F401 - imported for its resolved location, not its API

    stdlib_dir = Path(sysconfig.get_paths()["stdlib"]).resolve()
    resolved = Path(wave.__file__).resolve()
    assert stdlib_dir in resolved.parents, (
        f"`import wave` resolved to {resolved}, not the standard library at "
        f"{stdlib_dir}. A top-level `wave` package has been reintroduced."
    )
    assert REPO_ROOT not in resolved.parents, f"`import wave` resolved into this repo: {resolved}"


def test_dunder_version_matches_pyproject_version():
    """`wave_sdk.__version__` is what users print; pyproject is what PyPI records.

    A hardcoded literal in a test (or in `__init__.py` itself) can drift from
    `pyproject.toml` with no build-time signal — this reads pyproject back rather than
    encoding the expected value, so it fails the moment the two disagree either way.
    """
    import wave_sdk

    assert wave_sdk.__version__ == _pyproject()["project"]["version"]


def test_distribution_name_is_wave_av_sdk():
    """`pip install wave-av-sdk` is what README/CHANGELOG currently promise."""
    assert _pyproject()["project"]["name"] == "wave-av-sdk"
