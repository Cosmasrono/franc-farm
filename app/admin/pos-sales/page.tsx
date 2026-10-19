import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAppSession } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';
import PosSalesReports from './PosSalesReports';
import PosReportFilters from './PosReportFilters';
import { getPosReportRange, type ReportQuery } from '@/app/lib/pos-report-range';
import type { PosSale } from '@prisma/client';

export default async function AdminPosSalesPage({ searchParams }: { searchParams: Promise<ReportQuery> }) {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    redirect('/login');
  }

  let range = getPosReportRange({});
  let error = '';
  try {
    range = getPosReportRange(await searchParams);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Choose a valid date range.';
  }

  let sales: PosSale[] = [];
  if (!error) {
    try {
      sales = await prisma.posSale.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: range.from, lt: range.to } },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      console.error('Error loading sales in admin page:', err);
      error = 'Could not load the sales report. Please try again.';
    }
  }

  return (
    <main className="shop-container shop-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">COUNTER REGISTER AUDIT</p>
          <h1 className="font-serif text-4xl">POS Sales &amp; Cashier Reports</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/pos" className="shop-button">
            Launch POS Terminal ⚡
          </Link>
          <Link href="/admin/dashboard" className="shop-button secondary">
            Admin Dashboard
          </Link>
        </div>
      </div>

      <PosReportFilters key={`${range.period}-${range.date}-${range.start}-${range.end}`} period={range.period} date={range.date} start={range.start} end={range.end} />
      {error ? <p role="alert" className="checkout-panel text-red-700">{error}</p> : (
        <>
          <p className="text-sm text-stone-600 mb-6">Completed payments: {range.start} to {range.end} · Kenya time (EAT)</p>
          <PosSalesReports initialSales={JSON.parse(JSON.stringify(sales))} />
        </>
      )}
    </main>
  );
}
