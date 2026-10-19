/** Expense options, shared by the admin page (browser) and the API. */
export const EXPENSE_CATEGORIES = [
  'Stock purchases',
  'Packaging',
  'Rent',
  'Utilities',
  'Salaries & wages',
  'Transport & delivery',
  'Equipment & repairs',
  'Marketing',
  'Licences & regulatory fees',
  'Other',
] as const;

export const EXPENSE_PAYMENT_METHODS = { CASH: 'Cash', MPESA: 'M-Pesa', BANK: 'Bank transfer', OTHER: 'Other' } as const;
