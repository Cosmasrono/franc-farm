'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Trash2 } from 'lucide-react';
import { formatToKsh } from '@/app/lib/currency';
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS } from '@/app/lib/expenses-shared';

interface Expense {
  id: string; date: string; amount: number; category: string; description: string;
  vendor: string | null; paymentMethod: string; reference: string | null; recordedByName: string;
}
interface Summary {
  expenses: Expense[]; byCategory: Record<string, number>; totalExpenses: number;
  posIncome: number; onlineIncome: number; income: number; profit: number;
}
interface Range { period: string; date: string; start: string; end: string }

const inputClass = 'block w-full mt-1 border border-stone-300 rounded px-3 py-2 bg-white text-stone-900';

/** Renders the AI's short markdown answer: headings, bullet points and **bold**. */
function Insights({ text }: { text: string }) {
  const bold = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
    );
  return (
    <div className="space-y-2 text-sm leading-7 text-stone-700">
      {text.split('\n').map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
        if (/^#{1,6}\s/.test(line)) return <h3 key={i} className="font-semibold text-stone-900 mt-3">{bold(line.replace(/^#+\s*/, ''))}</h3>;
        if (/^([-*•]|\d+\.)\s/.test(line)) return <p key={i} className="pl-4">• {bold(line.replace(/^([-*•]|\d+\.)\s*/, ''))}</p>;
        return <p key={i}>{bold(line)}</p>;
      })}
    </div>
  );
}

