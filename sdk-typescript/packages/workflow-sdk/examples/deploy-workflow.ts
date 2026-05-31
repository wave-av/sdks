/**
 * Deployment workflow
 *
 * Demonstrates a CI/CD-style workflow with build, test,
 * and deploy phases with rollback on failure.
 */
import { WorkflowBuilder, WaveWorkflowClient } from '@wave-av/workflow-sdk';

const deployWorkflow = new WorkflowBuilder('edge-deploy')
  .name('Edge deployment')
  .description('Build, test, and deploy to edge workers')
  .category('devops')
  .version('1.0.0')
  .tags('deploy', 'edge', 'ci-cd')
  .phase('build', (phase) =>
    phase
      .description('Build edge worker bundle')
      .agent('build-agent', {
        target: 'cloudflare-worker',
        entry: '{{input.entry_file}}',
      })
  )
  .phase('test', (phase) =>
    phase
      .description('Run integration tests against staging')
      .agent('test-runner', {
        environment: 'staging',
        suite: 'integration',
      })
      .onFailure('fail')
  )
  .phase('deploy', (phase) =>
    phase
      .description('Deploy to production edge')
      .agent('edge-deployer', {
        regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
        rollout: 'canary',
        canary_percent: 10,
      })
  )
  .timeout(600)
  .enableCheckpoints()
  .maxRetries(0)
  .build();

async function main() {
  const client = new WaveWorkflowClient({
    apiKey: process.env.WAVE_API_KEY!,
    organizationId: process.env.WAVE_ORGANIZATION_ID!,
  });

  // Subscribe to real-time events
  const execution = await client.execute('edge-deploy', {
    input_params: {
      entry_file: 'src/worker.ts',
    },
  });

  client.subscribeToExecution(execution.id);

  client.on('phase.completed', (event) => {
    const data = event.data as { phase_name?: string; duration_ms?: number };
    console.log(`Phase "${data.phase_name}" completed in ${data.duration_ms}ms`);
  });

  client.on('execution.completed', (event) => {
    const data = event.data as { status?: string };
    console.log(`Deployment complete: ${data.status}`);
    process.exit(0);
  });

  client.on('error', (error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
}

main().catch(console.error);
