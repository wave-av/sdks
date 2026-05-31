/**
 * WAVE SDK - Billing Types
 *
 * Types for usage tracking, meter reporting, and subscription management.
 */

export type MeterType =
  | 'stream_minutes'
  | 'storage_gb'
  | 'ai_tokens'
  | 'transcription_minutes'
  | 'voice_minutes'
  | 'compute_minutes';

export type SubscriptionTier = 'starter' | 'launch' | 'scale' | 'volume';

export interface UsageEvent {
  meterType: MeterType;
  value: number;
  idempotencyKey?: string;
  timestamp?: Date;
  dimensions?: Record<string, string>;
}

export interface UsageSummary {
  meterType: MeterType;
  currentUsage: number;
  limit: number;
  percentUsed: number;
  estimatedOverageCost: number;
  periodStart: string;
  periodEnd: string;
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  currentPeriodEnd: string;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface UsageThresholdCallback {
  meterType: MeterType;
  threshold: number;
  callback: (usage: UsageSummary) => void;
}

export interface BillingAPIConfig {
  pollIntervalMs?: number;
}
