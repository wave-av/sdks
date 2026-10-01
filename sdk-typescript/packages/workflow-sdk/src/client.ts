/**
 * WAVE Workflow SDK Client
 *
 * HTTP client for interacting with the WAVE Workflow API.
 *
 * Availability: the Workflow API routes this client calls (see `WORKFLOW_ROUTES`)
 * are not served by https://api.wave.online yet. Every method rejects with a
 * `WorkflowApiError` whose `code` is `ROUTE_NOT_MAPPED` until they are.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  WorkflowDefinition,
  WorkflowExecution,
  ExecutionLog,
  ExecuteWorkflowRequest,
  ExecuteWorkflowResponse,
  ListExecutionsRequest,
  ListExecutionsResponse,
  AnyWorkflowEvent,
  ExecutionStatus,
} from './types';
import { WorkflowApiError, WorkflowClientError } from './errors';
import { WORKFLOW_ROUTES, buildPath, type WorkflowRouteName } from './routes';

/**
 * The subset of the WebSocket interface the client uses. The global `WebSocket`
 * in Node.js 22+ and Bun, and the `ws` package, all satisfy it.
 */
export interface WorkflowWebSocket {
  readonly readyState: number;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(): void;
}

/**
 * Opens a WebSocket that sends `headers` on the handshake request.
 *
 * @example
 * ```typescript
 * import WebSocket from 'ws';
 * const webSocketFactory = (url, { headers }) => new WebSocket(url, { headers });
 * ```
 */
export type WorkflowWebSocketFactory = (
  url: string,
  init: { headers: Record<string, string> }
) => WorkflowWebSocket;

/**
 * Client configuration options
 */
export interface WaveWorkflowClientConfig {
  /** API key for authentication. Sent only in the `Authorization` header, never in a URL. */
  apiKey: string;
  /** Organization ID for tenant isolation */
  organizationId: string;
  /** Base URL for the API (default: https://api.wave.online). Must be https unless it is localhost. */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable debug logging (method and URL only; credentials are never logged) */
  debug?: boolean;
  /**
   * Opens the execution-events WebSocket with an `Authorization` header.
   * Defaults to the global `WebSocket` on Node.js 22+ and Bun. Required on
   * Node.js 18/20; not available in browsers (see `subscribeToExecution`).
   */
  webSocketFactory?: WorkflowWebSocketFactory;
}

/**
 * Workflow event types for the event emitter
 */
export interface WorkflowClientEvents {
  'execution.started': (event: AnyWorkflowEvent) => void;
  'execution.completed': (event: AnyWorkflowEvent) => void;
  'execution.failed': (event: AnyWorkflowEvent) => void;
  'phase.started': (event: AnyWorkflowEvent) => void;
  'phase.completed': (event: AnyWorkflowEvent) => void;
  'error': (error: Error) => void;
}

const DEFAULT_BASE_URL = 'https://api.wave.online';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const WS_CLOSING = 2;

/** Normalise and check the base URL so the bearer key never travels over plain HTTP to a remote host. */
function normaliseBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WorkflowClientError('WAVE_ERR_INVALID_ARGUMENT', `baseUrl is not a valid URL: ${raw}`);
  }
  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new WorkflowClientError(
      'WAVE_ERR_INVALID_ARGUMENT',
      `baseUrl must use https (plain http is allowed only for localhost), got ${url.protocol}//${url.host}`
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new WorkflowClientError(
      'WAVE_ERR_INVALID_ARGUMENT',
      'baseUrl must not contain credentials, a query string or a fragment'
    );
  }
  return url.toString().replace(/\/+$/, '');
}

/**
 * The default factory: the global WebSocket of a server runtime that supports
 * handshake headers (Node.js 22+, Bun). Browsers cannot set headers on a
 * WebSocket, so there is no default there.
 */
function defaultWebSocketFactory(): WorkflowWebSocketFactory | undefined {
  const g = globalThis as {
    process?: { versions?: Record<string, string | undefined> };
    WebSocket?: new (url: string, init: unknown) => WorkflowWebSocket;
  };
  const versions = g.process?.versions;
  const serverRuntime = Boolean(versions?.node || versions?.bun);
  const Ctor = g.WebSocket;
  if (!serverRuntime || typeof Ctor !== 'function') return undefined;
  return (url, init) => new Ctor(url, init);
}

