'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { BarChart3, ClipboardList, Clock, Cross, LayoutDashboard, LogOut, Megaphone, Package, Receipt, ShoppingBag, Stethoscope, Store, Users, Wallet, X } from 'lucide-react';
import { BRAND } from '@/app/lib/brand';

const managementLinks = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products & stock', icon: Package },
  { href: '/admin/prescriptions', label: 'Prescriptions', icon: Stethoscope },
  { href: '/admin/orders', label: 'Online orders & payments', icon: ShoppingBag },
  { href: '/admin/pos-sales', label: 'POS sales & reports', icon: Receipt },
  { href: '/admin/reports', label: 'System reports', icon: BarChart3 },
  { href: '/admin/expenses', label: 'Expenses', icon: Wallet },
  { href: '/admin/users', label: 'Staff & users', icon: Users },
  { href: '/admin/promotions', label: 'Promotions', icon: Megaphone },
];

/** Till-only actions; they open the till's own panels, so they show only on /pos. */
export interface TillActions {
  onOrders: () => void;
  onHistory: () => void;
  onShift: () => void;
  newOrderCount: number;
}

interface Props {
  isAdmin: boolean;
  open: boolean;
  onClose: () => void;
  till?: TillActions;
  /** The parent is already a fixed-height layout (the till): fill it instead of pinning to the window. */
  fillParent?: boolean;
}

/**
 * Staff navigation: pinned on the left from 1024px wide (it does not scroll with the page),
 * and a slide-out menu on smaller screens.
 */
export default function StaffSidebar({ isAdmin, open, onClose, till, fillParent }: Props) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  // Close the slide-out menu after navigating.
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const itemClass = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  const current = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const link = (href: string, label: string, Icon: typeof Store) => (
    <Link key={href} href={href} onClick={onClose} aria-current={current(href) ? 'page' : undefined} className={`${itemClass} ${current(href) ? 'bg-white/15 text-white' : ''}`}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />{label}
    </Link>
  );
  const action = (callback: () => void) => { onClose(); callback(); };
  const content = (
    <>
      <div className="flex items-center gap-2 border-b border-white/15 px-5 py-5">
        <Cross className="size-6 shrink-0" aria-hidden="true" />
        <div><p className="font-bold tracking-wide">{BRAND.wordmark}</p><p className="mt-1 text-[10px] uppercase tracking-widest text-emerald-100/70">Pharmacy workspace</p></div>
      </div>
      <nav aria-label="POS and system navigation" className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        <div className="space-y-1">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-100/60">Point of sale</p>
          {link('/pos', 'Sales terminal', Store)}
          {till && <>
            <button type="button" onClick={() => action(till.onOrders)} className={itemClass}><ClipboardList className="size-4 shrink-0" aria-hidden="true" /><span className="flex-1">Orders & prescriptions</span>{till.newOrderCount > 0 && <span className="rounded-full bg-emerald-200 px-1.5 text-xs text-emerald-950" aria-label={`${till.newOrderCount} new orders`}>{till.newOrderCount}</span>}</button>
            <button type="button" onClick={() => action(till.onHistory)} className={itemClass}><Receipt className="size-4 shrink-0" aria-hidden="true" />Sales history & receipts</button>
            <button type="button" onClick={() => action(till.onShift)} className={itemClass}><Clock className="size-4 shrink-0" aria-hidden="true" />Register stats</button>
          </>}
        </div>
        {isAdmin && <div className="space-y-1">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-100/60">Management</p>
          {managementLinks.map(({ href, label, icon }) => link(href, label, icon))}
        </div>}
        <div className="space-y-1 border-t border-white/15 pt-3">
          <Link href="/" onClick={onClose} className={itemClass}><ShoppingBag className="size-4 shrink-0" aria-hidden="true" />Pharmacy website</Link>
          <button type="button" onClick={() => signOut({ callbackUrl: '/login' })} className={itemClass}><LogOut className="size-4 shrink-0" aria-hidden="true" />Sign out</button>
        </div>
      </nav>
    </>
  );

  return <>
    <aside className={`no-print hidden w-56 shrink-0 flex-col bg-[#103d33] text-emerald-50 lg:flex xl:w-60 ${fillParent ? '' : 'sticky top-0 h-dvh self-start'}`}>{content}</aside>
    <dialog ref={dialog} id="staff-menu" aria-label="System menu" onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="no-print fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] border-0 bg-[#103d33] p-0 text-emerald-50 shadow-2xl backdrop:bg-black/40">
      <div className="flex h-full flex-col">
        <div className="flex justify-end px-3 pt-3"><button type="button" autoFocus onClick={onClose} aria-label="Close system menu" className="rounded-lg p-2 hover:bg-white/10"><X className="size-5" /></button></div>
        {content}
      </div>
    </dialog>
  </>;
}
