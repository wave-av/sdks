# @wave-av/workflow-sdk

[![npm version](https://img.shields.io/npm/v/@wave-av/workflow-sdk.svg)](https://www.npmjs.com/package/@wave-av/workflow-sdk)
[![npm downloads](https://img.shields.io/npm/dm/@wave-av/workflow-sdk.svg)](https://www.npmjs.com/package/@wave-av/workflow-sdk)
[![license](https://img.shields.io/npm/l/@wave-av/workflow-sdk.svg)](./LICENSE)

SDK for building and executing workflows on the WAVE platform. The source lives here, in
`wave-av/sdks` at `sdk-typescript/packages/workflow-sdk`.

## Status: the Workflow API is not served yet

`WorkflowBuilder` and the Zod schemas work today, locally. The HTTP client does not have a
server to talk to yet: `https://api.wave.online` does not serve the `/v1/workflows` and
`/v1/executions` routes this client calls, and answers each of them `404 ROUTE_NOT_MAPPED`.
None of them is in the published WAVE API contract. The contract's only workflow operation
is `POST /v1/workflow-engine`, which is a draft and is not served either.

Until a Workflow API ships, every client method rejects with a `WorkflowApiError` whose
`code` is `ROUTE_NOT_MAPPED` and whose `requestId` you can quote to WAVE support. The client
never reports a refusal as a success. `WORKFLOW_ROUTES` lists every route it calls, and
`scripts/live-smoke.mjs` re-checks them against the gateway.

## Installation

```bash
npm install @wave-av/workflow-sdk
# or
yarn add @wave-av/workflow-sdk
# or
pnpm add @wave-av/workflow-sdk
```

Zod is a regular dependency (the same `^4.4.3` range as `@wave-av/adk`), so the package
installs next to either zod 3 or zod 4 in your project.

## Quick start

```typescript
import { WaveWorkflowClient, WorkflowApiError } from '@wave-av/workflow-sdk';

// Create a client (throws WAVE_ERR_MISSING_API_KEY if the key is empty)
const client = new WaveWorkflowClient({
  apiKey: process.env.WAVE_API_KEY!,
  organizationId: 'org_123',
});

try {
  // Execute a workflow
  const execution = await client.execute('my-workflow', {
    input_params: {
      environment: 'production',
    },
  });
  console.log('Execution started:', execution.id);

  // Wait for completion
  const result = await client.waitForCompletion(execution.id);
  console.log('Result:', result.status);
} catch (error) {
  if (error instanceof WorkflowApiError) {
    // Today: 404 ROUTE_NOT_MAPPED (see "Status" above)
    console.error(error.status, error.code, error.requestId);
  } else {
    throw error;
  }
}
```

## Building workflows

Use the fluent builder API to create workflow definitions:

```typescript
import { WorkflowBuilder } from '@wave-av/workflow-sdk';

const workflow = new WorkflowBuilder('data-pipeline')
  .name('Data Processing Pipeline')
  .description('ETL pipeline for processing analytics data')
  .category('data-processing')
  .version('1.0.0')
  .tags('etl', 'analytics')
  .phase('extract', (phase) =>
    phase
      .description('Extract data from source systems')
      .agent('data-extractor', { source: 'api', endpoint: '/data' })
  )
  .phase('transform', (phase) =>
    phase
      .description('Transform and validate data')
      .agent('data-transformer', { format: 'json' })
      .onFailure('retry')
  )
  .phase('load', (phase) =>
    phase
      .description('Load data to destination')
      .agent('data-loader', { destination: 'database' })
  )
  .timeout(3600)
  .enableCheckpoints()
  .maxRetries(3)
  .build();

// Export as JSON
console.log(JSON.stringify(workflow, null, 2));
```

## API reference

### WaveWorkflowClient

#### Constructor options

```typescript
const client = new WaveWorkflowClient({
  apiKey: string;           // Required: API key, sent only in the Authorization header
  organizationId: string;   // Required: Organization ID for tenant isolation
  baseUrl?: string;         // Optional: API base URL (default: https://api.wave.online; https unless localhost)
  timeout?: number;         // Optional: Request timeout in ms (default: 30000)
  debug?: boolean;          // Optional: Log method and URL of each request (never credentials)
  webSocketFactory?: (url, { headers }) => WebSocket; // Optional: see "Real-time events"
});
```

#### Methods

##### Workflow definitions

```typescript
// Get a workflow by slug
const workflow = await client.getWorkflow('my-workflow');

// List all workflows
const { workflows, total } = await client.listWorkflows({
  category: 'devops',
  status: 'active',
  limit: 10,
});
```

##### Executions

```typescript
// Execute a workflow
const execution = await client.execute('my-workflow', {
  input_params: { key: 'value' },
  idempotency_key: 'unique-key',
});

// Get execution status
const status = await client.getExecution(execution.id);

// List executions
const { executions } = await client.listExecutions({
  workflow_id: 'workflow-id',
  status: 'running',
  limit: 20,
});

// Cancel an execution
await client.cancelExecution(execution.id);

// Pause an execution
await client.pauseExecution(execution.id);

// Resume a paused execution
await client.resumeExecution(execution.id);

// Retry a failed execution
await client.retryExecution(execution.id, { from_checkpoint: true });
```

##### Convenience methods

```typescript
// Wait for completion with progress callback
const result = await client.waitForCompletion(execution.id, {
  pollInterval: 2000,  // Poll every 2 seconds
  timeout: 3600000,    // 1 hour timeout
  onProgress: (exec) => {
    console.log(`Status: ${exec.status}, Phase: ${exec.current_phase}`);
  },
});

// Execute and wait in one call
const result = await client.executeAndWait('my-workflow', {
  input_params: { key: 'value' },
});
```

##### Logs

```typescript
// Get execution logs
const { logs } = await client.getLogs(execution.id, {
  level: 'error',
  limit: 100,
});
```

##### Real-time events

The API key is sent in the WebSocket handshake's `Authorization` header. It is never put in
the URL, where proxies, CDNs and access logs would record it. Node.js 22+ and Bun do this
with their built-in `WebSocket`. On Node.js 18/20, pass a factory from the `ws` package:

```typescript
import WebSocket from 'ws';

const client = new WaveWorkflowClient({
  apiKey: process.env.WAVE_API_KEY!,
  organizationId: 'org_123',
  webSocketFactory: (url, { headers }) => new WebSocket(url, { headers }),
});
```

Browsers cannot set WebSocket headers, so `subscribeToExecution` throws
`WAVE_ERR_WEBSOCKET_UNSUPPORTED` there. Keep the long-lived API key on your server and
subscribe from it.

```typescript
// Subscribe to execution events
const unsubscribe = client.subscribeToExecution(execution.id);

client.on('execution.started', (event) => {
  console.log('Execution started:', event);
});

client.on('phase.completed', (event) => {
  console.log('Phase completed:', event.data.phase_name);
});

client.on('execution.completed', (event) => {
  console.log('Execution completed in', event.data.duration_ms, 'ms');
  unsubscribe();
});

client.on('error', (error) => {
  console.error('Error:', error);
});
```

## Types

All TypeScript types are exported from the package:

```typescript
import type {
  WorkflowDefinition,
  WorkflowPhase,
  WorkflowAgent,
  WorkflowConfig,
  WorkflowExecution,
  ExecutionStatus,
  ExecutionLog,
  AnyWorkflowEvent,
} from '@wave-av/workflow-sdk';
```

## Validation

The SDK includes Zod schemas for runtime validation:

```typescript
import { WorkflowDefinitionSchema } from '@wave-av/workflow-sdk/types';

const result = WorkflowDefinitionSchema.safeParse(workflowData);
if (!result.success) {
  console.error('Validation errors:', result.error.issues);
}
```

## Error handling

Two error classes tell "the API said no" apart from "no request was sent":

- `WorkflowApiError`: the gateway answered with a non-2xx status. It has `status`, `code`
  (the gateway's machine-readable code, e.g. `ROUTE_NOT_MAPPED`, `AUTH_INVALID_KEY`,
  `SCOPE_INSUFFICIENT`), `requestId`, `docUrl`, `route` (e.g. `GET /v1/workflows`) and the raw
  `body`. Its message still starts with `API error (<status>)`, as in 1.0.x.
- `WorkflowClientError`: the client stopped before any network I/O. `code` is one of
  `WAVE_ERR_MISSING_API_KEY`, `WAVE_ERR_INVALID_ARGUMENT` (for example an empty or `..` id),
  `WAVE_ERR_WEBSOCKET_UNSUPPORTED` or `WAVE_ERR_TIMEOUT`.

Neither error ever contains the API key.

```typescript
import { WorkflowApiError, WorkflowClientError } from '@wave-av/workflow-sdk';

try {
  const execution = await client.execute('my-workflow');
} catch (error) {
  if (error instanceof WorkflowApiError) {
    console.error(`${error.route} -> ${error.status} ${error.code} (request ${error.requestId})`);
  } else if (error instanceof WorkflowClientError && error.code === 'WAVE_ERR_TIMEOUT') {
    console.error('Request timed out');
  } else {
    throw error;
  }
}
```

## Live check

`scripts/live-smoke.mjs` calls every GET route through the built client against the live
gateway, after two controls (`GET /v1/network/surface` and an authenticated
`GET /v1/billing/usage`). It refuses any non-GET request, so it cannot change anything.

```bash
pnpm build && WAVE_API_KEY=... pnpm smoke:live            # report
pnpm build && WAVE_API_KEY=... pnpm smoke:live -- --strict # exit 1 while any route is unserved
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `WAVE_API_KEY` | API key for authentication |
| `WAVE_ORGANIZATION_ID` | Organization ID for tenant isolation |
| `WAVE_API_URL` | Optional: Custom API base URL |

## Related packages

- [@wave-av/sdk](https://www.npmjs.com/package/@wave-av/sdk) — TypeScript SDK (34 API modules)
- [@wave-av/adk](https://www.npmjs.com/package/@wave-av/adk) — Agent Developer Kit
- [@wave-av/mcp-server](https://www.npmjs.com/package/@wave-av/mcp-server) — MCP server for AI tools
- [@wave-av/cli](https://www.npmjs.com/package/@wave-av/cli) — Command-line interface

## API contract

The WAVE API contract and the capability index list every route the gateway serves:
[gateway.wave.online/.well-known/wave-skills.json](https://gateway.wave.online/.well-known/wave-skills.json).

## Maturity

`@wave-av/workflow-sdk` is in **private-preview**. Track changes in [CHANGELOG.md](./CHANGELOG.md).

## Support

Report issues at [github.com/wave-av/sdks/issues](https://github.com/wave-av/sdks/issues).

## Verify Install

Once OIDC trusted-publisher binding lands, every CI publish emits Sigstore provenance attestations.

```bash
npm audit signatures @wave-av/workflow-sdk
```

See the [wave-av/sdks](https://github.com/wave-av/sdks) repository for security + provenance details.

## License

Apache-2.0. See [LICENSE](./LICENSE).
