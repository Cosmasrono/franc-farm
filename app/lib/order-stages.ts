// The steps a website order goes through after it is placed. Shared by the
// till (which moves orders along) and My orders (which shows the customer).

export type OrderStage = 'NEW' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'READY' | 'DELIVERED' | 'COLLECTED' | 'CANCELLED';

export const FINAL_STAGES: OrderStage[] = ['DELIVERED', 'COLLECTED', 'CANCELLED'];

/** The one step that follows `stage`, for a delivery or a pickup order. */
export function nextStage(stage: OrderStage, method: string): OrderStage | null {
  const pickup = method === 'pickup';
  switch (stage) {
    case 'NEW': return 'PREPARING';
    case 'PREPARING': return pickup ? 'READY' : 'OUT_FOR_DELIVERY';
    case 'OUT_FOR_DELIVERY': return 'DELIVERED';
    case 'READY': return 'COLLECTED';
    default: return null;
  }
}

/** Button text at the till for moving an order to `stage`. */
export const STAGE_ACTION: Record<OrderStage, string> = {
  NEW: 'New',
  PREPARING: 'Start preparing',
  OUT_FOR_DELIVERY: 'Send out for delivery',
  READY: 'Mark ready for pickup',
  DELIVERED: 'Mark delivered',
  COLLECTED: 'Mark collected',
  CANCELLED: 'Cancel order',
};

/** What the customer and the till see for each stage. */
export const STAGE_LABEL: Record<OrderStage, string> = {
  NEW: 'Order received',
  PREPARING: 'Being prepared',
  OUT_FOR_DELIVERY: 'Out for delivery',
  READY: 'Ready for pickup',
  DELIVERED: 'Delivered',
  COLLECTED: 'Collected',
  CANCELLED: 'Cancelled',
};

export function stageOf(value: string | null | undefined): OrderStage {
  return value && value in STAGE_LABEL ? (value as OrderStage) : 'NEW';
}
