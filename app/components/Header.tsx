'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, Menu, X, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import useSWR from 'swr';
import type { AppSession } from '@/app/lib/auth-options';
import Wordmark from './Wordmark';

interface Props { activeTab: string; setActiveTab: (tab: string) => void; onCartClick: () => void }
export default function Header({ activeTab, setActiveTab, onCartClick }: Props) {
  const { data: session } = useSession() as { data: AppSession | null };
  const [open, setOpen] = useState(false);
  const { data, mutate } = useSWR<{ quantity: number }[]>(session?.user ? '/api/cart' : null, async (url: string) => {
    const res = await fetch(url); if (!res.ok) throw new Error('Unable to load bag'); return res.json();
  });
  useEffect(() => { const refresh = () => { void mutate(); }; window.addEventListener('cartUpdated', refresh); return () => window.removeEventListener('cartUpdated', refresh); }, [mutate]);
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  const count = data?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const nav = [{ id: 'home', label: 'Home' }, { id: 'shop', label: 'Shop' }, { id: 'prescriptions', label: 'Prescriptions' }];
  const navigate = (id: string) => { setActiveTab(id); setOpen(false); };
  const role = session?.user?.role || '';
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(role);
  const isStaff = isAdmin || role === 'CASHIER';
  return <header className="shop-header">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div className="shop-container header-inner">
      <Wordmark onClick={() => navigate('home')} />
      <nav className="desktop-nav" aria-label="Main navigation">{nav.map(item => <button key={item.id} onClick={() => navigate(item.id)} aria-current={item.id === activeTab ? 'page' : undefined}>{item.label}</button>)}</nav>
      <div className="header-actions">
        {/* On phones these move into the menu, so the header keeps just the bag and menu button. */}
        {session?.user ? <div className="account-links"><Link className="account-link" href="/orders">My orders</Link>{isStaff && <Link className="account-link font-semibold text-[#0e6b5c]" href="/pos">POS Terminal</Link>}{isAdmin && <Link className="account-link" href="/admin/dashboard">Admin</Link>}<button className="icon-button" aria-label="Sign out" onClick={() => signOut({ callbackUrl: '/' })}><LogOut size={18} /></button></div> : <Link className="account-link" href="/login">Sign in</Link>}
        <button className="bag-button" onClick={onCartClick} aria-label={`Shopping bag, ${count} items`}><ShoppingBag size={19} /><span>{count}</span></button>
        <button className="icon-button mobile-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
    </div>
    {open && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
      {nav.map(item => <button key={item.id} onClick={() => navigate(item.id)} aria-current={activeTab === item.id ? 'page' : undefined}>{item.label}</button>)}
      <div className="mobile-nav-account">
        {session?.user ? <>
          <Link href="/orders" onClick={() => setOpen(false)}>My orders</Link>
          {isStaff && <Link href="/pos" onClick={() => setOpen(false)}>POS Terminal</Link>}
          {isAdmin && <Link href="/admin/dashboard" onClick={() => setOpen(false)}>Admin</Link>}
          <button onClick={() => signOut({ callbackUrl: '/' })}>Sign out</button>
        </> : <>
          <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>
          <Link href="/signup" onClick={() => setOpen(false)}>Create an account</Link>
        </>}
      </div>
    </nav>}
  </header>;
}
