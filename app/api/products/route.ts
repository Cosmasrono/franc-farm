import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { publicProduct } from '@/app/lib/products';

/** The shop's catalogue: active products only, without cost prices or batch details. */
export async function GET() {
  try {
    const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    const now = new Date();
    return NextResponse.json(products.map((p) => publicProduct(p, now)));
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
