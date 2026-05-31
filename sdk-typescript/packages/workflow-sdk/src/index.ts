/**
 * WAVE Workflow SDK
 *
 * Official SDK for building and executing workflows on the WAVE platform.
 *
 * @packageDocumentation
 * @module @wave-av/workflow-sdk
 *
 * @example
 * ```typescript
 * import { WaveWorkflowClient } from '@wave-av/workflow-sdk';
 *
 * const client = new WaveWorkflowClient({
 *   apiKey: process.env.WAVE_API_KEY!,
 *   organizationId: 'org_123',
 * });
 *
 * // Execute a workflow
 * const execution = await client.execute('my-workflow', {
 *   input_params: { environment: 'production' },
 * });
 *
 * // Wait for completion
 * const result = await client.waitForCompletion(execution.id, {
 *   onProgress: (exec) => console.log(`Status: ${exec.status}`),
 * });
 *
 * console.log('Output:', result.output);
 * ```
 */

// Re-export types
export * from './types';

// Re-export client
export {
  WaveWorkflowClient,
  createClient,
  type WaveWorkflowClientConfig,
  type WorkflowClientEvents,
} from './client';

// Builder utilities for creating workflow definitions
export { WorkflowBuilder } from './builder';

/**
 * SDK version
 */
export const VERSION = '1.0.0';

/**
 * Default API base URL
 */
export const DEFAULT_API_URL = 'https://api.wave.online';
