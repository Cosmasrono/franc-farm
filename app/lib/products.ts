import type { Prisma, Product } from '@prisma/client';

export const PRODUCT_CATEGORIES = [
  'Prescription medicines',
  'Pain & fever',
  'Cough, cold & flu',
  'Digestive health',
  'Vitamins & supplements',
  'First aid',
  'Skin care',
  'Mother & baby',
  'Personal care',
  'Medical devices',
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Drops', 'Cream', 'Ointment', 'Gel', 'Inhaler', 'Injection', 'Sachet', 'Spray', 'Device', 'Other'] as const;

/** Products expiring within this many days are flagged for the team. */
export const EXPIRY_WARNING_DAYS = 90;
const DAY = 24 * 60 * 60 * 1000;

export const isObjectId = (id: unknown): id is string => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);

export function isExpired(product: Pick<Product, 'expiryDate'>, now = new Date()) {
  return !!product.expiryDate && product.expiryDate.getTime() <= now.getTime();
}

export function expiresSoon(product: Pick<Product, 'expiryDate'>, now = new Date()) {
  return !!product.expiryDate && !isExpired(product, now) && product.expiryDate.getTime() - now.getTime() <= EXPIRY_WARNING_DAYS * DAY;
}

export function isLowStock(product: Pick<Product, 'stock' | 'reorderLevel'>) {
  return product.stock <= product.reorderLevel;
}

/** Why a product cannot be sold right now, or null if it can. */
export function unavailableReason(product: Pick<Product, 'isActive' | 'price' | 'stock' | 'expiryDate' | 'name'>, quantity = 1, now = new Date()) {
  if (!product.isActive) return `${product.name} is no longer sold.`;
  if (!Number.isFinite(product.price) || product.price <= 0) return `${product.name} has no price set.`;
  if (isExpired(product, now)) return `${product.name} has passed its expiry date and cannot be sold.`;
  if (product.stock < quantity) return product.stock > 0 ? `Only ${product.stock} of ${product.name} left in stock.` : `${product.name} is out of stock.`;
  return null;
}

/** What customers and the till may see. Cost price and batch details stay with the admin. */
export function publicProduct(p: Product, now = new Date()) {
  return {
    id: p.id,
    name: p.name,
    genericName: p.genericName,
    category: p.category,
    description: p.description,
    strength: p.strength,
    dosageForm: p.dosageForm,
    packSize: p.packSize,
    price: p.price,
    image: p.image,
    requiresPrescription: p.requiresPrescription,
    inStock: p.stock > 0 && !isExpired(p, now),
    // Only a hint for the shop; the server checks real stock at checkout.
    lowStock: p.stock > 0 && isLowStock(p),
  };
}
export type PublicProduct = ReturnType<typeof publicProduct>;

/** What the till needs on top: the real count, the shelf code and expiry, so cashiers can check. */
export function tillProduct(p: Product, now = new Date()) {
  return { ...publicProduct(p, now), stock: p.stock, sku: p.sku, expiryDate: p.expiryDate, expired: isExpired(p, now) };
}
export type TillProduct = ReturnType<typeof tillProduct>;

export class StockError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

export type StockReason = 'SALE_POS' | 'SALE_ONLINE' | 'RESTOCK' | 'ADJUSTMENT' | 'EXPIRED' | 'DAMAGED' | 'RETURN';
export interface StockLine { productId: string; quantity: number }
interface StockContext { reason: StockReason; reference?: string | null; note?: string | null; userId?: string | null; userName?: string | null }

/**
 * Takes sold quantities out of stock and logs each movement. Run it inside a
 * transaction. In `strict` mode a line without enough stock stops the sale;
 * use `force` only when the customer has already paid, so the sale stands and
 * the shortfall shows up as negative stock for the team to investigate.
 */
export async function deductStock(tx: Prisma.TransactionClient, lines: StockLine[], ctx: StockContext, mode: 'strict' | 'force' = 'strict') {
  // One movement per product, even if the ticket lists it twice.
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!isObjectId(line.productId) || !Number.isInteger(line.quantity) || line.quantity < 1) continue;
    totals.set(line.productId, (totals.get(line.productId) || 0) + line.quantity);
  }
  const shortfalls: string[] = [];
  for (const [productId, quantity] of totals) {
    const done = await tx.product.updateMany({
      where: { id: productId, ...(mode === 'strict' && { stock: { gte: quantity } }) },
      data: { stock: { decrement: quantity } },
    });
    const product = await tx.product.findUnique({ where: { id: productId }, select: { name: true, stock: true } });
    if (!done.count) {
      if (!product && mode === 'force') { shortfalls.push(`a product that no longer exists (${productId})`); continue; }
      if (!product) throw new StockError('A product on this sale no longer exists. Remove it and try again.');
      throw new StockError(product.stock > 0 ? `Only ${product.stock} of ${product.name} left in stock.` : `${product.name} is out of stock.`);
    }
    if (!product) continue;
    if (product.stock < 0) shortfalls.push(`${product.name} (${product.stock})`);
    await tx.stockMovement.create({
      data: { productId, productName: product.name, change: -quantity, stockAfter: product.stock, reason: ctx.reason, reference: ctx.reference ?? null, note: ctx.note ?? null, userId: ctx.userId ?? null, userName: ctx.userName ?? null },
    });
  }
  return { shortfalls };
}
