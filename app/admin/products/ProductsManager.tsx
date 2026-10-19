'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import type { Product, StockMovement } from '@prisma/client';
import { Plus, PackagePlus, History, Pencil, X } from 'lucide-react';
import { DOSAGE_FORMS, EXPIRY_WARNING_DAYS, PRODUCT_CATEGORIES } from '@/app/lib/products';
import { formatToKsh } from '@/app/lib/currency';

// JSON turns dates into strings on the way to the browser.
type Row = Omit<Product, 'expiryDate' | 'createdAt' | 'updatedAt'> & { expiryDate: string | null; createdAt: string; updatedAt: string };
type Movement = Omit<StockMovement, 'createdAt'> & { createdAt: string };

const DAY = 86_400_000;
const expired = (p: Row) => !!p.expiryDate && new Date(p.expiryDate).getTime() <= Date.now();
const expiring = (p: Row) => !!p.expiryDate && !expired(p) && new Date(p.expiryDate).getTime() - Date.now() <= EXPIRY_WARNING_DAYS * DAY;
const low = (p: Row) => p.stock > 0 && p.stock <= p.reorderLevel;
const dateInput = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' }) : '');

const FILTERS: [string, string, (p: Row) => boolean][] = [
  ['all', 'Active', (p) => p.isActive],
  ['low', 'Low stock', (p) => p.isActive && low(p)],
  ['out', 'Out of stock', (p) => p.isActive && p.stock <= 0],
  ['expiring', `Expiring ≤ ${EXPIRY_WARNING_DAYS} days`, (p) => p.isActive && expiring(p)],
  ['expired', 'Expired', (p) => p.isActive && expired(p) && p.stock > 0],
  ['rx', 'Prescription only', (p) => p.isActive && p.requiresPrescription],
  ['inactive', 'Removed from sale', (p) => !p.isActive],
];

const fetcher = async (url: string) => { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('Could not load'); return r.json(); };

