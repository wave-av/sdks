export interface CostEstimate {
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

  isReadOnly(): boolean {
    return this.readOnly;
  }

  setReadOnly(value: boolean): void {
    this.readOnly = value;
  }

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
      if (
        est.operation === operation &&
        est.confirmed &&
        Date.now() - est.createdAt < 300_000
      ) {
        return false;
      }
    }
    return true;
  }
}

export const safetyState = new SafetyState();
