import { prisma } from './prisma';
import { isObjectId, unavailableReason } from './products';
import { DELIVERY_RATES, feeForDistance, type LatLng } from './delivery';
import { distanceFromPharmacy, type RouteDistance } from './route-distance';
export class CheckoutError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const MAX_LINE_QUANTITY = 50;

/** A product the shop can sell online: active, priced, in date, and not prescription-only. */
export async function findSellableProduct(productId: string) {
  if (!isObjectId(productId)) return null;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.isActive || product.requiresPrescription) return null;
  return product;
}

/**
 * Prices the bag. For delivery the fee depends on the road distance to the customer's pin;
 * without a pin the quote has no fee yet, and `requireLocation` (used when ordering) refuses it.
 */
export async function getCheckout(userId: string, method: string, location: LatLng | null = null, requireLocation = false) {
  if (!['delivery', 'pickup'].includes(method)) throw new CheckoutError('Choose delivery or pickup.');
  const cart = await prisma.cart.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  if (!cart.length) throw new CheckoutError('Your bag is empty.');
  if (cart.length > 100) throw new CheckoutError('Please reduce the number of items in your bag.');
  const products = await prisma.product.findMany({ where: { id: { in: cart.map((c) => c.productId) } } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const now = new Date();
  const items = cart.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_LINE_QUANTITY) throw new CheckoutError(`Choose a quantity between 1 and ${MAX_LINE_QUANTITY}.`);
    const product = byId.get(item.productId);
    if (!product) throw new CheckoutError('An item in your bag is no longer sold. Please remove it.', 409);
    if (product.requiresPrescription) throw new CheckoutError(`${product.name} needs a prescription. Remove it and send your prescription instead.`, 409);
    const reason = unavailableReason(product, item.quantity, now);
    if (reason) throw new CheckoutError(`${reason} Please update your bag.`, 409);
    return { id: item.id, productId: product.id, name: product.name, price: product.price, image: product.image || '', category: product.category, strength: product.strength, dosageForm: product.dosageForm, quantity: item.quantity };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  let distance: RouteDistance | null = null;
  if (method === 'delivery') {
    if (!location) {
      if (requireLocation) throw new CheckoutError('Pin your delivery location on the map.');
    } else {
      distance = await distanceFromPharmacy(location);
      if (distance.km > DELIVERY_RATES.maxKm) throw new CheckoutError(`Sorry, we deliver within ${DELIVERY_RATES.maxKm} km of the pharmacy. This pin is about ${distance.km} km away; choose store pickup instead.`);
    }
  }
  const fee = distance ? feeForDistance(distance.km, subtotal) : 0;
  return { items, subtotal, deliveryFee: fee, total: Math.ceil(subtotal + fee), location: distance ? location : null, distance, needsLocation: method === 'delivery' && !location };
}