export default function ProductsManager({ initialFilter, focusId }: { initialFilter: string; focusId: string | null }) {
  const { data, error, isLoading, mutate } = useSWR<Row[]>('/api/admin/products', fetcher);
  const [filter, setFilter] = useState(FILTERS.some(([id]) => id === initialFilter) ? initialFilter : 'all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [stocking, setStocking] = useState<Row | null>(null);
  const [history, setHistory] = useState<Row | null>(null);
  const [notice, setNotice] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importCategory, setImportCategory] = useState('');
  // Opened from a dashboard alert: show just that product until the admin asks for the rest.
  const [focused, setFocused] = useState(!!focusId);

  const rows = useMemo(() => {
    if (focused && focusId) return (data || []).filter((p) => p.id === focusId);
    const test = FILTERS.find(([id]) => id === filter)?.[2] || (() => true);
    const q = query.trim().toLowerCase();
    return (data || []).filter(test).filter((p) => !q || [p.name, p.genericName, p.sku, p.batchNumber, p.manufacturer].some((v) => v?.toLowerCase().includes(q)));
  }, [data, filter, query, focused, focusId]);

  const done = async (message: string) => { setNotice(message); await mutate(); setTimeout(() => setNotice(''), 4000); };
  const download = async (template = false) => {
    setTransferring(true); setTransferError('');
    try {
      const response = await fetch('/api/admin/products/transfer' + (template ? '?template=1' : ''));
      if (!response.ok) throw new Error('Could not export inventory. Please try again.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = template ? 'inventory-template.csv' : 'inventory.csv'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setTransferError(error instanceof Error ? error.message : 'Export failed.'); }
    finally { setTransferring(false); }
  };
  const importProducts = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!importFile) return;
    setTransferring(true); setTransferError('');
    try {
      const body = new FormData(); body.set('file', importFile);
      body.set('defaultCategory', importCategory);
      const response = await fetch('/api/admin/products/transfer', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Import failed.');
      await done(`${result.count} products imported into inventory.`);
    } catch (error) { setTransferError(error instanceof Error ? error.message : 'Import failed.'); }
    finally { setTransferring(false); }
  };

  return <main className="shop-container shop-section">
    <div className="section-heading">
      <div><p className="eyebrow">ADMINISTRATION</p><h1 className="font-serif text-4xl">Products &amp; stock.</h1></div>
      <div className="flex gap-3"><button className="shop-button" onClick={() => setEditing('new')}><Plus size={16} /> Add product</button><Link href="/admin/dashboard" className="shop-button secondary">Back to dashboard</Link></div>
    </div>
    <p className="text-sm text-stone-500 mb-6">Stock changes only through deliveries, write-offs and sales, so every unit is accounted for in each product&apos;s history. Prices here are what the shop and the till charge.</p>
    {notice && <p className="notice bg-emerald-50! border-emerald-200!" role="status">{notice}</p>}
    <section className="checkout-panel mb-6" aria-labelledby="inventory-transfer-heading">
      <h2 id="inventory-transfer-heading">Import &amp; export inventory</h2>
      <p className="my-3 text-sm text-stone-600">Import new products from a CSV spreadsheet (up to 5,000 rows, 2 MB). Include name and selling price, and either include a category column or select a category below for missing values. Stock and other columns are optional. UnitMargin and MarginPct are ignored; cost and selling prices are imported. Existing names or SKUs are rejected, and any invalid row prevents the whole import. Export includes all products, including those removed from sale.</p>
      <div className="mb-4 flex flex-wrap gap-3"><button type="button" className="shop-button secondary" disabled={transferring} onClick={() => void download()}>Export inventory CSV</button><button type="button" className="shop-button secondary" disabled={transferring} onClick={() => void download(true)}>Download CSV template</button></div>
      <form onSubmit={importProducts} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Product CSV file<input type="file" accept=".csv,text/csv" required disabled={transferring} onChange={event => setImportFile(event.target.files?.[0] || null)} className="mt-2 block max-w-full text-sm" /></label>
        <label className="text-sm">Category for rows without one<select value={importCategory} disabled={transferring} onChange={event => setImportCategory(event.target.value)} className="mt-2 block rounded-md border border-stone-300 p-2 text-sm"><option value="">Use category from file</option>{PRODUCT_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
        <button type="submit" className="shop-button" disabled={transferring || !importFile}>{transferring ? 'Please wait…' : 'Import products'}</button>
      </form>
      {transferError && <p className="mt-3 text-sm text-red-700" role="alert">{transferError}</p>}
    </section>

    <nav className="category-nav justify-start! px-0!" aria-label="Filter products">
      {FILTERS.map(([id, label, test]) => <button key={id} aria-current={!focused && filter === id ? 'page' : undefined} onClick={() => { setFilter(id); setFocused(false); }}>{label} ({(data || []).filter(test).length})</button>)}
    </nav>
    {focused && focusId && <p className="text-sm mb-4">Showing the product from the dashboard. <button className="text-link mt-0!" onClick={() => setFocused(false)}>Show all products</button></p>}
    <div className="catalog-tools"><input type="search" aria-label="Search products" placeholder="Search name, ingredient, code or batch…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>

    {error ? <div className="empty-state" role="alert"><h2>Products could not be loaded.</h2><button className="shop-button" onClick={() => mutate()}>Try again</button></div>
      : isLoading ? <p role="status">Loading products…</p>
      : !rows.length ? <div className="empty-state"><h2>{data?.length ? 'Nothing matches.' : 'No products yet.'}</h2><p>{data?.length ? 'Try another filter or search.' : 'Add your first product to start selling and tracking stock.'}</p></div>
      : <div className="checkout-panel p-0! overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50"><tr><th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3 text-right">Price</th><th className="p-3 text-right">In stock</th><th className="p-3">Batch · expiry</th><th className="p-3">Actions</th></tr></thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((p) => <tr key={p.id} className={p.id === focusId ? 'bg-amber-50' : ''}>
              <td className="p-3"><p className="font-semibold">{p.name}</p><p className="text-xs text-stone-500">{[p.genericName, p.strength, p.dosageForm, p.sku && `Code ${p.sku}`].filter(Boolean).join(' · ')}</p>
                <div className="badge-row mt-1!">{p.requiresPrescription && <span className="badge rx">Rx only</span>}{!p.isActive && <span className="badge out">Removed</span>}</div></td>
              <td className="p-3 text-stone-600">{p.category}</td>
              <td className="p-3 text-right whitespace-nowrap">{formatToKsh(p.price)}{p.costPrice ? <p className="text-xs text-stone-500">cost {formatToKsh(p.costPrice)}</p> : null}</td>
              <td className="p-3 text-right"><span className={p.stock <= 0 ? 'text-red-700 font-semibold' : low(p) ? 'text-amber-700 font-semibold' : ''}>{p.stock}</span><p className="text-xs text-stone-500">reorder at {p.reorderLevel}</p></td>
              <td className="p-3 whitespace-nowrap">{p.batchNumber || '—'}<p className={`text-xs ${expired(p) ? 'text-red-700 font-semibold' : expiring(p) ? 'text-amber-700' : 'text-stone-500'}`}>{p.expiryDate ? `${expired(p) ? 'Expired ' : 'Exp. '}${new Date(p.expiryDate).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' })}` : 'No expiry set'}</p></td>
              <td className="p-3"><div className="flex flex-wrap gap-x-4 gap-y-1">
                <button className="text-link mt-0!" onClick={() => setStocking(p)}><PackagePlus size={14} /> Stock</button>
                <button className="text-link mt-0!" onClick={() => setEditing(p)}><Pencil size={14} /> Edit</button>
                <button className="text-link mt-0!" onClick={() => setHistory(p)}><History size={14} /> History</button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>}

    {editing && <ProductForm product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(m) => { setEditing(null); void done(m); }} />}
    {stocking && <StockForm product={stocking} onClose={() => setStocking(null)} onSaved={(m) => { setStocking(null); void done(m); }} />}
    {history && <HistoryPanel product={history} onClose={() => setHistory(null)} />}
  </main>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, [onClose]);
  return <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
      <div className="flex justify-between items-center p-5 border-b"><h2 className="text-xl font-bold">{title}</h2><button className="icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button></div>
      <div className="p-5">{children}</div>
    </div>
  </div>;
}

