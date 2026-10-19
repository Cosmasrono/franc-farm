import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getAppSession } from '@/app/lib/auth-options';
import {
  PosSaleError, STAFF_ROLES as STAFF, assertMpesaCodeUnused, normalizeMpesaCode, prepareSale, recordSale,
} from '@/app/lib/pos-sale';

const ADMINS = ['ADMIN', 'SUPER_ADMIN'];

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session?.user || !STAFF.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date'); // YYYY-MM-DD
    const cashierIdParam = searchParams.get('cashierId');

    let from: Date;
    let to: Date | undefined;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      from = new Date(`${dateParam}T00:00:00.000Z`);
      to = new Date(`${dateParam}T23:59:59.999Z`);
    } else {
      from = new Date();
      from.setDate(from.getDate() - 7);
    }

    const where = {
      createdAt: { gte: from, ...(to && { lte: to }) },
      ...(cashierIdParam && /^[a-f\d]{24}$/i.test(cashierIdParam) && { cashierId: cashierIdParam }),
    };

    const sales = await prisma.posSale.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });

    const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const cashTotal = sales.filter((s) => s.paymentMethod === 'CASH').reduce((sum, s) => sum + (s.total || 0), 0);
    const mpesaTotal = sales.filter((s) => s.paymentMethod === 'MPESA').reduce((sum, s) => sum + (s.total || 0), 0);
    const otherTotal = totalRevenue - cashTotal - mpesaTotal;

    return NextResponse.json({
      sales,
      summary: { totalCount: sales.length, totalRevenue, cashTotal, mpesaTotal, otherTotal },
    });
  } catch (error) {
    console.error('Error fetching POS sales:', error);
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
  }
}

/** Records a cash sale, or (admins only) an M-Pesa payment typed in by code.
 *  Cashiers take M-Pesa through /api/pos/mpesa, which confirms it with PayHero. */
export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session?.user?.id || !STAFF.includes(session.user.role)) {
    return NextResponse.json({ error: 'Please sign in to the till.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const method = body.paymentMethod;
    if (method !== 'CASH' && method !== 'MPESA') throw new PosSaleError('Payment must be Cash or M-Pesa.');
    if (method === 'MPESA' && !ADMINS.includes(session.user.role)) {
      throw new PosSaleError('Send an M-Pesa prompt to the customer’s phone to take M-Pesa.', 403);
    }

    const sale = await prepareSale(body, session.user.role);

    let mpesaCode: string | null = null;
    let amountPaid = sale.total;
    let changeDue = 0;
    if (method === 'MPESA') {
      mpesaCode = normalizeMpesaCode(body.mpesaCode);
      await assertMpesaCodeUnused(mpesaCode);
    } else {
      const tendered = Number(body.amountPaid);
      if (!Number.isFinite(tendered) || tendered < sale.total) {
        throw new PosSaleError(`Cash received is less than the total due (KSh ${sale.total.toLocaleString()}).`);
      }
      amountPaid = tendered;
      changeDue = Math.round((tendered - sale.total) * 100) / 100;
    }

    const created = await recordSale(
      sale,
      { method, amountPaid, changeDue, mpesaCode },
      { id: session.user.id, name: session.user.name || session.user.email || 'Cashier', role: session.user.role },
    );
    return NextResponse.json({ success: true, sale: created });
  } catch (error) {
    if (error instanceof PosSaleError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error creating POS sale:', error);
    return NextResponse.json({ error: 'Failed to record sale' }, { status: 500 });
  }
}
