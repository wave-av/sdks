import { describe, it, expect, beforeEach } from 'vitest';

// Re-implement SafetyState for testing (the exported singleton can't be reset between tests)
interface CostEstimate {
  id: string;
  operation: string;
  estimatedMonthlyCost: number;
  breakdown: Record<string, number>;
  confirmed: boolean;
  createdAt: number;
}

class SafetyState {
  private readOnly = false;
  private pendingEstimates = new Map<string, CostEstimate>();

  isReadOnly(): boolean { return this.readOnly; }
  setReadOnly(value: boolean): void { this.readOnly = value; }

  addEstimate(estimate: CostEstimate): void {
    this.pendingEstimates.set(estimate.id, estimate);
  }

  confirmEstimate(id: string): CostEstimate | undefined {
    const est = this.pendingEstimates.get(id);
    if (est) est.confirmed = true;
    return est;
  }

  getEstimate(id: string): CostEstimate | undefined {
    return this.pendingEstimates.get(id);
  }

  requiresConfirmation(operation: string): boolean {
    for (const est of this.pendingEstimates.values()) {
      if (est.operation === operation && est.confirmed && Date.now() - est.createdAt < 300_000) {
        return false;
      }
    }
    return true;
  }
}

describe('SafetyState', () => {
  let state: SafetyState;

  beforeEach(() => {
    state = new SafetyState();
  });

  describe('read-only mode', () => {
    it('defaults to false', () => {
      expect(state.isReadOnly()).toBe(false);
    });

    it('can be enabled', () => {
      state.setReadOnly(true);
      expect(state.isReadOnly()).toBe(true);
    });

    it('can be toggled back', () => {
      state.setReadOnly(true);
      state.setReadOnly(false);
      expect(state.isReadOnly()).toBe(false);
    });
  });

  describe('cost estimates', () => {
    const estimate: CostEstimate = {
      id: 'est-123',
      operation: 'create_stream',
      estimatedMonthlyCost: 29.99,
      breakdown: { transcoding: 15, bandwidth: 10, storage: 4.99 },
      confirmed: false,
      createdAt: Date.now(),
    };

    it('stores and retrieves estimates', () => {
      state.addEstimate(estimate);
      expect(state.getEstimate('est-123')).toEqual(estimate);
    });

    it('returns undefined for missing estimates', () => {
      expect(state.getEstimate('nonexistent')).toBeUndefined();
    });

    it('confirms an estimate', () => {
      state.addEstimate(estimate);
      const confirmed = state.confirmEstimate('est-123');
      expect(confirmed?.confirmed).toBe(true);
    });

    it('returns undefined when confirming nonexistent estimate', () => {
      expect(state.confirmEstimate('nonexistent')).toBeUndefined();
    });
  });

  describe('requiresConfirmation', () => {
    it('requires confirmation when no estimates exist', () => {
      expect(state.requiresConfirmation('create_stream')).toBe(true);
    });

    it('requires confirmation when estimate exists but not confirmed', () => {
      state.addEstimate({
        id: 'est-1',
        operation: 'create_stream',
        estimatedMonthlyCost: 10,
        breakdown: {},
        confirmed: false,
        createdAt: Date.now(),
      });
      expect(state.requiresConfirmation('create_stream')).toBe(true);
    });

    it('does NOT require confirmation when estimate is confirmed and fresh', () => {
      state.addEstimate({
        id: 'est-1',
        operation: 'create_stream',
        estimatedMonthlyCost: 10,
        breakdown: {},
        confirmed: false,
        createdAt: Date.now(),
      });
      state.confirmEstimate('est-1');
      expect(state.requiresConfirmation('create_stream')).toBe(false);
    });

    it('requires confirmation when estimate is expired (>5 min)', () => {
      state.addEstimate({
        id: 'est-1',
        operation: 'create_stream',
        estimatedMonthlyCost: 10,
        breakdown: {},
        confirmed: false,
        createdAt: Date.now() - 400_000, // 6.7 minutes ago
      });
      state.confirmEstimate('est-1');
      expect(state.requiresConfirmation('create_stream')).toBe(true);
    });

    it('requires confirmation for different operation type', () => {
      state.addEstimate({
        id: 'est-1',
        operation: 'create_stream',
        estimatedMonthlyCost: 10,
        breakdown: {},
        confirmed: false,
        createdAt: Date.now(),
      });
      state.confirmEstimate('est-1');
      // create_stream is confirmed, but deploy_worker is not
      expect(state.requiresConfirmation('deploy_worker')).toBe(true);
    });
  });
});
