'use client';
import Link from 'next/link';
import { BRAND } from '@/app/lib/brand';
import { WHATSAPP_NUMBER, generalEnquiryMessage, whatsappLink } from '@/app/lib/whatsapp';
import Wordmark from './Wordmark';
export default function Footer({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  return <footer className="shop-footer"><div className="shop-container footer-grid">
    <div><Wordmark onClick={() => setActiveTab('home')} /><p>{BRAND.tagline}</p></div>
    <div><h2>Shop</h2><button onClick={() => setActiveTab('shop')}>All products</button><button onClick={() => setActiveTab('prescriptions')}>Send a prescription</button><Link href="/orders">My orders</Link></div>
    <div><h2>Your account</h2><Link href="/login">Sign in</Link><Link href="/signup">Create an account</Link><a href={whatsappLink(generalEnquiryMessage())} target="_blank" rel="noopener noreferrer">WhatsApp {WHATSAPP_NUMBER}</a></div>
    <div><h2>Talk to a pharmacist</h2><p>Not sure what you need? Message our pharmacist on WhatsApp at {WHATSAPP_NUMBER}. In an emergency, call 999 or go to the nearest hospital.</p><button className="text-link" onClick={() => setActiveTab('prescriptions')}>Send a prescription →</button></div>
  </div><div className="shop-container footer-bottom"><span>© {new Date().getFullYear()} {BRAND.name}. {BRAND.licence}.</span><span>Prescription medicines are dispensed only against a valid prescription. <Link href="/credits" className="underline">Photo credits</Link></span></div></footer>;
}
