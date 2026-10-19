import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const now = new Date();
    const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Africa/Nairobi' }).format(now));
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const start = new Date(date + 'T00:00:00Z');
    const end = new Date(date + 'T23:59:59.999Z');
    const promotion = await prisma.promotion.findFirst({ where: { active: true, daysOfWeek: { has: day }, AND: [{ OR: [{ startDate: null }, { startDate: { lte: end } }] }, { OR: [{ endDate: null }, { endDate: { gte: start } }] }] }, orderBy: { createdAt: 'desc' }, select: { message: true } });
    return NextResponse.json(promotion || {}, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({}); }
}