/**
 * WAVE Workflow API Client
 *
 * @example
 * ```typescript
 * const client = new WaveWorkflowClient({
 *   apiKey: process.env.WAVE_API_KEY!,
 *   organizationId: 'org_123',
 * });
 *
 * try {
 *   const execution = await client.execute('my-workflow', {
 *     input_params: { foo: 'bar' },
 *   });
 *   const result = await client.waitForCompletion(execution.id);
 * } catch (error) {
 *   if (error instanceof WorkflowApiError) console.error(error.code, error.requestId);
 * }
 * ```
 */
export class WaveWorkflowClient extends EventEmitter<WorkflowClientEvents> {
  private readonly config: Required<Omit<WaveWorkflowClientConfig, 'webSocketFactory'>>;
  private readonly headers: Record<string, string>;
  private readonly webSocketFactory: WorkflowWebSocketFactory | undefined;

  constructor(config: WaveWorkflowClientConfig) {
    super();

    if (typeof config?.apiKey !== 'string' || config.apiKey.trim() === '') {
      throw new WorkflowClientError(
        'WAVE_ERR_MISSING_API_KEY',
        'apiKey is empty. Pass your WAVE API key (for example process.env.WAVE_API_KEY); ' +
          'the client will not send a request with "Bearer undefined".'
      );
    }

    this.config = {
      timeout: 30000,
      debug: false,
      organizationId: config.organizationId,
      apiKey: config.apiKey,
      ...(config.timeout !== undefined ? { timeout: config.timeout } : {}),
      ...(config.debug !== undefined ? { debug: config.debug } : {}),
      baseUrl: normaliseBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL),
    };

