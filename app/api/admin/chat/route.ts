import { NextResponse } from 'next/server';
import { getAppSession } from '@/app/lib/auth-options';
import { askAgentRouter, ChatServiceError, parseChatMessages } from '@/app/lib/admin-chat';
import { expenseSummary } from '@/app/lib/expenses';
import { getPosReportRange } from '@/app/lib/pos-report-range';

export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
  let messages;
  let includeSummary = false;
  try {
    const raw = await request.text();
    if (raw.length > 40_000) throw new Error('The conversation is too long. Start a new chat.');
    const body = JSON.parse(raw);
    messages = parseChatMessages(body?.messages);
    if (body.includeSummary !== undefined && typeof body.includeSummary !== 'boolean') throw new Error('Invalid summary option.');
    includeSummary = body.includeSummary === true;
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? 'Invalid chat request.' : error instanceof Error ? error.message : 'Invalid chat request.' }, { status: 400 });
  }
  try {
    let context: string | undefined;
    if (includeSummary) {
      const range = getPosReportRange({ period: 'month' });
      const summary = await expenseSummary(range.from, range.to);
      context = JSON.stringify({ period: `${range.start} to ${range.end}`, timezone: 'Africa/Nairobi', currency: 'KES', sales: summary.income, expenses: summary.totalExpenses, salesLessRecordedExpenses: summary.profit, expensesByCategory: summary.byCategory });
    }
    return NextResponse.json({ reply: await askAgentRouter(messages, context) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ChatServiceError ? error.message : 'Could not load the business summary. Try again with the summary turned off.' }, { status: 503 });
  }
}
