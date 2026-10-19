import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { prisma } from '@/app/lib/prisma';
import { getAppSession } from '@/app/lib/auth-options';
import { getCheckout, CheckoutError } from '@/app/lib/checkout';
import { parseLocation } from '@/app/lib/delivery';
import { initiatePayHeroStkPush, formatKenyanPhoneNumber, getPayHeroConfig } from '@/app/lib/payhero';

export async function POST(request: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in to check out.' }, { status: 401 });
  let paymentId: string | undefined;
  try {
    try { getPayHeroConfig(); } catch { return NextResponse.json({ error: 'M-Pesa payments are unavailable right now. Please choose cash on delivery or pickup, or try again later.' }, { status: 503 }); }
    const body = await request.json();
    if (body.isTestMode) return NextResponse.json({ error: 'Simulated payments are not available.' }, { status: 400 });
    const phone = typeof body.phoneNumber === 'string' ? formatKenyanPhoneNumber(body.phoneNumber) : '';
    if (!/^0[17]\d{8}$/.test(phone)) throw new CheckoutError('Enter a valid Kenyan mobile number.');
    const method = body.deliveryMethod || 'delivery';
    const name = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const address = typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : '';
    if (!name || name.length > 150 || (method === 'delivery' && (!address || address.length > 500))) throw new CheckoutError('Enter your name and delivery address.');
    const quote = await getCheckout(session.user.id, method, parseLocation(body.deliveryLocation?.lat, body.deliveryLocation?.lng), true);
    if (body.expectedAmount !== quote.total) throw new CheckoutError('Your bag or prices have changed. Refresh checkout before paying.', 409);
    // Only another M-Pesa prompt for the bag blocks a new one; cash orders are separate.
    const recent = await prisma.payment.findFirst({ where: { userId: session.user.id, status: 'PENDING', merchantRequestId: { not: 'PAY_ON_DELIVERY' }, createdAt: { gte: new Date(Date.now() - 120000) } }, orderBy: { createdAt: 'desc' } });
    if (recent) return NextResponse.json({ error: 'A payment is already pending. Check My orders before trying again.', paymentId: recent.id }, { status: 409 });
    const payment = await prisma.payment.create({ data: {
      userId: session.user.id, phoneNumber: phone, amount: quote.total, status: 'PENDING', merchantRequestId: '', checkoutRequestId: 'TEMP_' + randomUUID(),
      cartItems: { items: quote.items, subtotal: quote.subtotal, deliveryFee: quote.deliveryFee, deliveryDetails: { customerName: name, phoneNumber: phone, deliveryAddress: method === 'pickup' ? 'Store pickup' : address, deliveryMethod: method, deliveryDate: typeof body.deliveryDate === 'string' ? body.deliveryDate.slice(0, 100) : '', orderNotes: typeof body.orderNotes === 'string' ? body.orderNotes.slice(0, 1000) : '', ...(quote.location && quote.distance ? { location: quote.location, distanceKm: quote.distance.km, durationMin: quote.distance.minutes, distanceEstimated: quote.distance.estimated } : {}) } },
    } });
    paymentId = payment.id;
    const response = await initiatePayHeroStkPush({ amount: quote.total, phoneNumber: phone, externalReference: payment.id, customerName: name });
    if (response.success === false || (!response.reference && !response.CheckoutRequestID)) throw new ProviderRejected();
    await prisma.payment.update({ where: { id: payment.id }, data: { checkoutRequestId: response.CheckoutRequestID || response.reference!, merchantRequestId: response.reference || response.CheckoutRequestID! } });
    return NextResponse.json({ paymentId: payment.id, checkoutRequestId: response.CheckoutRequestID || response.reference, amount: quote.total, quote });
  } catch (error) {
    // The provider answered and refused, so no prompt reached the phone: close the attempt so the customer can retry now.
    const rejected = error instanceof ProviderRejected || (axios.isAxiosError(error) && !!error.response && error.response.status < 500);
    if (paymentId && rejected) {
      await prisma.payment.updateMany({ where: { id: paymentId, status: 'PENDING' }, data: { status: 'FAILED', resultDesc: 'M-Pesa did not accept the payment request.' } });
      return NextResponse.json({ error: 'M-Pesa could not send the payment prompt. Check the phone number and try again.' }, { status: 502 });
    }
    if (paymentId) await prisma.payment.updateMany({ where: { id: paymentId, status: 'PENDING' }, data: { resultDesc: 'Payment initiation could not be confirmed. Check status before retrying.' } });
    return NextResponse.json({ error: error instanceof CheckoutError ? error.message : 'Payment could not be initiated. Check My orders before trying again.', paymentId }, { status: error instanceof CheckoutError ? error.status : 502 });
  }
}

class ProviderRejected extends Error {}
