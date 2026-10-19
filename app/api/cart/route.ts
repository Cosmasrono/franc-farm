// app/api/cart/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAppSession } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';
import { MAX_LINE_QUANTITY, findSellableProduct } from '@/app/lib/checkout';
import { isObjectId, unavailableReason } from '@/app/lib/products';

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await getAppSession();
  return session?.user?.id ?? null;
}

/** Adds one unit of a product to the signed-in customer's bag. Body: { productId }. */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { productId } = await request.json().catch(() => ({}));
    if (!isObjectId(productId)) return NextResponse.json({ error: 'Choose a product to add.' }, { status: 400 });

    const product = await findSellableProduct(productId);
    if (!product) return NextResponse.json({ error: 'This product cannot be bought online.' }, { status: 409 });

    const existing = await prisma.cart.findFirst({ where: { userId, productId } });
    const quantity = (existing?.quantity || 0) + 1;
    if (quantity > MAX_LINE_QUANTITY) return NextResponse.json({ error: `Maximum quantity is ${MAX_LINE_QUANTITY}.` }, { status: 400 });
    const reason = unavailableReason(product, quantity);
    if (reason) return NextResponse.json({ error: reason }, { status: 409 });

    const cartItem = existing
      ? await prisma.cart.update({ where: { id: existing.id }, data: { quantity } })
      : await prisma.cart.create({ data: { userId, productId, quantity: 1 } });
    return NextResponse.json(cartItem, { status: 201 });
  } catch (error) {
    console.error('Error adding to cart:', error);
    return NextResponse.json({ error: 'Failed to add to cart' }, { status: 500 });
  }
}

/** The bag, with today's name, price and photo for each product. */
export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const cartItems = await prisma.cart.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    const products = await prisma.product.findMany({ where: { id: { in: cartItems.map((c) => c.productId) } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    const now = new Date();
    return NextResponse.json(cartItems.map((item) => {
      const product = byId.get(item.productId);
      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        name: product?.name || 'Product no longer sold',
        price: product?.price || 0,
        image: product?.image || '',
        // For the illustrated pack when there is no photo.
        category: product?.category || '',
        strength: product?.strength || null,
        dosageForm: product?.dosageForm || null,
        // Shown in the bag so the customer can fix it before checkout.
        problem: !product || product.requiresPrescription ? 'No longer available online.' : unavailableReason(product, item.quantity, now),
      };
    }));
  } catch (error) {
    console.error('Error fetching cart:', error);
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const quantity = Number(searchParams.get('quantity') ?? '0');
    if (!isObjectId(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      return NextResponse.json({ error: 'Valid cart item ID and quantity are required' }, { status: 400 });
    }

    const item = await prisma.cart.findFirst({ where: { id, userId } });
    if (!item) return NextResponse.json({ error: 'Cart item not found' }, { status: 404 });
    // Lowering a quantity is always fine; raising it must not pass what is on the shelf.
    if (quantity > item.quantity) {
      const product = await findSellableProduct(item.productId);
      const reason = product ? unavailableReason(product, quantity) : 'This product cannot be bought online.';
      if (reason) return NextResponse.json({ error: reason }, { status: 409 });
    }

    const updated = await prisma.cart.update({ where: { id }, data: { quantity } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating cart:', error);
    return NextResponse.json({ error: 'Failed to update cart item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = new URL(request.url).searchParams.get('id');
    if (!isObjectId(id)) return NextResponse.json({ error: 'Cart item ID is required' }, { status: 400 });

    const item = await prisma.cart.findFirst({ where: { id, userId } });
    if (!item) return NextResponse.json({ error: 'Cart item not found' }, { status: 404 });

    await prisma.cart.delete({ where: { id } });
    return NextResponse.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error removing from cart:', error);
    return NextResponse.json({ error: 'Failed to remove from cart' }, { status: 500 });
  }
}
