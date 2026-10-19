import { prisma } from './prisma';
import { getPayHeroTransactionStatus } from './payhero';
import { verifiedPaymentStatus } from './payment-verification';
import { PreparedSale, recordSale } from './pos-sale';

/**
 * Settles an M-Pesa prompt sent from the till. The status comes only from
 * PayHero's authenticated API; when it confirms the full amount was paid, the
 * waiting ticket is recorded as a sale with the real M-Pesa receipt.
 */
export async function reconcilePosMpesa(id: string) {
  const request = await prisma.posMpesaRequest.findUniqueOrThrow({ where: { id } });
  if (request.status !== 'PENDING' || !request.reference) return request;

  const live = await getPayHeroTransactionStatus(request.reference);
  const status = verifiedPaymentStatus(request.amount, request.reference, live);
  if (status === 'PENDING') return request;

  if (status === 'FAILED') {
    await prisma.posMpesaRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'FAILED', resultDesc: live?.error_message || 'The customer did not complete the payment.' },
    });
    return prisma.posMpesaRequest.findUniqueOrThrow({ where: { id } });
  }

  // Paid. Claim the request so a callback and the till's polling can't both record it.
  const claimed = await prisma.posMpesaRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'COMPLETING' } });
  if (!claimed.count) return prisma.posMpesaRequest.findUniqueOrThrow({ where: { id } });

  const receipt = live?.provider_reference || live?.third_party_reference || request.reference;
  try {
    const sale = await recordSale(
      request.sale as unknown as PreparedSale,
      { method: 'MPESA', amountPaid: request.amount, changeDue: 0, mpesaCode: receipt },
      { id: request.cashierId, name: request.cashierName, role: 'CASHIER' },
      { moneyAlreadyTaken: true },
    );
    return prisma.posMpesaRequest.update({
      where: { id },
      data: { status: 'COMPLETED', saleNumber: sale.saleNumber, mpesaReceipt: receipt, resultDesc: 'Payment verified with the provider.' },
    });
  } catch (error) {
    // Put it back so the next check retries; the customer's money is already in.
    await prisma.posMpesaRequest.update({ where: { id }, data: { status: 'PENDING' } });
    throw error;
  }
}
