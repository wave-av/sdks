/**
 * WAVE Workflow SDK Types
 *
 * Type definitions for workflow definitions, executions, and events.
 */

import { z } from 'zod';

// ============================================================================
// Workflow Definition Types
// ============================================================================

/**
 * Agent configuration within a workflow phase
 */
export interface WorkflowAgent {
  type: string;
  config?: Record<string, unknown>;
  timeout_seconds?: number;
  retry_policy?: RetryPolicy;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  max_attempts: number;
  backoff_type: 'fixed' | 'exponential';
  initial_delay_ms: number;
  max_delay_ms?: number;
}

/**
 * Workflow phase definition
 */
export interface WorkflowPhase {
  name: string;
  description?: string;
  order: number;
  agents: WorkflowAgent[];
  condition?: PhaseCondition;
  on_failure?: 'fail' | 'skip' | 'retry';
}

/**
 * Conditional phase execution
 */
export interface PhaseCondition {
  type: 'expression' | 'previous_phase_status';
  expression?: string;
  required_status?: 'completed' | 'skipped';
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
  timeout_seconds?: number;
  max_retries?: number;
  checkpoint_enabled?: boolean;
  parallel_phases?: boolean;
  fail_fast?: boolean;
  notification_channels?: string[];
}

/**
 * Complete workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  slug: string;
  description?: string;
  organization_id: string;
  created_by: string;
  category: string;
  version: string;
  status: 'draft' | 'active' | 'deprecated' | 'archived';
  phases: WorkflowPhase[];
  config: WorkflowConfig;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Workflow Execution Types
// ============================================================================

/**
 * Execution status
 */
export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * Phase execution status
 */
export interface PhaseExecutionStatus {
  name: string;
  order: number;
  status: ExecutionStatus;
  started_at?: string;
  completed_at?: string;
  error?: string;
  output?: Record<string, unknown>;
}

/**
 * Workflow execution record
 */
export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  organization_id: string;
  triggered_by: string;
  trigger_type: 'manual' | 'scheduled' | 'webhook' | 'api' | 'event';
  status: ExecutionStatus;
  input_params?: Record<string, unknown>;
  output?: Record<string, unknown>;
  current_phase?: string;
  phase_statuses: PhaseExecutionStatus[];
  checkpoint_id?: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Execution log entry
 */
export interface ExecutionLog {
  id: string;
  execution_id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Base workflow event
 */
export interface WorkflowEvent<T = unknown> {
  type: string;
  timestamp: string;
  workflow_id: string;
  execution_id?: string;
  organization_id: string;
  data: T;
}

/**
 * Execution started event
 */
export interface ExecutionStartedEvent extends WorkflowEvent<{
  trigger_type: string;
  input_params?: Record<string, unknown>;
}> {
  type: 'execution.started';
  execution_id: string;
}

/**
 * Execution completed event
 */
export interface ExecutionCompletedEvent extends WorkflowEvent<{
  duration_ms: number;
  output?: Record<string, unknown>;
}> {
  type: 'execution.completed';
  execution_id: string;
}

/**
 * Execution failed event
 */
export interface ExecutionFailedEvent extends WorkflowEvent<{
  error: string;
  failed_phase?: string;
  duration_ms: number;
}> {
  type: 'execution.failed';
  execution_id: string;
}

/**
 * Phase started event
 */
export interface PhaseStartedEvent extends WorkflowEvent<{
  phase_name: string;
  phase_order: number;
}> {
  type: 'phase.started';
  execution_id: string;
}

/**
 * Phase completed event
 */
export interface PhaseCompletedEvent extends WorkflowEvent<{
  phase_name: string;
  phase_order: number;
  duration_ms: number;
  output?: Record<string, unknown>;
}> {
  type: 'phase.completed';
  execution_id: string;
}

/**
 * Union of all workflow events
 */
export type AnyWorkflowEvent =
  | ExecutionStartedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | PhaseStartedEvent
  | PhaseCompletedEvent;

// ============================================================================
// API Types
// ============================================================================

/**
 * Execute workflow request
 */
export interface ExecuteWorkflowRequest {
  input_params?: Record<string, unknown>;
  trigger_type?: 'manual' | 'api';
  idempotency_key?: string;
  checkpoint_id?: string;
}

/**
 * Execute workflow response
 */
export interface ExecuteWorkflowResponse {
  execution: WorkflowExecution;
}

/**
 * List executions request
 */
export interface ListExecutionsRequest {
  workflow_id?: string;
  status?: ExecutionStatus;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'started_at' | 'completed_at';
  order?: 'asc' | 'desc';
}

/**
 * List executions response
 */
export interface ListExecutionsResponse {
  executions: WorkflowExecution[];
  total: number;
  has_more: boolean;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const WorkflowAgentSchema = z.object({
  type: z.string().min(1),
  config: z.record(z.unknown()).optional(),
  timeout_seconds: z.number().int().positive().optional(),
  retry_policy: z.object({
    max_attempts: z.number().int().positive(),
    backoff_type: z.enum(['fixed', 'exponential']),
    initial_delay_ms: z.number().int().positive(),
    max_delay_ms: z.number().int().positive().optional(),
  }).optional(),
});

export const WorkflowPhaseSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  order: z.number().int().positive(),
  agents: z.array(WorkflowAgentSchema),
  condition: z.object({
    type: z.enum(['expression', 'previous_phase_status']),
    expression: z.string().optional(),
    required_status: z.enum(['completed', 'skipped']).optional(),
  }).optional(),
  on_failure: z.enum(['fail', 'skip', 'retry']).optional(),
});

export const WorkflowConfigSchema = z.object({
  timeout_seconds: z.number().int().positive().max(86400).optional(),
  max_retries: z.number().int().min(0).max(10).optional(),
  checkpoint_enabled: z.boolean().optional(),
  parallel_phases: z.boolean().optional(),
  fail_fast: z.boolean().optional(),
  notification_channels: z.array(z.string()).optional(),
});

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(100),
  description: z.string().max(1000).optional(),
  category: z.string().min(1).max(50),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  phases: z.array(WorkflowPhaseSchema).min(1),
  config: WorkflowConfigSchema.optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const ExecuteWorkflowRequestSchema = z.object({
  input_params: z.record(z.unknown()).optional(),
  trigger_type: z.enum(['manual', 'api']).optional(),
  idempotency_key: z.string().max(100).optional(),
  checkpoint_id: z.string().uuid().optional(),
});
