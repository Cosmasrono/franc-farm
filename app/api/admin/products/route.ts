import { NextRequest, NextResponse } from 'next/server';
import { getAppSession } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';
import { ImageUploadError, saveImage } from '@/app/lib/uploads';
import { ProductInputError, readOpeningStock, readProductInput } from '@/app/lib/product-input';

async function admin() {
  const session = await getAppSession();
  return session?.user && ['ADMIN', 'SUPER_ADMIN'].includes(session.user.role) ? session.user : null;
}

/** Every product, including inactive ones, with stock, cost and batch details. */
export async function GET() {
  if (!await admin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const products = await prisma.product.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  return NextResponse.json(products, { headers: { 'Cache-Control': 'no-store' } });
}

/** Adds a product from the admin form (multipart, with an optional photo). */
export async function POST(request: NextRequest) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const form = await request.formData();
    const data = readProductInput(form);
    const stock = readOpeningStock(form);
    const file = form.get('image');
    const image = file instanceof File && file.size > 0 ? await saveImage(file, 'products') : null;

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: { ...data, image, stock } });
      if (stock > 0) {
        await tx.stockMovement.create({
          data: { productId: created.id, productName: created.name, change: stock, stockAfter: stock, reason: 'RESTOCK', note: 'Opening stock', userId: user.id, userName: user.name || user.email || 'Admin' },
        });
      }
      return created;
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof ProductInputError || error instanceof ImageUploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'The product could not be saved. Please try again.' }, { status: 500 });
  }
}
