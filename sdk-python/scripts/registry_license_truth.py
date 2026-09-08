#!/usr/bin/env python3
"""
registry_license_truth — does the artifact on the registry carry the license the source declares?

WHY THIS EXISTS
---------------
Every license gate in this fleet compares one *declaration* to another declaration, or a
declaration to the LICENSE file sitting beside it. Neither can see the defect that actually
reached users, because that defect lives on the registry:

    $ curl -s https://pypi.org/pypi/wave-av-sdk/2.0.0/json | jq -r '.info.license'
    MIT
    $ grep '^license' sdk-python/pyproject.toml
    license = {text = "Apache-2.0"}

Both statements are true at the same time. `wave-av-sdk 2.0.0` is on PyPI carrying
`License: MIT`, and `sdk-python/pyproject.toml` declares `Apache-2.0` at that same version
string `2.0.0`. PyPI releases are immutable — a version can never be re-uploaded — so the
Apache-2.0 correction cannot reach a single user while the source still says `2.0.0`, and the
next `sdk-python-v*` tag push would build `2.0.0` and die on `400 File already exists`.

So this gate reads the *published* metadata and compares it to the source, and it draws the
line where the immutability of a registry puts it:

  * **Blocking** — the version the source is about to publish is ALREADY published, and/or the
    already-published artifact at that exact version string declares a different license. This
    is unfixable-by-upload and must stop a release.
  * **Reported, not blocking** — a strictly OLDER published version disagrees with what the
    source declares today. That is immutable history. It is real and it is worth printing, but
    failing on it forever would make the gate permanently red and therefore ignored.

USAGE
-----
    python3 scripts/registry_license_truth.py                     # offline, uses the checked-in snapshot
    python3 scripts/registry_license_truth.py --json              # machine-readable
    python3 scripts/registry_license_truth.py --refresh           # re-fetch the snapshot from PyPI

Exit 0 when no blocking violation is found, 1 otherwise.

Dependency-free and stdlib-only on purpose: this monorepo has no root package.json and the
python leg of CI runs a 3.10 matrix, where `tomllib` does not exist yet.
"""

from __future__ import annotations

import argparse
import datetime
import json
import re
import sys
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PYPROJECT = PACKAGE_ROOT / "pyproject.toml"
DEFAULT_SNAPSHOT = PACKAGE_ROOT / "tests" / "fixtures" / "pypi_wave_av_sdk.json"

PYPI_JSON_URL = "https://pypi.org/pypi/{name}/json"

# ---------------------------------------------------------------------------
# SPDX normalisation
# ---------------------------------------------------------------------------

# PyPI carries the license in three different shapes depending on how old the release is and
# which build backend produced it: the free-text `License:` field, the modern
# `License-Expression:` field, and the `License :: OSI Approved :: ...` trove classifiers.
# All three have to be reduced to one SPDX-ish token before they can be compared.
_CLASSIFIER_TO_SPDX = {
    "License :: OSI Approved :: MIT License": "MIT",
    "License :: OSI Approved :: Apache Software License": "Apache-2.0",
    "License :: OSI Approved :: BSD License": "BSD-3-Clause",
    "License :: OSI Approved :: ISC License (ISCL)": "ISC",
    "License :: OSI Approved :: Mozilla Public License 2.0 (MPL 2.0)": "MPL-2.0",
    "License :: OSI Approved :: GNU General Public License v3 (GPLv3)": "GPL-3.0-only",
    "License :: OSI Approved :: GNU Lesser General Public License v3 (LGPLv3)": "LGPL-3.0-only",
    "License :: OSI Approved :: GNU Affero General Public License v3": "AGPL-3.0-only",
}

_FREETEXT_TO_SPDX = (
    # Ordered: Apache is tested before MIT because the Apache-2.0 appendix contains the word
    # "MIT" nowhere but its boilerplate is often pasted next to an MIT header in drifted repos.
    (re.compile(r"apache", re.I), "Apache-2.0"),
    (re.compile(r"\bmit\b", re.I), "MIT"),
    (re.compile(r"mozilla|\bmpl\b", re.I), "MPL-2.0"),
    (re.compile(r"\bisc\b", re.I), "ISC"),
    (re.compile(r"\bbsd\b", re.I), "BSD-3-Clause"),
    (re.compile(r"\bagpl", re.I), "AGPL-3.0-only"),
    (re.compile(r"\blgpl", re.I), "LGPL-3.0-only"),
    (re.compile(r"\bgpl", re.I), "GPL-3.0-only"),
)


def normalize_license(value: str | None) -> str:
    """Reduce any of PyPI's three license shapes to one comparable token.

    Returns "UNKNOWN" for anything unrecognised — never guesses, because a wrong guess here
    would silently mark a real contradiction as agreement.
    """
    if not value or not str(value).strip():
        return "UNKNOWN"
    text = str(value).strip()
    if text in _CLASSIFIER_TO_SPDX:
        return _CLASSIFIER_TO_SPDX[text]
    # An exact SPDX id already (e.g. "Apache-2.0", "MIT").
    if re.fullmatch(r"[A-Za-z0-9.+-]+", text):
        for canonical in set(_CLASSIFIER_TO_SPDX.values()):
            if text.lower() == canonical.lower():
                return canonical
    for pattern, spdx in _FREETEXT_TO_SPDX:
        if pattern.search(text):
            return spdx
    return "UNKNOWN"


