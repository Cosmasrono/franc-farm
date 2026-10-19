import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getAppSession } from '@/app/lib/auth-options';
import { OPEN_STATUSES, PRESCRIPTION_STATUSES, STATUS_LABELS, prescriptionReference, type PrescriptionStatus } from '@/app/lib/prescriptions';
import { FINAL_STAGES, OrderStage, STAGE_LABEL, nextStage, stageOf } from '@/app/lib/order-stages';
import { googleMapsLink } from '@/app/lib/delivery';

const STAFF = ['CASHIER', 'ADMIN', 'SUPER_ADMIN'];
/** How far back the till looks for website orders still being worked on. */
const ACTIVE_DAYS = 14;

type StoredItem = { id?: string; productId?: string; cakeName?: string; name?: string; price?: number; quantity?: number; image?: string };
type StoredOrder = {
  items?: StoredItem[];
  subtotal?: number;
  deliveryFee?: number;
  deliveryDetails?: {
    customerName?: string; phoneNumber?: string; deliveryAddress?: string; deliveryMethod?: string;
    deliveryDate?: string; orderNotes?: string; paymentType?: string;
    location?: { lat: number; lng: number }; distanceKm?: number; durationMin?: number | null; distanceEstimated?: boolean;
  };
};

/** Matches the order only if nobody moved it meanwhile (older orders have no stage saved at all). */
function stillAt(fulfilment: string | null) {
  return fulfilment ? { fulfilment } : { OR: [{ fulfilment: null }, { fulfilment: { isSet: false } }] };
}

export async function GET() {
  const session = await getAppSession();
  if (!session?.user || !STAFF.includes(session.user.role)) {
    return NextResponse.json({ error: 'Please sign in to the till.' }, { status: 401 });
  }

  try {
    // Website orders the pharmacy still has to act on: cash orders not yet paid,
    // and paid orders not yet delivered or collected.
    const since = new Date(Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000);
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: since },
        OR: [
          { status: 'PENDING', merchantRequestId: 'PAY_ON_DELIVERY' },
          { status: 'COMPLETED' },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const webOrders = payments
      .filter((p) => {
        const data = (p.cartItems as StoredOrder | null) || {};
        return Array.isArray(data.items) && !FINAL_STAGES.includes(stageOf(p.fulfilment));
      })
      .map((p) => {
        const data = (p.cartItems as StoredOrder | null) || {};
        const details = data.deliveryDetails || {};
        const items = (data.items || []).map((item) => ({
          id: item.id || '',
          productId: item.id || '',
          // Orders placed before the switch to the pharmacy stored the name as cakeName.
          name: item.name || item.cakeName || 'Website item',
          category: 'Website Order',
          price: item.price || 0,
          quantity: item.quantity || 1,
          image: item.image || '',
        }));
        if (data.deliveryFee && data.deliveryFee > 0) {
          items.push({ id: `delivery-${p.id}`, productId: 'delivery-fee', name: 'Delivery Fee', category: 'Delivery', price: data.deliveryFee, quantity: 1, image: '' });
        }
        const method = details.deliveryMethod === 'pickup' ? 'pickup' : 'delivery';
        const stage = stageOf(p.fulfilment);
        const paid = p.status === 'COMPLETED';
        return {
          id: p.id,
          source: 'storefront',
          orderType: method,
          customerName: details.customerName || 'Website customer',
          customerPhone: details.phoneNumber || p.phoneNumber || '',
          deliveryAddress: method === 'pickup' ? 'Store pickup' : details.deliveryAddress || '',
          distanceKm: method === 'delivery' ? details.distanceKm ?? null : null,
          mapUrl: method === 'delivery' && details.location ? googleMapsLink(details.location) : null,
          deliveryDate: details.deliveryDate || '',
          orderNotes: details.orderNotes || '',
          paid,
          paymentLabel: paid
            ? p.mpesaReceiptNumber ? `Paid · M-Pesa ${p.mpesaReceiptNumber}` : 'Paid'
            : method === 'pickup' ? 'Cash due on pickup' : 'Cash due on delivery',
          stage,
          stageLabel: STAGE_LABEL[stage],
          next: nextStage(stage, method),
          items,
          subtotal: data.subtotal || p.amount,
          deliveryFee: data.deliveryFee || 0,
          total: p.amount,
          createdAt: p.createdAt,
        };
      });

    // Prescriptions sent in online. They carry no priced lines: the pharmacist
    // reads the prescription and adds the medicines from stock at the till.
    const requests = await prisma.prescriptionRequest.findMany({
      where: { status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'asc' },
      take: 30,
    });
    const prescriptions = requests.map((rx) => {
      const delivery = rx.deliveryMethod === 'delivery';
      return {
        id: rx.id,
        source: 'prescription',
        rxSource: rx.source,
        reference: prescriptionReference(rx.id),
        orderType: delivery ? 'delivery' : 'pickup',
        customerName: rx.patientName,
        customerPhone: rx.phone,
        deliveryAddress: delivery ? rx.deliveryAddress || 'Address to confirm' : 'Collect at the pharmacy',
        distanceKm: null,
        mapUrl: null,
        deliveryDate: '',
        orderNotes: [rx.medicines && `Asked for: ${rx.medicines}`, rx.notes && `Note: ${rx.notes}`, rx.pharmacistNote && `Pharmacist: ${rx.pharmacistNote}`].filter(Boolean).join(' · '),
        fileUrl: rx.file ? `/api/prescriptions/${rx.id}/file` : null,
        rxStatus: rx.status,
        paid: false,
        paymentLabel: 'Prescription — price at the till',
        stage: 'NEW' as OrderStage,
        stageLabel: STATUS_LABELS[rx.status] || rx.status,
        next: null,
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        total: 0,
        createdAt: rx.createdAt,
      };
    });

    return NextResponse.json({ orders: [...webOrders, ...prescriptions] });
  } catch (error) {
    console.error('Error fetching online orders for POS:', error);
    return NextResponse.json({ error: 'Failed to fetch online orders' }, { status: 500 });
  }
}

