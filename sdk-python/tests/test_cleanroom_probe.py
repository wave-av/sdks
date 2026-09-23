"""Unit guards for the clean-room isolation check in `scripts/ga/cleanroom_python_assert.py`.

WHY THESE EXIST
---------------
`cleanroom-isolation` is the load-bearing assertion of the entire registry clean-room gate:
every other check in that probe (`py-import-module`, `py-no-stdlib-shadow`) is only
meaningful if no source checkout can satisfy the import that the PUBLISHED WHEEL is
supposed to satisfy. If the isolation check is wrong, the gate can report a confident PASS
on a package that is completely broken for real users.

It WAS wrong. The check was keyed on one hardcoded path — `<sys.path entry>/sdk-python/wave`
— which was the pre-rename layout of exactly one of the two repositories the probe runs
against. After `wave` -> `wave_sdk` (ART-001) it matched nothing on any machine, so it
reported "no repo checkout on sys.path" unconditionally: a check that could not fail. That
is strictly worse than no check, because the rest of the gate's verdict rests on it.

A hardcoded-path guard has no test that would have caught this, so the fix is not just a
better path list — it is `checkout_paths_providing()`, a pure function over an explicit
sys.path, exercised below against real directory trees for BOTH repository layouts plus the
false-positive case (site-packages, where finding the module is the correct outcome). These
run offline in the normal `pytest` pass, so the guard can never again silently disarm
itself between releases.
"""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

import pytest

PROBE_PATH = Path(__file__).resolve().parents[2] / "scripts" / "ga" / "cleanroom_python_assert.py"


def _load_probe():
    """Import the GA probe by path — it is a script, not an installed module."""
    assert PROBE_PATH.is_file(), (
        f"clean-room probe not found at {PROBE_PATH}. If it moved, this test file and "
        f".github/workflows/test-python.yml's path filter must move with it."
    )
    spec = importlib.util.spec_from_file_location("_ga_cleanroom_probe", PROBE_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


probe = _load_probe()


def _make_checkout(root: Path, subroot: str, module: str) -> Path:
    """Create a source-checkout-shaped tree: <root>/<subroot>/<module>/__init__.py."""
    pkg = (root / subroot / module) if subroot else (root / module)
    pkg.mkdir(parents=True)
    (pkg / "__init__.py").write_text("")
    return pkg


# --- control: the helper can see anything at all ------------------------------------------


def test_flags_root_level_checkout_layout(tmp_path: Path):
    """`wave-av/sdk-python` layout: `wave_sdk/` sits at the repository root.

    The pre-fix guard looked only under `<entry>/sdk-python/`, so this — a checkout of the
    OTHER repository the probe runs against — was invisible to it.
    """
    _make_checkout(tmp_path, "", "wave_sdk")
    hits = probe.checkout_paths_providing([str(tmp_path)], "wave_sdk")
    assert hits, "a root-level `wave_sdk/` on sys.path must be reported as a clean-room leak"


def test_flags_nested_sdk_python_checkout_layout(tmp_path: Path):
    """`wave-av/sdks` layout: `sdk-python/wave_sdk/`. This is this repository."""
    _make_checkout(tmp_path, "sdk-python", "wave_sdk")
    hits = probe.checkout_paths_providing([str(tmp_path)], "wave_sdk")
    assert hits, "a `sdk-python/wave_sdk/` checkout on sys.path must be reported as a leak"


def test_flags_single_file_module(tmp_path: Path):
    """A leak does not have to be a package — `wave_sdk.py` shadows just as effectively."""
    (tmp_path / "wave_sdk.py").write_text("")
    hits = probe.checkout_paths_providing([str(tmp_path)], "wave_sdk")
    assert hits, "a top-level `wave_sdk.py` on sys.path must be reported as a leak"


def test_flags_the_empty_sys_path_entry_meaning_cwd(tmp_path: Path, monkeypatch):
    """`''` on sys.path means the current directory, which can absolutely be a checkout.

    The pre-fix guard skipped falsy entries outright, so `cd` into a checkout and run the
    probe and it saw nothing.
    """
    _make_checkout(tmp_path, "", "wave_sdk")
    monkeypatch.chdir(tmp_path)
    hits = probe.checkout_paths_providing([""], "wave_sdk")
    assert hits, "the '' sys.path entry (cwd) must be resolved and checked, not skipped"


# --- false-positive controls: the guard must stay usable ----------------------------------


def test_does_not_flag_the_interpreters_own_site_packages():
    """Finding the module in site-packages is the CORRECT outcome, not a leak.

    Without this exclusion the guard would fire on every legitimate run, and a guard that
    fails when everything is fine gets deleted — which is how gates die.
    """
    site_dirs = [p for p in sys.path if "site-packages" in p]
    if not site_dirs:
        pytest.skip("no site-packages on sys.path in this environment")
    for entry in site_dirs:
        assert probe.interpreter_owned(entry), (
            f"{entry} is inside the interpreter prefix and must never be treated as a "
            f"repository checkout"
        )
    assert probe.checkout_paths_providing(site_dirs, "wave_sdk") == []


def test_does_not_flag_an_unrelated_directory(tmp_path: Path):
    """A sys.path entry that cannot supply the module under test is not a leak."""
    (tmp_path / "docs").mkdir()
    assert probe.checkout_paths_providing([str(tmp_path)], "wave_sdk") == []


def test_guard_is_keyed_on_the_module_under_test(tmp_path: Path):
    """The self-maintenance property: rename the package, the guard follows it.

    A checkout of the PRE-rename layout (`wave/`) is not a leak for `import wave_sdk`, and
    a checkout of whatever the module is called today always is. This is the assertion the
    hardcoded `"wave"` literal could not make, and its absence is why the rename disarmed
    the check without a single test going red.
    """
    _make_checkout(tmp_path, "sdk-python", "wave")
    assert probe.checkout_paths_providing([str(tmp_path)], "wave_sdk") == []
    assert probe.checkout_paths_providing([str(tmp_path)], "wave") != []


def test_reported_hit_points_at_the_offending_path(tmp_path: Path):
    """The failure message has to name the leaking path, not just say something is wrong."""
    pkg = _make_checkout(tmp_path, "sdk-python", "wave_sdk")
    hits = probe.checkout_paths_providing([str(tmp_path)], "wave_sdk")
    assert [os.path.realpath(h) for h in hits] == [os.path.realpath(str(pkg))]
