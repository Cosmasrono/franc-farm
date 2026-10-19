'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { ArrowLeft, CheckCircle, Smartphone, ShoppingBag } from 'lucide-react';
import Packshot from '@/app/components/Packshot';
import { formatToKsh } from '@/app/lib/currency';
import Wordmark from '@/app/components/Wordmark';
import LocationPicker from '@/app/components/LocationPicker';
import { DELIVERY_RATES, type LatLng } from '@/app/lib/delivery';

/** Same rule the server applies: 07xx / 01xx, with or without +254. */
const isKenyanMobile = (value: string) => {
  let digits = value.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  if (digits.startsWith('254') && digits.length === 12) digits = '0' + digits.slice(3);
  if (/^[17]\d{8}$/.test(digits)) digits = '0' + digits;
  return /^0[17]\d{8}$/.test(digits);
};

interface Item { id: string; name: string; quantity: number; price: number; image: string; category?: string; strength?: string | null; dosageForm?: string | null }
interface Quote { items: Item[]; subtotal: number; deliveryFee: number; total: number; needsLocation?: boolean; distance?: { km: number; minutes: number | null; estimated: boolean } | null }
interface PaymentResult { status: string; amount: number; mpesaReceiptNumber: string | null; resultDesc?: string }

export default function PaymentContent() {
  const { data: session, status: authStatus } = useSession();
  const [method, setMethod] = useState('delivery');
  const [paymentChoice, setPaymentChoice] = useState<'mpesa' | 'cash'>('mpesa');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [receipt, setReceipt] = useState<PaymentResult | null>(null);
  const [paidQuote, setPaidQuote] = useState<Quote | null>(null);
  const [pollExpired, setPollExpired] = useState(false);
  const [podSuccess, setPodSuccess] = useState<any | null>(null);
  // What the customer typed, so a failed or cancelled payment does not wipe the form.
  const [details, setDetails] = useState({ name: '', phone: '', address: '', date: '', notes: '' });
  const [pollRound, setPollRound] = useState(0);
  const [location, setLocation] = useState<LatLng | null>(null);
  const needsPin = method === 'delivery' && !location;

  const { data: quote, error: quoteError, isLoading, mutate } = useSWR<Quote>(
    session?.user && !pendingId && !receipt && !podSuccess
      ? '/api/checkout?deliveryMethod=' + method + (method === 'delivery' && location ? `&lat=${location.lat}&lng=${location.lng}` : '')
      : null,
    async (url: string) => {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load checkout.');
      return data;
    }
  );

  useEffect(() => {
    if (!pendingId) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const poll = async () => {
      try {
        const res = await fetch('/api/check-payment?paymentId=' + pendingId, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.status === 'completed') {
          setReceipt(data);
          setPendingId('');
          setBusy(false);
          window.dispatchEvent(new Event('cartUpdated'));
          return;
        }
        if (res.ok && ['failed', 'cancelled'].includes(data.status)) {
          setError(data.resultDesc || 'Payment was not completed. You can try again.');
          setPendingId('');
          setBusy(false);
          return;
        }
      } catch {
        /* Keep checking during transient network failures. */
      }
      if (cancelled) return;
      if (Date.now() - started > 120000) {
        setPollExpired(true);
        setBusy(false);
        return;
      }
      timeout = setTimeout(poll, 3000);
    };
    timeout = setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [pendingId, pollRound]);

  const checkAgain = () => {
    setPollExpired(false);
    setBusy(true);
    setPollRound((n) => n + 1);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quote) return;
    if (needsPin) { setError('Pin your delivery location on the map.'); return; }
    setBusy(true);
    setError('');
    setPollExpired(false);
    const form = new FormData(event.currentTarget);
    const entered = {
      name: String(form.get('name') || ''),
      phone: String(form.get('phone') || ''),
      address: String(form.get('address') || ''),
      date: String(form.get('date') || ''),
      notes: String(form.get('notes') || ''),
    };
    setDetails(entered);
    if (!isKenyanMobile(entered.phone)) {
      setError('Enter a valid Kenyan mobile number, for example 0712 345 678.');
      setBusy(false);
      return;
    }

    const payload = {
      phoneNumber: form.get('phone'),
      customerName: form.get('name'),
      deliveryAddress: form.get('address'),
      deliveryMethod: method,
      deliveryLocation: method === 'delivery' ? location : null,
      deliveryDate: form.get('date'),
      orderNotes: form.get('notes'),
      expectedAmount: quote.total,
    };

    try {
      if (paymentChoice === 'cash') {
        const res = await fetch('/api/checkout/pod', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setBusy(false);
          setError(data.error || 'Could not place order.');
          if (res.status === 409) void mutate();
          return;
        }
        setPodSuccess({ ...data, quote });
        setBusy(false);
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        const res = await fetch('/api/mpesa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.paymentId) {
            setPaidQuote(quote);
            setPendingId(data.paymentId);
          } else setBusy(false);
          setError(data.error || 'Could not start payment.');
          void mutate();
          return;
        }
        setPaidQuote(data.quote);
        setPendingId(data.paymentId);
      }
    } catch {
      setError('The connection was interrupted. Check My orders before trying again.');
      setBusy(false);
    }
  };

  const shownQuote = paidQuote && (pendingId || receipt) ? paidQuote : podSuccess ? podSuccess.quote : quote;
  const header = (
    <header className="shop-header">
      <div className="shop-container header-inner">
        <Wordmark />
        <Link href="/" className="text-link">
          <ArrowLeft size={15} /> Continue shopping
        </Link>
      </div>
    </header>
  );

  const items = (value?: Quote) =>
    value?.items.map((item) => (
      <div key={item.id} className="checkout-item">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            width={65}
            height={65}
            className="object-cover aspect-square"
            unoptimized={item.image.startsWith('/uploads/')}
          />
        ) : (
          <Packshot name={item.name} strength={item.strength} dosageForm={item.dosageForm} category={item.category || ''} className="w-[65px] h-[65px] rounded shrink-0" />
        )}
        <div className="flex-1">
          <h3>{item.name}</h3>
          <p>Quantity: {item.quantity}</p>
        </div>
        <span>{formatToKsh(item.price * item.quantity)}</span>
      </div>
    ));

  if (podSuccess) {
    const pickup = method === 'pickup';
    return (
      <>
        {header}
        <main className="checkout-panel checkout-success">
          <CheckCircle className="text-emerald-700 mb-5" size={35} />
          <p className="eyebrow">ORDER RECEIVED</p>
          <h1>Thank you — your order is with the pharmacy.</h1>
          <p className="text-sm text-stone-600 leading-relaxed mb-6">
            Pay in cash {pickup ? 'when you collect your order at the shop' : 'when your order is delivered'}. You will
            get a receipt when you pay, and it will also appear in My orders.
          </p>
          {items(podSuccess.quote)}
          <div className="checkout-total final">
            <span>{pickup ? 'Total to pay on collection' : 'Total to pay on delivery'}</span>
            <span>{formatToKsh(podSuccess.quote?.total || 0)}</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-7 no-print">
            <Link className="shop-button" href="/orders">
              View my orders
            </Link>
            <button className="shop-button secondary" onClick={() => window.print()}>
              Print slip
            </button>
          </div>
        </main>
      </>
    );
  }

  // M-Pesa STK Confirmation Screen
  if (receipt) {
    return (
      <>
        {header}
        <main className="checkout-panel checkout-success">
          <CheckCircle className="text-emerald-700 mb-5" size={35} />
          <p className="eyebrow">THANK YOU FOR YOUR ORDER</p>
          <h1>Payment received.</h1>
          <p>Your order details are saved. You can view them any time in My orders.</p>
          {items(paidQuote || undefined)}
          <div className="checkout-total final">
            <span>Amount paid</span>
            <span>{formatToKsh(receipt.amount)}</span>
          </div>
          <p className="mt-5 text-sm">
            M-Pesa reference: {receipt.mpesaReceiptNumber || 'Awaiting receipt reference'}
          </p>
          <div className="flex flex-wrap gap-3 mt-7 no-print">
            <Link className="shop-button" href="/orders">
              View my orders
            </Link>
            <button className="shop-button secondary" onClick={() => window.print()}>
              Print receipt
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {header}
      <main className="shop-container">
        <div className="catalog-heading">
          <p className="eyebrow">ONE STEP CLOSER</p>
          <h1>Checkout</h1>
          <p>Review your order and tell us how you would like to receive it.</p>
        </div>
        {authStatus === 'loading' ? (
          <p className="empty-state" role="status">
            Loading your account…
          </p>
        ) : !session?.user ? (
          <div className="empty-state">
            <h2>Sign in to finish your order.</h2>
            <p>Your bag will be waiting for you.</p>
            <Link href="/login?callbackUrl=/payment" className="shop-button">
              Sign in
            </Link>
          </div>
        ) : quoteError?.message === 'Your bag is empty.' && !pendingId ? (
          <div className="empty-state">
            <ShoppingBag className="mx-auto mb-4 text-[#0e6b5c]" size={32} />
            <h2>Your bag is empty.</h2>
            <p>Add health products from the shop, then come back to check out.</p>
            <Link href="/#shop" className="shop-button">
              Go to the shop
            </Link>
          </div>
        ) : (
          <div className="checkout-grid">
            <section className="checkout-panel">
              {error && (
                <div role="alert" className="notice">
                  {error}
                </div>
              )}
              {pendingId ? (
                <div role="status">
                  <Smartphone className="text-[#0e6b5c] mb-5" size={32} />
                  <h2>{pollExpired ? 'Still waiting for confirmation.' : 'Check your phone.'}</h2>
                  <p className="text-sm text-stone-600 leading-7">
                    {pollExpired
                      ? 'Your payment may still complete. Check My orders before starting another payment.'
                      : 'Enter your M-Pesa PIN on the prompt sent to your phone. This page will update when payment is confirmed.'}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-6">
                    {pollExpired && (
                      <button type="button" className="shop-button" onClick={checkAgain}>
                        Check again
                      </button>
                    )}
                    <Link href="/orders" className="shop-button secondary">
                      View my orders
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={submit}>
                  <h2>1. Delivery &amp; Contact Details</h2>
                  <label>
                    Your name
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      maxLength={150}
                      defaultValue={details.name || session.user.name || ''}
                    />
                  </label>
                  <label>
                    Phone number
                    <input
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      placeholder="0712 345 678"
                      defaultValue={details.phone}
                    />
                  </label>
                  <label>
                    Delivery or pickup
                    <select value={method} onChange={(e) => setMethod(e.target.value)}>
                      <option value="delivery">Delivery</option>
                      <option value="pickup">Store pickup</option>
                    </select>
                  </label>
                  {method === 'delivery' && (
                    <div className="mb-5">
                      <p className="text-sm font-medium mb-2">Delivery location</p>
                      <LocationPicker value={location} onChange={setLocation} />
                      {quote?.distance && (
                        <p className="text-sm text-[#0e6b5c] font-medium mt-2" role="status">
                          {quote.distance.estimated ? 'About ' : ''}{quote.distance.km} km by road from the pharmacy
                        </p>
                      )}
                    </div>
                  )}
                  {method === 'delivery' && (
                    <label>
                      House, building or landmark
                      <textarea
                        name="address"
                        autoComplete="street-address"
                        required
                        maxLength={500}
                        rows={3}
                        placeholder="e.g. Sunrise Apartments, block B, house 12, blue gate"
                        defaultValue={details.address}
                      />
                    </label>
                  )}
                  <label>
                    Preferred date
                    <input
                      type="date"
                      name="date"
                      min={new Date().toLocaleDateString('en-CA')}
                      defaultValue={details.date}
                    />
                  </label>
                  <label>
                    A note for the pharmacy <span className="text-stone-400">(optional)</span>
                    <textarea
                      name="notes"
                      rows={2}
                      maxLength={1000}
                      placeholder="Directions for the rider, or a question for the pharmacist"
                      defaultValue={details.notes}
                    />
                  </label>

                  <h2 className="mt-8">2. How would you like to pay?</h2>
                  <div className="grid grid-cols-2 gap-3 mb-5" role="radiogroup" aria-label="Payment method">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paymentChoice === 'mpesa'}
                      onClick={() => setPaymentChoice('mpesa')}
                      className={`p-3.5 rounded-lg border text-left transition-all ${
                        paymentChoice === 'mpesa'
                          ? 'border-[#0e6b5c] bg-[#f0f8f5] text-[#0e6b5c]'
                          : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                      }`}
                    >
                      <p className="font-semibold text-xs uppercase tracking-wide">M-Pesa now</p>
                      <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                        A payment prompt is sent to your phone.
                      </p>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={paymentChoice === 'cash'}
                      onClick={() => setPaymentChoice('cash')}
                      className={`p-3.5 rounded-lg border text-left transition-all ${
                        paymentChoice === 'cash'
                          ? 'border-[#0e6b5c] bg-[#f0f8f5] text-[#0e6b5c]'
                          : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                      }`}
                    >
                      <p className="font-semibold text-xs uppercase tracking-wide">
                        Cash on {method === 'pickup' ? 'pickup' : 'delivery'}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                        {method === 'pickup' ? 'Pay at the counter when you collect.' : 'Pay the rider when your order arrives.'}
                      </p>
                    </button>
                  </div>

                  <p className="text-xs text-stone-500 leading-6 mb-5">
                    {paymentChoice === 'cash'
                      ? 'Your order goes straight to the pharmacy. Nothing is charged now.'
                      : 'We will send a payment prompt to your phone. Enter your PIN on your phone only.'}
                  </p>

                  <button
                    className="shop-button w-full"
                    disabled={busy || isLoading || !quote || !!quoteError || needsPin}
                  >
                    {busy
                      ? 'Submitting order…'
                      : needsPin
                      ? 'Pin your delivery location to continue'
                      : quote
                      ? paymentChoice === 'cash'
                        ? 'Place order — pay ' + formatToKsh(quote.total) + ' in cash'
                        : 'Pay ' + formatToKsh(quote.total) + ' with M-Pesa'
                      : 'Preparing your order…'}
                  </button>
                </form>
              )}
            </section>

            <aside className="checkout-panel checkout-summary">
              <h2>Your order</h2>
              {quoteError && !pendingId ? (
                <div role="alert">
                  <p className="notice">{quoteError.message}</p>
                  <button className="text-link" onClick={() => mutate()}>
                    Refresh order
                  </button>
                </div>
              ) : isLoading ? (
                <p role="status">Updating your order…</p>
              ) : (
                <>
                  {items(shownQuote)}
                  <div className="checkout-total">
                    <span>Subtotal</span>
                    <span>{formatToKsh(shownQuote?.subtotal || 0)}</span>
                  </div>
                  <div className="checkout-total">
                    <span>Delivery</span>
                    <span>
                      {shownQuote?.needsLocation ? 'Pin your location' : shownQuote?.deliveryFee ? formatToKsh(shownQuote.deliveryFee) : 'No charge'}
                    </span>
                  </div>
                  <div className="checkout-total final">
                    <span>Total</span>
                    <span>{formatToKsh(shownQuote?.total || 0)}</span>
                  </div>
                  <p className="text-xs text-stone-500 mt-5 leading-6">
                    Delivery is KSh {DELIVERY_RATES.base} plus KSh {DELIVERY_RATES.perKm} per km by road, within {DELIVERY_RATES.maxKm} km. Free for orders of {formatToKsh(DELIVERY_RATES.freeFrom)} and above. Pickup has no delivery charge.
                  </p>
                </>
              )}
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
