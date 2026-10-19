import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getAppSession } from '@/app/lib/auth-options';
export async function POST() { return NextResponse.json({ error: 'Place orders through checkout.' }, { status: 410 }); }
export async function GET() {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try { return NextResponse.json(await prisma.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })); }
  catch { return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 }); }
}

