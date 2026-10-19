import { prisma } from './prisma';
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS } from './expenses-shared';
import { kenyaDate } from './pos-report-range';

export { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS };

export class ExpenseError extends Error { constructor(message: string, public status = 400) { super(message); } }

const text = (value: unknown, limit: number) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null);

/** Checks a submitted expense and returns the fields to store. */
export function parseExpense(body: Record<string, unknown>, now = new Date()) {
  const amount = typeof body.amount === 'number' || typeof body.amount === 'string' ? Number(body.amount) : NaN;
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 10_000_000) throw new ExpenseError('Enter an amount between KSh 0.01 and KSh 10,000,000.');
  const category = text(body.category, 60);
  if (!category || !(EXPENSE_CATEGORIES as readonly string[]).includes(category)) throw new ExpenseError('Choose a category.');
  const description = text(body.description, 300);
  if (!description) throw new ExpenseError('Say what the money was spent on.');
  const paymentMethod = text(body.paymentMethod, 10) || 'CASH';
  if (!Object.hasOwn(EXPENSE_PAYMENT_METHODS, paymentMethod)) throw new ExpenseError('Choose how it was paid.');
  const day = typeof body.date === 'string' ? body.date.trim() : null;
  const date = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00+03:00`) : null;
  if (!date || !Number.isFinite(date.getTime()) || kenyaDate(date) !== day) throw new ExpenseError('Choose a valid date for the expense.');
  if (day > kenyaDate(now)) throw new ExpenseError('The expense date cannot be in the future.');
  return {
    date,
    amount: Math.round(amount * 100) / 100,
    category,
    description,
    paymentMethod,
    vendor: text(body.vendor, 120),
    reference: text(body.reference, 60),
  };
}

/** Expenses and takings for one period, used by the page and the AI insights. */
export async function expenseSummary(from: Date, to: Date) {
  const [expenses, posSales, onlinePayments] = await Promise.all([
    prisma.expense.findMany({ where: { date: { gte: from, lt: to } }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] }),
    prisma.posSale.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: from, lt: to } }, _sum: { total: true } }),
    prisma.payment.findMany({ where: { status: 'COMPLETED', createdAt: { gte: from, lt: to } }, select: { amount: true, resultDesc: true } }),
  ]);
  const byCategory: Record<string, number> = {};
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const posIncome = posSales._sum.total || 0;
  // Website orders paid at the till already count as POS sales.
  const onlineIncome = onlinePayments.filter(p => !p.resultDesc?.startsWith('Paid at POS')).reduce((sum, p) => sum + p.amount, 0);
  const income = posIncome + onlineIncome;
  return { expenses, byCategory, totalExpenses, posIncome, onlineIncome, income, profit: income - totalExpenses };
}
