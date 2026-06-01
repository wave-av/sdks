# Changelog

All notable changes to @wave-av/mcp-server will be documented in this file.

## [Unreleased]

### Added
- `wave_gateway_call` tool — generic escape hatch to invoke any WAVE gateway `/v1`
  endpoint with standard `WAVE_API_KEY` auth + rate-limit awareness, for routes not
  covered by a dedicated tool. Auth/scope enforced server-side at the gateway.
- SSRF-safe `normalizeGatewayPath()` validator (rejects absolute URLs, protocol-relative
  `//host`, and any path escaping the `/v1` mount) + unit tests.
- `WAVE_API_BASE` accepted as a back-compat alias for `WAVE_BASE_URL` in `getBaseUrl()`.

## [0.1.8] - 2026-04-03

### Added
- Troubleshooting section in README
- Related packages section with cross-links to WAVE ecosystem
- Improved npm description for search discoverability
- GitHub topics for repository discoverability

### Fixed
- Author field standardized to "WAVE Online, LLC <sdk@wave.online>"
- Keywords expanded for npm search (7+ per package)
