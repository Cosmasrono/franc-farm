import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getAppSession } from '@/app/lib/auth-options';
import { ExpenseError, parseExpense } from '@/app/lib/expenses';

export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new ExpenseError('Invalid request.');
    const expense = await prisma.expense.create({
      data: { ...parseExpense(body), recordedById: session.user.id, recordedByName: session.user.name || session.user.email || 'Admin' },
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (error instanceof ExpenseError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error saving expense:', error);
    return NextResponse.json({ error: 'The expense could not be saved. Please try again.' }, { status: 500 });
  }
}
