import type { TillProduct } from './products';

export type PosProduct = TillProduct;

export interface PosCartItem {
  id: string;
  productId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  notes?: string;
  image?: string;
  /** Prescription-only medicine: the cashier must record the prescription before checkout. */
  requiresPrescription?: boolean;
  /** Units on the shelf when the till loaded it, so the cashier can't ring up more. */
  maxQuantity?: number;
}

export interface PosSalePayload {
  items: PosCartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'CASH' | 'MPESA';
  amountPaid: number;
  changeDue: number;
  mpesaCode?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  /** Set when this sale settles a website order or a prescription request. */
  onlineOrder?: { id: string; source: string };
  /** The prescription the cashier checked, when the ticket has prescription-only items. */
  prescription?: { reference: string; verified: boolean };
}


export function formatKes(amount: number): string {
  return 'KSh ' + Number(amount || 0).toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
