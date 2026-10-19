export interface ProviderStatus { status?: string; amount?: number | string; reference?: string; provider_reference?: string; third_party_reference?: string; error_message?: string }
export function verifiedPaymentStatus(expectedAmount: number, expectedReference: string, result: ProviderStatus | null): 'COMPLETED' | 'FAILED' | 'PENDING' {
  if (!result || (result.reference && result.reference !== expectedReference)) return 'PENDING';
  const status = result.status?.toUpperCase();
  if (status === 'FAILED' || status === 'CANCELLED') return 'FAILED';
  if (!['SUCCESS', 'COMPLETED'].includes(status || '')) return 'PENDING';
  const amount = Number(result.amount);
  return Number.isFinite(amount) && amount > 0 && Math.abs(amount - expectedAmount) < 0.005 ? 'COMPLETED' : 'PENDING';
}

