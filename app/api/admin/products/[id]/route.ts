import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAppSession } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';
import { ImageUploadError, saveImage } from '@/app/lib/uploads';
import { ProductInputError, readProductInput } from '@/app/lib/product-input';
import { isObjectId } from '@/app/lib/products';

async function admin() {
  const session = await getAppSession();
  return session?.user && ['ADMIN', 'SUPER_ADMIN'].includes(session.user.role) ? session.user : null;
}

const notFound = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

/** Edits a product's details (multipart, so a new photo can come with it). Stock is changed separately. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await admin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!isObjectId(id)) return NextResponse.json({ error: 'Unknown product.' }, { status: 400 });
  try {
    const form = await request.formData();
    const data = readProductInput(form);
    const file = form.get('image');
    const image = file instanceof File && file.size > 0 ? await saveImage(file, 'products') : undefined;
    const isActive = form.get('isActive');
    const product = await prisma.product.update({
      where: { id },
      data: { ...data, ...(image && { image }), ...(isActive !== null && { isActive: isActive === 'true' }) },
    });
    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof ProductInputError || error instanceof ImageUploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (notFound(error)) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'The product could not be saved. Please try again.' }, { status: 500 });
  }
}

/**
 * Removes a product from sale. It is deactivated rather than deleted, because
 * past sales, orders and the stock log still point at it.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await admin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!isObjectId(id)) return NextResponse.json({ error: 'Unknown product.' }, { status: 400 });
  try {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    await prisma.cart.deleteMany({ where: { productId: id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (notFound(error)) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    console.error('Error removing product:', error);
    return NextResponse.json({ error: 'The product could not be removed. Please try again.' }, { status: 500 });
  }
}
