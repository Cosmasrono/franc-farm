export const PRESCRIPTION_STATUSES = ['pending', 'reviewing', 'ready', 'dispensed', 'declined'] as const;
export type PrescriptionStatus = (typeof PRESCRIPTION_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  pending: 'New prescription',
  reviewing: 'Pharmacist reviewing',
  ready: 'Ready to dispense',
  dispensed: 'Dispensed',
  declined: 'Declined',
};

/** Statuses the team still has to act on. */
export const OPEN_STATUSES: PrescriptionStatus[] = ['pending', 'reviewing', 'ready'];

// A short, human-readable reference both the customer and the team can quote.
export function prescriptionReference(id: string) {
  return 'RX-' + id.slice(-6).toUpperCase();
}

export interface PrescriptionDetails {
  patientName?: string | null;
  phone?: string | null;
  medicines?: string | null;
  notes?: string | null;
  deliveryMethod?: string | null;
  deliveryAddress?: string | null;
}

/** "Delivery to Kilimani, …" or "Collect at the pharmacy". */
export function handoverLabel(details: Pick<PrescriptionDetails, 'deliveryMethod' | 'deliveryAddress'>) {
  return details.deliveryMethod === 'delivery'
    ? `Delivery${details.deliveryAddress?.trim() ? ' to ' + details.deliveryAddress.trim() : ''}`
    : 'Collect at the pharmacy';
}

export function prescriptionSummary(details: PrescriptionDetails, reference?: string) {
  const rows: [string, string | null | undefined][] = [
    ['Reference', reference],
    ['Patient', details.patientName],
    ['Phone', details.phone],
    ['Collection or delivery', details.deliveryMethod ? handoverLabel(details) : null],
    ['Medicines', details.medicines],
    ['Notes', details.notes],
  ];
  return rows.filter(([, value]) => value && value.trim()).map(([label, value]) => `${label}: ${value!.trim()}`);
}
