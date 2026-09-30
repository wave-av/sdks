# WAVE SDK for Python: this directory is not the published SDK

The supported Python SDK is **`wave-sdk`**. Its source, releases and documentation live in
[github.com/wave-av/sdk-python](https://github.com/wave-av/sdk-python).

```bash
pip install wave-sdk
```

```python
import os

from wave_sdk import Wave

client = Wave(api_key=os.environ["WAVE_API_KEY"])
manifests = client.pricing.list_manifests()   # GET /v1/pricing/manifests, a free read
```

This call works on every `wave-sdk` release from 2.2.0 on, so it runs whichever version
`pip install wave-sdk` resolves.

Quickstart, namespace table, error handling and changelog:
[wave-av/sdk-python README](https://github.com/wave-av/sdk-python#readme).

## Why this directory still exists

`sdk-python/` built the PyPI distribution **`wave-av-sdk`**. Every `wave-av-sdk` release on PyPI
is yanked, so `pip install wave-av-sdk` fails with "No matching distribution found". The
pipeline that published it (`.github/workflows/publish-pypi.yml`) is disabled unless the
`MONOREPO_NPM_PYPI_PUBLISH` repository variable is `true`, and it must stay disabled. The source
stays because this repository's `test-python` workflow still installs and tests it.

If you installed `wave-av-sdk`, switch to `wave-sdk`:

```bash
pip uninstall -y wave-av-sdk
pip install wave-sdk
```

The import name is the same (`wave_sdk`). If your code still has `from wave import Wave`, change
it to `from wave_sdk import Wave`: the old `wave` top-level package collided with the Python
standard library's `wave` module and could never be imported.

## License

Apache-2.0 - WAVE Online, LLC. See [LICENSE](LICENSE).
