/**
 * VOD processing pipeline
 *
 * Takes a recorded stream and runs it through transcription,
 * chapter detection, and clip extraction.
 */
import { WorkflowBuilder, WaveWorkflowClient } from '@wave-av/workflow-sdk';

const pipeline = new WorkflowBuilder('vod-processing')
  .name('VOD processing pipeline')
  .description('Post-stream processing: transcribe, chapter, clip')
  .category('content')
  .version('1.0.0')
  .tags('vod', 'transcription', 'clips')
  .phase('transcribe', (phase) =>
    phase
      .description('Generate transcript from recording')
      .agent('transcription-agent', {
        recording_id: '{{input.recording_id}}',
        language: '{{input.language}}',
        provider: 'deepgram',
      })
  )
  .phase('chapters', (phase) =>
    phase
      .description('Detect chapter boundaries from transcript')
      .agent('chapter-detector', {
        min_chapter_duration_s: 60,
        max_chapters: 20,
      })
  )
  .phase('clips', (phase) =>
    phase
      .description('Extract highlight clips')
      .agent('clip-extractor', {
        max_clips: 5,
        target_duration_s: 30,
      })
      .onFailure('skip')
  )
  .timeout(1800)
  .enableCheckpoints()
  .maxRetries(1)
  .build();

async function main() {
  const client = new WaveWorkflowClient({
    apiKey: process.env.WAVE_API_KEY!,
    organizationId: process.env.WAVE_ORGANIZATION_ID!,
  });

  const execution = await client.execute('vod-processing', {
    input_params: {
      recording_id: 'rec_abc123',
      language: 'en',
    },
  });

  console.log('Processing started:', execution.id);

  // Monitor progress
  const result = await client.waitForCompletion(execution.id, {
    pollInterval: 5000,
    onProgress: (exec) => {
      console.log(`Phase: ${exec.current_phase} | Status: ${exec.status}`);
    },
  });

  console.log('Processing complete:', result.status);
}

main().catch(console.error);
