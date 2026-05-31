/**
 * WAVE SDK — Autopilot module
 *
 * AI-Director-as-API surface (Wave C #15).
 * Customer's own director agent can drive WAVE Autopilot programmatically.
 *
 * @example
 * ```ts
 * import { WaveClient } from '@wave-av/sdk';
 *
 * const wave = new WaveClient({ apiKey: process.env.WAVE_API_KEY });
 *
 * // Customer agent decides to cut to camera 2 on speaker change
 * await wave.autopilot.cut({
 *   streamId: 'abc-123',
 *   from: 'cam1',
 *   to: 'cam2',
 *   reason: 'speaker_change',
 *   transition: 'fade',
 *   durationMs: 500,
 *   confidence: 0.92,
 * });
 * ```
 */

import type { WaveClientConfig } from '@wave-av/core';

export type CutReason =
  | 'speaker_change'
  | 'reaction_shot'
  | 'wide_shot'
  | 'crowd_shot'
  | 'demo_focus'
  | 'manual'
  | 'agent_decision';

export type Transition = 'cut' | 'fade' | 'wipe';

export interface AutopilotCutInput {
  streamId: string;
  from: string;
  to: string;
  reason: CutReason;
  transition?: Transition;
  durationMs?: number;
  confidence?: number;
}

export interface AutopilotCutResult {
  accepted: boolean;
  idempotencyKey: string;
  streamId: string;
  transition: Transition;
  message: string;
}

export class AutopilotModule {
  constructor(private readonly config: WaveClientConfig) {}

  async cut(input: AutopilotCutInput): Promise<AutopilotCutResult> {
    const baseUrl = (this.config as { baseUrl?: string }).baseUrl ?? 'https://api.wave.online';
    const apiKey = (this.config as { apiKey?: string }).apiKey;

    if (!apiKey) {
      throw new Error('WAVE_API_KEY required — pass apiKey to WaveClient constructor');
    }

    const body = {
      stream_id: input.streamId,
      from: input.from,
      to: input.to,
      reason: input.reason,
      transition: input.transition ?? 'cut',
      ...(input.durationMs !== undefined ? { duration_ms: input.durationMs } : {}),
      ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
    };

    const response = await fetch(`${baseUrl}/v1/autopilot/cut`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok && response.status !== 202) {
      const text = await response.text();
      throw new Error(`Autopilot cut failed: HTTP ${response.status} — ${text.slice(0, 200)}`);
    }

    const json = (await response.json()) as { data?: { accepted: boolean; idempotency_key: string; stream_id: string; transition: Transition; message: string } };
    if (!json.data) {
      throw new Error('Autopilot cut returned malformed response');
    }
    return {
      accepted: json.data.accepted,
      idempotencyKey: json.data.idempotency_key,
      streamId: json.data.stream_id,
      transition: json.data.transition,
      message: json.data.message,
    };
  }
}

export function createAutopilotModule(config: WaveClientConfig): AutopilotModule {
  return new AutopilotModule(config);
}
