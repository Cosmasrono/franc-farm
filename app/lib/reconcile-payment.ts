import { prisma } from './prisma';
import { getPayHeroTransactionStatus } from './payhero';
import { verifiedPaymentStatus } from './payment-verification';
import { deductStock } from './products';
type PaymentPayload = { items?: { id: string; productId?: string; quantity: number }[] };
export async function reconcilePayment(id: string) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id } });
  if (payment.status !== 'PENDING') return payment;
  const reference = payment.merchantRequestId || payment.checkoutRequestId;
  // Cash-on-delivery orders are settled at the till, never by the provider.
  if (/^(TEMP_|TEST_|PAY_ON_DELIVERY)/.test(reference)) return payment;
  const live = await getPayHeroTransactionStatus(reference);
  const status = verifiedPaymentStatus(payment.amount, reference, live);
  if (status === 'PENDING') return payment;
  const payload = payment.cartItems as PaymentPayload | null;
  await prisma.$transaction(async tx => {
    const changed = await tx.payment.updateMany({ where: { id, status: 'PENDING' }, data: {
      status, mpesaReceiptNumber: live?.provider_reference || live?.third_party_reference || payment.mpesaReceiptNumber,
      resultDesc: status === 'COMPLETED' ? 'Payment verified with the provider.' : 'The payment was not completed.',
    } });
    if (!changed.count || status !== 'COMPLETED' || !Array.isArray(payload?.items)) return;
    // The customer has paid, so the sale stands even if the shelf ran short; the
    // shortfall is logged as negative stock for the team to sort out.
    const { shortfalls } = await deductStock(tx, payload.items.map(item => ({ productId: item.productId || '', quantity: item.quantity })), { reason: 'SALE_ONLINE', reference: id, userName: 'Online shop' }, 'force');
    if (shortfalls.length) await tx.payment.update({ where: { id }, data: { resultDesc: `Payment verified with the provider. Stock ran short for ${shortfalls.join(', ')}; check before dispatch.` } });
    for (const item of payload.items) {
      if (/^[a-f\d]{24}$/i.test(item.id) && Number.isInteger(item.quantity)) await tx.cart.deleteMany({ where: { id: item.id, userId: payment.userId, quantity: item.quantity } });
    }
  });
  return prisma.payment.findUniqueOrThrow({ where: { id } });
}