# ---------------------------------------------------------------------------
# Version comparison
# ---------------------------------------------------------------------------


def parse_version(version: str) -> tuple[int, ...]:
    """Parse a dotted numeric version into a comparable tuple.

    Only the numeric release segment is compared; any pre/post/dev suffix is dropped. That is
    sufficient here — this gate answers "is this exact string already taken" and "is that other
    release older than mine", not full PEP 440 ordering.
    """
    numbers = re.findall(r"\d+", str(version).split("+")[0])
    return tuple(int(n) for n in numbers) or (0,)


# ---------------------------------------------------------------------------
# Source metadata
# ---------------------------------------------------------------------------


def _parse_pyproject_with_regex(text: str) -> dict:
    """Minimal `[project]`-table extractor for Python 3.10, which has no `tomllib`.

    Reads only the four scalar/array fields this gate needs. Deliberately not a TOML parser —
    it is scoped to the exact keys, so it cannot silently mis-read the rest of the file.
    """
    project = text.split("[project]", 1)[-1]
    # Stop at the next top-level table so `[tool.*]` sections cannot leak in.
    project = re.split(r"\n\[(?!project\.)", project, maxsplit=1)[0]

    def scalar(key: str) -> str | None:
        m = re.search(rf'^\s*{key}\s*=\s*["\']([^"\']*)["\']', project, re.M)
        return m.group(1) if m else None

    name = scalar("name")
    version = scalar("version")

    # license = {text = "Apache-2.0"}  or  license = "Apache-2.0"
    license_value = scalar("license")
    if license_value is None:
        m = re.search(r'^\s*license\s*=\s*\{[^}]*text\s*=\s*["\']([^"\']*)["\']', project, re.M)
        license_value = m.group(1) if m else None

    classifiers: list[str] = []
    m = re.search(r"^\s*classifiers\s*=\s*\[(.*?)\]", project, re.M | re.S)
    if m:
        classifiers = re.findall(r'["\']([^"\']+)["\']', m.group(1))

    return {
        "name": name,
        "version": version,
        "license": license_value,
        "classifiers": classifiers,
    }


def read_source_metadata(pyproject_path: Path | str = DEFAULT_PYPROJECT) -> dict:
    """Read name/version/license/license-classifiers out of a pyproject.toml.

    Uses `tomllib` where it exists (Python >= 3.11) and the scoped regex reader on 3.10, so the
    gate behaves identically across the whole CI matrix without adding a dependency.
    """
    text = Path(pyproject_path).read_text(encoding="utf-8")
    try:
        import tomllib

        project = tomllib.loads(text).get("project", {})
        raw_license = project.get("license")
        if isinstance(raw_license, dict):
            raw_license = raw_license.get("text")
        parsed = {
            "name": project.get("name"),
            "version": project.get("version"),
            "license": raw_license,
            "classifiers": list(project.get("classifiers", [])),
        }
    except ModuleNotFoundError:  # pragma: no cover - only taken on Python 3.10
        parsed = _parse_pyproject_with_regex(text)

    license_classifiers = [c for c in parsed["classifiers"] if c.startswith("License ::")]
    return {
        "name": parsed["name"],
        "version": parsed["version"],
        "license": parsed["license"],
        "license_classifiers": license_classifiers,
        "declared_spdx": normalize_license(parsed["license"]),
        "classifier_spdx": [normalize_license(c) for c in license_classifiers],
    }


# ---------------------------------------------------------------------------
# The check
# ---------------------------------------------------------------------------


def published_spdx(entry: dict) -> str:
    """The license a published release actually declares, from whichever field carries it."""
    for key in ("license_expression", "license"):
        spdx = normalize_license(entry.get(key))
        if spdx != "UNKNOWN":
            return spdx
    for classifier in entry.get("license_classifiers", []):
        spdx = normalize_license(classifier)
        if spdx != "UNKNOWN":
            return spdx
    return "UNKNOWN"


