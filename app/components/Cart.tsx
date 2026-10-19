'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { X, Minus, Plus } from 'lucide-react';
import Packshot from './Packshot';
import useSWR from 'swr';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { formatToKsh } from '@/app/lib/currency';
interface Item { id: string; productId: string; name: string; price: number; image: string; quantity: number; problem: string | null; category?: string; strength?: string | null; dosageForm?: string | null }
export default function Cart({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { data: items = [], error, isLoading, mutate } = useSWR<Item[]>(isOpen && session?.user ? '/api/cart' : null, async (url: string) => { const res = await fetch(url); if (!res.ok) throw new Error('Unable to load your bag'); return res.json(); });
  const change = async (id: string, quantity: number) => {
    setBusy(true); setMessage('');
    try { const res = await fetch(`/api/cart?id=${id}&quantity=${quantity}`, { method: quantity < 1 ? 'DELETE' : 'PATCH' }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || 'Your bag could not be updated. Please try again.'); await mutate(); window.dispatchEvent(new Event('cartUpdated')); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const blocked = items.some(item => item.problem);
  return <Dialog open={isOpen} onClose={onClose} className="relative z-50"><div className="fixed inset-0 bg-black/35" aria-hidden="true" /><div className="fixed inset-0 flex justify-end"><DialogPanel className="w-full max-w-md bg-[#f8fbfa] h-full flex flex-col p-6 sm:p-8 shadow-xl"><div className="flex justify-between items-center border-b border-stone-200 pb-5"><DialogTitle className="font-serif text-3xl">Your bag</DialogTitle><button className="icon-button" aria-label="Close bag" onClick={onClose}><X size={20} /></button></div>
    <div className="flex-1 overflow-y-auto py-4">
      {!session?.user ? <div className="empty-state"><h2>Your bag is waiting.</h2><p>Sign in to save your bag and place an order.</p><Link href="/login" className="shop-button">Sign in</Link></div> : isLoading ? <p role="status">Loading your bag…</p> : error ? <div role="alert"><p>We could not load your bag.</p><button className="text-link" onClick={() => mutate()}>Try again</button></div> : !items.length ? <div className="empty-state"><h2>Your bag is empty.</h2><p>Add health products from the shop to get started.</p><button className="shop-button" onClick={onClose}>Continue browsing</button></div> : items.map(item => <div className="checkout-item" key={item.id}>
        {item.image ? <Image src={item.image} alt={item.name} width={76} height={76} className="object-cover aspect-square" unoptimized={item.image.startsWith('/uploads/')} /> : <Packshot name={item.name} strength={item.strength} dosageForm={item.dosageForm} category={item.category || ''} className="w-[76px] h-[76px] rounded shrink-0" />}
        <div className="flex-1"><h3>{item.name}</h3><p>{formatToKsh(item.price)}</p>{item.problem && <p className="text-xs! text-red-700!" role="alert">{item.problem}</p>}<div className="flex gap-2 items-center mt-2"><button disabled={busy} className="icon-button border border-stone-200" aria-label={`Decrease ${item.name} quantity`} onClick={() => change(item.id, item.quantity - 1)}><Minus size={14} /></button><span aria-live="polite" className="min-w-5 text-center">{item.quantity}</span><button disabled={busy || item.quantity >= 50 || !!item.problem} className="icon-button border border-stone-200" aria-label={`Increase ${item.name} quantity`} onClick={() => change(item.id, item.quantity + 1)}><Plus size={14} /></button></div></div>
        <button className="icon-button" disabled={busy} aria-label={`Remove ${item.name}`} onClick={() => change(item.id, 0)}><X size={15} /></button></div>)}
      {message && <p role="alert" className="notice mt-4">{message}</p>}
    </div>
    {session?.user && items.length > 0 && <div className="border-t border-stone-200 pt-5"><div className="flex justify-between mb-3"><span>Subtotal</span><strong>{formatToKsh(total)}</strong></div><p className="text-xs text-stone-500 mb-5">{blocked ? 'Fix or remove the items marked above to check out.' : 'Delivery is calculated at checkout.'}</p>{blocked ? <button className="shop-button w-full" disabled>Continue to checkout →</button> : <Link href="/payment" className="shop-button w-full" onClick={onClose}>Continue to checkout →</Link>}</div>}
  </DialogPanel></div></Dialog>;
}
