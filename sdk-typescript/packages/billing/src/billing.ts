/**
 * WAVE SDK - Billing API
 *
 * Usage tracking, meter reporting, and subscription management.
 * Reports usage events to WAVE billing meters and monitors quota thresholds.
 *
 * @example
 * ```typescript
 * import { createClient } from '@wave-av/sdk';
 *
 * const wave = createClient({ apiKey: 'wave_...' });
 * const billing = new BillingAPI(wave);
 *
 * // Report usage
 * await billing.reportUsage({ meterType: 'stream_minutes', value: 15 });
 *
 * // Get usage summary
 * const usage = await billing.getUsageSummary('stream_minutes');
 *
 * // Monitor thresholds
 * billing.onUsageThreshold('stream_minutes', 80, (usage) => {
 *   console.log(`${usage.percentUsed}% of stream minutes used`);
 * });
 * ```
 */

import type { WaveClient } from '@wave-av/core';
import type {
  MeterType,
  UsageEvent,
  UsageSummary,
  SubscriptionStatus,
  UsageThresholdCallback,
  BillingAPIConfig,
} from './billing-types';

export type {
  MeterType,
  SubscriptionTier,
  UsageEvent,
  UsageSummary,
  SubscriptionStatus,
  UsageThresholdCallback,
  BillingAPIConfig,
} from './billing-types';

export class BillingAPI {
  private client: WaveClient;
  private thresholds: UsageThresholdCallback[] = [];
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private config: Required<BillingAPIConfig>;

  constructor(client: WaveClient, config?: BillingAPIConfig) {
    this.client = client;
    this.config = {
      pollIntervalMs: config?.pollIntervalMs ?? 60_000,
    };
  }

  /**
   * Report a usage event to a billing meter.
   * Events are aggregated by Stripe Billing Meters.
   */
  async reportUsage(event: UsageEvent): Promise<void> {
    await (this.client as any).request('POST', '/billing/usage/track', {
      meter_type: event.meterType,
      value: event.value,
      idempotency_key: event.idempotencyKey,
      timestamp: event.timestamp?.toISOString(),
      dimensions: event.dimensions,
    });
  }

  /**
   * Report multiple usage events in a single request.
   */
  async reportUsageBatch(events: UsageEvent[]): Promise<void> {
    await (this.client as any).request('POST', '/billing/usage/track/batch', {
      events: events.map(e => ({
        meter_type: e.meterType,
        value: e.value,
        idempotency_key: e.idempotencyKey,
        timestamp: e.timestamp?.toISOString(),
        dimensions: e.dimensions,
      })),
    });
  }

  /**
   * Get current usage summary for a meter in the current billing period.
   */
  async getUsageSummary(meterType: MeterType): Promise<UsageSummary> {
    return (this.client as any).request('GET', `/billing/usage/meters?meter=${meterType}`);
  }

  /**
   * Get usage summaries for all 6 billing meters.
   */
  async getAllUsageSummaries(): Promise<UsageSummary[]> {
    return (this.client as any).request('GET', '/billing/usage/meters');
  }

  /**
   * Get current subscription status.
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    return (this.client as any).request('GET', '/billing/status');
  }

  /**
   * Register a callback when usage crosses a threshold percentage.
   * Starts polling usage data if not already polling.
   */
  onUsageThreshold(
    meterType: MeterType,
    thresholdPercent: number,
    callback: (usage: UsageSummary) => void,
  ): () => void {
    const entry: UsageThresholdCallback = {
      meterType,
      threshold: thresholdPercent,
      callback,
    };
    this.thresholds.push(entry);

    if (!this.pollInterval) {
      this.startPolling();
    }

    return () => {
      const idx = this.thresholds.indexOf(entry);
      if (idx >= 0) this.thresholds.splice(idx, 1);
      if (this.thresholds.length === 0) this.stopPolling();
    };
  }

  /**
   * Stop all polling and clean up.
   */
  destroy(): void {
    this.stopPolling();
    this.thresholds = [];
  }

  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      try {
        const summaries = await this.getAllUsageSummaries();
        for (const summary of summaries) {
          for (const threshold of this.thresholds) {
            if (
              threshold.meterType === summary.meterType &&
              summary.percentUsed >= threshold.threshold
            ) {
              threshold.callback(summary);
            }
          }
        }
      } catch {
        // Silently ignore poll failures -- next poll will retry
      }
    }, this.config.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export function createBillingAPI(client: WaveClient, config?: BillingAPIConfig): BillingAPI {
  return new BillingAPI(client, config);
}
