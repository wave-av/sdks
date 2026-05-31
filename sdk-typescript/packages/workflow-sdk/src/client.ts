/**
 * WAVE Workflow SDK Client
 *
 * HTTP client for interacting with the WAVE Workflow API.
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

/**
 * Client configuration options
 */
export interface WaveWorkflowClientConfig {
  /** API key for authentication */
  apiKey: string;
  /** Organization ID for tenant isolation */
  organizationId: string;
  /** Base URL for the API (default: https://api.wave.online) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
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

/**
 * WAVE Workflow API Client
 *
 * @example
 * ```typescript
 * const client = new WaveWorkflowClient({
 *   apiKey: process.env.WAVE_API_KEY,
 *   organizationId: 'org_123',
 * });
 *
 * // Execute a workflow
 * const execution = await client.execute('my-workflow', {
 *   input_params: { foo: 'bar' },
 * });
 *
 * // Wait for completion
 * const result = await client.waitForCompletion(execution.id);
 * ```
 */
export class WaveWorkflowClient extends EventEmitter<WorkflowClientEvents> {
  private readonly config: Required<WaveWorkflowClientConfig>;
  private readonly headers: Record<string, string>;

  constructor(config: WaveWorkflowClientConfig) {
    super();

    this.config = {
      baseUrl: 'https://api.wave.online',
      timeout: 30000,
      debug: false,
      ...config,
    };

    this.headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'X-Organization-Id': this.config.organizationId,
    };
  }

  // ==========================================================================
  // Workflow Definitions
  // ==========================================================================

  /**
   * Get a workflow definition by slug
   */
  async getWorkflow(slug: string): Promise<WorkflowDefinition> {
    return this.request<WorkflowDefinition>(`/v1/workflows/${slug}`);
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
    const params = new URLSearchParams();
    if (options?.category) params.set('category', options.category);
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));

    return this.request(`/v1/workflows?${params.toString()}`);
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
      `/v1/workflows/${workflowSlug}/execute`,
      {
        method: 'POST',
        body: JSON.stringify(request || {}),
      }
    );
    return response.execution;
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>(`/v1/executions/${executionId}`);
  }

  /**
   * List executions
   */
  async listExecutions(
    request?: ListExecutionsRequest
  ): Promise<ListExecutionsResponse> {
    const params = new URLSearchParams();
    if (request?.workflow_id) params.set('workflow_id', request.workflow_id);
    if (request?.status) params.set('status', request.status);
    if (request?.limit) params.set('limit', String(request.limit));
    if (request?.offset) params.set('offset', String(request.offset));
    if (request?.order_by) params.set('order_by', request.order_by);
    if (request?.order) params.set('order', request.order);

    return this.request(`/v1/executions?${params.toString()}`);
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>(
      `/v1/executions/${executionId}/cancel`,
      { method: 'POST' }
    );
  }

  /**
   * Pause a running execution
   */
  async pauseExecution(executionId: string): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>(
      `/v1/executions/${executionId}/pause`,
      { method: 'POST' }
    );
  }

  /**
   * Resume a paused execution
   */
  async resumeExecution(executionId: string): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>(
      `/v1/executions/${executionId}/resume`,
      { method: 'POST' }
    );
  }

  /**
   * Retry a failed execution
   */
  async retryExecution(
    executionId: string,
    options?: { from_checkpoint?: boolean }
  ): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>(
      `/v1/executions/${executionId}/retry`,
      {
        method: 'POST',
        body: JSON.stringify(options || {}),
      }
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
    const params = new URLSearchParams();
    if (options?.level) params.set('level', options.level);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));

    return this.request(`/v1/executions/${executionId}/logs?${params.toString()}`);
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

    throw new Error(`Execution ${executionId} timed out after ${timeout}ms`);
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
   * Subscribe to real-time execution events
   */
  subscribeToExecution(executionId: string): () => void {
    const wsUrl = this.config.baseUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');

    const ws = new WebSocket(
      `${wsUrl}/v1/executions/${executionId}/events?token=${this.config.apiKey}`
    );

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AnyWorkflowEvent;
        this.emit(data.type as keyof WorkflowClientEvents, data);
      } catch (error) {
        this.emit('error', error as Error);
      }
    };

    ws.onerror = (error) => {
      this.emit('error', new Error(`WebSocket error: ${error}`));
    };

    // Return unsubscribe function
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    if (this.config.debug) {
      console.log(`[WaveWorkflowClient] ${options?.method || 'GET'} ${url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout
    );

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options?.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error (${response.status}): ${error}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }

      throw error;
    }
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
