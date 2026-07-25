export type RangeKey = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DateRange {
  key: RangeKey;
  from: string | null; // YYYY-MM-DD, inclusive
  to: string | null;   // YYYY-MM-DD, inclusive
  label: string;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function resolveDateRange(searchParams: URLSearchParams): DateRange {
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const explicitKey = searchParams.get('range') as RangeKey | null;
  const key: RangeKey = explicitKey ?? (from || to ? 'custom' : 'all');
  const today = startOfDay(new Date());

  switch (key) {
    case 'custom':
      return { key, from: from || null, to: to || null, label: from || to ? `${from ?? '…'} to ${to ?? '…'}` : 'Custom range' };
    case 'today':
      return { key, from: toISO(today), to: toISO(today), label: 'Today' };
    case 'week': {
      const day = today.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(today);
      monday.setDate(today.getDate() - diffToMonday);
      return { key, from: toISO(monday), to: toISO(today), label: 'This Week' };
    }
    case 'month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { key, from: toISO(first), to: toISO(today), label: 'This Month' };
    }
    case 'quarter': {
      const q = Math.floor(today.getMonth() / 3);
      const first = new Date(today.getFullYear(), q * 3, 1);
      return { key, from: toISO(first), to: toISO(today), label: 'This Quarter' };
    }
    case 'year': {
      const first = new Date(today.getFullYear(), 0, 1);
      return { key, from: toISO(first), to: toISO(today), label: 'This Year' };
    }
    default:
      return { key: 'all', from: null, to: null, label: 'All Time' };
  }
}

export function inRange(dateValue: string | null | undefined, range: DateRange): boolean {
  if (!dateValue) return range.from == null && range.to == null ? true : false;
  const d = dateValue.slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}
