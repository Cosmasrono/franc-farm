import { PHARMACY_LOCATION, straightLineKm, type LatLng } from './delivery';

export type RouteDistance = { km: number; minutes: number | null; estimated: boolean };

// OSRM's public demo server: free, no key, but best-effort. For heavy traffic, self-host OSRM
// or point OSRM_URL at a hosted provider with the same API.
const OSRM_URL = process.env.OSRM_URL || 'https://router.project-osrm.org';
// Roads are rarely straight; used only when the routing service cannot answer.
const ROAD_FACTOR = 1.35;

const cache = new Map<string, RouteDistance>();

/** Road distance and driving time from the pharmacy, falling back to an estimate if routing fails. */
export async function distanceFromPharmacy(to: LatLng): Promise<RouteDistance> {
  const key = `${to.lat},${to.lng}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const from = PHARMACY_LOCATION;
  let result: RouteDistance;
  try {
    const res = await fetch(`${OSRM_URL}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'pharmacy-app delivery quote' },
    });
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!res.ok || data.code !== 'Ok' || typeof route?.distance !== 'number') throw new Error(data?.code || `HTTP ${res.status}`);
    result = { km: Math.round(route.distance / 100) / 10, minutes: Math.round(route.duration / 60), estimated: false };
  } catch (error) {
    console.warn('Road distance unavailable, using an estimate:', error);
    result = { km: Math.round(straightLineKm(from, to) * ROAD_FACTOR * 10) / 10, minutes: null, estimated: true };
    return result; // Not cached, so the next quote tries the routing service again.
  }

  if (cache.size > 2000) cache.clear();
  cache.set(key, result);
  return result;
}
