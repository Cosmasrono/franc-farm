'use client';

import { useState } from 'react';
import type { ReportPeriod } from '@/app/lib/pos-report-range';

export default function PosReportFilters({ period, date, start, end, action = '/admin/pos-sales' }: {
  period: ReportPeriod; date: string; start: string; end: string; action?: string;
}) {
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [startDate, setStartDate] = useState(start);
  const [endDate, setEndDate] = useState(end);
  const inputClass = 'block mt-1 border border-stone-300 rounded px-3 py-2 bg-white text-stone-900';

  return (
    <form action={action} method="GET" className="checkout-panel mb-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm text-stone-600">
          Period
          <select name="period" value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value as ReportPeriod)} className={inputClass}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {selectedPeriod === 'custom' ? (
          <>
            <label className="text-sm text-stone-600">Start date
              <input type="date" name="start" value={startDate} onChange={(event) => setStartDate(event.target.value)} max={endDate || undefined} required className={inputClass} />
            </label>
            <label className="text-sm text-stone-600">End date
              <input type="date" name="end" value={endDate} onChange={(event) => setEndDate(event.target.value)} min={startDate || undefined} required className={inputClass} />
            </label>
          </>
        ) : (
          <label className="text-sm text-stone-600">
            {selectedPeriod === 'day' ? 'Date' : selectedPeriod === 'week' ? 'Any date in the week' : 'Any date in the month'}
            <input type="date" name="date" defaultValue={date} required className={inputClass} />
          </label>
        )}
        <button type="submit" className="shop-button">Apply filters</button>
      </div>
      <p className="text-xs text-stone-500 mt-3">Weeks run Monday to Sunday. Custom ranges include both dates. All dates use Kenya time (EAT).</p>
    </form>
  );
}
