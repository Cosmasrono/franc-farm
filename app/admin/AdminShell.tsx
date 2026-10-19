'use client';

import { useState } from 'react';
import { Cross, Menu } from 'lucide-react';
import StaffSidebar from '@/app/components/StaffSidebar';
import { BRAND } from '@/app/lib/brand';

/** Admin pages with the staff sidebar pinned on the left; only the page content scrolls past it. */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="flex min-h-dvh">
    <StaffSidebar isAdmin open={menuOpen} onClose={() => setMenuOpen(false)} />
    <div className="min-w-0 flex-1">
      <div className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-white/15 bg-[#103d33] px-4 py-2.5 text-emerald-50 lg:hidden">
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open system menu" aria-expanded={menuOpen} aria-controls="staff-menu" className="rounded-lg p-2 hover:bg-white/10"><Menu className="size-5" /></button>
        <Cross className="size-5 shrink-0" aria-hidden="true" />
        <span className="font-bold tracking-wide">{BRAND.wordmark}</span>
      </div>
      {children}
    </div>
  </div>;
}
