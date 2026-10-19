'use client';

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import HomeTab from './components/HomeTab';
import ShopTab from './components/ShopTab';
import PrescriptionsTab from './components/PrescriptionsTab';
import PrescriptionModal from './components/PrescriptionModal';
import OrdersTab from './components/OrdersTab';
import Footer from './components/Footer';
import Toast from './components/Toast';
import Cart from './components/Cart';
import { useSession } from 'next-auth/react';
import { Session } from 'next-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PublicProduct } from './lib/products';

const TABS = ['home', 'shop', 'prescriptions', 'orders'];

export default function PharmacyWebsite() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession() as { data: Session | null; status: string };
  const [activeTab, updateActiveTab] = useState('home');
  const [category, setCategory] = useState('All');
  const setActiveTab = (tab: string) => { updateActiveTab(tab); window.history.pushState(null, '', '#' + tab); window.scrollTo({ top: 0, behavior: 'instant' }); };
  useEffect(() => { const sync = () => { const tab = window.location.hash.slice(1); updateActiveTab(TABS.includes(tab) ? tab : 'home'); }; sync(); window.addEventListener('popstate', sync); window.addEventListener('hashchange', sync); return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); }; }, []);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [rxOpen, setRxOpen] = useState(false);
  const [rxMedicine, setRxMedicine] = useState('');
  const [rxSent, setRxSent] = useState(0);
  // Remounting the form on each open clears the previous patient's details.
  const [rxFormKey, setRxFormKey] = useState(0);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const askToSignIn = (message = 'Please sign in or create an account to add items to your bag.') => {
    showToast(message, 'error');
    setTimeout(() => router.push('/login?callbackUrl=' + encodeURIComponent('/#shop')), 1500);
  };

  const handleAddToCart = async (product: PublicProduct) => {
    if (!session?.user) return askToSignIn();
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      if (response.status === 401) return askToSignIn();
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        showToast(`${product.name} added to your bag.`, 'success');
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        showToast(data.error || 'Failed to add item. Try again.', 'error');
      }
    } catch (error) {
      console.error('Cart error:', error);
      showToast('Network error. Please check your connection.', 'error');
    }
  };

  const openCategory = (c: string) => { setCategory(c); setActiveTab('shop'); };
  const sendPrescription = (medicine = '') => { setRxMedicine(medicine); setRxFormKey((k) => k + 1); setRxOpen(true); };

  return (
    <div className="min-h-screen">
      <div className="relative z-10">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} onCartClick={() => setIsCartOpen(true)} />
        {toast.show && <Toast message={toast.message} type={toast.type} />}
        <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

        <main id="main-content" tabIndex={-1}>
          <div key={activeTab} className="pb-10">
            {activeTab === 'home' && <HomeTab setActiveTab={setActiveTab} openCategory={openCategory} handleAddToCart={handleAddToCart} onSendPrescription={sendPrescription} />}
            {activeTab === 'shop' && <ShopTab category={category} setCategory={setCategory} handleAddToCart={handleAddToCart} onSendPrescription={sendPrescription} />}
            {activeTab === 'prescriptions' && <PrescriptionsTab onSend={() => sendPrescription()} refreshKey={rxSent} />}

            {activeTab === 'orders' && !session?.user && (
              authStatus === 'loading' ? (
                <p className="empty-state" role="status">Loading your account…</p>
              ) : (
                <div className="empty-state">
                  <h2>Sign in to see your orders.</h2>
                  <p>Your orders are saved to your account.</p>
                  <Link href={'/login?callbackUrl=' + encodeURIComponent('/#orders')} className="shop-button">Sign in</Link>
                </div>
              )
            )}
            {activeTab === 'orders' && session?.user && <OrdersTab userId={session.user.id} />}
          </div>
        </main>

        <PrescriptionModal key={rxFormKey} isOpen={rxOpen} onClose={() => setRxOpen(false)} medicine={rxMedicine} onSent={() => setRxSent((n) => n + 1)} />
        <Footer setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}
