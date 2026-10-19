'use client';
import { reportCsv, type ReportRow } from '@/app/lib/system-report';
export default function ReportActions({ rows, start, end }: { rows: ReportRow[]; start: string; end: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([reportCsv(rows, start, end)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = `pharmacy-report-${start}-${end}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="flex gap-3 mb-6 print:hidden"><button className="shop-button" onClick={download}>Download CSV</button><button className="shop-button secondary" onClick={() => window.print()}>Print / Save PDF</button></div>;
}
