import { prisma } from './prisma';
import { tillProduct, type TillProduct } from './products';

/**
 * What the till can see: every active product at the same price as the shop,
 * with the real stock count and expiry so the cashier can spot problems.
 * Out-of-stock and expired products are listed but cannot be rung up.
 */
export async function loadPosProducts(): Promise<TillProduct[]> {
  const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  const now = new Date();
  return products.filter((p) => Number.isFinite(p.price) && p.price > 0).map((p) => tillProduct(p, now));
}