const input = 'block w-full border border-stone-300 rounded-md p-2.5 mt-1 text-sm';

function ProductForm({ product, onClose, onSaved }: { product: Row | null; onClose: () => void; onSaved: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState(product?.category || PRODUCT_CATEGORIES[1]);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setError('');
    const form = new FormData(e.currentTarget);
    form.set('requiresPrescription', String(form.get('requiresPrescription') === 'on'));
    if (product) form.set('isActive', String(form.get('isActive') === 'on'));
    try {
      const res = await fetch(product ? `/api/admin/products/${product.id}` : '/api/admin/products', { method: product ? 'PUT' : 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The product could not be saved.');
      onSaved(product ? `${data.name} updated.` : `${data.name} added.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'The product could not be saved.'); setBusy(false); }
  };
  return <Modal title={product ? `Edit ${product.name}` : 'Add a product'} onClose={onClose}>
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4 text-sm">
      {error && <p className="notice sm:col-span-2" role="alert">{error}</p>}
      <label className="sm:col-span-2">Product name *<input name="name" required maxLength={150} defaultValue={product?.name} placeholder="e.g. Panadol Extra" className={input} /></label>
      <label>Active ingredient (generic name)<input name="genericName" maxLength={150} defaultValue={product?.genericName || ''} placeholder="e.g. Paracetamol + Caffeine" className={input} /></label>
      <label>Category *<select name="category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={input}>{PRODUCT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label>Strength<input name="strength" maxLength={60} defaultValue={product?.strength || ''} placeholder="e.g. 500 mg" className={input} /></label>
      <label>Dosage form<select name="dosageForm" defaultValue={product?.dosageForm || ''} className={input}><option value="">—</option>{DOSAGE_FORMS.map((f) => <option key={f}>{f}</option>)}</select></label>
      <label>Pack size<input name="packSize" maxLength={80} defaultValue={product?.packSize || ''} placeholder="e.g. Pack of 20 tablets" className={input} /></label>
      <label>Manufacturer<input name="manufacturer" maxLength={120} defaultValue={product?.manufacturer || ''} className={input} /></label>
      <label>Selling price (KSh) *<input name="price" type="number" min="1" step="0.01" required defaultValue={product?.price} className={input} /></label>
      <label>Cost price (KSh)<input name="costPrice" type="number" min="0" step="0.01" defaultValue={product?.costPrice ?? ''} className={input} /></label>
      <label>Barcode or shelf code<input name="sku" maxLength={60} defaultValue={product?.sku || ''} className={input} /></label>
      <label>Reorder when stock reaches<input name="reorderLevel" type="number" min="0" step="1" defaultValue={product?.reorderLevel ?? 10} className={input} /></label>
      <label>Batch number<input name="batchNumber" maxLength={60} defaultValue={product?.batchNumber || ''} className={input} /></label>
      <label>Expiry date<input name="expiryDate" type="date" defaultValue={dateInput(product?.expiryDate ?? null)} className={input} /></label>
      {!product && <label>Opening stock (units)<input name="stock" type="number" min="0" step="1" defaultValue={0} className={input} /></label>}
      <label>Photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp" className={input} /></label>
      <label className="sm:col-span-2">Description<textarea name="description" rows={2} maxLength={1000} defaultValue={product?.description || ''} className={input} /></label>
      <label className="sm:col-span-2 flex items-start gap-2"><input type="checkbox" name="requiresPrescription" defaultChecked={product?.requiresPrescription || category === 'Prescription medicines'} disabled={category === 'Prescription medicines'} className="mt-1 accent-[#0e6b5c]" /><span>Prescription only — not sold online; the till asks for a checked prescription. {category === 'Prescription medicines' && <em className="text-stone-500">(Always on for this category.)</em>}</span></label>
      {product && <label className="sm:col-span-2 flex items-start gap-2"><input type="checkbox" name="isActive" defaultChecked={product.isActive} className="mt-1 accent-[#0e6b5c]" /><span>On sale (untick to hide it from the shop and the till)</span></label>}
      <div className="sm:col-span-2 flex justify-end gap-3 pt-2"><button type="button" className="shop-button secondary" onClick={onClose}>Cancel</button><button className="shop-button" disabled={busy}>{busy ? 'Saving…' : product ? 'Save changes' : 'Add product'}</button></div>
    </form>
  </Modal>;
}

const REASONS: [string, string, 1 | -1 | 0][] = [
  ['RESTOCK', 'Delivery received', 1],
  ['RETURN', 'Customer return (resaleable)', 1],
  ['EXPIRED', 'Write off: expired', -1],
  ['DAMAGED', 'Write off: damaged', -1],
  ['ADJUSTMENT', 'Count correction (+ or −)', 0],
];

function StockForm({ product, onClose, onSaved }: { product: Row; onClose: () => void; onSaved: (message: string) => void }) {
  const [reason, setReason] = useState('RESTOCK');
  const [units, setUnits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sign = REASONS.find(([id]) => id === reason)?.[2] ?? 1;
  const change = sign === 0 ? Number(units) : sign * Math.abs(Number(units));
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/admin/products/${product.id}/stock`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change, reason, reference: form.get('reference'), note: form.get('note'), batchNumber: form.get('batchNumber'), expiryDate: form.get('expiryDate') }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The stock could not be updated.');
      onSaved(`${product.name}: ${change > 0 ? '+' : ''}${change} units. Now ${data.stock} in stock.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'The stock could not be updated.'); setBusy(false); }
  };
  return <Modal title={`Stock: ${product.name}`} onClose={onClose}>
    <p className="text-sm text-stone-600 mb-4">Currently <strong>{product.stock}</strong> in stock.</p>
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4 text-sm">
      {error && <p className="notice sm:col-span-2" role="alert">{error}</p>}
      <label>What happened?<select value={reason} onChange={(e) => setReason(e.target.value)} className={input}>{REASONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Units{sign === 0 ? ' (negative to remove)' : ''} *<input type="number" required step="1" min={sign === 0 ? undefined : 1} value={units} onChange={(e) => setUnits(e.target.value)} className={input} /></label>
      <label>Reference<input name="reference" maxLength={100} placeholder={reason === 'RESTOCK' ? 'Supplier invoice no.' : ''} className={input} /></label>
      <label>Note<input name="note" maxLength={300} className={input} /></label>
      {reason === 'RESTOCK' && <>
        <label>New batch number<input name="batchNumber" maxLength={60} defaultValue={product.batchNumber || ''} className={input} /></label>
        <label>Expiry of this delivery<input name="expiryDate" type="date" defaultValue={dateInput(product.expiryDate)} className={input} /></label>
        <p className="sm:col-span-2 text-xs text-stone-500">The product keeps one batch and expiry: enter the earliest expiry on the shelf so the alerts stay accurate.</p>
      </>}
      <div className="sm:col-span-2 flex justify-end gap-3 pt-2"><button type="button" className="shop-button secondary" onClick={onClose}>Cancel</button><button className="shop-button" disabled={busy || !units || !Number.isInteger(change) || change === 0}>{busy ? 'Saving…' : Number.isFinite(change) && change ? `Record ${change > 0 ? '+' : ''}${change}` : 'Record'}</button></div>
    </form>
  </Modal>;
}

const REASON_LABEL: Record<string, string> = { SALE_POS: 'Till sale', SALE_ONLINE: 'Online order', RESTOCK: 'Delivery', ADJUSTMENT: 'Count correction', EXPIRED: 'Expired', DAMAGED: 'Damaged', RETURN: 'Return' };

function HistoryPanel({ product, onClose }: { product: Row; onClose: () => void }) {
  const { data, error, isLoading } = useSWR<Movement[]>(`/api/admin/products/${product.id}/stock`, fetcher);
  return <Modal title={`History: ${product.name}`} onClose={onClose}>
    {error ? <p className="notice" role="alert">History could not be loaded.</p> : isLoading ? <p role="status">Loading…</p> : !data?.length ? <p className="text-sm text-stone-500">No stock movements yet.</p> :
      <table className="w-full text-sm text-left"><thead className="border-b"><tr><th className="py-2">When</th><th>What</th><th className="text-right">Change</th><th className="text-right">After</th><th className="pl-3">By · ref</th></tr></thead>
        <tbody className="divide-y divide-stone-100">{data.map((m) => <tr key={m.id}><td className="py-2 whitespace-nowrap">{new Date(m.createdAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'short', timeStyle: 'short' })}</td><td>{REASON_LABEL[m.reason] || m.reason}{m.note ? <p className="text-xs text-stone-500">{m.note}</p> : null}</td><td className={`text-right ${m.change < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{m.change > 0 ? '+' : ''}{m.change}</td><td className="text-right">{m.stockAfter}</td><td className="pl-3 text-xs text-stone-500">{m.userName || '—'}{m.reference ? ` · ${m.reference}` : ''}</td></tr>)}</tbody></table>}
  </Modal>;
}
