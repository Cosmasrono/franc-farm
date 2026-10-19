import test from 'node:test';
import assert from 'node:assert/strict';
import { DELIVERY_RATES, feeForDistance, parseLocation, straightLineKm } from '../app/lib/delivery';

test('delivery fee is base plus each started kilometre', () => {
  assert.equal(feeForDistance(0.4, 1000), DELIVERY_RATES.base + DELIVERY_RATES.perKm);
  assert.equal(feeForDistance(4.2, 1000), DELIVERY_RATES.base + 5 * DELIVERY_RATES.perKm);
});

test('delivery is free at the threshold and for an empty bag', () => {
  assert.equal(feeForDistance(10, DELIVERY_RATES.freeFrom), 0);
  assert.equal(feeForDistance(10, 0), 0);
});

test('only coordinates inside Kenya are accepted', () => {
  assert.deepEqual(parseLocation('-1.29', '36.82'), { lat: -1.29, lng: 36.82 });
  assert.equal(parseLocation(51.5, -0.12), null);
  assert.equal(parseLocation('abc', 36.8), null);
  assert.equal(parseLocation(undefined, undefined), null);
});

test('straight-line distance is about right across Nairobi', () => {
  // Two points in central Nairobi about 2 km apart as the crow flies.
  const km = straightLineKm({ lat: -1.2864, lng: 36.8172 }, { lat: -1.2676, lng: 36.8108 });
  assert.ok(km > 1.8 && km < 2.5, `got ${km}`);
});
