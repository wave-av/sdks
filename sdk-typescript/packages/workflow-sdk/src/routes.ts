/**
 * Every HTTP route the Workflow client calls, in one table.
 *
 * Contract status (probed 2026-09-30 against https://api.wave.online): none of
 * these routes is in the published WAVE OpenAPI contract, and the gateway
 * answers each of them `404 ROUTE_NOT_MAPPED`. The contract's only workflow
 * operation is `POST /v1/workflow-engine` (draft schema, scope
 * `workflow-engine:write`), which is not served yet either. Until a Workflow API
 * ships, every client method rejects with a `WorkflowApiError` carrying that
 * code. `scripts/live-smoke.mjs` re-checks this table against the gateway.
 *
 * Path parameters are written `{name}` and are URL-encoded by `buildPath`.
 */

import { WorkflowClientError } from './errors';

export const WORKFLOW_ROUTES = {
  getWorkflow: { method: 'GET', path: '/v1/workflows/{slug}' },
  listWorkflows: { method: 'GET', path: '/v1/workflows' },
  execute: { method: 'POST', path: '/v1/workflows/{slug}/execute' },
  getExecution: { method: 'GET', path: '/v1/executions/{executionId}' },
  listExecutions: { method: 'GET', path: '/v1/executions' },
  cancelExecution: { method: 'POST', path: '/v1/executions/{executionId}/cancel' },
  pauseExecution: { method: 'POST', path: '/v1/executions/{executionId}/pause' },
  resumeExecution: { method: 'POST', path: '/v1/executions/{executionId}/resume' },
  retryExecution: { method: 'POST', path: '/v1/executions/{executionId}/retry' },
  getLogs: { method: 'GET', path: '/v1/executions/{executionId}/logs' },
  subscribeToExecution: { method: 'GET', path: '/v1/executions/{executionId}/events' },
} as const satisfies Record<string, { method: 'GET' | 'POST'; path: string }>;

export type WorkflowRouteName = keyof typeof WORKFLOW_ROUTES;

/**
 * Fill `{param}` placeholders with URL-encoded values. Rejects empty values and
 * the dot segments `.` / `..`, which `encodeURIComponent` leaves intact and
 * which would otherwise walk the request to a different route.
 */
export function buildPath(template: string, params: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (typeof value !== 'string' || value.trim() === '' || value === '.' || value === '..') {
      throw new WorkflowClientError(
        'WAVE_ERR_INVALID_ARGUMENT',
        `Invalid path parameter "${name}": expected a non-empty id or slug.`
      );
    }
    return encodeURIComponent(value);
  });
}
