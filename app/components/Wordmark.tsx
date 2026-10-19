import Link from 'next/link';
import { Cross } from 'lucide-react';
import { BRAND } from '@/app/lib/brand';

/** The pharmacy's name as a logo. A link home by default, or a button when `onClick` is given. */
export default function Wordmark({ onClick, className = '' }: { onClick?: () => void; className?: string }) {
  const content = <><strong className="flex items-center gap-2 font-bold"><Cross size={26} strokeWidth={2.6} aria-hidden="true" />{BRAND.wordmark}</strong><span>{BRAND.strapline}</span></>;
  return onClick
    ? <button className={`wordmark ${className}`} onClick={onClick} aria-label={`${BRAND.name} home`}>{content}</button>
    : <Link className={`wordmark ${className}`} href="/" aria-label={`${BRAND.name} home`}>{content}</Link>;
}
