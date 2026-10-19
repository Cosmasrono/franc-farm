'use client';
import { useState } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import { ClipboardPlus, Plus } from 'lucide-react';
import { formatToKsh } from '@/app/lib/currency';
import { PRODUCT_CATEGORIES, type PublicProduct } from '@/app/lib/products';
import Packshot from './Packshot';

export type AddToCart = (product: PublicProduct) => void | Promise<void>;

export default function ShopTab({ category, setCategory, handleAddToCart, onSendPrescription }: {
  category: string;
  setCategory: (category: string) => void;
  handleAddToCart: AddToCart;
  onSendPrescription: (medicine: string) => void;
}) {
  const { data, error, isLoading, mutate } = useSWR<PublicProduct[]>('/api/products', async (url: string) => {
    const response = await fetch(url); if (!response.ok) throw new Error('Unable to load products'); return response.json();
  });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name');
  const [busy, setBusy] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const products = (data || [])
    .filter(p => category === 'All' || p.category === category)
    .filter(p => !q || [p.name, p.genericName, p.description, p.strength, p.dosageForm].some(v => v?.toLowerCase().includes(q)))
    .slice()
    .sort((a, b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : a.name.localeCompare(b.name));
  const add = async (p: PublicProduct) => { setBusy(p.id); try { await handleAddToCart(p); } finally { setBusy(null); } };

  return <section className="shop-container">
    <div className="catalog-heading"><p className="eyebrow">SHOP</p><h1>{category === 'All' ? 'Health & wellness products' : category}</h1><p>Genuine products, priced and stocked by our pharmacy team.</p></div>
    <nav className="category-nav" aria-label="Product categories">
      {['All', ...PRODUCT_CATEGORIES].map(c => <button key={c} aria-current={category === c ? 'page' : undefined} onClick={() => setCategory(c)}>{c}</button>)}
    </nav>
    <div className="catalog-tools"><input aria-label="Search products" type="search" placeholder="Search by name or ingredient…" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Sort products" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name A–Z</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
    {category === 'Prescription medicines' && <div className="rx-notice mb-8"><ClipboardPlus size={20} className="shrink-0 mt-0.5" /><p>These medicines need a valid prescription. Choose “Send prescription” and our pharmacist will check it, confirm the cost with you, and prepare it for collection or delivery.</p></div>}
    {error ? <div className="empty-state" role="alert"><h2>The shop is taking a moment.</h2><p>Please try again to see what is in stock.</p><button className="shop-button" onClick={() => mutate()}>Try again</button></div> :
      isLoading ? <div className="product-grid" aria-label="Loading products">{[0,1,2].map(i => <div key={i} className="product-photo animate-pulse" />)}</div> :
      products.length ? <div className="product-grid">{products.map(p => <article key={p.id} className="product-card">
        {p.image
          ? <div className="product-photo"><Image src={p.image} alt={p.name} fill sizes="(max-width: 760px) 50vw, 33vw" className="object-cover" unoptimized={p.image.startsWith('/uploads/')} /></div>
          : <div className="product-photo"><Packshot name={p.name} strength={p.strength} dosageForm={p.dosageForm} category={p.category} className="w-full h-full transition-transform duration-500 hover:scale-105" /></div>}
        <h2>{p.name}</h2>
        <p className="product-type">{[p.genericName, p.strength, p.dosageForm !== 'Other' && p.dosageForm].filter(Boolean).join(' · ') || p.category}</p>
        {p.packSize && <p className="product-meta">{p.packSize}</p>}
        <div className="badge-row">
          {p.requiresPrescription && <span className="badge rx">Prescription only</span>}
          {!p.inStock ? <span className="badge out">Out of stock</span> : p.lowStock ? <span className="badge low">Only a few left</span> : <span className="badge">In stock</span>}
        </div>
        <div className="product-bottom"><p>{formatToKsh(p.price)}</p>
          {p.requiresPrescription
            ? <button className="shop-button secondary" onClick={() => onSendPrescription(p.name)} aria-label={`Send a prescription for ${p.name}`}><ClipboardPlus size={15} /> Send prescription</button>
            : <button className="shop-button secondary" disabled={!p.inStock || busy !== null} onClick={() => add(p)} aria-label={`Add ${p.name} to bag`}>{busy === p.id ? 'Adding…' : p.inStock ? <><Plus size={15} /> Add to bag</> : 'Out of stock'}</button>}
        </div>
      </article>)}</div> : <div className="empty-state"><h2>{q ? 'No matches.' : 'Nothing here yet.'}</h2><p>{q ? 'Try a brand name, or the active ingredient such as “paracetamol”.' : 'We are stocking this category. Ask our pharmacist on WhatsApp if you need something now.'}</p>{(q || category !== 'All') && <button className="shop-button secondary" onClick={() => { setQuery(''); setCategory('All'); }}>Show all products</button>}</div>}
    <p className="text-xs text-stone-500 mt-10 mb-4 leading-6">Product photos are for illustration. Always read the label and follow the directions. If symptoms persist, speak to a pharmacist or doctor.</p>
  </section>;
}
