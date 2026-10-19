import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import credits from '@/app/lib/photo-credits.json';
import { BRAND } from '@/app/lib/brand';
import Wordmark from '@/app/components/Wordmark';

export const metadata: Metadata = { title: `Photo credits | ${BRAND.name}` };

type Credit = { image: string; title: string; author: string; licence: string; licenceUrl: string; source: string };

// CC BY and CC BY-SA photos must credit the author and licence; this page does that for every product photo.
export default function CreditsPage() {
  const rows = Object.entries(credits as Record<string, Credit>).sort(([a], [b]) => a.localeCompare(b));
  return <>
    <header className="shop-header"><div className="shop-container header-inner"><Wordmark /><Link href="/#shop" className="text-link">Back to the shop →</Link></div></header>
    <main className="shop-container shop-section">
      <p className="eyebrow">PHOTO CREDITS</p>
      <h1 className="font-serif text-4xl mb-4">Product photos</h1>
      <p className="text-sm text-stone-600 leading-7 max-w-2xl mb-8">These product photos come from Wikimedia Commons under the licences below. They were resized and placed on a white square for the shop. Photos show the product type and may not match the exact pack we stock; products without a photo here show an illustration.</p>
      <ul className="grid sm:grid-cols-2 gap-4">
        {rows.map(([product, c]) => <li key={product} className="checkout-panel flex gap-4 p-4!">
          <Image src={c.image} alt={product} width={72} height={72} className="rounded object-cover shrink-0" />
          <div className="text-sm leading-6 min-w-0">
            <p className="font-semibold">{product}</p>
            <p className="text-stone-600 truncate"><a className="underline" href={c.source} target="_blank" rel="noopener noreferrer">“{c.title}”</a> by {c.author}</p>
            <p className="text-stone-500">{c.licenceUrl ? <a className="underline" href={c.licenceUrl} target="_blank" rel="noopener noreferrer">{c.licence}</a> : c.licence}{/SA/.test(c.licence) ? ' · adapted version shared under the same licence' : ''}</p>
          </div>
        </li>)}
      </ul>
    </main>
  </>;
}
