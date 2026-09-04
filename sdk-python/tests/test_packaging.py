"""Distribution-level packaging guards for the `wave-av-sdk` artifact.

These tests exist because of a defect class that every other gate in this repo
misses, and that only becomes visible once the artifact is on PyPI — where it is
unfixable, because PyPI refuses a re-upload of an already-published version.

The published `wave-av-sdk==2.0.0` wheel installs a top-level package named
`wave`. CPython ships `Lib/wave.py` (WAV audio I/O) in its standard library, and
the stdlib directory sits AHEAD of `site-packages` on `sys.path`. The measured
consequences, on a clean `pip install wave-av-sdk`:

  * `import wave` resolves to the stdlib, so the SDK is unreachable — even the
    `from wave import Wave` line the README itself documented raises ImportError.
    The distribution is 100% unimportable on every supported Python.
  * On any path where site-packages precedes the stdlib (`pip install --target`,
    a PYTHONPATH entry, a zipapp), the direction inverts and the SDK shadows the
    stdlib instead: `wave.open()` disappears and unrelated audio code in the same
    environment breaks.

Neither `python -m pytest` from the checkout nor `twine check` in
`.github/workflows/publish-pypi.yml` catches this. Running pytest from the
checkout actively HIDES it: the checkout directory is `sys.path[0]`, so the local
package wins `import wave` during development regardless of what ships.

So these tests deliberately work on the BUILT ARTIFACT, installed into a throwaway
venv, executed from a working directory that contains no checkout of this repo.

Determinism note: the venv install uses `--no-deps` against the local wheel file,
so the whole suite runs offline and cannot go green (or red) because of an index
outage. `wave_av_sdk` is therefore resolved with `importlib.util.find_spec`, which
proves the installed distribution provides the name under the right path without
executing `httpx`/`pydantic` imports. `import wave` IS executed, because the
stdlib module it must resolve to has no third-party dependencies. Nothing here
skips: a build or install that fails is reported as a failure, never as a pass.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import sysconfig
import venv
import zipfile
from pathlib import Path

import pytest

SDK_ROOT = Path(__file__).resolve().parent.parent
IMPORT_NAME = "wave_av_sdk"

# Names a wheel may contain at the top level without being an importable package.
_NON_IMPORT_SUFFIXES = (".dist-info", ".data")


def _stdlib_top_level_names() -> set[str]:
    """Every name `import <name>` could resolve to from the standard library.

    `sys.stdlib_module_names` is 3.10+ and is the authoritative list; the on-disk
    scan is unioned in so the guard cannot get weaker on an interpreter whose
    stdlib carries a module the frozen list omits.
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


def _wheel_top_level_names(wheel: Path) -> set[str]:
    """Top-level importable names the wheel actually installs.

    Read from the archive rather than from `top_level.txt`, which modern wheels
    frequently omit, and rather than from the pyproject include-globs, which
    describe intent instead of the artifact. A top-level *module* (`wave.py`) is
    counted as well as a top-level *package* (`wave/__init__.py`) — a py_modules
    declaration shadows the stdlib exactly as effectively as a package does.
    """
    names: set[str] = set()
    with zipfile.ZipFile(wheel) as zf:
        for entry in zf.namelist():
            head = entry.split("/")[0]
            if head.endswith(_NON_IMPORT_SUFFIXES):
                continue
            if "/" in entry:
                names.add(head)
            elif head.endswith(".py"):
                names.add(head[:-3])
    return names


#: Directories that must never be copied into the pristine build tree. `build/`
#: is the important one: setuptools copies the package into `build/lib/` and does
#: NOT prune names that have gone away, so a stale `build/lib/wave` from an
#: earlier build is silently baked into every later wheel. `.gitignore` hides
#: `build/`, so `git status` looks clean while the artifact is wrong — measured
#: on this very rename, where the wheel kept shipping `wave` after the source
#: rename was complete.
_BUILD_DEBRIS = {"build", "dist", "__pycache__", ".pytest_cache", ".mypy_cache", ".git"}


