export function formatToKsh(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KSH',
    minimumFractionDigits: 2,
  }).format(amount);
}
