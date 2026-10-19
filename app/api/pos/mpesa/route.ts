import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getAppSession } from '@/app/lib/auth-options';
import { formatKenyanPhoneNumber, initiatePayHeroStkPush, getPayHeroConfig } from '@/app/lib/payhero';
import { PosSaleError, STAFF_ROLES, prepareSale } from '@/app/lib/pos-sale';
import { reconcilePosMpesa } from '@/app/lib/pos-mpesa';

const ADMINS = ['ADMIN', 'SUPER_ADMIN'];

async function staffSession() {
  const session = await getAppSession();
  return session?.user?.id && STAFF_ROLES.includes(session.user.role) ? session.user : null;
}

/** Sends an M-Pesa prompt to the customer's phone for the ticket on the till. */
export async function POST(request: Request) {
  const user = await staffSession();
  if (!user) return NextResponse.json({ error: 'Please sign in to the till.' }, { status: 401 });

  try { getPayHeroConfig(); } catch {
    return NextResponse.json({ error: 'M-Pesa is not configured. Ask an administrator to check System Reports.' }, { status: 503 });
  }

  let requestId: string | undefined;
  try {
    const body = await request.json();
    const phone = typeof body.phoneNumber === 'string' ? formatKenyanPhoneNumber(body.phoneNumber) : '';
    if (!/^0[17]\d{8}$/.test(phone)) throw new PosSaleError('Enter the customer’s M-Pesa number, e.g. 0712 345 678.');

    const sale = await prepareSale(body, user.role);
    // The provider rounds to whole shillings; never charge more than the recorded ticket.
    if (!Number.isInteger(sale.total)) throw new PosSaleError('M-Pesa prompts require a whole-shilling total. Adjust the ticket or use another payment method.');
    const cashierName = user.name || user.email || 'Cashier';
    const created = await prisma.posMpesaRequest.create({
      data: {
        cashierId: user.id,
        cashierName,
        phone,
        amount: sale.total,
        sale: JSON.parse(JSON.stringify(sale)),
      },
    });
    requestId = created.id;

    const res = await initiatePayHeroStkPush({
      amount: sale.total,
      phoneNumber: phone,
      externalReference: created.id,
      customerName: sale.customerName || undefined,
    });
    const reference = res.reference || res.CheckoutRequestID;
    if (res.success === false || !reference) throw new Error('Provider did not accept the payment request');
    await prisma.posMpesaRequest.update({ where: { id: created.id }, data: { reference } });

    return NextResponse.json({ requestId: created.id, amount: sale.total, phone });
  } catch (error) {
    if (requestId) {
      await prisma.posMpesaRequest.update({
        where: { id: requestId },
        data: { status: 'FAILED', resultDesc: 'The M-Pesa prompt could not be sent.' },
      }).catch(() => {});
    }
    if (error instanceof PosSaleError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('POS M-Pesa prompt failed:', error);
    return NextResponse.json({ error: 'The M-Pesa prompt could not be sent. Check the number and try again.' }, { status: 502 });
  }
}

/** The till polls this until the customer has paid (or declined). */
export async function GET(request: Request) {
  const user = await staffSession();
  if (!user) return NextResponse.json({ error: 'Please sign in to the till.' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: 'Unknown payment request.' }, { status: 400 });

  const existing = await prisma.posMpesaRequest.findUnique({ where: { id } });
  if (!existing || (existing.cashierId !== user.id && !ADMINS.includes(user.role))) {
    return NextResponse.json({ error: 'Unknown payment request.' }, { status: 404 });
  }

  try {
    const current = await reconcilePosMpesa(id);
    const sale = current.status === 'COMPLETED' && current.saleNumber
      ? await prisma.posSale.findUnique({ where: { saleNumber: current.saleNumber } })
      : null;
    return NextResponse.json(
      { status: current.status.toLowerCase(), resultDesc: current.resultDesc, sale },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('POS M-Pesa check failed:', error);
    return NextResponse.json({ status: 'pending', resultDesc: 'Still checking with M-Pesa…' });
  }
}
