import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAppSession } from '@/app/lib/auth-options';
import { getPosReportRange, kenyaDate, type ReportQuery } from '@/app/lib/pos-report-range';
import { expenseSummary } from '@/app/lib/expenses';
import PosReportFilters from '../pos-sales/PosReportFilters';
import ExpensesManager from './ExpensesManager';

export default async function AdminExpensesPage({ searchParams }: { searchParams: Promise<ReportQuery> }) {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) redirect('/login');

  let range = getPosReportRange({ period: 'month' });
  let error = '';
  try {
    const query = await searchParams;
    range = getPosReportRange({ period: 'month', ...query });
  } catch (err) {
    error = err instanceof Error ? err.message : 'Choose a valid date range.';
  }

  let summary: Awaited<ReturnType<typeof expenseSummary>> | null = null;
  if (!error) {
    try {
      summary = await expenseSummary(range.from, range.to);
    } catch (err) {
      console.error('Error loading expenses:', err);
      error = 'Could not load expenses. Please try again.';
    }
  }

  return (
    <main className="shop-container shop-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MONEY OUT</p>
          <h1 className="font-serif text-4xl">Expenses</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/pos-sales" className="shop-button secondary">POS Sales</Link>
          <Link href="/admin/dashboard" className="shop-button secondary">Admin Dashboard</Link>
        </div>
      </div>

      <PosReportFilters
        key={`${range.period}-${range.date}-${range.start}-${range.end}`}
        action="/admin/expenses"
        period={range.period}
        date={range.date}
        start={range.start}
        end={range.end}
      />
      {error || !summary ? (
        <p role="alert" className="checkout-panel text-red-700">{error || 'Could not load expenses.'}</p>
      ) : (
        <ExpensesManager
          key={`${range.start}-${range.end}`}
          today={kenyaDate()}
          range={{ period: range.period, date: range.date, start: range.start, end: range.end }}
          summary={JSON.parse(JSON.stringify(summary))}
        />
      )}
    </main>
  );
}
