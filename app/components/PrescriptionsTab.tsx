'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { ClipboardPlus, FileText, MessageCircle, PhoneCall, ShieldCheck } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { WHATSAPP_NUMBER, generalEnquiryMessage, whatsappLink } from '@/app/lib/whatsapp';

interface MyPrescription { id: string; reference: string; status: string; statusLabel: string; medicines: string | null; pharmacistNote: string | null; hasFile: boolean; createdAt: string }

export default function PrescriptionsTab({ onSend, refreshKey }: { onSend: () => void; refreshKey: number }) {
  const { data: session } = useSession();
  const { data, error, isLoading } = useSWR<MyPrescription[]>(session?.user ? ['/api/prescriptions', refreshKey] : null, async ([url]: [string]) => {
    const res = await fetch(url); if (!res.ok) throw new Error('Unable to load prescriptions'); return res.json();
  });
  return <section className="shop-container shop-section">
    <div className="section-heading"><div><p className="eyebrow">PRESCRIPTIONS</p><h1 className="font-serif text-4xl">Send us your prescription.</h1></div><button className="shop-button" onClick={onSend}><ClipboardPlus size={17} /> Send a prescription</button></div>
    <div className="grid md:grid-cols-3 gap-5 mb-12">
      {[
        [FileText, '1. Upload it', 'Take a clear photo of the whole prescription, or attach the PDF from your clinic.'],
        [PhoneCall, '2. We call you', 'A pharmacist checks it and calls you to confirm what is in stock and the cost.'],
        [ShieldCheck, '3. Collect or receive it', 'Pay at collection or on delivery. Bring the original prescription when you collect.'],
      ].map(([Icon, title, text]) => { const I = Icon as typeof FileText; return <div key={title as string} className="checkout-panel"><I className="text-[#0e6b5c] mb-3" size={26} /><h2 className="text-lg! mb-2!">{title as string}</h2><p className="text-sm text-stone-600 leading-6">{text as string}</p></div>; })}
    </div>

    {session?.user ? <div className="checkout-panel">
      <h2>Your prescriptions</h2>
      {error ? <p role="alert" className="notice">We could not load your prescriptions. Please try again.</p>
        : isLoading ? <p role="status">Loading…</p>
        : !data?.length ? <p className="text-sm text-stone-500">Prescriptions you send while signed in will appear here with their progress.</p>
        : <ul className="divide-y divide-stone-100">{data.map(rx => <li key={rx.id} className="py-4 flex flex-wrap justify-between gap-3">
          <div><p className="font-semibold">{rx.reference}</p><p className="text-xs text-stone-500">{new Date(rx.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}{rx.medicines ? ` · ${rx.medicines}` : ''}</p>{rx.pharmacistNote && <p className="text-sm text-stone-600 mt-2">Pharmacist: {rx.pharmacistNote}</p>}</div>
          <div className="flex items-center gap-4">{rx.hasFile && <a className="text-link mt-0!" href={`/api/prescriptions/${rx.id}/file`} target="_blank" rel="noopener noreferrer">View file</a>}<span className="enquiry-status" data-status={rx.status}>{rx.statusLabel}</span></div>
        </li>)}</ul>}
    </div> : <div className="empty-state"><h2>Track your prescriptions.</h2><p>Sign in before sending, and you can follow each prescription here. You can also send one without an account.</p><Link href={'/login?callbackUrl=' + encodeURIComponent('/#prescriptions')} className="shop-button">Sign in</Link></div>}

    <p className="text-sm text-stone-600 mt-10 leading-7">Questions about a prescription? <a className="text-link mt-0!" href={whatsappLink(generalEnquiryMessage('a prescription'))} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> WhatsApp {WHATSAPP_NUMBER}</a></p>
  </section>;
}
