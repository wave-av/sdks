#!/usr/bin/env node
/**
 * Live smoke test for @wave-av/workflow-sdk against the real WAVE gateway.
 *
 * Read-only by construction: `fetch` is wrapped so any method other than GET
 * throws before it leaves the process. POST routes are listed as "not probed".
 *
 *   pnpm build && WAVE_API_KEY=... node scripts/live-smoke.mjs [--strict]
 *
 * 1. Controls: GET /v1/network/surface must answer 200 (the gateway is up and
 *    reachable) and the authenticated GET /v1/billing/usage must answer 200 (the
 *    key is accepted), so a refusal below is about the route, not the key.
 * 2. Each HTTP GET route in WORKFLOW_ROUTES is called through the built client.
 *    The report shows the HTTP status, the gateway code and the request id the
 *    SDK surfaced, i.e. what a customer would see. The WebSocket events route
 *    (subscribeToExecution) is excluded: it is an upgrade, not a GET, and is
 *    reported as "not probed".
 *
 * WAVE_API_URL is validated by the SDK's own client constructor (https only,
 * plain http for localhost) BEFORE any request, so the key is never sent to an
 * unvalidated destination.
 *
 * Exit code: 0 when the controls pass and every probe got a gateway answer that
 * the SDK surfaced as a typed result or WorkflowApiError. With --strict, also 1
 * while any route answers ROUTE_NOT_MAPPED / ROUTE_NOT_FOUND (flip this on in CI
 * once a Workflow API is served).
 *
 * The API key is read from WAVE_API_KEY and is never printed.
 */
import { WaveWorkflowClient, WorkflowApiError, WORKFLOW_ROUTES } from '../dist/index.mjs';

const strict = process.argv.includes('--strict');
const apiKey = process.env.WAVE_API_KEY ?? '';
if (!apiKey) {
  console.error('live-smoke: WAVE_API_KEY is not set');
  process.exit(2);
}

// Build the client first: its constructor rejects a non-https (non-localhost)
// baseUrl, credentials, a query or a fragment. Nothing below sends the key to
// a URL that has not passed that check.
let client;
try {
  client = new WaveWorkflowClient({
    apiKey,
    organizationId: process.env.WAVE_ORGANIZATION_ID ?? '',
    baseUrl: process.env.WAVE_API_URL ?? 'https://api.wave.online',
  });
} catch (error) {
  console.error(`live-smoke: ${error?.message ?? error}`);
  process.exit(2);
}
const BASE = (process.env.WAVE_API_URL ?? 'https://api.wave.online').replace(/\/+$/, '');

const realFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET') throw new Error(`live-smoke guard: refusing ${method} (GET-only)`);
  return realFetch(input, init);
};

let failed = false;

const control = await fetch(`${BASE}/v1/network/surface`);
console.log(`control GET /v1/network/surface -> ${control.status} (rid ${control.headers.get('x-request-id') ?? '-'})`);
if (control.status !== 200) {
  console.error('live-smoke: control failed; the gateway is not reachable, so no route result below means anything');
  process.exit(1);
}
// Authenticated control: proves the key is accepted, so a refusal below is about the route, not the key.
const authed = await fetch(`${BASE}/v1/billing/usage`, { headers: { Authorization: `Bearer ${apiKey}` } });
console.log(`control GET /v1/billing/usage (authed) -> ${authed.status} (rid ${authed.headers.get('x-request-id') ?? '-'})`);
if (authed.status !== 200) {
  console.error('live-smoke: the API key was not accepted by an authenticated control route');
  process.exit(1);
}

const probes = {
  listWorkflows: () => client.listWorkflows({ limit: 1 }),
  getWorkflow: () => client.getWorkflow('live-smoke-nonexistent'),
  listExecutions: () => client.listExecutions({ limit: 1 }),
  getExecution: () => client.getExecution('live-smoke-nonexistent'),
  getLogs: () => client.getLogs('live-smoke-nonexistent', { limit: 1 }),
};

for (const [name, route] of Object.entries(WORKFLOW_ROUTES)) {
  const probe = probes[name];
  if (!probe) {
    const why = name === 'subscribeToExecution' ? 'WebSocket upgrade, not an HTTP GET' : 'GET-only smoke';
    console.log(`skip  ${route.method} ${route.path} (not probed: ${why})`);
    continue;
  }
  try {
    await probe();
    console.log(`ok    ${route.method} ${route.path} -> 2xx (served)`);
  } catch (error) {
    if (!(error instanceof WorkflowApiError)) {
      failed = true;
      console.log(`FAIL  ${route.method} ${route.path} -> untyped ${error?.name}: ${error?.message}`);
      continue;
    }
    const unserved = error.code === 'ROUTE_NOT_MAPPED' || error.code === 'ROUTE_NOT_FOUND';
    if (unserved && strict) failed = true;
    const tag = unserved ? 'unsrv' : 'answr';
    console.log(`${tag} ${route.method} ${route.path} -> ${error.status} ${error.code ?? '-'} (rid ${error.requestId ?? '-'})`);
  }
}

process.exit(failed ? 1 : 0);