def check_release_readiness(source: dict, snapshot: dict) -> list[dict]:
    """Compare source metadata against a registry snapshot.

    Returns a list of violations, each a dict with `code`, `blocking` and `message`. Blocking
    violations are the ones a release must not proceed through; non-blocking ones are immutable
    history that is reported so it stays visible.
    """
    violations: list[dict] = []
    source_version = source.get("version")
    source_spdx = source.get("declared_spdx", "UNKNOWN")
    releases = list(snapshot.get("releases", []))
    per_version = snapshot.get("per_version", {})
    name = snapshot.get("name") or source.get("name")

    # 0. The source must agree with itself before it is worth comparing to anything else.
    for classifier_spdx in source.get("classifier_spdx", []):
        if classifier_spdx != source_spdx:
            violations.append(
                {
                    "code": "source-classifier-mismatch",
                    "blocking": True,
                    "message": (
                        f"pyproject declares license {source_spdx!r} but carries a "
                        f"{classifier_spdx!r} trove classifier — the wheel would ship both"
                    ),
                }
            )

    # 1. The immutability rule. A version already on the index can never be replaced.
    if source_version in releases:
        published = per_version.get(source_version, {})
        published_license = published_spdx(published)
        violations.append(
            {
                "code": "version-already-published",
                "blocking": True,
                "message": (
                    f"{name} {source_version} is already on the index (published as "
                    f"{published_license}); PyPI releases are immutable, so this build can "
                    f"never be uploaded — bump the version"
                ),
            }
        )
        if published_license != source_spdx and "UNKNOWN" not in (published_license, source_spdx):
            violations.append(
                {
                    "code": "same-version-license-drift",
                    "blocking": True,
                    "message": (
                        f"{name} {source_version} is published as {published_license} but the "
                        f"source declares {source_spdx} at that SAME version string — the "
                        f"license correction cannot reach a user without a version bump"
                    ),
                }
            )

    # 2. Older releases that disagree. Immutable, so reported rather than failed.
    source_tuple = parse_version(source_version or "0")
    for version in releases:
        if version == source_version:
            continue
        if parse_version(version) >= source_tuple:
            continue
        published_license = published_spdx(per_version.get(version, {}))
        if published_license != source_spdx and "UNKNOWN" not in (published_license, source_spdx):
            violations.append(
                {
                    "code": "historical-license-drift",
                    "blocking": False,
                    "message": (
                        f"{name} {version} is published as {published_license} while the source "
                        f"now declares {source_spdx}; that release is immutable and stays as "
                        f"published"
                    ),
                }
            )

    return violations


# ---------------------------------------------------------------------------
# Snapshot I/O
# ---------------------------------------------------------------------------


def load_snapshot(path: Path | str = DEFAULT_SNAPSHOT) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def fetch_snapshot(name: str) -> dict:
    """Read-only, unauthenticated GET of a package's public PyPI metadata.

    Only used behind `--refresh`. Never called from the test suite, so CI stays deterministic
    and offline.
    """
    import urllib.request

    url = PYPI_JSON_URL.format(name=name)
    with urllib.request.urlopen(url, timeout=30) as response:  # noqa: S310 - literal https URL
        payload = json.loads(response.read().decode("utf-8"))

    releases = sorted(payload.get("releases", {}), key=parse_version)
    per_version: dict[str, dict] = {}
    for version in releases:
        with urllib.request.urlopen(  # noqa: S310 - literal https URL
            f"https://pypi.org/pypi/{name}/{version}/json", timeout=30
        ) as response:
            info = json.loads(response.read().decode("utf-8"))["info"]
        per_version[version] = {
            "license": info.get("license"),
            "license_expression": info.get("license_expression"),
            "license_classifiers": [
                c for c in info.get("classifiers", []) if c.startswith("License ::")
            ],
            "summary": info.get("summary"),
            "repository": (info.get("project_urls") or {}).get("Repository"),
        }

    return {
        "name": payload["info"]["name"],
        "source": url,
        "latest_version": payload["info"]["version"],
        "releases": releases,
        "per_version": per_version,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--pyproject", default=str(DEFAULT_PYPROJECT))
    parser.add_argument("--snapshot", default=str(DEFAULT_SNAPSHOT))
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="re-fetch the registry snapshot from pypi.org before checking, and rewrite it",
    )
    parser.add_argument("--json", action="store_true", help="emit machine-readable output")
    args = parser.parse_args(argv)

    source = read_source_metadata(args.pyproject)

    if args.refresh:
        snapshot = fetch_snapshot(source["name"])
        snapshot["captured_utc"] = datetime.datetime.now(datetime.timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        Path(args.snapshot).write_text(
            json.dumps(snapshot, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
    else:
        snapshot = load_snapshot(args.snapshot)

    violations = check_release_readiness(source, snapshot)
    blocking = [v for v in violations if v["blocking"]]

    if args.json:
        print(
            json.dumps(
                {
                    "source": source,
                    "snapshot_captured_utc": snapshot.get("captured_utc"),
                    "violations": violations,
                    "ok": not blocking,
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        label = f"{source['name']} {source['version']} declares {source['declared_spdx']}"
        published = ", ".join(
            f"{v}={published_spdx(snapshot.get('per_version', {}).get(v, {}))}"
            for v in snapshot.get("releases", [])
        )
        print(f"source:    {label}")
        print(f"published: {published or '(nothing on the index yet)'}")
        if not violations:
            print("OK — the source license agrees with every published artifact.")
        for violation in violations:
            mark = "FAIL" if violation["blocking"] else "note"
            print(f"  [{mark}] {violation['code']}: {violation['message']}")
        if blocking:
            print(f"\n{len(blocking)} blocking license/version violation(s).")

    return 1 if blocking else 0


if __name__ == "__main__":
    sys.exit(main())