export default function ExpensesManager({ today, range, summary }: { today: string; range: Range; summary: Summary }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [deleting, setDeleting] = useState('');
  const [insights, setInsights] = useState('');
  const [insightsError, setInsightsError] = useState('');
  const [thinking, setThinking] = useState(false);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The expense could not be saved.');
      const day = String(body.date);
      const outside = day < range.start || day > range.end;
      setMessage({ type: 'success', text: outside ? `Expense saved for ${day}. It is outside the period shown, so change the dates above to see it.` : 'Expense saved.' });
      setFormKey((k) => k + 1);
      setInsights('');
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'The expense could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (expense: Expense) => {
    if (!window.confirm(`Remove "${expense.description}" (${formatToKsh(expense.amount)})?`)) return;
    setDeleting(expense.id);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/expenses/' + expense.id, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) throw new Error(data.error || 'The expense could not be removed.');
      setInsights('');
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'The expense could not be removed.' });
    } finally {
      setDeleting('');
    }
  };

  const askAi = async () => {
    setThinking(true);
    setInsightsError('');
    try {
      const res = await fetch('/api/admin/expenses/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(range) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Insights could not be created.');
      setInsights(data.insights);
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'Insights could not be created.');
    } finally {
      setThinking(false);
    }
  };

  const categories = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <p className="text-sm text-stone-600 mb-6">Showing {range.start} to {range.end} · Kenya time (EAT)</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          ['Money in (sales)', summary.income, `POS ${formatToKsh(summary.posIncome)} · Online ${formatToKsh(summary.onlineIncome)}`],
          ['Money out (expenses)', summary.totalExpenses, `${summary.expenses.length} recorded`],
          ['Sales less expenses', summary.profit, 'Based on recorded expenses only'],
          ['Biggest cost', categories[0]?.[1] || 0, categories[0]?.[0] || 'Nothing recorded yet'],
        ].map(([label, value, note]) => (
          <div className="checkout-panel" key={label as string}>
            <p className="text-xs text-stone-500">{label}</p>
            <p className={`font-serif text-3xl mt-3 ${label === 'Sales less expenses' ? summary.profit < 0 ? 'text-red-700' : 'text-emerald-800' : ''}`}>{formatToKsh(value as number)}</p>
            <p className="text-xs text-stone-500 mt-2">{note}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6 mb-8">
        <section className="checkout-panel">
          <h2>Record an expense</h2>
          {message && (
            <p role={message.type === 'error' ? 'alert' : 'status'} className={message.type === 'error' ? 'notice' : 'text-sm text-emerald-800 mb-4'}>{message.text}</p>
          )}
          <form key={formKey} onSubmit={save} className="grid sm:grid-cols-2 gap-x-4">
            <label>Date<input type="date" name="date" defaultValue={today} max={today} required className={inputClass} /></label>
            <label>Amount (KSh)<input type="number" name="amount" min="0.01" max="10000000" step="0.01" inputMode="decimal" required placeholder="e.g. 3400" className={inputClass} /></label>
            <label>Category
              <select name="category" required defaultValue="" className={inputClass}>
                <option value="" disabled>Choose…</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Paid by
              <select name="paymentMethod" defaultValue="CASH" className={inputClass}>
                {Object.entries(EXPENSE_PAYMENT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">What was it for?<input name="description" required maxLength={300} placeholder="e.g. Paracetamol restock from supplier" className={inputClass} /></label>
            <label>Supplier <span className="text-stone-400">(optional)</span><input name="vendor" maxLength={120} placeholder="e.g. Naivas" className={inputClass} /></label>
            <label>Receipt / M-Pesa code <span className="text-stone-400">(optional)</span><input name="reference" maxLength={60} className={inputClass} /></label>
            <button className="shop-button sm:col-span-2" disabled={saving || thinking || !!deleting}>{saving ? 'Saving…' : 'Save expense'}</button>
          </form>
        </section>

        <section className="checkout-panel">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div>
              <h2 className="flex items-center gap-2"><Sparkles size={18} className="text-[#0e6b5c]" /> AI insights</h2>
              <p className="text-sm text-stone-500">A plain-language look at where the money went this period, with tips to improve profit.</p>
            </div>
            <button type="button" className="shop-button" onClick={askAi} disabled={thinking || saving || !!deleting}>
              {thinking ? 'Thinking…' : insights ? 'Refresh insights' : 'Get insights'}
            </button>
          </div>
          <div className="mt-5" aria-live="polite">
            {insightsError ? <p role="alert" className="notice">{insightsError}</p>
              : thinking ? <p role="status" className="text-sm text-stone-500">Reading this period&apos;s figures…</p>
              : insights ? <Insights text={insights} />
              : <p className="text-sm text-stone-500">Press &ldquo;Get insights&rdquo; for a summary. Totals and the ten largest expenses&apos; amounts, categories, dates and descriptions are shared with AI. Avoid personal details in descriptions.</p>}
          </div>
          {insights && <p className="text-xs text-stone-400 mt-5">AI-generated. Check important figures against the table below.</p>}
        </section>
      </div>

      {categories.length > 0 && (
        <section className="checkout-panel mb-8">
          <h2>By category</h2>
          <div className="space-y-3">
            {categories.map(([category, amount]) => (
              <div key={category}>
                <div className="flex justify-between text-sm"><span>{category}</span><span>{formatToKsh(amount)}</span></div>
                <div className="h-2 bg-stone-100 rounded mt-1">
                  <div className="h-2 bg-[#0e6b5c] rounded" style={{ width: `${Math.max(2, (amount / summary.totalExpenses) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="checkout-panel overflow-x-auto">
        <h2>Expenses in this period</h2>
        {!summary.expenses.length ? (
          <p className="text-sm text-stone-500">No expenses recorded for these dates yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200">
              <tr><th className="p-3">Date</th><th className="p-3">What</th><th className="p-3">Category</th><th className="p-3">Paid by</th><th className="p-3 text-right">Amount</th><th className="p-3"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {summary.expenses.map((e) => (
                <tr key={e.id}>
                  <td className="p-3 whitespace-nowrap">{new Date(e.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' })}</td>
                  <td className="p-3">
                    {e.description}
                    <span className="block text-xs text-stone-500">{[e.vendor, e.reference, 'by ' + e.recordedByName].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td className="p-3">{e.category}</td>
                  <td className="p-3">{EXPENSE_PAYMENT_METHODS[e.paymentMethod as keyof typeof EXPENSE_PAYMENT_METHODS] || e.paymentMethod}</td>
                  <td className="p-3 text-right whitespace-nowrap">{formatToKsh(e.amount)}</td>
                  <td className="p-3 text-right">
                    <button className="icon-button" aria-label={`Remove ${e.description}`} disabled={!!deleting || saving || thinking} onClick={() => remove(e)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
