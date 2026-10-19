import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/app/lib/prisma';
import { getAppSession } from '@/app/lib/auth-options';
import { getCheckout, CheckoutError } from '@/app/lib/checkout';
import { parseLocation } from '@/app/lib/delivery';
import { formatKenyanPhoneNumber } from '@/app/lib/payhero';

export async function POST(request: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to place an order.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const phone = typeof body.phoneNumber === 'string' ? formatKenyanPhoneNumber(body.phoneNumber) : '';
    if (!/^0[17]\d{8}$/.test(phone)) {
      throw new CheckoutError('Enter a valid Kenyan mobile number.');
    }

    const method = body.deliveryMethod || 'delivery';
    const name = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const address = typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : '';

    if (!name || name.length > 150 || (method === 'delivery' && (!address || address.length > 500))) {
      throw new CheckoutError('Enter your name and delivery address.');
    }

    const quote = await getCheckout(session.user.id, method, parseLocation(body.deliveryLocation?.lat, body.deliveryLocation?.lng), true);
    if (body.expectedAmount !== quote.total) {
      throw new CheckoutError('Your bag or prices have changed. Refresh checkout before ordering.', 409);
    }

    const checkoutRequestId = 'POS_POD_' + randomUUID();

    // Create payment/order in PENDING state awaiting POS cashier checkout
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        phoneNumber: phone,
        amount: quote.total,
        status: 'PENDING',
        merchantRequestId: 'PAY_ON_DELIVERY',
        checkoutRequestId,
        resultDesc: 'Awaiting POS Checkout (Pay on Delivery / Collection)',
        cartItems: {
          items: quote.items,
          subtotal: quote.subtotal,
          deliveryFee: quote.deliveryFee,
          deliveryDetails: {
            customerName: name,
            phoneNumber: phone,
            deliveryAddress: method === 'pickup' ? 'Store Pickup' : address,
            deliveryMethod: method,
            deliveryDate: typeof body.deliveryDate === 'string' ? body.deliveryDate.slice(0, 100) : '',
            orderNotes: typeof body.orderNotes === 'string' ? body.orderNotes.slice(0, 1000) : '',
            paymentType: 'PAY_AT_POS',
            ...(quote.location && quote.distance ? { location: quote.location, distanceKm: quote.distance.km, durationMin: quote.distance.minutes, distanceEstimated: quote.distance.estimated } : {}),
          },
        },
      },
    });

    // Clear cart once order is sent to POS
    await prisma.cart.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      orderId: payment.id,
      amount: quote.total,
      quote,
    });
  } catch (error) {
    console.error('Error creating Pay on Delivery order:', error);
    return NextResponse.json(
      { error: error instanceof CheckoutError ? error.message : 'Order could not be submitted. Please try again.' },
      { status: error instanceof CheckoutError ? error.status : 500 }
    );
  }
}
