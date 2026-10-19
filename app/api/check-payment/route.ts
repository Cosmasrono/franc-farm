import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getAppSession } from '@/app/lib/auth-options';
import { reconcilePayment } from '@/app/lib/reconcile-payment';
export async function GET(request: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = request.nextUrl.searchParams;
  if (params.has('manualCode') || params.has('simulateSuccess')) return NextResponse.json({ error: 'Payment must be verified with the provider.' }, { status: 400 });
  const id = params.get('paymentId');
  const checkoutRequestId = params.get('checkoutRequestId');
  if ((!id && !checkoutRequestId) || (id && !/^[a-f\d]{24}$/i.test(id))) return NextResponse.json({ error: 'Valid payment reference required.' }, { status: 400 });
  try {
    const existing = await prisma.payment.findFirst({ where: { userId: session.user.id, ...(id ? { id } : { checkoutRequestId: checkoutRequestId! }) } });
    if (!existing) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    const payment = await reconcilePayment(existing.id);
    return NextResponse.json({ status: payment.status.toLowerCase(), paymentId: payment.id, checkoutRequestId: payment.checkoutRequestId, mpesaReceiptNumber: payment.mpesaReceiptNumber, amount: payment.amount, resultDesc: payment.resultDesc, createdAt: payment.createdAt, updatedAt: payment.updatedAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Unable to check payment. Please try again.' }, { status: 503 }); }
}

