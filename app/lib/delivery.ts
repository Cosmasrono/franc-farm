// Delivery pricing and the pharmacy's location. Shared by the checkout page and the server,
// so it must not import anything server-only.

/**
 * Where riders start from. PLACEHOLDER (central Nairobi): replace with the pharmacy's real
 * coordinates. In Google Maps, right-click the shop's entrance and click the numbers to copy them.
 */
export const PHARMACY_LOCATION = { lat: -1.2864, lng: 36.8172 };

export const DELIVERY_RATES = {
  /** Charged on every delivery, in KSh. */
  base: 200,
  /** Added for each road kilometre, in KSh. */
  perKm: 30,
  /** Orders at or above this subtotal are delivered free, in KSh. */
  freeFrom: 5000,
  /** Furthest road distance we deliver to, in km. */
  maxKm: 25,
};

export type LatLng = { lat: number; lng: number };

/** Accepts only finite coordinates within Kenya, so a mistyped or spoofed pin is rejected. */
export function parseLocation(lat: unknown, lng: unknown): LatLng | null {
  const la = typeof lat === 'string' ? Number(lat) : lat;
  const ln = typeof lng === 'string' ? Number(lng) : lng;
  if (typeof la !== 'number' || typeof ln !== 'number' || !Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -4.9 || la > 5.1 || ln < 33.8 || ln > 42) return null;
  return { lat: Math.round(la * 1e5) / 1e5, lng: Math.round(ln * 1e5) / 1e5 };
}

/** Straight-line distance in km. */
export function straightLineKm(a: LatLng, b: LatLng) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Whole shillings: base plus a charge per km (part kilometres round up), free above the threshold. */
export function feeForDistance(km: number, subtotal: number) {
  if (subtotal >= DELIVERY_RATES.freeFrom || subtotal === 0) return 0;
  return DELIVERY_RATES.base + Math.ceil(km) * DELIVERY_RATES.perKm;
}

export const googleMapsLink = (to: LatLng) =>
  `https://www.google.com/maps/dir/?api=1&origin=${PHARMACY_LOCATION.lat},${PHARMACY_LOCATION.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
