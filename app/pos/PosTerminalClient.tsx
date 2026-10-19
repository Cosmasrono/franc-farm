'use client';

import { useState, useEffect, useMemo, useCallback, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { OrderStage, STAGE_ACTION } from '@/app/lib/order-stages';
import { BRAND, WHATSAPP_NUMBER } from '@/app/lib/brand';
import { PRODUCT_CATEGORIES } from '@/app/lib/products';
import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import StaffSidebar from '@/app/components/StaffSidebar';
import { Menu } from 'lucide-react';
import {
  PosProduct,
  PosCartItem,
  formatKes,
  PosSalePayload,
} from '@/app/lib/pos';
import {
  FaSearch,
  FaPlus,
  FaMinus,
  FaTrashAlt,
  FaCashRegister,
  FaMoneyBillWave,
  FaMobileAlt,
  FaPrint,
  FaTimes,
  FaSignOutAlt,
  FaUserCircle,
  FaChartLine,
  FaClock,
  FaCheckCircle,
  FaTag,
  FaGlobe,
  FaBell,
  FaBellSlash,
  FaReceipt,
  FaTruck,
  FaStore,
  FaSync,
  FaFilePrescription,
} from 'react-icons/fa';

interface PosTerminalClientProps {
  initialProducts: PosProduct[];
  cashier: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

const ALERTS_KEY = 'pos-order-alerts';
function readAlertsPref(): boolean {
  try {
    return localStorage.getItem(ALERTS_KEY) !== 'off';
  } catch {
    return true;
  }
}
function subscribeAlertsPref(onChange: () => void) {
  window.addEventListener(ALERTS_KEY, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(ALERTS_KEY, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export default function PosTerminalClient({
  initialProducts,
  cashier,
}: PosTerminalClientProps) {
  // Products & Category State
  const [products, setProducts] = useState<PosProduct[]>(initialProducts);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Cart / Ticket State
  const [cart, setCart] = useState<PosCartItem[]>([]);
  // Phones show one panel at a time: the products, or the ticket.
  const [mobileView, setMobileView] = useState<'products' | 'ticket'>('products');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountType, setDiscountType] = useState<'FLAT' | 'PERCENT'>('FLAT');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItemForm, setCustomItemForm] = useState({ name: '', price: '' });

  // Linked online order (if an incoming website delivery/pickup order is loaded)
  const [activeOnlineOrder, setActiveOnlineOrder] = useState<{ id: string; source: string; reference?: string } | null>(null);
  // Prescription checked at the counter, needed when the ticket has prescription-only medicine.
  const [rxReference, setRxReference] = useState('');
  const [rxVerified, setRxVerified] = useState(false);
  const [tillNotice, setTillNotice] = useState('');
  const flash = (message: string) => { setTillNotice(message); setTimeout(() => setTillNotice(''), 3500); };

  // Keep prices identical to the website: reload them regularly, and update
  // anything already on the ticket (website-order lines keep the price the customer was quoted).
  const refreshProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/products', { cache: 'no-store' });
      if (!res.ok) return;
      const fresh: PosProduct[] = (await res.json()).products || [];
      setProducts(fresh);
      const byId = new Map(fresh.map((p) => [p.id, p]));
      setCart((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          const p = byId.get(item.productId);
          if (!p || (p.price === item.price && p.stock === item.maxQuantity)) return item;
          changed = true;
          return { ...item, price: p.price, maxQuantity: p.stock };
        });
        return changed ? next : prev;
      });
    } catch {
      /* keep the current list; try again next time */
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshProducts, 60_000);
    return () => clearInterval(interval);
  }, [refreshProducts]);

  // Online / Delivery Orders State
  const [showOnlineOrdersModal, setShowOnlineOrdersModal] = useState(false);
  const [onlineOrders, setOnlineOrders] = useState<any[]>([]);
  const [loadingOnlineOrders, setLoadingOnlineOrders] = useState(false);
  const newOrderCount = onlineOrders.filter((o) => o.stage === 'NEW').length;

  // Checkout State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MPESA'>('CASH');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [mpesaCode, setMpesaCode] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(cashier.role);
  // M-Pesa at the till: a PayHero prompt to the customer's phone. Admins may
  // instead type a code from the customer's SMS if PayHero is unavailable.
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaRequestId, setMpesaRequestId] = useState('');
  const [mpesaWaitExpired, setMpesaWaitExpired] = useState(false);
  const [manualMpesa, setManualMpesa] = useState(false);

  // Receipt State
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Shift / Register Stats Modal State
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftData, setShiftData] = useState<any | null>(null);
  const [loadingShift, setLoadingShift] = useState(false);

  // Sales History Modal State (Where cashier can view all past sales and reprint)
  const [showSalesHistoryModal, setShowSalesHistoryModal] = useState(false);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [loadingSalesHistory, setLoadingSalesHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Live Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
          ' • ' +
          now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- New-order alerts: chime, banner, desktop notification, tab title ---
  // The on/off choice is remembered per browser; alerts are on unless muted.
  const alertsOn = useSyncExternalStore(subscribeAlertsPref, readAlertsPref, () => true);
  const [orderAlerts, setOrderAlerts] = useState<any[]>([]);
  const seenOrderIds = useRef<Set<string> | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  const playChime = useCallback(() => {
    try {
      audioCtx.current ??= new AudioContext();
      const ctx = audioCtx.current;
      [880, 1175, 1568].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + i * 0.18;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch {
      /* audio blocked until the cashier has clicked somewhere */
    }
  }, []);

  const orderHeadline = (o: any) =>
    o.source === 'prescription'
      ? 'New prescription'
      : o.orderType === 'pickup' ? 'New pickup order' : 'New delivery order';

  const announceOrders = useCallback((fresh: any[]) => {
    setOrderAlerts((prev) => [...fresh, ...prev].slice(0, 5));
    if (!readAlertsPref()) return;
    playChime();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      for (const o of fresh.slice(0, 3)) {
        const n = new Notification(orderHeadline(o), {
          body: o.source === 'prescription'
            ? `${o.customerName} · ${o.reference} · review and dispense`
            : `${o.customerName} · ${o.items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')} · ${formatKes(o.total)}`,
          tag: `order-${o.id}`,
        });
        n.onclick = () => {
          window.focus();
          setShowOnlineOrdersModal(true);
          n.close();
        };
      }
    }
  }, [playChime]);

  const toggleAlerts = async () => {
    const next = !alertsOn;
    try { localStorage.setItem(ALERTS_KEY, next ? 'on' : 'off'); } catch { /* ignore */ }
    window.dispatchEvent(new Event(ALERTS_KEY));
    if (next) {
      playChime(); // also unlocks sound for later alerts
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  };

  // Fetch online / delivery orders
  const loadOnlineOrders = useCallback(async () => {
    setLoadingOnlineOrders(true);
    try {
      const res = await fetch('/api/pos/online-orders', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const orders: any[] = data.orders || [];
        setOnlineOrders(orders);
        // Alert only for orders that arrived since the till was opened.
        const ids = orders.map((o) => o.id);
        if (seenOrderIds.current === null) {
          seenOrderIds.current = new Set(ids);
        } else {
          const fresh = orders.filter((o) => o.stage === 'NEW' && !seenOrderIds.current!.has(o.id));
          ids.forEach((id) => seenOrderIds.current!.add(id));
          if (fresh.length) announceOrders(fresh);
        }
      }
    } catch (err) {
      console.error('Failed to load online orders', err);
    } finally {
      setLoadingOnlineOrders(false);
    }
  }, [announceOrders]);

  // Check for new website orders every 15 seconds
  useEffect(() => {
    loadOnlineOrders();
    const interval = setInterval(loadOnlineOrders, 15000);
    return () => clearInterval(interval);
  }, [loadOnlineOrders]);

  // Show waiting orders in the browser tab, so they're noticed from another tab.
  useEffect(() => {
    const base = `POS Terminal · ${BRAND.wordmark}`;
    const waiting = onlineOrders.filter((o) => o.stage === 'NEW').length;
    document.title = waiting ? `(${waiting}) New order${waiting > 1 ? 's' : ''} · ${base}` : base;
  }, [onlineOrders]);

  // Fetch sales history
  const loadSalesHistory = async () => {
    setLoadingSalesHistory(true);
    setShowSalesHistoryModal(true);
    try {
      const res = await fetch('/api/pos/sales');
      if (res.ok) {
        const data = await res.json();
        setSalesHistory(data.sales || []);
      }
    } catch (err) {
      console.error('Failed to load sales history', err);
    } finally {
      setLoadingSalesHistory(false);
    }
  };

  // Filter products
  // Only categories that have something on the till, in the shop's order.
  const categories = useMemo(() => ['All', ...PRODUCT_CATEGORIES.filter((c) => products.some((p) => p.category === c))], [products]);
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch = !q || [p.name, p.genericName, p.description, p.sku, p.strength].some((v) => v?.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);
  const ticketNeedsRx = cart.some((item) => item.requiresPrescription) && activeOnlineOrder?.source !== 'prescription';

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'PERCENT') {
      return (subtotal * Math.min(100, Math.max(0, discountValue))) / 100;
    }
    return Math.min(subtotal, Math.max(0, discountValue));
  }, [subtotal, discountType, discountValue]);

  const total = Math.max(0, subtotal - discountAmount);

  // Change Due calculation for Cash
  const numericAmountPaid = parseFloat(amountPaid) || 0;
  const changeDue = Math.max(0, numericAmountPaid - total);

  // Add product to cart. Expired or out-of-stock products can't be rung up,
  // and the ticket never asks for more than is on the shelf.
  const addToCart = (product: PosProduct) => {
    if (product.expired) return flash(`${product.name} has expired. Take it off the shelf.`);
    if (product.stock <= 0) return flash(`${product.name} is out of stock.`);
    const inTicket = cart.filter((item) => item.productId === product.id).reduce((s, i) => s + i.quantity, 0);
    if (inTicket >= product.stock) return flash(`Only ${product.stock} of ${product.name} in stock.`);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1, maxQuantity: product.stock } : item
        );
      }
      return [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.random()}`,
          productId: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          quantity: 1,
          image: product.image || undefined,
          maxQuantity: product.stock,
          ...(product.requiresPrescription && { requiresPrescription: true }),
        },
      ];
    });
  };

  // Modify cart quantity
  const updateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(itemId);
      return;
    }
    const item = cart.find((i) => i.id === itemId);
    if (item?.maxQuantity !== undefined && newQty > item.maxQuantity) {
      return flash(`Only ${item.maxQuantity} of ${item.name} in stock.`);
    }
    setCart((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity: newQty } : item))
    );
  };

  // Barcode scanners type the code and press Enter: add the one exact match.
  const handleSearchEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const code = searchQuery.trim().toLowerCase();
    const exact = products.filter((p) => p.sku && p.sku.toLowerCase() === code);
    const hit = exact.length === 1 ? exact[0] : filteredProducts.length === 1 ? filteredProducts[0] : null;
    if (hit) { addToCart(hit); setSearchQuery(''); }
  };

  // Only for custom lines; the server rejects typed prices on menu items.
  const updatePrice = (itemId: string, price: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === itemId && item.productId.startsWith('custom-')
          ? { ...item, price: Number.isFinite(price) && price > 0 ? price : 0 }
          : item,
      ),
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Clear all items from this order ticket?')) {
      setCart([]);
      setDiscountValue(0);
      setCustomerName('');
      setCustomerPhone('');
      setOrderNotes('');
      setActiveOnlineOrder(null);
      setRxReference('');
      setRxVerified(false);
    }
  };

  // Move a website order to its next step (preparing → out for delivery → delivered), or cancel it.
  const [orderBusyId, setOrderBusyId] = useState('');
  const [orderError, setOrderError] = useState('');
  const handleAdvanceOrder = async (order: any, stage: OrderStage) => {
    if (stage === 'CANCELLED' && !window.confirm(`Cancel ${order.customerName}'s order?`)) return;
    setOrderBusyId(order.id);
    setOrderError('');
    try {
      const res = await fetch('/api/pos/online-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, source: order.source, stage }),
      });
      const data = await res.json();
      if (!res.ok) setOrderError(data.error || 'Could not update the order.');
      await loadOnlineOrders();
    } catch {
      setOrderError('Network error. Please try again.');
    } finally {
      setOrderBusyId('');
    }
  };

  const handlePrescriptionStatus = async (order: { id: string; reference: string }, status: string) => {
    let note = '';
    if (status === 'declined') {
      const reason = window.prompt(`Decline ${order.reference}? Add a short reason for the record (the customer can see it).`);
      if (reason === null) return;
      note = reason;
    }
    setOrderBusyId(order.id);
    setOrderError('');
    try {
      const res = await fetch('/api/pos/online-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, source: 'prescription', status, cashierNote: note }),
      });
      const data = await res.json();
      if (!res.ok) setOrderError(data.error || 'Could not update the prescription.');
      await loadOnlineOrders();
    } catch {
      setOrderError('Network error. Please try again.');
    } finally {
      setOrderBusyId('');
    }
  };

  // Load an incoming website order, or a prescription to dispense, into the POS ticket.
  const handleLoadOnlineOrder = (order: any) => {
    setRxReference(order.source === 'prescription' ? order.reference : '');
    setRxVerified(order.source === 'prescription');
    setCart(
      order.items.map((it: any) => ({
        id: `item-${Date.now()}-${Math.random()}`,
        productId: it.productId || it.id,
        name: it.name,
        category: it.category || 'Website Order',
        price: it.price,
        quantity: it.quantity,
        image: it.image,
        notes: it.notes,
      }))
    );
    setCustomerName(order.customerName || '');
    setCustomerPhone(order.customerPhone || '');
    setOrderNotes(
      `[${order.orderType === 'pickup' ? 'PICKUP' : 'DELIVERY'}] ${
        order.deliveryAddress ? `To: ${order.deliveryAddress}` : ''
      } ${order.orderNotes ? `| Note: ${order.orderNotes}` : ''}`
    );
    setActiveOnlineOrder({ id: order.id, source: order.source, reference: order.reference });
    setShowOnlineOrdersModal(false);
    // A prescription arrives with no lines: the pharmacist adds the medicines from stock.
    setMobileView(order.source === 'prescription' ? 'products' : 'ticket');
  };

  // Add custom off-menu item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(customItemForm.price);
    if (!customItemForm.name.trim() || isNaN(priceNum) || priceNum <= 0) return;

    setCart((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        productId: `custom-${Date.now()}`,
        name: customItemForm.name.trim(),
        category: 'Custom',
        price: priceNum,
        quantity: 1,
      },
    ]);

    setCustomItemForm({ name: '', price: '' });
    setShowCustomItemModal(false);
  };

  // Open Checkout Modal
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    if (!activeOnlineOrder || activeOnlineOrder.source !== 'prescription') setRxVerified(false);
    void refreshProducts();
    setAmountPaid(total.toString());
    setMpesaPhone(customerPhone);
    setMpesaRequestId('');
    setMpesaWaitExpired(false);
    setManualMpesa(false);
    setCheckoutError('');
    setShowCheckoutModal(true);
  };

  // The ticket as the server needs it. It prices the items itself; for a
  // website order it uses the stored order.
  const buildPayload = (paidNum: number): PosSalePayload => ({
    items: cart,
    onlineOrder: activeOnlineOrder ? { id: activeOnlineOrder.id, source: activeOnlineOrder.source } : undefined,
    prescription: rxReference.trim() ? { reference: rxReference.trim(), verified: rxVerified } : undefined,
    subtotal,
    discount: discountAmount,
    total,
    paymentMethod,
    amountPaid: paidNum,
    changeDue: paymentMethod === 'CASH' ? changeDue : 0,
    mpesaCode: paymentMethod === 'MPESA' ? mpesaCode : undefined,
    customerName: customerName.trim() || undefined,
    customerPhone: (customerPhone.trim() || mpesaPhone.trim()) || undefined,
    notes: orderNotes.trim() || undefined,
  });

  const finishSale = (sale: any) => {
    // A website order settled at the till is marked paid by the sale itself.
    if (activeOnlineOrder) loadOnlineOrders();
    setCompletedSale(sale);
    setShowCheckoutModal(false);
    setShowReceiptModal(true);
    setCart([]);
    setDiscountValue(0);
    setCustomerName('');
    setCustomerPhone('');
    setOrderNotes('');
    setMpesaCode('');
    setMpesaPhone('');
    setMpesaRequestId('');
    setAmountPaid('');
    setActiveOnlineOrder(null);
    setRxReference('');
    setRxVerified(false);
    setMobileView('products');
    // Stock just changed: show the new counts straight away.
    void refreshProducts();
  };

  // Cash sale, or an M-Pesa code typed in by an admin.
  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    setCheckoutError('');

    const paidNum = parseFloat(amountPaid) || total;
    if (paymentMethod === 'CASH' && paidNum < total) {
      setCheckoutError(`Cash received (KSh ${paidNum}) is less than total due (KSh ${total})`);
      setIsProcessing(false);
      return;
    }

    try {
      const res = await fetch('/api/pos/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(paidNum)),
      });
      const data = await res.json();
      if (res.status === 409) void refreshProducts();
      if (!res.ok) throw new Error(data.error || 'Failed to complete sale');
      finishSale(data.sale);
    } catch (err: any) {
      setCheckoutError(err.message || 'Error recording transaction');
    } finally {
      setIsProcessing(false);
    }
  };

  // Sends a PayHero prompt to the customer's phone; the sale is recorded once they pay.
  const handleSendMpesaPrompt = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    setCheckoutError('');
    setMpesaWaitExpired(false);
    try {
      const res = await fetch('/api/pos/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildPayload(total), phoneNumber: mpesaPhone }),
      });
      const data = await res.json();
      if (res.status === 409) void refreshProducts();
      if (!res.ok) throw new Error(data.error || 'The M-Pesa prompt could not be sent.');
      setMpesaRequestId(data.requestId);
    } catch (err: any) {
      setCheckoutError(err.message);
      setIsProcessing(false);
    }
  };

  // Wait for the customer to enter their PIN.
  useEffect(() => {
    if (!mpesaRequestId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const check = async () => {
      try {
        const res = await fetch('/api/pos/mpesa?id=' + mpesaRequestId, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (res.status === 401) {
          setCheckoutError('Your till session has ended. Sign in again, then check Sales history before retrying.');
          setIsProcessing(false);
          return;
        }
        if (data.status === 'completed' && data.sale) {
          setIsProcessing(false);
          finishSale(data.sale);
          return;
        }
        if (data.status === 'failed') {
          setCheckoutError(data.resultDesc || 'The customer did not complete the payment.');
          setMpesaRequestId('');
          setIsProcessing(false);
          return;
        }
      } catch {
        /* keep waiting through brief network drops */
      }
      if (cancelled) return;
      if (Date.now() - started > 120_000) {
        setMpesaWaitExpired(true);
        setIsProcessing(false);
        return;
      }
      timer = setTimeout(check, 3000);
    };
    timer = setTimeout(check, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpesaRequestId, mpesaWaitExpired]);


  // Thermal Print Handler
  const handlePrintReceipt = () => {
    document.body.classList.add('printing-receipt');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-receipt');
    }, 500);
  };

  // Load shift summary
  const handleLoadShiftSummary = async () => {
    setLoadingShift(true);
    setShowShiftModal(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/pos/sales?date=${today}`);
      const data = await res.json();
      setShiftData(data);
    } catch (err) {
      console.error('Failed to load shift summary', err);
    } finally {
      setLoadingShift(false);
    }
  };

  // Filter sales history
  const filteredHistory = useMemo(() => {
    if (!historySearch) return salesHistory;
    const q = historySearch.toLowerCase();
    return salesHistory.filter(
      (s) =>
        s.saleNumber?.toLowerCase().includes(q) ||
        s.cashierName?.toLowerCase().includes(q) ||
        s.customerName?.toLowerCase().includes(q) ||
        s.mpesaCode?.toLowerCase().includes(q)
    );
  }, [salesHistory, historySearch]);

  return (
    <div className="flex flex-col h-dvh bg-[#f5f8f7] text-stone-800 select-none overflow-hidden">
      {/* ================= NEW ORDER ALERTS ================= */}
      {orderAlerts.length > 0 && !showOnlineOrdersModal && (
        <div className="fixed top-16 right-4 z-[60] w-80 space-y-2 no-print" role="alert" aria-live="assertive">
          {orderAlerts.map((o) => (
            <div key={o.id} className="bg-white border-2 border-[#0e6b5c] rounded-xl shadow-2xl p-4 animate-in slide-in-from-right duration-200">
              <div className="flex justify-between items-start gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[#0e6b5c] flex items-center gap-1.5">
                  {o.orderType === 'pickup' ? <FaStore /> : <FaTruck />} {orderHeadline(o)}
                </p>
                <button
                  onClick={() => setOrderAlerts((prev) => prev.filter((a) => a.id !== o.id))}
                  className="text-stone-400 hover:text-stone-700"
                  aria-label="Dismiss"
                >
                  <FaTimes />
                </button>
              </div>
              <p className="font-semibold text-sm text-stone-900 mt-1">{o.customerName}</p>
              <p className="text-xs text-stone-600 line-clamp-2">
                {o.items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}
              </p>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs">
                  <strong className="font-mono">{formatKes(o.total)}</strong>
                  <span className={`ml-2 ${o.paid ? 'text-emerald-700' : 'text-red-700'}`}>{o.paymentLabel}</span>
                </span>
                <button
                  onClick={() => { setOrderAlerts([]); setShowOnlineOrdersModal(true); }}
                  className="shop-button py-1.5 px-3 text-xs!"
                >
                  View order
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ================= POS TOP BAR ================= */}
      <header className="bg-white border-b border-stone-200 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 shrink-0 shadow-xs z-30">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open system menu" aria-expanded={sidebarOpen} aria-controls="staff-menu" className="rounded-lg p-2 text-[#0e6b5c] hover:bg-stone-100 lg:hidden"><Menu className="size-5" /></button>
          <Link href="/" className="wordmark text-2xl! hidden sm:block">
            {BRAND.wordmark}
            <span className="text-[7px]! tracking-widest text-[#0e6b5c]">POS TERMINAL</span>
          </Link>

          {/* ONLINE & DELIVERY ORDERS BUTTON WITH BADGE */}
          <button
            onClick={() => {
              loadOnlineOrders();
              setOrderAlerts([]);
              setShowOnlineOrdersModal(true);
            }}
            className="flex items-center gap-2 bg-[#ecf6f2] hover:bg-[#d9efe7] text-[#0e6b5c] border border-[#bfe3d6] px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-full text-xs font-semibold transition-all relative whitespace-nowrap"
            title="Incoming orders from website or delivery"
          >
            <FaGlobe className="text-sm" />
            <span className="hidden sm:inline">Orders &amp; Prescriptions</span>
            <span className="sm:hidden">Orders</span>
            {newOrderCount > 0 && (
              <span className="bg-[#0e6b5c] text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                {newOrderCount} New
              </span>
            )}
          </button>

          <button
            onClick={toggleAlerts}
            className={`p-2 rounded-full border text-sm transition-colors ${
              alertsOn ? 'border-[#bfe3d6] text-[#0e6b5c] bg-[#ecf6f2]' : 'border-stone-200 text-stone-400 bg-white'
            }`}
            title={alertsOn ? 'New-order alerts are on (sound + desktop). Click to mute.' : 'New-order alerts are muted. Click to turn on.'}
            aria-label={alertsOn ? 'Mute new-order alerts' : 'Turn on new-order alerts'}
          >
            {alertsOn ? <FaBell /> : <FaBellSlash />}
          </button>

          {/* VIEW ALL POS SALES & RECEIPTS BUTTON */}
          <button
            onClick={loadSalesHistory}
            className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors"
            title="View POS Sales Ledger and Reprint Receipts"
            aria-label="Sales history and receipts"
          >
            <FaReceipt className="text-[#0e6b5c]" />
            <span className="hidden sm:inline">Sales History &amp; Receipts</span>
          </button>
        </div>

        {/* Live Clock & Cashier Info */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-stone-500 font-mono">
            <FaClock className="text-stone-400" />
            <span>{currentTime}</span>
          </div>

          <button
            onClick={handleLoadShiftSummary}
            className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors"
            title="Today's Shift Register Sales"
            aria-label="Register stats"
          >
            <FaChartLine className="text-[#0e6b5c]" />
            <span className="hidden sm:inline">Register Stats</span>
          </button>

          {/* LINK TO ADMIN POS REPORTS */}
          {['ADMIN', 'SUPER_ADMIN'].includes(cashier.role) && (
            <Link
              href="/admin/pos-sales"
              className="inline-block px-3 py-1.5 rounded-lg bg-[#0e6b5c]/10 hover:bg-[#0e6b5c]/20 text-[#0e6b5c] text-xs font-semibold transition-colors"
              title="View Complete Admin Audit & Analytics"
            >
              Reports 📊
            </Link>
          )}

          <div className="hidden md:flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200 text-xs">
            <FaUserCircle className="text-stone-400 text-base" />
            <div>
              <p className="font-semibold text-stone-800 leading-tight">{cashier.name}</p>
              <p className="text-[10px] text-[#0e6b5c] uppercase font-bold tracking-wider">
                {cashier.role}
              </p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-2 rounded-lg text-stone-400 hover:text-red-700 hover:bg-red-50 transition-colors"
            title="Lock / Sign Out Cashier"
            aria-label="Sign out of the till"
          >
            <FaSignOutAlt className="text-base" />
          </button>
        </div>
      </header>

      {/* ================= MAIN SPLIT CONTENT ================= */}
      <div className="min-h-0 flex-1 flex overflow-hidden">
        <StaffSidebar
          isAdmin={isAdmin}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          fillParent
          till={{
            onOrders: () => { loadOnlineOrders(); setOrderAlerts([]); setShowOnlineOrdersModal(true); },
            onHistory: loadSalesHistory,
            onShift: handleLoadShiftSummary,
            newOrderCount,
          }}
        />
        {/* ================= LEFT: PRODUCT EXPLORER ================= */}
        <div className={`flex-1 flex-col min-w-0 bg-[#f9fbfa] border-r border-stone-200 ${mobileView === 'ticket' ? 'hidden md:flex' : 'flex'}`}>
          {/* Active online order banner if one is loaded */}
          {activeOnlineOrder && (
            <div className="bg-[#fff8ec] border-b border-[#f3dfbc] px-4 py-2 flex items-center justify-between text-xs text-amber-900">
              <span className="font-medium flex items-center gap-1.5">
                {activeOnlineOrder.source === 'prescription'
                  ? <><FaFilePrescription /> Dispensing prescription <strong>{activeOnlineOrder.reference}</strong> for <strong>{customerName}</strong>: add the medicines from stock</>
                  : <><FaTruck /> Checking out website order for <strong>{customerName}</strong></>}
              </span>
              <button
                onClick={() => {
                  setActiveOnlineOrder(null);
                  clearCart();
                }}
                className="text-amber-800 hover:underline text-[11px]"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Search & Category Tabs */}
          <div className="p-4 bg-white border-b border-stone-200 space-y-3 shrink-0">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm" />
                <input
                  type="text"
                  placeholder="Search name, ingredient or scan a barcode…"
                  aria-label="Search products or scan a barcode"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchEnter}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-200 bg-stone-50 text-sm focus:bg-white focus:border-[#0e6b5c] focus:outline-hidden transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    <FaTimes />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowCustomItemModal(true)}
                className="px-3.5 py-2.5 rounded-lg border border-dashed border-[#0e6b5c] bg-[#f0f8f5] text-[#0e6b5c] hover:bg-[#e0f1eb] text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
              >
                <FaPlus /> Service / other
              </button>
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-[#0e6b5c] text-white shadow-xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400">
                <FaSearch className="text-4xl mb-3 opacity-30" />
                <p className="font-serif text-lg text-stone-600">No matching items found</p>
                <p className="text-xs text-stone-400 mt-1">Try clearing your search or category filter</p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                {filteredProducts.map((prod) => {
                  const inCartCount = cart
                    .filter((item) => item.productId === prod.id)
                    .reduce((sum, item) => sum + item.quantity, 0);

                  const unavailable = prod.expired || prod.stock <= 0;
                  return (
                    <button
                      key={prod.id}
                      onClick={() => addToCart(prod)}
                      aria-disabled={unavailable}
                      className={`group text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] transition-transform ${unavailable ? 'opacity-55' : ''}`}
                    >
                      <Card className={`h-full gap-0 py-0 overflow-hidden transition-all group-hover:border-primary/60 group-hover:shadow-md ${inCartCount > 0 ? 'border-primary ring-1 ring-primary/30' : ''}`}>
                        <div className="flex flex-1 flex-col gap-1 p-2.5">
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="text-[13px] font-semibold leading-tight text-card-foreground line-clamp-2">
                              {prod.name}
                            </h4>
                            {inCartCount > 0 && <Badge className="min-w-5 rounded-full">{inCartCount}</Badge>}
                          </div>
                          {prod.requiresPrescription && <Badge variant="warning" className="self-start">Rx</Badge>}
                          <p className="text-[11px] text-muted-foreground truncate">
                            {[prod.strength, prod.dosageForm !== 'Other' && prod.dosageForm].filter(Boolean).join(' · ') || prod.category}
                          </p>
                          <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                            <span className="text-sm font-bold text-primary tabular-nums">{formatKes(prod.price)}</span>
                            {prod.expired ? (
                              <Badge variant="destructive">Expired</Badge>
                            ) : prod.stock <= 0 ? (
                              <Badge variant="destructive">Out</Badge>
                            ) : prod.lowStock ? (
                              <Badge variant="warning">{prod.stock} left</Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground tabular-nums">{prod.stock} left</span>
                            )}
                          </div>
                        </div>
                      </Card>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Phones: jump to the ticket */}
          {cart.length > 0 && (
            <div className="md:hidden shrink-0 p-3 border-t border-stone-200 bg-white">
              <button
                onClick={() => setMobileView('ticket')}
                className="shop-button w-full py-3 text-sm! font-bold flex justify-between"
              >
                <span>View ticket · {cart.reduce((s, i) => s + i.quantity, 0)} items</span>
                <span className="font-mono">{formatKes(total)} →</span>
              </button>
            </div>
          )}
        </div>

        {/* ================= RIGHT: TICKET / CART PANEL ================= */}
        <div className={`w-full md:w-[360px] lg:w-[420px] bg-white flex-col shrink-0 border-l border-stone-200 shadow-lg z-20 ${mobileView === 'products' ? 'hidden md:flex' : 'flex'}`}>
          {/* Ticket Header */}
          <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-2 bg-stone-50/70">
            <button
              onClick={() => setMobileView('products')}
              className="md:hidden px-3 py-2 -ml-1 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-700"
            >
              ← Add items
            </button>
            <div className="flex-1">
              <h3 className="font-serif text-lg font-bold text-stone-900 leading-tight">
                Current Order
              </h3>
              <p className="text-[11px] text-stone-500">
                {cart.reduce((s, i) => s + i.quantity, 0)} items in ticket
              </p>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-stone-400 hover:text-red-700 flex items-center gap-1 transition-colors"
                title="Clear Ticket"
              >
                <FaTrashAlt /> Clear
              </button>
            )}
          </div>

          {/* Customer Info (Collapsible / Compact) */}
          <div className="px-4 py-2.5 bg-stone-50/40 border-b border-stone-100 flex flex-col gap-1.5 text-xs">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Customer Name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded border border-stone-200 bg-white text-xs"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-32 px-2.5 py-1.5 rounded border border-stone-200 bg-white text-xs"
              />
            </div>
            {orderNotes && (
              <p className="text-[11px] text-stone-500 italic bg-white p-1 rounded border border-stone-100 truncate">
                {orderNotes}
              </p>
            )}
          </div>

          {/* Ticket Line Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100 p-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
                <FaCashRegister className="text-4xl mb-3 text-stone-200" />
                <p className="font-serif text-base text-stone-600">Ticket is empty</p>
                <p className="text-xs text-stone-400 mt-1 max-w-[200px]">
                  Tap a product, scan a barcode, or load a website order or prescription above
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="p-2.5 hover:bg-stone-50/70 rounded-lg group transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-900 leading-snug truncate">
                        {item.requiresPrescription && <span className="mr-1 bg-amber-100 text-amber-900 text-[9px] font-bold px-1 py-0.5 rounded">Rx</span>}
                        {item.name}
                      </p>
                      {item.productId.startsWith('custom-') ? (
                        // Services and off-list items: the cashier enters the agreed price.
                        <label className="flex items-center gap-1 text-[11px] text-stone-500 font-mono mt-0.5">
                          KSh
                          <input
                            type="number"
                            min={1}
                            step="1"
                            value={item.price || ''}
                            onChange={(e) => updatePrice(item.id, Number(e.target.value))}
                            className="w-20 border border-stone-300 rounded px-1 py-0.5 text-stone-900 bg-white"
                            aria-label={`Price of ${item.name}`}
                          />
                          each
                        </label>
                      ) : (
                        <p className="text-[11px] text-stone-500 font-mono">
                          {formatKes(item.price)} each
                        </p>
                      )}
                    </div>

                    <p className="font-bold text-xs text-stone-900 font-mono">
                      {formatKes(item.price * item.quantity)}
                    </p>
                  </div>

                  {/* Quantity Stepper & Remove */}
                  <div className="flex items-center justify-between mt-2 pt-1">
                    <div className="flex items-center border border-stone-200 rounded-md overflow-hidden bg-white shadow-2xs">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="px-2 py-1 text-stone-500 hover:bg-stone-100 text-xs active:bg-stone-200"
                        aria-label="Decrease quantity"
                      >
                        <FaMinus />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-stone-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="px-2 py-1 text-stone-500 hover:bg-stone-100 text-xs active:bg-stone-200"
                        aria-label="Increase quantity"
                      >
                        <FaPlus />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-stone-300 hover:text-red-600 p-1 transition-colors"
                      title="Remove Item"
                    >
                      <FaTrashAlt className="text-xs" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ticket Calculations & Pay Button */}
          <div className="p-4 border-t border-stone-200 bg-stone-50/80 space-y-2.5 shrink-0">
            <div className="flex justify-between text-xs text-stone-600">
              <span>Subtotal:</span>
              <span className="font-mono">{formatKes(subtotal)}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <button
                onClick={() => setShowDiscountModal(true)}
                className="text-[#0e6b5c] hover:underline flex items-center gap-1 font-medium"
              >
                <FaTag className="text-[10px]" />
                {discountAmount > 0
                  ? `Discount applied (${discountType === 'PERCENT' ? `${discountValue}%` : 'Flat'}):`
                  : '+ Add Discount'}
              </button>
              {discountAmount > 0 && (
                <span className="font-mono text-red-700 font-semibold">
                  -{formatKes(discountAmount)}
                </span>
              )}
            </div>

            {ticketNeedsRx && (
              <p className="flex items-start gap-1.5 text-[11px] text-amber-900 bg-[#fff8ec] border border-[#f3dfbc] rounded p-2">
                <FaFilePrescription className="mt-0.5 shrink-0" /> Prescription-only medicine on this ticket. You will confirm the prescription at payment.
              </p>
            )}
            {tillNotice && (
              <p className="text-[11px] text-red-800 bg-red-50 border border-red-200 rounded p-2" role="alert">{tillNotice}</p>
            )}
            <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline">
              <span className="text-sm font-semibold text-stone-800 uppercase tracking-wide">
                Total Due:
              </span>
              <span className="font-serif text-3xl font-bold text-[#0e6b5c] font-mono">
                {formatKes(total)}
              </span>
            </div>

            {/* Charge Button */}
            <button
              onClick={handleOpenCheckout}
              disabled={cart.length === 0}
              className="w-full shop-button py-3.5 text-sm! font-bold tracking-wider uppercase flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:shadow-none transition-all active:scale-[0.99]"
            >
              <FaMoneyBillWave className="text-lg" />
              Pay {formatKes(total)}
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODAL: INCOMING ONLINE / DELIVERY ORDERS ================= */}
      {showOnlineOrdersModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-2xl w-full p-4 sm:p-6 animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-stone-100 shrink-0">
              <div className="flex items-center gap-2">
                <FaGlobe className="text-[#0e6b5c] text-xl" />
                <div>
                  <h3 className="font-serif text-xl font-bold text-stone-900">
                    Orders &amp; Prescriptions ({onlineOrders.length})
                  </h3>
                  <p className="text-xs text-stone-500">
                    Prepare and hand over website orders, and dispense prescriptions. Unpaid orders are checked out at the till.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadOnlineOrders}
                  disabled={loadingOnlineOrders}
                  className="p-2 text-stone-400 hover:text-stone-700"
                  title="Refresh Orders"
                >
                  <FaSync className={loadingOnlineOrders ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => setShowOnlineOrdersModal(false)}
                  className="text-stone-400 hover:text-stone-600 text-lg"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {orderError && (
                <div className="notice text-xs" role="alert">{orderError}</div>
              )}
              {loadingOnlineOrders && onlineOrders.length === 0 ? (
                <p className="text-center py-10 text-stone-500 text-sm">Checking for online orders…</p>
              ) : onlineOrders.length === 0 ? (
                <div className="text-center py-12 text-stone-400">
                  <FaCheckCircle className="text-4xl mx-auto mb-2 text-emerald-500 opacity-60" />
                  <p className="font-serif text-base text-stone-700">All caught up!</p>
                  <p className="text-xs text-stone-400 mt-1">
                    No website orders or prescriptions waiting.
                  </p>
                </div>
              ) : (
                onlineOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 rounded-xl border border-stone-200 hover:border-[#0e6b5c] bg-stone-50/50 hover:bg-stone-50 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            ord.orderType === 'pickup'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ord.orderType === 'pickup' ? <FaStore className="inline mr-1" /> : <FaTruck className="inline mr-1" />}
                          {ord.orderType}
                        </span>
                        <h4 className="font-bold text-sm text-stone-900">{ord.customerName}</h4>
                        <span className="text-xs font-mono text-stone-500">{ord.customerPhone}</span>
                      </div>

                      {ord.source === 'prescription' ? (
                        <div className="text-xs text-stone-600 space-y-1">
                          <p className="font-semibold text-amber-900 flex items-center gap-1.5"><FaFilePrescription /> {ord.reference} · {ord.stageLabel}</p>
                          {ord.orderNotes && <p>{ord.orderNotes}</p>}
                          {ord.fileUrl
                            ? <a href={ord.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[#0e6b5c] underline font-semibold">Open the prescription</a>
                            : <p className="text-stone-500">{ord.rxSource === 'whatsapp' ? 'Sent on WhatsApp — check the chat.' : 'Not attached — check the original prescription.'}</p>}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-600">
                          {ord.items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                      )}

                      {ord.deliveryAddress && (
                        <p className="text-[11px] text-stone-500">
                          📍 {ord.deliveryAddress}
                          {ord.distanceKm != null && <span className="font-semibold text-stone-700"> · {ord.distanceKm} km</span>}
                          {ord.mapUrl && <> · <a href={ord.mapUrl} target="_blank" rel="noopener noreferrer" className="text-[#0e6b5c] underline font-semibold">Directions</a></>}
                        </p>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                      {ord.source !== 'prescription' && (
                        <span className="font-mono font-bold text-base text-[#0e6b5c]">
                          {formatKes(ord.total)}
                        </span>
                      )}
                      {ord.source === 'storefront' && (
                        <div className="flex flex-wrap sm:justify-end gap-1.5 text-[10px] font-bold uppercase">
                          <span className="px-2 py-0.5 rounded bg-stone-200 text-stone-700">{ord.stageLabel}</span>
                          <span className={`px-2 py-0.5 rounded ${ord.paid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {ord.paymentLabel}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-wrap sm:justify-end gap-1.5">
                        {ord.source === 'prescription' && ord.rxStatus === 'pending' && (
                          <button onClick={() => handlePrescriptionStatus(ord, 'reviewing')} disabled={orderBusyId === ord.id} className="py-2 px-3 text-xs font-semibold rounded-lg bg-stone-800 text-white hover:bg-stone-900 disabled:opacity-40">
                            Start review
                          </button>
                        )}
                        {ord.source === 'prescription' && ord.rxStatus !== 'ready' && (
                          <button onClick={() => handlePrescriptionStatus(ord, 'ready')} disabled={orderBusyId === ord.id} className="py-2 px-3 text-xs font-semibold rounded-lg bg-stone-800 text-white hover:bg-stone-900 disabled:opacity-40">
                            Checked — ready
                          </button>
                        )}
                        {!ord.paid && (ord.source !== 'prescription' || ord.rxStatus === 'ready') && (
                          <button
                            onClick={() => handleLoadOnlineOrder(ord)}
                            className="shop-button py-2 px-3 text-xs! font-semibold flex items-center gap-1.5"
                          >
                            📥 {ord.source === 'prescription' ? 'Dispense at till' : 'Check out at till'}
                          </button>
                        )}
                        {ord.source === 'prescription' && (
                          <button onClick={() => handlePrescriptionStatus(ord, 'declined')} disabled={orderBusyId === ord.id} className="py-2 px-2 text-xs text-stone-500 underline">
                            Decline
                          </button>
                        )}
                        {ord.next && (
                          <button
                            onClick={() => handleAdvanceOrder(ord, ord.next)}
                            disabled={orderBusyId === ord.id || (['DELIVERED', 'COLLECTED'].includes(ord.next) && !ord.paid)}
                            title={['DELIVERED', 'COLLECTED'].includes(ord.next) && !ord.paid ? 'Check the order out at the till first' : undefined}
                            className="py-2 px-3 text-xs font-semibold rounded-lg bg-stone-800 text-white hover:bg-stone-900 disabled:opacity-40"
                          >
                            {orderBusyId === ord.id ? 'Saving…' : STAGE_ACTION[ord.next as OrderStage]}
                          </button>
                        )}
                        {ord.source === 'storefront' && !ord.paid && ['NEW', 'PREPARING'].includes(ord.stage) && (
                          <button
                            onClick={() => handleAdvanceOrder(ord, 'CANCELLED')}
                            disabled={orderBusyId === ord.id}
                            className="py-2 px-2 text-xs text-stone-500 underline"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SALES HISTORY & RECEIPTS (WHERE TO SEE POS SALES) ================= */}
      {showSalesHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-3xl w-full p-4 sm:p-6 animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-stone-100 shrink-0">
              <div className="flex items-center gap-2">
                <FaReceipt className="text-[#0e6b5c] text-xl" />
                <div>
                  <h3 className="font-serif text-xl font-bold text-stone-900">
                    POS Sales History &amp; Receipts
                  </h3>
                  <p className="text-xs text-stone-500">
                    All transactions rung up on the POS register
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {['ADMIN', 'SUPER_ADMIN'].includes(cashier.role) && (
                  <Link
                    href="/admin/pos-sales"
                    className="text-xs text-[#0e6b5c] hover:underline font-semibold"
                  >
                    Open Full Reports →
                  </Link>
                )}
                <button
                  onClick={() => setShowSalesHistoryModal(false)}
                  className="text-stone-400 hover:text-stone-600 text-lg"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Search filter */}
            <div className="py-3 border-b border-stone-100 shrink-0">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs" />
                <input
                  type="text"
                  placeholder="Search by receipt #, customer name, cashier, or M-Pesa code…"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 text-xs bg-stone-50 focus:bg-white"
                />
              </div>
            </div>

            {/* History Table */}
            <div className="flex-1 overflow-y-auto py-2">
              {loadingSalesHistory ? (
                <p className="text-center py-10 text-stone-500 text-sm">Loading sales history…</p>
              ) : filteredHistory.length === 0 ? (
                <p className="text-center py-10 text-stone-400 text-sm">No sales found</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-[10px] uppercase text-stone-500">
                    <tr>
                      <th className="p-2.5">Receipt #</th>
                      <th className="p-2.5">Time</th>
                      <th className="p-2.5">Cashier</th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5 text-right">Total</th>
                      <th className="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredHistory.map((s) => (
                      <tr key={s.id} className="hover:bg-stone-50/70">
                        <td className="p-2.5 font-mono font-bold text-[#0e6b5c]">{s.saleNumber}</td>
                        <td className="p-2.5 text-stone-500">
                          {new Date(s.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                          {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-2.5 text-stone-800 font-medium">{s.cashierName}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded bg-stone-100 text-[10px] font-semibold">
                            {s.paymentMethod}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold">{formatKes(s.total)}</td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => {
                              setCompletedSale(s);
                              setShowReceiptModal(true);
                            }}
                            className="text-[#0e6b5c] hover:underline font-semibold flex items-center gap-1 mx-auto"
                          >
                            <FaPrint className="text-[10px]" /> Slip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CUSTOM ITEM ================= */}
      {showCustomItemModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-stone-200 max-w-sm w-full p-5 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-stone-100">
              <h3 className="font-serif text-lg font-bold text-stone-900">Add Off-Menu Item</h3>
              <button
                onClick={() => setShowCustomItemModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleAddCustomItem} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Item Description / Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Birthday Candle, Soda, Topping"
                  value={customItemForm.name}
                  onChange={(e) =>
                    setCustomItemForm({ ...customItemForm, name: e.target.value })
                  }
                  className="w-full border border-stone-300 rounded p-2 text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  Price (KSh)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="e.g. 150"
                  value={customItemForm.price}
                  onChange={(e) =>
                    setCustomItemForm({ ...customItemForm, price: e.target.value })
                  }
                  className="w-full border border-stone-300 rounded p-2 text-sm font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowCustomItemModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded"
                >
                  Cancel
                </button>
                <button type="submit" className="shop-button text-xs py-1.5 px-4">
                  Add to Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DISCOUNT ================= */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-stone-200 max-w-xs w-full p-5 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-stone-100">
              <h3 className="font-serif text-lg font-bold text-stone-900">Apply Discount</h3>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              <div className="flex border border-stone-200 rounded-lg overflow-hidden p-0.5 bg-stone-100">
                <button
                  onClick={() => setDiscountType('FLAT')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    discountType === 'FLAT' ? 'bg-white shadow-2xs text-[#0e6b5c]' : 'text-stone-600'
                  }`}
                >
                  Flat KSh
                </button>
                <button
                  onClick={() => setDiscountType('PERCENT')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    discountType === 'PERCENT'
                      ? 'bg-white shadow-2xs text-[#0e6b5c]'
                      : 'text-stone-600'
                  }`}
                >
                  Percentage (%)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  {discountType === 'PERCENT' ? 'Discount Percentage (%)' : 'Discount Amount (KSh)'}
                </label>
                <input
                  type="number"
                  min="0"
                  max={discountType === 'PERCENT' ? 100 : subtotal}
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full border border-stone-300 rounded p-2 text-sm font-mono"
                  autoFocus
                />
              </div>

              <div className="flex justify-between gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountValue(0);
                    setShowDiscountModal(false);
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove Discount
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="shop-button text-xs py-1.5 px-4"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHECKOUT & PAYMENT ================= */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-lg w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-serif text-2xl font-bold text-stone-900">Checkout Counter</h3>
                <p className="text-xs text-stone-500">Select payment method and confirm tender</p>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-stone-400 hover:text-stone-600 text-lg"
              >
                <FaTimes />
              </button>
            </div>

            {/* Total Callout */}
            <div className="my-5 p-4 bg-[#f0f8f5] border border-[#d6ebe4] rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
                  Amount Due
                </p>
                <p className="font-serif text-3xl font-bold text-[#0e6b5c] font-mono">
                  {formatKes(total)}
                </p>
              </div>
              <div className="text-right text-xs text-stone-500">
                <p>{cart.reduce((s, i) => s + i.quantity, 0)} items</p>
                {customerName && <p className="font-semibold text-stone-700">{customerName}</p>}
              </div>
            </div>

            {/* Prescription check: prescription-only medicine is sold only against a prescription the cashier has seen. */}
            {cart.some((i) => i.requiresPrescription) && (
              <div className="mb-5 p-4 rounded-xl border border-[#f3dfbc] bg-[#fff8ec] space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-900 flex items-center gap-1.5">
                  <FaFilePrescription /> Prescription check
                </p>
                {activeOnlineOrder?.source === 'prescription' ? (
                  <p className="text-xs text-stone-700">Dispensing against prescription <strong>{activeOnlineOrder.reference}</strong>, already checked by the pharmacist.</p>
                ) : (
                  <>
                    <label className="block text-xs font-semibold text-stone-700">
                      Prescriber, facility or prescription number
                      <input
                        type="text"
                        value={rxReference}
                        onChange={(e) => setRxReference(e.target.value)}
                        maxLength={120}
                        placeholder="e.g. Dr. A. Otieno, Mbagathi Hospital, 02/10/2026"
                        className="mt-1 w-full border border-stone-300 rounded-lg p-2.5 text-sm bg-white font-normal"
                      />
                    </label>
                    <label className="flex items-start gap-2 text-xs text-stone-700">
                      <input type="checkbox" checked={rxVerified} onChange={(e) => setRxVerified(e.target.checked)} className="mt-0.5 accent-[#0e6b5c]" />
                      I have seen a valid prescription for {cart.filter((i) => i.requiresPrescription).map((i) => i.name).join(', ')}.
                    </label>
                  </>
                )}
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              {[
                { id: 'CASH', label: 'Cash', icon: FaMoneyBillWave },
                { id: 'MPESA', label: 'M-Pesa', icon: FaMobileAlt },
              ].map((m) => {
                const Icon = m.icon;
                const active = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    disabled={!!mpesaRequestId}
                    onClick={() => {
                      setPaymentMethod(m.id as any);
                      if (m.id === 'CASH') setAmountPaid(total.toString());
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                      active
                        ? 'border-[#0e6b5c] bg-[#0e6b5c] text-white shadow-sm'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <Icon className="text-lg" />
                    <span className="text-xs font-semibold">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Method Details */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-4 p-4 bg-stone-50 rounded-xl border border-stone-200 mb-5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                    Cash Tendered / Received (KSh)
                  </label>
                  <input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg p-2.5 text-lg font-bold font-mono bg-white"
                    autoFocus
                  />
                </div>

                {/* Quick denomination buttons */}
                <div className="flex gap-2 flex-wrap">
                  {[total, 500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountPaid(amt.toString())}
                      className="px-3 py-1.5 text-xs font-mono font-medium rounded-md bg-white border border-stone-200 hover:border-[#0e6b5c] hover:bg-stone-50"
                    >
                      {amt === total ? 'Exact' : formatKes(amt)}
                    </button>
                  ))}
                </div>

                {/* Live Change Due Calculation */}
                <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline">
                  <span className="text-xs font-semibold text-stone-600 uppercase">Change Due:</span>
                  <span
                    className={`font-mono text-2xl font-bold ${
                      changeDue > 0 ? 'text-emerald-700' : 'text-stone-800'
                    }`}
                  >
                    {formatKes(changeDue)}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === 'MPESA' && !manualMpesa && (
              <div className="space-y-3 p-4 bg-green-50/50 rounded-xl border border-green-200 mb-5">
                {mpesaRequestId ? (
                  <div role="status" className="text-center py-2">
                    <FaMobileAlt className="text-3xl text-green-700 mx-auto mb-2" />
                    <p className="font-semibold text-stone-800">
                      {mpesaWaitExpired ? 'No confirmation yet' : `Waiting for ${mpesaPhone} to pay ${formatKes(total)}…`}
                    </p>
                    <p className="text-[11px] text-stone-500 mt-1">
                      {mpesaWaitExpired
                        ? 'The customer may still be paying. Check again before sending another prompt.'
                        : 'Ask the customer to enter their M-Pesa PIN. The receipt opens automatically once paid.'}
                    </p>
                    {mpesaWaitExpired && (
                      <div className="flex justify-center gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => { setMpesaWaitExpired(false); setIsProcessing(true); }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-white border border-stone-300 hover:bg-stone-50"
                        >
                          Check again
                        </button>
                        <button
                          type="button"
                          onClick={() => { setMpesaRequestId(''); setMpesaWaitExpired(false); }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-white border border-stone-300 hover:bg-stone-50"
                        >
                          Send a new prompt
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                      Customer&apos;s M-Pesa number
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="0712 345 678"
                      value={mpesaPhone}
                      onChange={(e) => setMpesaPhone(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg p-2.5 text-lg font-mono bg-white"
                      autoFocus
                    />
                    <p className="text-[11px] text-stone-500 mt-1">
                      A payment prompt for {formatKes(total)} is sent to this phone.
                    </p>
                  </div>
                )}
                {isAdmin && !mpesaRequestId && (
                  <button type="button" onClick={() => setManualMpesa(true)} className="text-[11px] text-stone-500 underline">
                    PayHero unavailable? Enter an M-Pesa code instead (admin)
                  </button>
                )}
              </div>
            )}

            {paymentMethod === 'MPESA' && manualMpesa && (
              <div className="space-y-3 p-4 bg-amber-50/50 rounded-xl border border-amber-200 mb-5">
                <label className="block text-xs font-semibold text-stone-700 uppercase mb-1">
                  M-Pesa Transaction Code (admin)
                </label>
                <input
                  type="text"
                  placeholder="e.g. QK83901923"
                  value={mpesaCode}
                  onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                  className="w-full border border-stone-300 rounded-lg p-2.5 text-sm font-mono uppercase bg-white"
                  autoFocus
                />
                <p className="text-[11px] text-stone-500">
                  Only use this if the money is already in the till account. Check the code in the M-Pesa statement.
                </p>
                <button type="button" onClick={() => setManualMpesa(false)} className="text-[11px] text-stone-500 underline">
                  Send a prompt to the customer&apos;s phone instead
                </button>
              </div>
            )}

            {checkoutError && (
              <div className="notice text-xs mb-4" role="alert">
                {checkoutError}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                disabled={isProcessing || !!mpesaRequestId}
                className="px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg text-sm hover:bg-stone-50 font-medium disabled:opacity-50"
              >
                Back to Ticket
              </button>
              {paymentMethod === 'MPESA' && !manualMpesa ? (
                !mpesaRequestId && (
                  <button
                    type="button"
                    onClick={handleSendMpesaPrompt}
                    disabled={isProcessing || !mpesaPhone.trim() || (ticketNeedsRx && (!rxVerified || rxReference.trim().length < 3))}
                    className="shop-button py-2.5 px-6 text-sm font-bold flex items-center gap-2"
                  >
                    {isProcessing ? 'Sending…' : `Send M-Pesa prompt (${formatKes(total)}) →`}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleCompleteSale}
                  disabled={isProcessing || (ticketNeedsRx && (!rxVerified || rxReference.trim().length < 3))}
                  className="shop-button py-2.5 px-6 text-sm font-bold flex items-center gap-2"
                >
                  {isProcessing ? 'Processing…' : 'Complete Sale & Print Receipt →'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: RECEIPT & PRINT ================= */}
      {showReceiptModal && completedSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-sm w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            {/* Success icon */}
            <div className="text-center mb-4 no-print">
              <FaCheckCircle className="text-4xl text-emerald-600 mx-auto mb-2" />
              <h3 className="font-serif text-xl font-bold text-stone-900">Sale Completed!</h3>
              <p className="text-xs text-stone-500 font-mono">{completedSale.saleNumber}</p>
            </div>

            {/* Receipt Preview */}
            <div
              id="pos-receipt-print"
              className="bg-stone-50 p-4 rounded-xl border border-dashed border-stone-300 text-xs font-mono text-stone-800 space-y-2.5"
            >
              <div className="text-center pb-2 border-b border-dashed border-stone-300">
                <p className="font-serif text-lg font-bold text-stone-900">{BRAND.name.toUpperCase()}</p>
                <p className="text-[10px] text-stone-500">{BRAND.licence}</p>
                <p className="text-[9px] text-stone-400">WhatsApp: {WHATSAPP_NUMBER}</p>
              </div>

              <div className="text-[10px] space-y-0.5 pb-2 border-b border-dashed border-stone-300">
                <div className="flex justify-between">
                  <span className="text-stone-500">Receipt:</span>
                  <span className="font-bold">{completedSale.saleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Date:</span>
                  <span>{new Date(completedSale.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Cashier:</span>
                  <span>{completedSale.cashierName}</span>
                </div>
                {completedSale.customerName && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">Customer:</span>
                    <span>{completedSale.customerName}</span>
                  </div>
                )}
                {completedSale.prescriptionRef && (
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500">Rx:</span>
                    <span className="text-right">{completedSale.prescriptionRef}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 py-1 border-b border-dashed border-stone-300">
                {completedSale.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[65%]">
                      {item.quantity}x {item.name}
                    </span>
                    <span>{formatKes(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-1 text-[11px]">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal:</span>
                  <span>{formatKes(completedSale.subtotal)}</span>
                </div>
                {completedSale.discount > 0 && (
                  <div className="flex justify-between text-red-700">
                    <span>Discount:</span>
                    <span>-{formatKes(completedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-stone-900 pt-1">
                  <span>TOTAL:</span>
                  <span>{formatKes(completedSale.total)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-dashed border-stone-300 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-stone-500">Payment:</span>
                  <span className="font-bold">{completedSale.paymentMethod}</span>
                </div>
                {completedSale.paymentMethod === 'CASH' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Tendered:</span>
                      <span>{formatKes(completedSale.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-800">
                      <span>Change:</span>
                      <span>{formatKes(completedSale.changeDue)}</span>
                    </div>
                  </>
                )}
                {completedSale.mpesaCode && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">Ref:</span>
                    <span>{completedSale.mpesaCode}</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-2 text-[10px] text-stone-500">
                <p>Thank you. Get well soon!</p>
                <p>Keep medicines out of reach of children.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 no-print">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="flex-1 py-2.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <FaPrint /> Print Slip
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReceiptModal(false);
                  setCompletedSale(null);
                }}
                className="flex-1 shop-button text-xs py-2.5 px-4 font-bold"
              >
                Next Order (New)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: TODAY'S SHIFT / REGISTER STATS ================= */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-lg w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <FaCashRegister className="text-[#0e6b5c] text-xl" />
                <h3 className="font-serif text-xl font-bold text-stone-900">
                  Register Shift Summary
                </h3>
              </div>
              <button
                onClick={() => setShowShiftModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <FaTimes />
              </button>
            </div>

            {loadingShift ? (
              <p className="text-center py-8 text-stone-500 text-sm">Loading today&apos;s sales…</p>
            ) : shiftData ? (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-center">
                    <p className="text-[10px] uppercase font-semibold text-stone-400">Total Sales</p>
                    <p className="font-serif text-lg font-bold text-[#0e6b5c] mt-1">
                      {formatKes(shiftData.summary?.totalRevenue || 0)}
                    </p>
                    <p className="text-[10px] text-stone-500">{shiftData.summary?.totalCount || 0} tickets</p>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                    <p className="text-[10px] uppercase font-semibold text-emerald-800">Cash Drawer</p>
                    <p className="font-serif text-lg font-bold text-emerald-900 mt-1">
                      {formatKes(shiftData.summary?.cashTotal || 0)}
                    </p>
                    <p className="text-[10px] text-emerald-700">Physical Cash</p>
                  </div>

                  <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-center">
                    <p className="text-[10px] uppercase font-semibold text-green-800">M-Pesa</p>
                    <p className="font-serif text-lg font-bold text-green-900 mt-1">
                      {formatKes(shiftData.summary?.mpesaTotal || 0)}
                    </p>
                    <p className="text-[10px] text-green-700">Till / Mobile</p>
                  </div>
                </div>

                <div className="border border-stone-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-200 text-[10px] uppercase text-stone-500">
                      <tr>
                        <th className="p-2">Receipt</th>
                        <th className="p-2">Cashier</th>
                        <th className="p-2">Method</th>
                        <th className="p-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {shiftData.sales?.map((s: any) => (
                        <tr key={s.id}>
                          <td className="p-2 font-mono text-[11px] text-[#0e6b5c]">{s.saleNumber}</td>
                          <td className="p-2 truncate max-w-[90px]">{s.cashierName}</td>
                          <td className="p-2">{s.paymentMethod}</td>
                          <td className="p-2 text-right font-mono font-bold">{formatKes(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowShiftModal(false)}
                    className="shop-button py-2 px-4 text-xs"
                  >
                    Back to POS
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
