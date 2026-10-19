import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { BRAND } from './lib/brand';
export const metadata: Metadata = { title: BRAND.name, description: `Order medicines, vitamins and everyday health products from ${BRAND.name}, send your prescription to our pharmacist, and collect in store or get it delivered.` };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Providers>{children}</Providers></body></html>; }

