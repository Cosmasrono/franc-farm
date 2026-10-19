import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getAppSession } from '@/app/lib/auth-options';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 });
  try {
    const { count } = await prisma.expense.deleteMany({ where: { id } });
    if (!count) return NextResponse.json({ error: 'This expense was already removed.' }, { status: 404 });
    return NextResponse.json({ message: 'Expense removed' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'The expense could not be removed. Please try again.' }, { status: 500 });
  }
}