def _pristine_source_tree(dest: Path) -> Path:
    """Copy the project to `dest` without any previous build's leftovers."""

    def ignore(directory: str, entries: list[str]) -> set[str]:
        return {e for e in entries if e in _BUILD_DEBRIS or e.endswith(".egg-info")}

    shutil.copytree(SDK_ROOT, dest, ignore=ignore)
    return dest


@pytest.fixture(scope="session")
def built_wheel(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Build a real wheel from a pristine copy of this checkout.

    The copy matters: building in place would let a stale `build/lib/` from an
    earlier build contribute packages the source tree no longer has, which is
    exactly how a rename can look complete in git while the wheel still ships
    the old name.

    Tries a no-isolation build first so the common case needs no network; falls
    back to pip's isolated build when setuptools is absent from the running
    interpreter. A build that fails both ways raises — it is never skipped, since
    "we could not build the artifact" is a defect report, not a pass.
    """
    outdir = tmp_path_factory.mktemp("wheelhouse")
    source = _pristine_source_tree(tmp_path_factory.mktemp("pristine") / "src")
    attempts = (
        ["--no-deps", "--no-build-isolation", "--wheel-dir", str(outdir), str(source)],
        ["--no-deps", "--wheel-dir", str(outdir), str(source)],
    )
    failures = []
    for args in attempts:
        proc = subprocess.run(
            [sys.executable, "-m", "pip", "wheel", *args],
            capture_output=True,
            text=True,
        )
        wheels = list(outdir.glob("*.whl"))
        if proc.returncode == 0 and wheels:
            return wheels[0]
        failures.append(f"`pip wheel {' '.join(args)}` exited {proc.returncode}\n{proc.stderr[-2000:]}")
    raise AssertionError("could not build a wheel from " f"{SDK_ROOT}:\n\n" + "\n\n".join(failures))


@pytest.fixture(scope="session")
def installed_venv(tmp_path_factory: pytest.TempPathFactory, built_wheel: Path) -> Path:
    """A throwaway venv with the built wheel installed and nothing else."""
    venv_dir = tmp_path_factory.mktemp("cleanvenv") / "v"
    venv.EnvBuilder(with_pip=True, clear=True).create(venv_dir)
    python = venv_dir / ("Scripts" if sys.platform == "win32" else "bin") / "python"
    proc = subprocess.run(
        [str(python), "-m", "pip", "install", "--no-deps", "--no-index", str(built_wheel)],
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, f"installing {built_wheel.name} into a clean venv failed:\n{proc.stderr[-2000:]}"
    return venv_dir


def _probe(venv_dir: Path, cwd: Path) -> dict:
    """Run the import probe inside the venv, from a cwd with no checkout in it."""
    python = venv_dir / ("Scripts" if sys.platform == "win32" else "bin") / "python"
    script = """
import importlib.util, json, sysconfig, os
out = {}
spec = importlib.util.find_spec("wave_av_sdk")
out["sdk_found"] = spec is not None
out["sdk_origin"] = getattr(spec, "origin", None) if spec else None
import wave
out["wave_file"] = os.path.realpath(wave.__file__)
out["wave_has_open"] = hasattr(wave, "open")
out["stdlib_dir"] = os.path.realpath(sysconfig.get_paths()["stdlib"])
out["purelib"] = os.path.realpath(sysconfig.get_paths()["purelib"])
# `python -c` puts '' (the current directory) at sys.path[0], so the directory
# that could shadow the installed wheel is the process cwd. Report it resolved.
out["cwd"] = os.path.realpath(os.getcwd())
print(json.dumps(out))
"""
    proc = subprocess.run(
        [str(python), "-c", script],
        capture_output=True,
        text=True,
        cwd=str(cwd),
    )
    assert proc.returncode == 0, f"import probe failed inside the clean venv:\n{proc.stdout}\n{proc.stderr}"
    return json.loads(proc.stdout)


@pytest.fixture(scope="session")
def probe(tmp_path_factory: pytest.TempPathFactory, installed_venv: Path) -> dict:
    elsewhere = tmp_path_factory.mktemp("elsewhere")
    return _probe(installed_venv, elsewhere)


def test_probe_ran_outside_any_checkout_of_this_repo(probe: dict) -> None:
    """Control: prove the probe's cwd cannot satisfy an import the wheel should satisfy.

    Without this, running the suite from the repo root would let the checkout's
    own package answer every import below and turn the whole file into a test
    that can never fail.
    """
    cwd = Path(probe["cwd"]).resolve()
    sdk_root = SDK_ROOT.resolve()
    assert cwd != sdk_root, "the import probe ran from inside the checkout it is meant to test"
    assert sdk_root not in cwd.parents, f"probe cwd {cwd} is inside the checkout at {sdk_root}"
    for shadowing in ("wave", IMPORT_NAME):
        assert not (cwd / shadowing).exists(), (
            f"probe cwd {cwd} contains a `{shadowing}` directory, which sys.path[0] would let "
            f"answer the imports the installed wheel is supposed to answer"
        )


def test_built_wheel_ships_the_sdk_package(built_wheel: Path) -> None:
    """Control for the shadow test: prove the wheel scan sees a package at all.

    A bug that made `_wheel_top_level_names()` return an empty set would silently
    turn `test_built_wheel_ships_no_stdlib_shadowing_top_level` into a vacuous
    pass. This asserts the scan is looking at a real, populated artifact.
    """
    names = _wheel_top_level_names(built_wheel)
    assert names, f"{built_wheel.name} declares no top-level importable name at all"
    assert IMPORT_NAME in names, (
        f"{built_wheel.name} does not ship the `{IMPORT_NAME}` package; it ships {sorted(names)}"
    )


def test_built_wheel_ships_no_stdlib_shadowing_top_level(built_wheel: Path) -> None:
    """No top-level name in the artifact may collide with a stdlib module name.

    This is the assertion that fails on `wave-av-sdk==2.0.0`: it ships `wave`,
    and CPython ships `Lib/wave.py`.
    """
    collisions = sorted(_wheel_top_level_names(built_wheel) & _stdlib_top_level_names())
    assert collisions == [], (
        f"{built_wheel.name} ships top-level name(s) {collisions} that collide with the "
        f"CPython standard library. The stdlib precedes site-packages on sys.path, so a "
        f"user who runs `pip install wave-av-sdk` can never import them; and on any path "
        f"where site-packages wins instead, the distribution silently replaces the stdlib "
        f"module for every other package in the environment. Rename the package."
    )


def test_installed_sdk_is_importable_from_a_clean_venv(probe: dict) -> None:
    """`import wave_av_sdk` must resolve, from the installed wheel, outside the repo."""
    assert probe["sdk_found"], (
        f"`import {IMPORT_NAME}` does not resolve after installing the built wheel into a "
        f"clean venv. This is the published 2.0.0 defect: the distribution provides no "
        f"module under its own name."
    )
    origin = Path(probe["sdk_origin"]).resolve()
    purelib = Path(probe["purelib"]).resolve()
    assert purelib in origin.parents, (
        f"`{IMPORT_NAME}` resolved to {origin}, which is not inside the clean venv's "
        f"site-packages at {purelib} — the probe is reading something other than the "
        f"installed artifact."
    )


def test_import_wave_still_resolves_to_the_standard_library(probe: dict) -> None:
    """`import wave` in an environment holding this SDK must still be CPython's stdlib.

    The other half of the defect. A user who installs this SDK must not lose the
    stdlib `wave` module that unrelated code in the same environment depends on.
    """
    resolved = Path(probe["wave_file"]).resolve()
    stdlib_dir = Path(probe["stdlib_dir"]).resolve()
    purelib = Path(probe["purelib"]).resolve()

    assert stdlib_dir in resolved.parents, (
        f"`import wave` resolved to {resolved}, not the CPython standard library at "
        f"{stdlib_dir}. This distribution is shadowing a stdlib module."
    )
    assert purelib not in resolved.parents, (
        f"`import wave` resolved into site-packages at {resolved} — an installed "
        f"distribution has taken over the stdlib `wave` name."
    )
    assert probe["wave_has_open"], (
        "`wave.open` is missing, so the resolved `wave` is not the stdlib WAV module "
        "even though it sits on the stdlib path."
    )
