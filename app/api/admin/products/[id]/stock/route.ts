import { NextRequest, NextResponse } from 'next/server';
import { getAppSession } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';
import { isObjectId } from '@/app/lib/products';

const REASONS = ['RESTOCK', 'ADJUSTMENT', 'EXPIRED', 'DAMAGED', 'RETURN'] as const;
type Reason = (typeof REASONS)[number];

async function admin() {
  const session = await getAppSession();
  return session?.user && ['ADMIN', 'SUPER_ADMIN'].includes(session.user.role) ? session.user : null;
}

/** The product's stock history, newest first. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await admin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!isObjectId(id)) return NextResponse.json({ error: 'Unknown product.' }, { status: 400 });
  const movements = await prisma.stockMovement.findMany({ where: { productId: id }, orderBy: { createdAt: 'desc' }, take: 100 });
  return NextResponse.json(movements, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Receives stock or writes it off. Body: { change, reason, reference?, note?,
 * batchNumber?, expiryDate? }. A delivery may come with a new batch and expiry.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!isObjectId(id)) return NextResponse.json({ error: 'Unknown product.' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const change = Number(body.change);
  const reason = body.reason as Reason;
  if (!REASONS.includes(reason)) return NextResponse.json({ error: 'Choose why the stock is changing.' }, { status: 400 });
  if (!Number.isInteger(change) || change === 0 || Math.abs(change) > 1_000_000) return NextResponse.json({ error: 'Enter a whole number of units, other than 0.' }, { status: 400 });
  if (reason === 'RESTOCK' && change < 0) return NextResponse.json({ error: 'A delivery adds stock. Use a write-off to remove units.' }, { status: 400 });
  if (['EXPIRED', 'DAMAGED'].includes(reason) && change > 0) return NextResponse.json({ error: 'Write-offs remove stock. Enter a negative number.' }, { status: 400 });

  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const batchNumber = text(body.batchNumber, 60);
  const expiryRaw = text(body.expiryDate, 20);
  const expiryDate = expiryRaw && /^\d{4}-\d{2}-\d{2}$/.test(expiryRaw) ? new Date(`${expiryRaw}T23:59:59.999+03:00`) : null;

  try {
    const product = await prisma.$transaction(async (tx) => {
      // A write-off cannot take stock below zero.
      const res = await tx.product.updateMany({
        where: { id, ...(change < 0 && { stock: { gte: -change } }) },
        data: { stock: { increment: change }, ...(batchNumber && { batchNumber }), ...(expiryDate && { expiryDate }) },
      });
      const current = await tx.product.findUnique({ where: { id } });
      if (!current) throw new Error('NOT_FOUND');
      if (!res.count) throw new Error(`SHORT:${current.stock}`);
      await tx.stockMovement.create({
        data: {
          productId: id, productName: current.name, change, stockAfter: current.stock, reason,
          reference: text(body.reference, 100), note: text(body.note, 300), userId: user.id, userName: user.name || user.email || 'Admin',
        },
      });
      return current;
    });
    return NextResponse.json(product);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NOT_FOUND') return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    if (message.startsWith('SHORT:')) return NextResponse.json({ error: `Only ${message.slice(6)} units are in stock.` }, { status: 409 });
    console.error('Error changing stock:', error);
    return NextResponse.json({ error: 'The stock could not be updated. Please try again.' }, { status: 500 });
  }
}
