# Changelog

All notable changes to @wave-av/workflow-sdk will be documented in this file.

## [1.1.0] - Unreleased

### Security
- `subscribeToExecution` no longer puts the API key in the WebSocket URL
  (`?token=<key>`), where proxies, CDNs and access logs record it. The key now goes in
  the handshake's `Authorization` header: through the global `WebSocket` on Node.js 22+
  and Bun, or through the new `webSocketFactory` option (e.g. the `ws` package on Node.js
  18/20). Runtimes that cannot send headers (browsers) get
  `WorkflowClientError('WAVE_ERR_WEBSOCKET_UNSUPPORTED')` instead of a connection.
- Path parameters (`slug`, `executionId`) are URL-encoded, and empty, `.` and `..` values
  are rejected before any request, so an id cannot redirect a request to another route.
- `baseUrl` must be https (plain http only for localhost) and must not carry credentials.

### Fixed
- Installing next to zod 4 no longer fails with `ERESOLVE` (`peer zod@"^3.22.0"`). Zod is
  now a dependency (`^4.4.3`, the range `@wave-av/adk` uses) instead of a peer, and the
  schemas use the two-argument `z.record` form.
- An empty `apiKey` throws `WAVE_ERR_MISSING_API_KEY` instead of sending `Bearer undefined`.
- `VERSION` reported `1.0.0`; a unit test now keeps it equal to `package.json`.
- The npm homepage pointed at a docs page that returns 404; it now points at this README.

### Added
- `WorkflowApiError` (`status`, `code`, `requestId`, `docUrl`, `route`, `body`) for every
  non-2xx answer. Its message keeps the `API error (<status>)` prefix of 1.0.x.
- `WorkflowClientError` for failures before any network I/O, including timeouts.
- `WORKFLOW_ROUTES`: every route the client calls, in one table.
- `scripts/live-smoke.mjs`: a GET-only check of those routes against the live gateway.
- Unit tests (`vitest`), and a CI workflow that builds, type-checks and tests the package.

### Known limitation
- The WAVE gateway does not serve the Workflow API yet. Every client method rejects with
  `WorkflowApiError` code `ROUTE_NOT_MAPPED` (see the README "Status" section).

## [1.0.5] - 2026-04-03

### Added
- Troubleshooting section in README
- Related packages section with cross-links to WAVE ecosystem
- Improved npm description for search discoverability
- GitHub topics for repository discoverability

### Fixed
- Author field standardized to "WAVE Online, LLC <sdk@wave.online>"
- Keywords expanded for npm search (7+ per package)
