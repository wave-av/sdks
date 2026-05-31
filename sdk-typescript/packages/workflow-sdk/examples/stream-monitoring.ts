/**
 * Stream monitoring workflow
 *
 * Monitors a live stream's health and triggers alerts
 * when quality degrades below thresholds.
 */
import { WorkflowBuilder, WaveWorkflowClient } from '@wave-av/workflow-sdk';

const workflow = new WorkflowBuilder('stream-health-monitor')
  .name('Stream health monitor')
  .description('Polls stream health and alerts on degradation')
  .category('monitoring')
  .version('1.0.0')
  .tags('streaming', 'health', 'alerts')
  .phase('check-health', (phase) =>
    phase
      .description('Fetch stream health metrics')
      .agent('stream-health-checker', {
        stream_id: '{{input.stream_id}}',
        thresholds: {
          min_bitrate_kbps: 2000,
          max_latency_ms: 500,
          min_fps: 24,
        },
      })
  )
  .phase('evaluate', (phase) =>
    phase
      .description('Evaluate health against thresholds')
      .agent('threshold-evaluator', {
        action_on_fail: 'alert',
      })
      .onFailure('retry')
  )
  .phase('alert', (phase) =>
    phase
      .description('Send alert if thresholds breached')
      .agent('alert-dispatcher', {
        channels: ['slack', 'email'],
      })
  )
  .timeout(60)
  .maxRetries(2)
  .build();

// Execute the workflow
async function main() {
  const client = new WaveWorkflowClient({
    apiKey: process.env.WAVE_API_KEY!,
    organizationId: process.env.WAVE_ORGANIZATION_ID!,
  });

  const result = await client.executeAndWait('stream-health-monitor', {
    input_params: {
      stream_id: 'your-stream-uuid-here',
    },
  });

  console.log('Monitor result:', result.status);
  if (result.output) {
    console.log('Health:', JSON.stringify(result.output, null, 2));
  }
}

main().catch(console.error);
