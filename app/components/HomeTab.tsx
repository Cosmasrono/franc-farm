'use client';

import React, { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import {
  ArrowRight,
  ClipboardPlus,
  MessageCircle,
  ShieldCheck,
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Sparkles,
  Pill,
  HeartPulse,
  Thermometer,
  ShieldAlert,
  ChevronRight,
  X,
  PhoneCall,
  PackageCheck
} from 'lucide-react';
import { BRAND } from '@/app/lib/brand';
import { WHATSAPP_NUMBER, generalEnquiryMessage, whatsappLink } from '@/app/lib/whatsapp';
import { PRODUCT_CATEGORIES, type PublicProduct } from '@/app/lib/products';
import { formatToKsh } from '@/app/lib/currency';
import { CategoryIcon } from './category-icons';
import Packshot from './Packshot';

interface HomeTabProps {
  setActiveTab: (tab: string) => void;
  openCategory: (category: string) => void;
  handleAddToCart?: (product: PublicProduct) => void | Promise<void>;
  onSendPrescription?: (medicine?: string) => void;
}

const SYMPTOM_SHORTCUTS = [
  { label: 'Headache & Fever', category: 'Pain & fever', icon: Thermometer },
  { label: 'Cough, Cold & Flu', category: 'Cough, cold & flu', icon: HeartPulse },
  { label: 'Stomach & Acid', category: 'Digestive health', icon: Pill },
  { label: 'Vitamins & Immunity', category: 'Vitamins & supplements', icon: Sparkles },
  { label: 'First Aid & Cuts', category: 'First aid', icon: ShieldCheck },
  { label: 'Prescription Rx', category: 'Prescription medicines', icon: ClipboardPlus },
];

const BLURB: Record<string, string> = {
  'Prescription medicines': 'Send your prescription for pharmacist verification & dispatch.',
  'Pain & fever': 'Fast relief for headaches, migraines, body aches and fever.',
  'Cough, cold & flu': 'Syrups, soothing lozenges, decongestants & antihistamines.',
  'Digestive health': 'Antacids, ORS rehydration sachets and tummy relief.',
  'Vitamins & supplements': 'Daily vitamins, zinc, iron, omega-3 and immune defence.',
  'First aid': 'Bandages, antiseptic solutions, cotton wool & emergency care.',
  'Skin care': 'Soothing creams, antifungal lotions and dermatological care.',
  'Mother & baby': 'Paediatric syrups, gripe water, nappies and maternal care.',
  'Personal care': 'Hygiene, dental care and sanitisation essentials.',
  'Medical devices': 'BP monitors, digital thermometers and blood glucometers.',
};

export default function HomeTab({
  setActiveTab,
  openCategory,
  handleAddToCart,
  onSendPrescription,
}: HomeTabProps) {
  const { data: allProducts, error, isLoading } = useSWR<PublicProduct[]>('/api/products', async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load products');
    return res.json();
  });

  const [homeCategory, setHomeCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  const productsSectionRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    const q = searchQuery.trim().toLowerCase();
    return allProducts
      .filter((p) => {
        if (homeCategory !== 'All' && p.category !== homeCategory) return false;
        if (!q) return true;
        return [p.name, p.genericName, p.description, p.strength, p.dosageForm, p.category]
          .some((val) => val?.toLowerCase().includes(q));
      })
      .slice(0, 12); // Curate top 12 products right on the home page
  }, [allProducts, homeCategory, searchQuery]);

  const handleAdd = async (product: PublicProduct) => {
    if (!handleAddToCart) {
      setActiveTab('shop');
      return;
    }
    setBusyProductId(product.id);
    try {
      await handleAddToCart(product);
    } finally {
      setBusyProductId(null);
    }
  };

  const scrollToProducts = (cat?: string) => {
    if (cat) setHomeCategory(cat);
    productsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-0">
      {/* Hero */}
      <div className="hero-band">
        <section className="shop-container py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left column: headline and actions */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#1f2b28] leading-[1.08]">
                  Order medicines online.<br />
                  <em className="text-[#0e6b5c] not-italic">From a licensed pharmacy.</em>
                </h1>
                <p className="text-stone-600 text-base sm:text-lg max-w-xl leading-relaxed">
                  Everyday medicines, health products and prescriptions, checked by our pharmacists.
                </p>
              </div>

              {/* Direct Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => scrollToProducts()}
                  className="shop-button flex-1 sm:flex-none"
                >
                  <Pill size={18} />
                  <span>Browse medicines</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => onSendPrescription ? onSendPrescription() : setActiveTab('prescriptions')}
                  className="shop-button secondary flex-1 sm:flex-none"
                >
                  <ClipboardPlus size={18} />
                  <span>Upload Doctor's Prescription</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-stone-500 pt-1">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" /> Pay via M-Pesa on Delivery
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" /> Tamper-Proof Sealed Pack
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" /> Pharmacist On Call
                </span>
              </div>
            </div>

            {/* Right Column: Hero Visual Highlights / Interactive Quick Pathways */}
            <div className="lg:col-span-5 space-y-4">
              {/* Card 1: Fast Delivery OTC */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:border-[#0e6b5c] transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#0e6b5c] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Truck size={24} />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base text-[#1f2b28]">Need Relief Right Now?</h3>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-[#0e6b5c]">
                        30–45m Delivery
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      Pain relief, cough syrups, antacids, vitamins, and first aid essentials in stock and ready to dispatch.
                    </p>
                    <button
                      type="button"
                      onClick={() => scrollToProducts()}
                      className="text-xs font-semibold text-[#0e6b5c] inline-flex items-center gap-1 pt-1 hover:underline"
                    >
                      Shop fast delivery medicines <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Doctor's Prescription */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:border-[#0e6b5c] transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ClipboardPlus size={24} />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base text-[#1f2b28]">Have a Doctor&apos;s Prescription?</h3>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Rx Verified
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      Snap a photo of your prescription. Our licensed pharmacist verifies it and contacts you before dispatching.
                    </p>
                    <button
                      type="button"
                      onClick={() => onSendPrescription ? onSendPrescription() : setActiveTab('prescriptions')}
                      className="text-xs font-semibold text-[#0e6b5c] inline-flex items-center gap-1 pt-1 hover:underline"
                    >
                      Send prescription photo <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 3: Need Pharmacist Advice */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:border-[#0e6b5c] transition-all group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <MessageCircle size={24} />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base text-[#1f2b28]">Talk to a Pharmacist</h3>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        WhatsApp Active
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      Unsure about dosage or which medicine is right for your symptoms? Message our pharmacy team directly.
                    </p>
                    <a
                      href={whatsappLink(generalEnquiryMessage())}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1 pt-1 hover:underline"
                    >
                      Chat on WhatsApp ({WHATSAPP_NUMBER}) <ChevronRight size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
      </div>

      {/* Service strip */}
      <div className="service-strip">
        <div>
          <ShieldCheck size={20} />
          <span>100% Genuine, PPB-Licensed Medicines</span>
        </div>
        <div>
          <Truck size={20} />
          <span>Temperature-Controlled Courier Delivery</span>
        </div>
        <div>
          <ClipboardPlus size={20} />
          <span>Prescriptions Reviewed by Qualified Pharmacist</span>
        </div>
        <div>
          <MessageCircle size={20} />
          <span>Live Support & Advice on WhatsApp</span>
        </div>
      </div>

      {/* Search and symptom finder */}
      <section className="shop-container py-10">
        <div className="bg-[#f0f6f4] rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-inner">
          <div className="max-w-2xl mb-6">
            <p className="eyebrow text-[#0e6b5c]">QUICK MEDICINE FINDER</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1f2b28] tracking-tight">
              What medicine or symptoms can we help you with?
            </h2>
            <p className="text-stone-600 text-sm mt-1">
              Search by brand name, generic chemical formula, or click a health category below.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl mb-6">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search medicines (e.g., Panadol, Coldcap, Benylin, Cetirizine, Gaviscon)..."
              className="w-full pl-12 pr-10 py-3.5 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:border-[#0e6b5c] focus:ring-2 focus:ring-[#0e6b5c22] shadow-sm text-[#1f2b28]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                aria-label="Clear search"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Quick Symptom Chips */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
              Popular Everyday Symptoms:
            </span>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_SHORTCUTS.map((symptom) => {
                const IconComponent = symptom.icon;
                const isSelected = homeCategory === symptom.category;
                return (
                  <button
                    key={symptom.label}
                    type="button"
                    onClick={() => {
                      setHomeCategory(isSelected ? 'All' : symptom.category);
                      scrollToProducts(isSelected ? 'All' : symptom.category);
                    }}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#0e6b5c] text-white shadow-sm'
                        : 'bg-white text-stone-700 border border-stone-200 hover:border-[#0e6b5c] hover:bg-stone-50'
                    }`}
                  >
                    <IconComponent size={14} className={isSelected ? 'text-white' : 'text-[#0e6b5c]'} />
                    <span>{symptom.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section ref={productsSectionRef} className="shop-container py-8" id="pharmacy-products-section">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0e6b5c] uppercase tracking-wider mb-2">
              <Truck size={15} /> READY FOR SAME-DAY DELIVERY
            </div>
            <h2 className="text-3xl font-bold text-[#1f2b28] tracking-tight">
              Essential Pharmacy Products
            </h2>
            <p className="text-stone-600 text-sm mt-1">
              Checked and stocked by our pharmacy team. Ready for courier dispatch or counter pickup.
            </p>
          </div>

          {/* Category Filter Pills on Home Page */}
          <div className="flex flex-wrap gap-2">
            {['All', 'Pain & fever', 'Cough, cold & flu', 'Digestive health', 'Vitamins & supplements', 'First aid', 'Prescription medicines'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setHomeCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  homeCategory === cat
                    ? 'bg-[#0e6b5c] text-white font-semibold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {cat === 'All' ? 'All Fast Delivery' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Live Products Grid */}
        {isLoading ? (
          <div className="home-product-grid" aria-label="Loading pharmacy products">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="animate-pulse bg-white p-3 rounded-xl border border-stone-200 space-y-3">
                <div className="aspect-[4/3] bg-stone-200 rounded-lg" />
                <div className="h-5 bg-stone-200 rounded w-3/4" />
                <div className="h-4 bg-stone-200 rounded w-1/2" />
                <div className="h-8 bg-stone-200 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="empty-state">
            <h2>Unable to load pharmacy stock</h2>
            <p>Please check your connection and try again.</p>
            <button className="shop-button" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="home-product-grid">
            {filteredProducts.map((p) => (
              <article key={p.id} className="home-product group">
                <div className="home-product-photo">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized={p.image.startsWith('/uploads/')}
                    />
                  ) : (
                    <Packshot
                      name={p.name}
                      strength={p.strength}
                      dosageForm={p.dosageForm}
                      category={p.category}
                      className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                      bleed
                    />
                  )}
                  <div className="home-product-tags">
                    {p.requiresPrescription && <span className="badge rx">Prescription</span>}
                    {!p.inStock ? (
                      <span className="badge out">Out of stock</span>
                    ) : p.lowStock ? (
                      <span className="badge low">Few left</span>
                    ) : null}
                  </div>
                </div>

                <div className="home-product-body">
                  <p className="home-product-category">{p.category}</p>
                  <h3 className="home-product-name">{p.name}</h3>
                  <p className="home-product-detail">
                    {[p.strength, p.dosageForm !== 'Other' && p.dosageForm, p.packSize].filter(Boolean).join(' · ') || p.genericName}
                  </p>

                  <div className="home-product-bottom">
                    <span className="home-product-price">{formatToKsh(p.price)}</span>
                    {p.requiresPrescription ? (
                      <button
                        type="button"
                        className="home-product-button secondary"
                        onClick={() => onSendPrescription ? onSendPrescription(p.name) : setActiveTab('prescriptions')}
                        aria-label={`Send prescription for ${p.name}`}
                      >
                        <ClipboardPlus size={14} />
                        <span>Send Rx</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!p.inStock || busyProductId !== null}
                        onClick={() => handleAdd(p)}
                        className="home-product-button"
                        aria-label={`Add ${p.name} to bag`}
                      >
                        {busyProductId === p.id ? 'Adding…' : p.inStock ? (<><Plus size={14} /><span>Add</span></>) : 'Sold out'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No medicines match your search</h2>
            <p>Try searching for active ingredients such as "Paracetamol", "Ibuprofen", or browse all categories.</p>
            <button
              type="button"
              className="shop-button secondary"
              onClick={() => {
                setSearchQuery('');
                setHomeCategory('All');
              }}
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* View Full Catalogue CTA */}
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            className="shop-button secondary px-8 py-3.5 text-sm inline-flex items-center gap-2"
          >
            <span>Explore Full Pharmacy Catalogue ({allProducts?.length || 0}+ Products)</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* How delivery works */}
      <section className="bg-[#f2f7f5] py-14 border-y border-stone-200">
        <div className="shop-container">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="eyebrow text-[#0e6b5c]">HASSLE-FREE HEALTHCARE</p>
            <h2 className="text-3xl font-bold text-[#1f2b28]">
              How Medicine Delivery Works
            </h2>
            <p className="text-stone-600 text-sm mt-2">
              From our dispensary to your home or office in 4 simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-3 relative">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-[#0e6b5c] font-bold text-sm flex items-center justify-center">
                1
              </div>
              <h3 className="font-bold text-base text-[#1f2b28]">Choose Medicine or Upload Rx</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Add everyday OTC medicines to your bag, or upload a photo of your doctor’s prescription slip.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-3 relative">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-[#0e6b5c] font-bold text-sm flex items-center justify-center">
                2
              </div>
              <h3 className="font-bold text-base text-[#1f2b28]">Pharmacist Verification</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Our qualified pharmacist reviews dosages, checks contraindications, and verifies medicine authentications.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-3 relative">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-[#0e6b5c] font-bold text-sm flex items-center justify-center">
                3
              </div>
              <h3 className="font-bold text-base text-[#1f2b28]">Discreet Tamper-Proof Pack</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Medications are securely packed in sealed, temperature-safe packaging to maintain strict privacy and quality.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-3 relative">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-[#0e6b5c] font-bold text-sm flex items-center justify-center">
                4
              </div>
              <h3 className="font-bold text-base text-[#1f2b28]">Delivered in 30–45 Mins</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                A licensed courier brings it right to your door. Pay securely with M-Pesa upon receiving your order.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="shop-container shop-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SHOP BY DEPARTMENT</p>
            <h2>All Pharmacy Categories</h2>
          </div>
          <p>
            Full catalogue of medicines, vitamins, maternal healthcare and devices,<br />
            stocked and overseen by licensed pharmacists.
          </p>
        </div>
        <div className="category-grid">
          {PRODUCT_CATEGORIES.map((category) => (
            <button
              className="category-card"
              key={category}
              type="button"
              onClick={() =>
                category === 'Prescription medicines'
                  ? setActiveTab('prescriptions')
                  : openCategory(category)
              }
            >
              <CategoryIcon category={category} size={24} />
              <h3>{category}</h3>
              <p>{BLURB[category]}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Prescriptions and consultation */}
      <section className="school-feature shop-container rounded-2xl overflow-hidden my-10">
        <div className="school-copy">
          <p className="eyebrow">DOCTOR'S PRESCRIPTION</p>
          <h2>Send it in.<br />We&apos;ll get it ready for delivery.</h2>
          <p>
            Take a clear photo of your prescription and send it to us. Our pharmacist reviews it,
            confirms availability and cost with you, and prepares your medicines for immediate collection or courier delivery.
          </p>
          <button
            type="button"
            className="shop-button"
            onClick={() => onSendPrescription ? onSendPrescription() : setActiveTab('prescriptions')}
          >
            <span>Send a prescription</span>
            <ArrowRight size={17} />
          </button>
        </div>

        <div className="school-copy bg-[#e3efe9]">
          <p className="eyebrow">PHARMACY CONSULTATION</p>
          <h2>Ask our<br />pharmacist.</h2>
          <p>
            Not sure which product is right for you, or whether two medicines can be safely taken together?
            Message our licensed pharmacy team directly on WhatsApp.
          </p>
          <a
            className="whatsapp-button"
            href={whatsappLink(generalEnquiryMessage())}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={16} />
            <span>Chat on WhatsApp ({WHATSAPP_NUMBER})</span>
          </a>
        </div>
      </section>

      {/* FAQs */}
      <section className="shop-container shop-section faq-section">
        <p className="eyebrow">DELIVERY & ORDERING DETAILS</p>
        <h2>Frequently Asked Questions</h2>

        <details>
          <summary>How fast will my medicine arrive?</summary>
          <p>
            For Nairobi orders, standard delivery takes 30 to 45 minutes from confirmation. 
            Couriers use insulated, temperature-controlled packs to keep syrups, drops, and tablets protected.
          </p>
        </details>

        <details>
          <summary>Can I order prescription medicines for home delivery?</summary>
          <p>
            Yes! Upload a photo or PDF of your doctor's prescription. Our licensed pharmacist reviews it, confirms dosage and total cost with you over phone or WhatsApp, and dispatches it straight to your address.
          </p>
        </details>

        <details>
          <summary>How do I pay for my delivery?</summary>
          <p>
            You can pay securely via M-Pesa prompt when checking out online, or choose M-Pesa / Cash on delivery when the courier arrives at your door.
          </p>
        </details>

        <details>
          <summary>Are the medicines genuine and safe?</summary>
          <p>
            Every product is sourced exclusively from licensed pharmaceutical distributors and registered with the Pharmacy and Poisons Board (PPB). All batches are tracked with verified expiry dates.
          </p>
        </details>

        <details>
          <summary>What if I need urgent emergency help?</summary>
          <p>
            Our pharmacy delivers medicines for everyday conditions and prescription refills. If you or someone else is experiencing an acute medical emergency, please call 999 or 112, or visit the nearest emergency room immediately.
          </p>
        </details>
      </section>
    </div>
  );
}
