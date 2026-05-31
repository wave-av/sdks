# @wave-av/mcp-server

[![npm version](https://img.shields.io/npm/v/@wave-av/mcp-server.svg)](https://www.npmjs.com/package/@wave-av/mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@wave-av/mcp-server.svg)](https://www.npmjs.com/package/@wave-av/mcp-server)
[![license](https://img.shields.io/npm/l/@wave-av/mcp-server.svg)](https://github.com/wave-av/mcp-server/blob/main/LICENSE)

MCP (Model Context Protocol) server that exposes WAVE streaming APIs as tools for AI coding assistants and autonomous agents.

**WAVE is the AI video layer** — the open MVP protocol parallel to Stripe's payments rails. This MCP server is the agent-facing surface: discover streams, negotiate per-second access, deliver media, and persist EU AI Act Article 26 receipts.

## Quick start

```bash
npx @wave-av/mcp-server
```

### Agentic media in 4 calls

```typescript
// 1. Discover available streams (no auth — public)
mvp_discover({ kind: 'stream', accept_codec: ['video/h264'] })

// 2. Request a vault token via /v1/acp/delegate_payment
mvp_request_resource({ resource_id: 'stream_abc123', amount_cents: 50 })

// 3. Pull a time-limited delivery URL
mvp_request_delivery({ resource_id: 'stream_abc123', protocol: 'hls' })

// 4. List Article 26 receipts (5-year retention)
mvp_list_receipts({ kind: 'inference', limit: 25 })
```

Full agent flow: `packages/sdk-typescript/examples/agent-commerce/mvp-stream-consume.ts`.
Open spec: <https://wave.online/docs/agentic-media/mvp-spec>.

## Setup

### 1. Get an API key

```bash
# Via CLI
wave auth login

# Or create at https://wave.online/settings/api-keys
```

### 2. Configure your AI tool

Add to your `.mcp.json` (Claude Code, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "wave": {
      "command": "npx",
      "args": ["-y", "@wave-av/mcp-server"],
      "env": {
        "WAVE_API_KEY": "wave_live_..."
      }
    }
  }
}
```

## Available tools

### Agentic media (AI agent video layer)

| Tool                     | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `mvp_discover`           | Discover available streams/inference/storage. No auth required.   |
| `mvp_request_resource`   | Request vault token via `/v1/acp/delegate_payment`.            |
| `mvp_request_delivery`   | Pull time-limited HLS/DASH/WebRTC URL with vault token.            |
| `mvp_list_receipts`      | List Article 26 receipts (5-year retention, EU AI Act compliant). |

See `docs/specs/mvp-machine-video-protocol-v1.md` for the open spec.

### Streams

| Tool                     | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `wave_list_streams`      | List all streams with pagination and status filtering |
| `wave_create_stream`     | Create a new stream with protocol and privacy options |
| `wave_start_stream`      | Start streaming on an existing stream                 |
| `wave_stop_stream`       | Stop an active stream                                 |
| `wave_get_stream_health` | Get real-time health metrics for a stream             |

### Studio

| Tool                     | Description                          |
| ------------------------ | ------------------------------------ |
| `wave_list_productions`  | List studio production sessions      |
| `wave_create_production` | Create a new multi-camera production |

### Analytics

| Tool                      | Description                             |
| ------------------------- | --------------------------------------- |
| `wave_get_viewers`        | Get current viewer count and breakdown  |
| `wave_get_stream_metrics` | Get detailed stream performance metrics |

### Billing

| Tool                    | Description                              |
| ----------------------- | ---------------------------------------- |
| `wave_get_subscription` | Get current subscription plan and status |
| `wave_get_usage`        | Get current period usage and limits      |

## Resources

Access WAVE entities directly via the `wave://` URI scheme:

- `wave://streams/{id}` - Stream configuration and status
- `wave://productions/{id}` - Studio production details

## Environment variables

| Variable        | Required | Default               | Description       |
| --------------- | -------- | --------------------- | ----------------- |
| `WAVE_API_KEY`  | Yes      | -                     | Your WAVE API key |
| `WAVE_BASE_URL` | No       | `https://api.wave.online` | API base URL      |

## Setup for other AI tools

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "wave": {
      "command": "npx",
      "args": ["-y", "@wave-av/mcp-server"],
      "env": { "WAVE_API_KEY": "wave_live_..." }
    }
  }
}
```

### Windsurf

Add to Windsurf MCP settings with the same configuration.

## Troubleshooting

### Server not starting

Verify your API key is set:

```bash
echo $WAVE_API_KEY
```

### Tools not appearing

Restart your AI tool after adding the MCP configuration. Most tools require a restart to detect new MCP servers.

### Connection errors

The MCP server uses stdio transport (no network listener). If you see connection errors, check that `npx` can run successfully:

```bash
npx @wave-av/mcp-server --version
```

### Testing the server

Send a JSON-RPC initialize request to verify:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | npx @wave-av/mcp-server
```

## Related packages

- [@wave-av/sdk](https://www.npmjs.com/package/@wave-av/sdk) — TypeScript SDK (34 API modules)
- [@wave-av/adk](https://www.npmjs.com/package/@wave-av/adk) — Agent Developer Kit
- [@wave-av/cli](https://www.npmjs.com/package/@wave-av/cli) — Command-line interface
- [@wave-av/create-app](https://www.npmjs.com/package/@wave-av/create-app) — Scaffold a new project
- [OpenAPI spec](https://github.com/wave-av/api-spec) — Full API specification

## Development

```bash
cd packages/mcp-server
pnpm install
pnpm run build
pnpm run dev       # Watch mode
pnpm run type-check
```

## License

MIT

## API Reference

See [docs.wave.online/sdk/mcp-server](https://docs.wave.online/sdk/mcp-server) for the complete API reference.

## Maturity

`@wave-av/mcp-server` is in **private-preview**. Per [maturity-language-policy.md](../../.claude/rules/80-copywriting/maturity-language-policy.md). Track changes in [CHANGELOG.md](./CHANGELOG.md).

## Support

Report issues at [github.com/wave-av/wave-surfer-connect/issues](https://github.com/wave-av/wave-surfer-connect/issues).

## Verify Install

Once OIDC trusted-publisher binding lands, every CI publish emits Sigstore provenance attestations.

```bash
npm audit signatures @wave-av/mcp-server
```

See [docs/security/verify-npm-package.md](../../docs/security/verify-npm-package.md).

## License

MIT — see [LICENSE](./LICENSE).
