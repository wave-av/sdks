# Agentic-Media MCP Consolidation

**Decision date:** 2026-05-02
**Plan task:** #220 (AVL-P5-SETUP-5 "Bootstrap packages/wave-agentic-media-mcp package")

## Resolution

The original plan called for a separate `@wave-av/wave-agentic-media-mcp`
npm package. We consolidated those tools into the existing
`@wave-av/mcp-server` package instead.

## Why consolidate

1. **Single distribution surface** — agents installing the WAVE MCP server
   get all 19+ tools (streaming, agentic-media, MVP protocol) in one
   `npm install @wave-av/mcp-server`. No need to coordinate version drift
   across two packages.

2. **Shared infrastructure** — both tool surfaces rely on the same
   `largeTextContent()` helper, the same auth flow, the same Argus event
   emission. Two packages would duplicate this.

3. **Lower discovery friction** — listing two packages on agents.md and
   docs.wave.online is more confusing than one package with grouped tools.

4. **Atomic releases** — when MVP protocol or streaming SDK ships an update,
   one publish cycle covers both tool surfaces.

## What was already shipped (#191, #250)

Per task #191 (`Create MCP tool mvp_request_resource in packages/mcp-server`)
and task #250 (`Promote wave-agentic-media-mcp README quick-start`), the
agentic-media tools live in `@wave-av/mcp-server`:

- `mvp_discover` — discover available agentic-media resources
- `mvp_request_resource` — request vault token via `/v1/acp/delegate_payment`
- `mvp_request_delivery` — pull time-limited HLS/DASH/WebRTC URL with vault token
- `mvp_list_receipts` — list MVP receipts for an agent
- (plus 15+ streaming tools)

## Consequence for plan task #220

Closed as **consolidated into existing package**. No separate package
created. Future Sessions-2026 vendor-pending tools (Visa, Mastercard, BNPL,
Privy upgrades) will also live in `@wave-av/mcp-server` rather than
spawning per-vendor packages.

## Reject alternative — separate package

We considered a thin meta-package that re-exports from `@wave-av/mcp-server`.
Rejected because:
- Adds dependency complexity
- Forces consumers to choose between two packages
- Provides no real isolation benefit
- Marketing doesn't need a separate npm name; documentation can group
  tools by category

## Related

- `packages/mcp-server/README.md` — Quick-start with agentic-media examples
- `packages/mcp-server/src/tools/agentic-media/` — Tool implementations
- ADR-0140 — Master Sessions-2026 integration plan