    this.headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      ...(this.config.organizationId ? { 'X-Organization-Id': this.config.organizationId } : {}),
    };

    this.webSocketFactory = config.webSocketFactory ?? defaultWebSocketFactory();
  }

  // ==========================================================================
  // Workflow Definitions
  // ==========================================================================

  /**
   * Get a workflow definition by slug
   */
  async getWorkflow(slug: string): Promise<WorkflowDefinition> {
    return this.request<WorkflowDefinition>('getWorkflow', { slug });
  }

  /**
   * List all workflows
   */
  async listWorkflows(options?: {
    category?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ workflows: WorkflowDefinition[]; total: number }> {
    const query = new URLSearchParams();
    if (options?.category) query.set('category', options.category);
    if (options?.status) query.set('status', options.status);
    if (options?.limit) query.set('limit', String(options.limit));
    if (options?.offset) query.set('offset', String(options.offset));

    return this.request('listWorkflows', {}, { query });
  }

  // ==========================================================================
  // Workflow Executions
  // ==========================================================================

  /**
   * Execute a workflow
   */
  async execute(
    workflowSlug: string,
    request?: ExecuteWorkflowRequest
  ): Promise<WorkflowExecution> {
    const response = await this.request<ExecuteWorkflowResponse>(
      'execute',
      { slug: workflowSlug },
      { body: request ?? {} }
    );
    return response.execution;
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>('getExecution', { executionId });
  }

  /**
   * List executions
   */
  async listExecutions(
    request?: ListExecutionsRequest
  ): Promise<ListExecutionsResponse> {
    const query = new URLSearchParams();
    if (request?.workflow_id) query.set('workflow_id', request.workflow_id);
    if (request?.status) query.set('status', request.status);
    if (request?.limit) query.set('limit', String(request.limit));
    if (request?.offset) query.set('offset', String(request.offset));
    if (request?.order_by) query.set('order_by', request.order_by);
    if (request?.order) query.set('order', request.order);

    return this.request('listExecutions', {}, { query });
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>('cancelExecution', { executionId });
  }

  /**
   * Pause a running execution
   */
  async pauseExecution(executionId: string): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>('pauseExecution', { executionId });
  }

  /**
   * Resume a paused execution
   */
  async resumeExecution(executionId: string): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>('resumeExecution', { executionId });
  }

  /**
   * Retry a failed execution
   */
  async retryExecution(
    executionId: string,
    options?: { from_checkpoint?: boolean }
  ): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>(
      'retryExecution',
      { executionId },
      { body: options ?? {} }
    );
  }

  // ==========================================================================
  // Execution Logs
  // ==========================================================================

  /**
   * Get execution logs
   */
  async getLogs(
    executionId: string,
    options?: {
      level?: 'debug' | 'info' | 'warn' | 'error';
      limit?: number;
      offset?: number;
    }
  ): Promise<{ logs: ExecutionLog[]; total: number }> {
    const query = new URLSearchParams();
    if (options?.level) query.set('level', options.level);
    if (options?.limit) query.set('limit', String(options.limit));
    if (options?.offset) query.set('offset', String(options.offset));

    return this.request('getLogs', { executionId }, { query });
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  /**
   * Wait for an execution to complete
   */
  async waitForCompletion(
    executionId: string,
    options?: {
      pollInterval?: number;
      timeout?: number;
      onProgress?: (execution: WorkflowExecution) => void;
    }
  ): Promise<WorkflowExecution> {
    const pollInterval = options?.pollInterval || 2000;
    const timeout = options?.timeout || 3600000; // 1 hour default
    const startTime = Date.now();

    const terminalStatuses: ExecutionStatus[] = [
      'completed',
      'failed',
      'cancelled',
      'timeout',
    ];

    while (Date.now() - startTime < timeout) {
      const execution = await this.getExecution(executionId);

      if (options?.onProgress) {
        options.onProgress(execution);
      }

      if (terminalStatuses.includes(execution.status)) {
        return execution;
      }

      await this.sleep(pollInterval);
    }

    throw new WorkflowClientError(
      'WAVE_ERR_TIMEOUT',
      `Execution ${executionId} did not finish within ${timeout}ms`
    );
  }

  /**
   * Execute a workflow and wait for completion
   */
  async executeAndWait(
    workflowSlug: string,
    request?: ExecuteWorkflowRequest,
    waitOptions?: Parameters<typeof this.waitForCompletion>[1]
  ): Promise<WorkflowExecution> {
    const execution = await this.execute(workflowSlug, request);
    return this.waitForCompletion(execution.id, waitOptions);
  }

  // ==========================================================================
  // Real-time Events (WebSocket)
  // ==========================================================================

  /**
   * Subscribe to real-time execution events.
   *
   * The API key is sent in the handshake's `Authorization` header and never in
   * the URL, where proxies, CDNs and access logs would record it. Browsers
   * cannot set WebSocket headers, so this throws `WAVE_ERR_WEBSOCKET_UNSUPPORTED`
   * there: keep the long-lived key on a server and subscribe from it.
   *
   * @returns an unsubscribe function that closes the socket
   */
  subscribeToExecution(executionId: string): () => void {
    const factory = this.webSocketFactory;
    if (!factory) {
      throw new WorkflowClientError(
        'WAVE_ERR_WEBSOCKET_UNSUPPORTED',
        'This runtime cannot send an Authorization header on a WebSocket, and the client will not put ' +
          'your API key in a URL. On Node.js 18/20 pass webSocketFactory: (url, { headers }) => new WebSocket(url, { headers }) ' +
          "using the 'ws' package. In a browser, subscribe from your server instead of shipping the API key to the client."
      );
    }

    const route = WORKFLOW_ROUTES.subscribeToExecution;
    const base = new URL(this.config.baseUrl);
    base.protocol = base.protocol === 'http:' ? 'ws:' : 'wss:';
    const url = `${base.toString().replace(/\/+$/, '')}${buildPath(route.path, { executionId })}`;

    if (this.config.debug) {
      console.log(`[WaveWorkflowClient] WS ${url}`);
    }

    const ws = factory(url, { headers: { ...this.headers } });

    ws.onmessage = (event) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : String(event.data);
        const data = JSON.parse(raw) as AnyWorkflowEvent;
        this.emit(data.type as keyof WorkflowClientEvents, data);
      } catch (error) {
        this.emit('error', error as Error);
      }
    };

    ws.onerror = () => {
      this.emit('error', new Error(`WebSocket error on ${route.path} for execution ${executionId}`));
    };

    // Return unsubscribe function
    return () => {
      if (ws.readyState < WS_CLOSING) {
        ws.close();
      }
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async request<T>(
    name: WorkflowRouteName,
    params: Record<string, string> = {},
    options: { query?: URLSearchParams; body?: unknown } = {}
  ): Promise<T> {
    const route = WORKFLOW_ROUTES[name];
    const path = buildPath(route.path, params);
    const qs = options.query?.toString();
    const url = `${this.config.baseUrl}${path}${qs ? `?${qs}` : ''}`;

    if (this.config.debug) {
      console.log(`[WaveWorkflowClient] ${route.method} ${url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        method: route.method,
        headers: this.headers,
        ...(route.method === 'POST' ? { body: JSON.stringify(options.body ?? {}) } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new WorkflowClientError(
          'WAVE_ERR_TIMEOUT',
          `Request timeout after ${this.config.timeout}ms (${route.method} ${route.path})`
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw await WorkflowApiError.fromResponse(response, `${route.method} ${route.path}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a new workflow client instance
 */
export function createClient(
  config: WaveWorkflowClientConfig
): WaveWorkflowClient {
  return new WaveWorkflowClient(config);
}
