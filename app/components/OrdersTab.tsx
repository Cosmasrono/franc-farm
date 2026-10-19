'use client';
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { formatToKsh } from '@/app/lib/currency';
interface MyPrescription { id: string; reference: string; status: string; statusLabel: string; medicines: string | null; pharmacistNote: string | null; createdAt: string }
interface Order { id: string; status: string; stageLabel?: string | null; total: number; mpesaReceiptNumber?: string; createdAt: string; items: { name: string; quantity: number; price: number }[]; deliveryDetails?: { deliveryMethod: string; deliveryAddress: string; deliveryDate: string; paymentType?: string } }
const isCash = (o: Order) => o.deliveryDetails?.paymentType === 'PAY_AT_POS';
function statusLabel(o: Order) {
  if (o.status === 'completed') return isCash(o) && !o.mpesaReceiptNumber ? 'Paid in cash' : 'Payment confirmed';
  if (o.status === 'pending') return isCash(o) ? (o.deliveryDetails?.deliveryMethod === 'pickup' ? 'Pay cash on pickup' : 'Pay cash on delivery') : 'Awaiting payment confirmation';
  return 'Payment ' + o.status;
}
export default function OrdersTab({ userId }: { userId: string }) {
  const { data: orders, error, isLoading, mutate } = useSWR<Order[]>('/api/orders/user/' + userId, async (url: string) => { const res = await fetch(url); if (!res.ok) throw new Error('Unable to load orders'); return res.json(); });
  // Prescriptions are stored separately from checkouts, so they are loaded and listed alongside them.
  const { data: prescriptions } = useSWR<MyPrescription[]>('/api/prescriptions', async (url: string) => { const res = await fetch(url); if (!res.ok) throw new Error('Unable to load prescriptions'); return res.json(); });
  const [busy, setBusy] = useState(false);
  const refresh = async () => { setBusy(true); try { await Promise.all((orders || []).filter(o => o.status === 'pending' && !isCash(o)).map(o => fetch('/api/check-payment?paymentId=' + o.id))); await mutate(); } finally { setBusy(false); } };
  return <section className="shop-container shop-section"><div className="section-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h1 className="font-serif text-4xl">My orders</h1></div><button className="shop-button secondary" onClick={refresh} disabled={busy}>{busy ? 'Checking…' : 'Refresh payment status'}</button></div>
    {error ? <div className="empty-state" role="alert"><h2>We could not load your orders.</h2><p>Try refreshing your payment status.</p></div> : isLoading ? <p role="status">Loading orders…</p> : !orders?.length && !prescriptions?.length ? <div className="empty-state"><h2>No orders yet.</h2><p>Once you check out, your order details will appear here.</p><Link href="/#shop" className="shop-button">Go to the shop</Link></div> :
    <div className="space-y-6">{prescriptions?.map(rx => <article key={rx.id} className="checkout-panel"><div className="flex flex-wrap justify-between gap-4"><div><p className="eyebrow mb-2">PRESCRIPTION {rx.reference}</p><p className="text-xs text-stone-500">{new Date(rx.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div><span className="enquiry-status self-start" data-status={rx.status}>{rx.statusLabel}</span></div>{rx.medicines && <p className="text-sm text-stone-700 mt-4">{rx.medicines}</p>}{rx.pharmacistNote && <p className="text-sm text-stone-600 mt-2">Pharmacist: {rx.pharmacistNote}</p>}<p className="text-xs text-stone-500 mt-4">Our pharmacist will call you to confirm availability and the cost. You pay when you collect or receive it.</p></article>)}{orders?.map(order => <article key={order.id} className="checkout-panel"><div className="flex flex-wrap justify-between gap-4"><div><p className="eyebrow mb-2">ORDER {order.id.slice(-8).toUpperCase()}</p><p className="text-xs text-stone-500">{new Date(order.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div><div className="text-right">{order.stageLabel && order.status !== 'cancelled' && <p className="font-semibold text-sm text-[#0e6b5c]">{order.stageLabel}</p>}<span className={order.status === 'completed' ? 'text-emerald-800 text-sm' : 'text-stone-600 text-sm'}>{statusLabel(order)}</span></div></div>
    {order.items.map((item, i) => <div key={i} className="checkout-item justify-between"><span>{item.name} × {item.quantity}</span><span>{formatToKsh(item.price * item.quantity)}</span></div>)}<div className="checkout-total final"><span>Order total</span><span>{formatToKsh(order.total)}</span></div>{order.mpesaReceiptNumber && <p className="text-xs text-stone-500 mt-4">M-Pesa reference: {order.mpesaReceiptNumber}</p>}{order.deliveryDetails && <p className="text-sm text-stone-600 mt-5">{order.deliveryDetails.deliveryMethod === 'pickup' ? 'Store pickup' : 'Delivery: ' + order.deliveryDetails.deliveryAddress}{order.deliveryDetails.deliveryDate && ' · Preferred date: ' + order.deliveryDetails.deliveryDate}</p>}<p className="text-xs text-stone-500 mt-4">Your order&apos;s progress and payment are shown above and update as the pharmacy prepares it.</p></article>)}</div>}
  </section>;
}

