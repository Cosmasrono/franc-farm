import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { reconcilePayment } from '@/app/lib/reconcile-payment';
import { reconcilePosMpesa } from '@/app/lib/pos-mpesa';
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = body?.response || body?.Body?.stkCallback || body;
    const checkout = response?.CheckoutRequestID || body?.reference;
    const external = response?.ExternalReference || body?.user_reference || body?.external_reference;
    const byCheckout = typeof checkout === 'string' && checkout.length <= 200 ? checkout : null;
    const byId = typeof external === 'string' && /^[a-f\d]{24}$/i.test(external) ? external : null;
    if (!byCheckout && !byId) return NextResponse.json({ error: 'Invalid callback reference.' }, { status: 400 });
    // Callback contents are only a notification. Status and amount come from
    // the authenticated provider API using our stored transaction reference.
    const payment = await prisma.payment.findFirst({
      where: { OR: [...(byCheckout ? [{ checkoutRequestId: byCheckout }] : []), ...(byId ? [{ id: byId }] : [])] },
    });
    if (payment) {
      const verified = await reconcilePayment(payment.id);
      if (verified.status === 'PENDING') return NextResponse.json({ error: 'Verification is pending.' }, { status: 503 });
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
    // Not a website order: an M-Pesa prompt sent from the till.
    const till = await prisma.posMpesaRequest.findFirst({
      where: { OR: [...(byCheckout ? [{ reference: byCheckout }] : []), ...(byId ? [{ id: byId }] : [])] },
    });
    if (!till) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    const verified = await reconcilePosMpesa(till.id);
    if (verified.status === 'PENDING') return NextResponse.json({ error: 'Verification is pending.' }, { status: 503 });
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch { return NextResponse.json({ error: 'Unable to verify callback.' }, { status: 503 }); }
}
