export type ReportPeriod = 'day' | 'week' | 'month' | 'custom';
export type ReportQuery = Record<string, string | string[] | undefined>;

const DAY_MS = 24 * 60 * 60 * 1000;
const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000;

export function kenyaDate(now = new Date()) {
  return new Date(now.getTime() + KENYA_OFFSET_MS).toISOString().slice(0, 10);
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Choose a valid date.');
  }
  return date;
}

export function getPosReportRange(query: ReportQuery, now = new Date()) {
  const value = (key: string) => {
    const entry = query[key];
    if (Array.isArray(entry)) throw new Error('Choose one value for each date filter.');
    return entry;
  };
  const period = value('period') ?? 'day';
  if (!['day', 'week', 'month', 'custom'].includes(period)) throw new Error('Choose day, week, month, or custom.');
  const date = value('date') || kenyaDate(now);
  let start = parseDate(date);
  let end = new Date(start);

  if (period === 'custom') {
    start = parseDate(value('start') || '');
    end = parseDate(value('end') || '');
    if (start > end) throw new Error('The end date must be on or after the start date.');
  } else if (period === 'week') {
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    end = new Date(start.getTime() + 6 * DAY_MS);
  } else if (period === 'month') {
    start.setUTCDate(1);
    end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
  }

  return {
    period: period as ReportPeriod,
    date,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    // Include both selected calendar dates, using an exclusive next-day boundary.
    from: new Date(start.getTime() - KENYA_OFFSET_MS),
    to: new Date(end.getTime() + DAY_MS - KENYA_OFFSET_MS),
  };
}
