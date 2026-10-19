import Link from 'next/link';
import { BRAND } from '@/app/lib/brand';
import { redirect } from 'next/navigation';
import { getAppSession } from '@/app/lib/auth-options';
import { getPosReportRange, type ReportQuery } from '@/app/lib/pos-report-range';
import { loadSystemReport } from '@/app/lib/load-system-report';
import { mpesaHealth } from '@/app/lib/mpesa-health';
import { formatToKsh } from '@/app/lib/currency';
import PosReportFilters from '../pos-sales/PosReportFilters';
import ReportActions from './ReportActions';

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportQuery> }) {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) redirect('/login');
  let range = getPosReportRange({ period: 'month' });
  let rows: Awaited<ReturnType<typeof loadSystemReport>> = [];
  let error = '';
  try { range = getPosReportRange({ period: 'month', ...await searchParams }); }
  catch (err) { error = err instanceof Error ? err.message : 'Choose a valid date range.'; }
  if (!error) {
    try { rows = await loadSystemReport(range.from, range.to); }
    catch { error = 'Could not load the report. Please try again.'; }
  }
  const health = mpesaHealth();
  return <main className="shop-container shop-section">
    <div className="section-heading"><div><p className="eyebrow">{BRAND.name.toUpperCase()}</p><h1 className="font-serif text-4xl">System reports</h1></div><Link className="shop-button secondary print:hidden" href="/admin/dashboard">Admin Dashboard</Link></div>
    <div className="print:hidden"><PosReportFilters key={`${range.period}-${range.date}-${range.start}-${range.end}`} action="/admin/reports" {...range} /></div>
    <p className="text-sm mb-4">{range.start} to {range.end} · Kenya time (EAT)</p>
    <p className="text-sm text-stone-600 mb-6">Sales and payments use their creation date; expenses use the date spent. Only completed payments count as income. Online orders settled at POS are counted once. Estimated profit/loss is recorded income minus recorded expenses; unrecorded costs, taxes and refunds are excluded. User and catalogue totals show the current state.</p>
    {error ? <p role="alert" className="notice">{error}</p> : <>
      <ReportActions rows={rows} start={range.start} end={range.end} />
      <div className="grid sm:grid-cols-3 gap-4 mb-6">{rows.filter((row) => row.section === 'Profit & loss').map((row) => <div className="checkout-panel" key={row.metric}><p className="text-sm text-stone-500">{row.metric}</p><p className={`text-3xl font-serif mt-3 ${row.value < 0 ? 'text-red-700' : ''}`}>{formatToKsh(row.value)}</p></div>)}</div>
      <div className="grid lg:grid-cols-2 gap-6">{[...new Set(rows.map((row) => row.section))].filter((section) => section !== 'Profit & loss').map((section) => <section key={section} className="checkout-panel break-inside-avoid"><h2>{section}</h2><table className="w-full text-sm"><thead className="sr-only"><tr><th>Metric</th><th>Value</th></tr></thead><tbody>{rows.filter((row) => row.section === section).map((row) => <tr key={row.metric} className="border-b border-stone-100"><th scope="row" className="text-left font-normal py-3 pr-3">{row.metric}</th><td className="text-right whitespace-nowrap">{row.unit === 'KSh' ? formatToKsh(row.value) : row.value}</td></tr>)}</tbody></table>{section === 'Payment records' && <p className="text-xs text-stone-500 mt-3">Includes online orders settled at POS. These record totals must not be added to the income total.</p>}</section>)}</div>
    </>}
    <section className="checkout-panel mt-6"><h2>M-Pesa configuration check</h2><p className="text-sm">{health.ready ? 'Required settings are present. A live payment is still needed to confirm the full flow.' : 'M-Pesa is not ready in this environment.'}</p>{health.issues.length > 0 && <ul className="list-disc pl-5 mt-3 text-sm">{health.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}<p className="text-xs text-stone-500 mt-3">Configuration check only. This page does not send a payment prompt or verify provider credentials.</p></section>
  </main>;
}
