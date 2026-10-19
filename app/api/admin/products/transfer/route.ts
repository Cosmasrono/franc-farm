import { NextRequest, NextResponse } from 'next/server';
import { getAppSession } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';
import { exportProductsCsv, parseProductsCsv } from '@/app/lib/product-csv';
import { ProductInputError } from '@/app/lib/product-input';

async function admin() {
  const session = await getAppSession();
  return session?.user && ['ADMIN', 'SUPER_ADMIN'].includes(session.user.role) ? session.user : null;
}

export async function GET(request: NextRequest) {
  if (!await admin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const template = request.nextUrl.searchParams.has('template');
  const products = template ? [] : await prisma.product.findMany({ orderBy: { name: 'asc' } });
  return new NextResponse(exportProductsCsv(products), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="inventory${template ? '-template' : ''}.csv"`, 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size > 2_000_000) throw new ProductInputError('Choose a CSV file no larger than 2 MB.');
    const defaultCategory = form.get('defaultCategory');
    const products = parseProductsCsv(await file.text(), typeof defaultCategory === 'string' ? defaultCategory : '');
    await prisma.$transaction(async tx => {
      const existing = await tx.product.findMany({ select: { name: true, sku: true } });
      const names = new Set(existing.map(p => p.name.toLowerCase()));
      const skus = new Set(existing.flatMap(p => p.sku ? [p.sku.toLowerCase()] : []));
      for (const product of products) {
        if (names.has(product.name.toLowerCase()) || (product.sku && skus.has(product.sku.toLowerCase()))) throw new ProductInputError(`${product.name}: name or SKU already exists. Import adds new products; use Edit or Stock to change existing inventory.`);
      }
      // Bulk writes keep a full price list (thousands of rows) inside the transaction timeout.
      await tx.product.createMany({ data: products });
      const stocked = products.filter(p => p.stock).map(p => p.name);
      if (stocked.length) {
        const created = await tx.product.findMany({ where: { name: { in: stocked } }, select: { id: true, name: true, stock: true } });
        await tx.stockMovement.createMany({ data: created.map(p => ({ productId: p.id, productName: p.name, change: p.stock, stockAfter: p.stock, reason: 'RESTOCK', note: 'Opening stock from CSV import', userId: user.id, userName: user.name || user.email || 'Admin' })) });
      }
    }, { timeout: 60000 });
    return NextResponse.json({ count: products.length }, { status: 201 });
  } catch (error) {
    if (error instanceof ProductInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Product import failed:', error);
    return NextResponse.json({ error: 'Import failed. No products were added. Please try again.' }, { status: 500 });
  }
}
