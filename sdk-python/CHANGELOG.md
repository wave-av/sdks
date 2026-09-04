# wave-av-sdk Changelog

> This directory builds the PyPI package **`wave-av-sdk`** (`[project] name` in
> `pyproject.toml`). This file was previously headed "wave-sdk Changelog", which is a
> *different* package published from a different repository (`wave-av/sdk-python`). The two
> are not the same distribution and their version numbers are unrelated.

## 3.0.0 (2026-09-04)

### Fixed (ART-001 — GA registry clean-room acceptance)

- **The importable top-level module is now `wave_sdk`, not `wave`.** Every release through
  `2.0.1` shipped a distribution whose only top-level name was `wave`, which collides with the
  CPython stdlib module of the same name (`wave` ∈ `sys.stdlib_module_names`). Because the
  stdlib directory precedes site-packages on `sys.path`, `import wave` in a real installation
  always resolved to the stdlib WAV-file reader, never to this SDK — the documented
  `from wave import Wave` entry point could not succeed for any customer. `scripts/ga/
  registry-cleanroom.mjs` in `wave-av/sdks` proved this against the live PyPI artifact
  (`py-no-stdlib-shadow` / `py-import-module`, both FAIL on `wave-av-sdk@2.0.0`).
  Renamed `wave/` -> `wave_sdk/` and every internal absolute import
  (`from wave.X import` -> `from wave_sdk.X import`). Public API is otherwise unchanged
  (`from wave_sdk import Wave`). This is a correctness fix, not a break of a working
  integration, and the major version bump reflects the import-path change, not a functional
  regression — there is no prior version where the old import path actually worked.
- This fix is **source-only in this commit**. It reaches PyPI only on the next
  `sdk-python-v*` tag publish (`.github/workflows/publish-pypi.yml`), which is an
  operator-gated action (PyPI Trusted Publisher + `pypi-publish` environment
  required-reviewer). Until that publish happens, `registry-cleanroom` will continue to report
  `wave-av-sdk@2.0.0 py-import-module` / `py-no-stdlib-shadow` as FAIL, correctly, because it
  tests what PyPI actually serves — not this checkout.

## 2.0.1 (2026-09-03)

### Fixed

- **License metadata now reaches the index.** `pyproject.toml` declares `Apache-2.0`, but the
  only release on PyPI — `wave-av-sdk 2.0.0` — was published carrying `License: MIT` and the
  MIT trove classifier. PyPI releases are immutable, so that correction could never reach a
  user while the source still said `2.0.0`, and the next `sdk-python-v*` tag push would have
  built `2.0.0` and failed on `400 File already exists`. Bumped to `2.0.1` so the Apache-2.0
  metadata can actually ship. The published `2.0.0` stays as published; it cannot be changed.

### Added

- `scripts/registry_license_truth.py` — compares this package's declared license and version
  against what is actually on PyPI, and fails when the version is already taken or when a
  release at the same version string declares a different license. Covered by
  `tests/test_registry_license_truth.py`, which runs offline against a checked-in snapshot of
  the real registry response.

## 2.0.0 (2026-04-05)

### Added

- **PipelineAPI** - Live stream management
- **StudioAPI** - Multi-camera production
- **FleetAPI** - Desktop Node fleet management
- **GhostAPI** - AI automatic directing
- **MeshAPI** - Multi-region failover
- **EdgeAPI** - CDN and edge workers
- **PulseAPI** - Analytics and BI
- **PrismAPI** - Virtual Device Bridge
- **ZoomAPI** - Zoom integration
- **VaultAPI** - Recording storage
- **MarketplaceAPI** - Templates/plugins
- **ConnectAPI** - Integration management
- **DistributionAPI** - Social simulcasting
- **DesktopAPI** - Desktop Node app
- **SignageAPI** - Digital signage
- **QrAPI** - Dynamic QR codes
- **AudienceAPI** - Polls/Q&A/reactions
- **CreatorAPI** - Monetization
- **PodcastAPI** - Podcast production
- **SlidesAPI** - Slides-to-video
- **UsbAPI** - USB device relay
- **PhoneAPI** - Voice calling
- **CollabAPI** - Collaboration rooms
- **CaptionsAPI** - Auto-captions
- **ChaptersAPI** - Video chapters
- **StudioAIAPI** - AI assistant
- **TranscribeAPI** - Transcription
- **SentimentAPI** - Sentiment analysis
- **SearchAPI** - Content search
- **SceneAPI** - Scene detection
- Full `WAVE` convenience class with all 33 APIs

### Changed

- SDK coverage expanded from 5 to 33 modules
- Full parity with TypeScript SDK

## 1.0.0

### Added

- Initial release: ClipsAPI, EditorAPI, VoiceAPI
- Base WaveClient with auth, retry, rate limiting
