/**
 * WAVE Workflow Builder
 *
 * Fluent builder API for creating workflow definitions.
 */

import type {
  WorkflowDefinition,
  WorkflowPhase,
  WorkflowAgent,
  WorkflowConfig,
  RetryPolicy,
} from './types';
import { WorkflowDefinitionSchema } from './types';

/**
 * Workflow Builder
 *
 * @example
 * ```typescript
 * const workflow = new WorkflowBuilder('my-workflow')
 *   .name('My Workflow')
 *   .description('Processes data through multiple stages')
 *   .category('data-processing')
 *   .version('1.0.0')
 *   .phase('extract', (phase) =>
 *     phase
 *       .description('Extract data from source')
 *       .agent('data-extractor', { source: 'api' })
 *   )
 *   .phase('transform', (phase) =>
 *     phase
 *       .description('Transform data')
 *       .agent('data-transformer')
 *   )
 *   .phase('load', (phase) =>
 *     phase
 *       .description('Load data to destination')
 *       .agent('data-loader', { destination: 'database' })
 *   )
 *   .config({
 *     timeout_seconds: 3600,
 *     checkpoint_enabled: true,
 *   })
 *   .build();
 * ```
 */
export class WorkflowBuilder {
  private definition: Partial<WorkflowDefinition> = {
    phases: [],
    config: {},
    tags: [],
  };

  constructor(slug: string) {
    this.definition.slug = slug;
  }

  /**
   * Set the workflow name
   */
  name(name: string): this {
    this.definition.name = name;
    return this;
  }

  /**
   * Set the workflow description
   */
  description(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * Set the workflow category
   */
  category(category: string): this {
    this.definition.category = category;
    return this;
  }

  /**
   * Set the workflow version
   */
  version(version: string): this {
    this.definition.version = version;
    return this;
  }

  /**
   * Add tags to the workflow
   */
  tags(...tags: string[]): this {
    this.definition.tags = [...(this.definition.tags || []), ...tags];
    return this;
  }

  /**
   * Add a phase to the workflow
   */
  phase(name: string, builder: (phase: PhaseBuilder) => PhaseBuilder): this {
    const phaseBuilder = new PhaseBuilder(name, (this.definition.phases?.length || 0) + 1);
    builder(phaseBuilder);
    this.definition.phases = [...(this.definition.phases || []), phaseBuilder.build()];
    return this;
  }

  /**
   * Set workflow configuration
   */
  config(config: WorkflowConfig): this {
    this.definition.config = { ...this.definition.config, ...config };
    return this;
  }

  /**
   * Set timeout in seconds
   */
  timeout(seconds: number): this {
    this.definition.config = { ...this.definition.config, timeout_seconds: seconds };
    return this;
  }

  /**
   * Enable checkpointing
   */
  enableCheckpoints(): this {
    this.definition.config = { ...this.definition.config, checkpoint_enabled: true };
    return this;
  }

  /**
   * Set max retries
   */
  maxRetries(retries: number): this {
    this.definition.config = { ...this.definition.config, max_retries: retries };
    return this;
  }

  /**
   * Build and validate the workflow definition
   */
  build(): Omit<WorkflowDefinition, 'id' | 'organization_id' | 'created_by' | 'status' | 'created_at' | 'updated_at'> {
    const result = WorkflowDefinitionSchema.safeParse(this.definition);

    if (!result.success) {
      const errors = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid workflow definition:\n${errors}`);
    }

    return result.data as Omit<WorkflowDefinition, 'id' | 'organization_id' | 'created_by' | 'status' | 'created_at' | 'updated_at'>;
  }

  /**
   * Export as JSON
   */
  toJSON(): string {
    return JSON.stringify(this.build(), null, 2);
  }
}

/**
 * Phase Builder
 */
export class PhaseBuilder {
  private phase: Partial<WorkflowPhase>;

  constructor(name: string, order: number) {
    this.phase = {
      name,
      order,
      agents: [],
    };
  }

  /**
   * Set phase description
   */
  description(description: string): this {
    this.phase.description = description;
    return this;
  }

  /**
   * Add an agent to the phase
   */
  agent(type: string, config?: Record<string, unknown>): this {
    const agent: WorkflowAgent = { type };
    if (config) agent.config = config;
    this.phase.agents = [...(this.phase.agents || []), agent];
    return this;
  }

  /**
   * Add an agent with full configuration
   */
  agentWithRetry(
    type: string,
    config: Record<string, unknown>,
    retryPolicy: RetryPolicy
  ): this {
    const agent: WorkflowAgent = {
      type,
      config,
      retry_policy: retryPolicy,
    };
    this.phase.agents = [...(this.phase.agents || []), agent];
    return this;
  }

  /**
   * Set conditional execution based on expression
   */
  runIf(expression: string): this {
    this.phase.condition = {
      type: 'expression',
      expression,
    };
    return this;
  }

  /**
   * Set conditional execution based on previous phase status
   */
  runAfter(status: 'completed' | 'skipped'): this {
    this.phase.condition = {
      type: 'previous_phase_status',
      required_status: status,
    };
    return this;
  }

  /**
   * Set failure behavior
   */
  onFailure(behavior: 'fail' | 'skip' | 'retry'): this {
    this.phase.on_failure = behavior;
    return this;
  }

  /**
   * Build the phase
   */
  build(): WorkflowPhase {
    return this.phase as WorkflowPhase;
  }
}

/**
 * Create a new workflow builder
 */
export function workflow(slug: string): WorkflowBuilder {
  return new WorkflowBuilder(slug);
}
