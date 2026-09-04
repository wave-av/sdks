"""
Registry license-truth tests.

These guard the one license question no in-repo gate can answer: does the artifact that is
actually on PyPI carry the license this source tree declares?

The defect they were written against, reproducible from the public index on 2026-09-03:

    $ curl -s https://pypi.org/pypi/wave-av-sdk/2.0.0/json | jq -r '.info.license'
    MIT
    $ grep '^license' sdk-python/pyproject.toml
    license = {text = "Apache-2.0"}

`wave-av-sdk 2.0.0` was published as MIT; the source declared Apache-2.0 at that same version
string. PyPI releases are immutable, so the correction could never reach a user and the next
tag push would have died on `400 File already exists`. The fix is a version bump; these tests
are what stop the collision from coming back.

Offline by construction: the registry snapshot is a checked-in fixture captured from pypi.org,
so CI needs no network and cannot go red because an index is having a bad afternoon.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = PACKAGE_ROOT / "scripts" / "registry_license_truth.py"
FIXTURE = PACKAGE_ROOT / "tests" / "fixtures" / "pypi_wave_av_sdk.json"


def _load_module():
    spec = importlib.util.spec_from_file_location("registry_license_truth", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["registry_license_truth"] = module
    spec.loader.exec_module(module)
    return module


rlt = _load_module()


@pytest.fixture
def snapshot() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# The real defect
# ---------------------------------------------------------------------------


def test_the_2_0_0_collision_is_blocking(snapshot):
    """Source at 2.0.0 against the real snapshot must fail, and say why, twice.

    This is the load-bearing test. If it ever stops producing both violations, the gate has
    stopped seeing the defect that shipped.
    """
    source = {
        "name": "wave-av-sdk",
        "version": "2.0.0",
        "declared_spdx": "Apache-2.0",
        "classifier_spdx": ["Apache-2.0"],
    }
    violations = rlt.check_release_readiness(source, snapshot)
    codes = {v["code"] for v in violations if v["blocking"]}

    assert "version-already-published" in codes, (
        "2.0.0 is on the index; a build of 2.0.0 can never be uploaded"
    )
    assert "same-version-license-drift" in codes, (
        "2.0.0 is published as MIT while the source declares Apache-2.0 at the same version"
    )
    drift = next(v for v in violations if v["code"] == "same-version-license-drift")
    assert "MIT" in drift["message"] and "Apache-2.0" in drift["message"]


def test_bumping_the_version_clears_the_block(snapshot):
    """2.0.1 is uploadable, and the 2.0.0 drift survives as immutable history."""
    source = {
        "name": "wave-av-sdk",
        "version": "2.0.1",
        "declared_spdx": "Apache-2.0",
        "classifier_spdx": ["Apache-2.0"],
    }
    violations = rlt.check_release_readiness(source, snapshot)

    assert [v for v in violations if v["blocking"]] == [], (
        "nothing blocks a release at a version the index does not have"
    )
    historical = [v for v in violations if v["code"] == "historical-license-drift"]
    assert len(historical) == 1, "the published 2.0.0 MIT release must stay visible"
    assert historical[0]["blocking"] is False, (
        "an immutable past release must not fail the gate forever"
    )


def test_a_self_contradicting_source_is_blocking(snapshot):
    """A pyproject whose classifier disagrees with its own license field never ships."""
    source = {
        "name": "wave-av-sdk",
        "version": "9.9.9",
        "declared_spdx": "Apache-2.0",
        "classifier_spdx": ["MIT"],
    }
    violations = rlt.check_release_readiness(source, snapshot)
    assert any(
        v["code"] == "source-classifier-mismatch" and v["blocking"] for v in violations
    ), "declaring Apache-2.0 beside an MIT trove classifier must fail"


# ---------------------------------------------------------------------------
# The live tree — this is the gate
# ---------------------------------------------------------------------------


def test_this_package_can_actually_be_published():
    """The real pyproject against the real snapshot: no blocking violation.

    This is the assertion that would have caught the release failure before the tag was pushed.
    """
    source = rlt.read_source_metadata(PACKAGE_ROOT / "pyproject.toml")
    snapshot = json.loads(FIXTURE.read_text(encoding="utf-8"))
    blocking = [v for v in rlt.check_release_readiness(source, snapshot) if v["blocking"]]
    assert blocking == [], "\n".join(f"{v['code']}: {v['message']}" for v in blocking)


def test_source_metadata_reads_the_real_pyproject():
    source = rlt.read_source_metadata(PACKAGE_ROOT / "pyproject.toml")
    assert source["name"] == "wave-av-sdk"
    assert source["declared_spdx"] == "Apache-2.0"
    assert source["classifier_spdx"] == ["Apache-2.0"], (
        "exactly one license classifier, and it must agree with the license field"
    )


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def test_regex_fallback_matches_tomllib():
    """The 3.10 path must read the same values as the 3.11+ path.

    CI runs a 3.10 leg where `tomllib` does not exist. A fallback that disagreed with tomllib
    would make the gate's verdict depend on the interpreter.
    """
    tomllib = pytest.importorskip("tomllib", reason="reference parser needs Python >= 3.11")
    text = (PACKAGE_ROOT / "pyproject.toml").read_text(encoding="utf-8")

    reference = tomllib.loads(text)["project"]
    fallback = rlt._parse_pyproject_with_regex(text)

    assert fallback["name"] == reference["name"]
    assert fallback["version"] == reference["version"]
    assert fallback["license"] == reference["license"]["text"]
    assert fallback["classifiers"] == reference["classifiers"]


def test_regex_fallback_ignores_tool_tables():
    """`[tool.*]` sections must not leak into the `[project]` read."""
    text = (
        '[project]\n'
        'name = "pkg"\n'
        'version = "1.2.3"\n'
        'license = {text = "Apache-2.0"}\n'
        'classifiers = ["License :: OSI Approved :: Apache Software License"]\n'
        '\n[tool.black]\n'
        'name = "not-the-project-name"\n'
        'version = "9.9.9"\n'
    )
    parsed = rlt._parse_pyproject_with_regex(text)
    assert parsed["name"] == "pkg"
    assert parsed["version"] == "1.2.3"
    assert parsed["license"] == "Apache-2.0"


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("MIT", "MIT"),
        ("Apache-2.0", "Apache-2.0"),
        ("Apache Software License", "Apache-2.0"),
        ("License :: OSI Approved :: MIT License", "MIT"),
        ("License :: OSI Approved :: Apache Software License", "Apache-2.0"),
        ("", "UNKNOWN"),
        (None, "UNKNOWN"),
        ("Proprietary — all rights reserved", "UNKNOWN"),
    ],
)
def test_normalize_license(raw, expected):
    assert rlt.normalize_license(raw) == expected


def test_unknown_licenses_never_claim_agreement(snapshot):
    """An unreadable license must not be reported as matching — silence is not agreement."""
    source = {
        "name": "wave-av-sdk",
        "version": "3.0.0",
        "declared_spdx": "UNKNOWN",
        "classifier_spdx": [],
    }
    violations = rlt.check_release_readiness(source, snapshot)
    assert not any(v["code"] == "historical-license-drift" for v in violations), (
        "UNKNOWN must not be compared as if it were a real license"
    )


def test_published_spdx_prefers_expression_then_field_then_classifier():
    assert rlt.published_spdx({"license_expression": "Apache-2.0", "license": "MIT"}) == "Apache-2.0"
    assert rlt.published_spdx({"license_expression": None, "license": "MIT"}) == "MIT"
    assert (
        rlt.published_spdx(
            {"license_classifiers": ["License :: OSI Approved :: Apache Software License"]}
        )
        == "Apache-2.0"
    )
    assert rlt.published_spdx({}) == "UNKNOWN"


@pytest.mark.parametrize(
    "left,right",
    [("2.0.0", "2.0.1"), ("2.0.9", "2.1.0"), ("1.9.9", "2.0.0")],
)
def test_parse_version_orders_releases(left, right):
    assert rlt.parse_version(left) < rlt.parse_version(right)


# ---------------------------------------------------------------------------
# Fixture integrity
# ---------------------------------------------------------------------------


def test_snapshot_records_the_published_mit_release(snapshot):
    """Guard the evidence itself: this fixture is the receipt for the defect."""
    assert snapshot["name"] == "wave-av-sdk"
    assert "2.0.0" in snapshot["releases"]
    assert snapshot["per_version"]["2.0.0"]["license"] == "MIT", (
        "captured from pypi.org — if this ever changes, PyPI stopped being immutable"
    )