/** Moves a website order to its next step, or cancels an unpaid one. */
export async function PATCH(request: Request) {
  const session = await getAppSession();
  if (!session?.user || !STAFF.includes(session.user.role)) {
    return NextResponse.json({ error: 'Please sign in to the till.' }, { status: 401 });
  }

  try {
    const { orderId, source, status, stage, cashierNote } = await request.json();
    if (typeof orderId !== 'string' || !/^[a-f\d]{24}$/i.test(orderId)) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }
    const by = session.user.name || session.user.email || 'Cashier';
    const note = typeof cashierNote === 'string' ? cashierNote.trim().slice(0, 300) : '';

    if (source === 'prescription') {
      // "dispensed" is set by the sale itself, so the till can't mark one dispensed without selling it.
      if (!PRESCRIPTION_STATUSES.includes(status as PrescriptionStatus) || status === 'dispensed') {
        return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
      }
      await prisma.prescriptionRequest.update({
        where: { id: orderId },
        data: { status, reviewedBy: by, reviewedAt: new Date(), ...(note && { pharmacistNote: note }) },
      });
      return NextResponse.json({ success: true });
    }

    const order = await prisma.payment.findUnique({ where: { id: orderId } });
    const data = (order?.cartItems as StoredOrder | null) || {};
    if (!order || !Array.isArray(data.items)) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    const current = stageOf(order.fulfilment);
    const log = [...((order.fulfilmentLog as object[] | null) || [])];

    // Cancelling: only a cash order nobody has paid for yet, before it leaves the shop.
    if (stage === 'CANCELLED' || status === 'cancelled') {
      if (order.merchantRequestId !== 'PAY_ON_DELIVERY' || order.status !== 'PENDING' || !['NEW', 'PREPARING'].includes(current)) {
        return NextResponse.json({ error: 'Only unpaid cash orders that have not left the shop can be cancelled.' }, { status: 409 });
      }
      const res = await prisma.payment.updateMany({
        where: { id: orderId, status: 'PENDING', ...stillAt(order.fulfilment) },
        data: {
          status: 'CANCELLED',
          fulfilment: 'CANCELLED',
          fulfilmentLog: [...log, { stage: 'CANCELLED', at: new Date().toISOString(), by, note }],
          resultDesc: `Cancelled at POS by ${by}. ${note}`.trim(),
        },
      });
      if (!res.count) return NextResponse.json({ error: 'This order just changed. Refresh and try again.' }, { status: 409 });
      return NextResponse.json({ success: true });
    }

    const method = data.deliveryDetails?.deliveryMethod === 'pickup' ? 'pickup' : 'delivery';
    const next = nextStage(current, method);
    if (!next || stage !== next) {
      return NextResponse.json({ error: 'This order just changed. Refresh and try again.' }, { status: 409 });
    }
    // Handing over the medicines closes the order, so it must be paid for by then.
    if ((next === 'DELIVERED' || next === 'COLLECTED') && order.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Take payment first: load the order into the till and check it out (cash or M-Pesa).' },
        { status: 409 },
      );
    }
    const res = await prisma.payment.updateMany({
      where: { id: orderId, ...stillAt(order.fulfilment) },
      data: { fulfilment: next, fulfilmentLog: [...log, { stage: next, at: new Date().toISOString(), by }] },
    });
    if (!res.count) return NextResponse.json({ error: 'This order just changed. Refresh and try again.' }, { status: 409 });
    return NextResponse.json({ success: true, stage: next });
  } catch (error) {
    console.error('Error updating online order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
