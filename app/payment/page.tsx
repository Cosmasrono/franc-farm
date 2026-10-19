import { Suspense } from 'react';
import type { Metadata } from 'next';
import PaymentContent from './PaymentContent';
import { BRAND } from '@/app/lib/brand';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: `Checkout | ${BRAND.name}`, description: 'Review your bag, choose delivery or pickup, and pay with M-Pesa.' };
export default function PaymentPage() { return <Suspense fallback={<div className="empty-state" role="status">Preparing checkout…</div>}><PaymentContent /></Suspense>; }

