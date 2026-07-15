# @wave-av/kernel

The **one** shared Kernel cloud-browser client for WAVE. A thin, typed wrapper
over [`@onkernel/sdk`](https://www.npmjs.com/package/@onkernel/sdk) pinned to the
`api.onkernel.com` host. Every WAVE consumer talks to Kernel through
`WaveKernel`, never the raw SDK — so telemetry, resilience, and auth live in one
place.

The client always targets `https://api.onkernel.com/` (the SDK default) and
never the legacy `api.kernel.sh` host.

## Install

```bash
pnpm add @wave-av/kernel
```

## Usage

```typescript
import { WaveKernel, withTelemetry } from '@wave-av/kernel';

const kernel = new WaveKernel({ apiKey: process.env.KERNEL_API_KEY });

// `withTelemetry` opts a browser session into WAVE's default CDP telemetry
// categories (console + network + page; screenshot stays off).
const browser = await kernel.browsers.create(withTelemetry({}));
```

`WaveKernel` re-exposes the full 0.78 SDK resource surface as typed passthrough
getters (`browsers`, `invocations`, `browserPools`, `profiles`, `credentials`,
`credentialProviders`, `apiKeys`, `projects`, `auth`, `proxies`, `deployments`,
`apps`, `organization`, `auditLogs`, `extensions`). Use `kernel.raw` only as an
escape hatch to the underlying SDK client.

## Configuration

| Option        | Default                       | Notes                                            |
| ------------- | ----------------------------- | ------------------------------------------------ |
| `apiKey`      | `process.env.KERNEL_API_KEY`  | Kernel API key.                                  |
| `baseURL`     | `https://api.onkernel.com/`   | Override only for testing.                        |
| `projectID`   | —                             | Optional project scope applied to all requests.  |
| `timeoutMs`   | `30000`                       | Request timeout in milliseconds.                 |
| `resilience`  | —                             | Slice-2 seams (see below).                       |

## Resilience seams

The `resilience` hooks (circuit breaker, request signer, error capture) are
**inert seams** in slice 1 — the interfaces exist so slice-2 wiring can drop in
without changing the public surface. Passing them today is a no-op.

## License

Apache-2.0
