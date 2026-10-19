import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma, Product } from '@prisma/client';
import { StockError, deductStock, expiresSoon, isExpired, publicProduct, tillProduct, unavailableReason } from '../app/lib/products';
import { ProductInputError, readOpeningStock, readProductInput } from '../app/lib/product-input';
import { PosSaleError, checkPrescription, type SaleLine } from '../app/lib/pos-sale';
import { prescriptionReference, prescriptionSummary } from '../app/lib/prescriptions';

const now = new Date('2026-10-02T09:00:00Z');
const day = 86_400_000;
const product = (over: Partial<Product> = {}): Product => ({
  id: 'a'.repeat(24), name: 'Paracetamol 500mg', genericName: 'Paracetamol', category: 'Pain & fever', description: null,
  strength: '500 mg', dosageForm: 'Tablet', packSize: 'Pack of 20', manufacturer: null, sku: '6001', price: 120, costPrice: 70,
  image: null, requiresPrescription: false, stock: 30, reorderLevel: 10, batchNumber: 'B1', expiryDate: new Date(now.getTime() + 365 * day),
  isActive: true, createdAt: now, updatedAt: now, ...over,
});

test('expiry: past or today is expired; within 90 days is flagged; no date is never expired', () => {
  assert.equal(isExpired(product({ expiryDate: new Date(now.getTime() - 1) }), now), true);
  assert.equal(isExpired(product({ expiryDate: now }), now), true);
  assert.equal(isExpired(product({ expiryDate: null }), now), false);
  assert.equal(expiresSoon(product({ expiryDate: new Date(now.getTime() + 30 * day) }), now), true);
  assert.equal(expiresSoon(product({ expiryDate: new Date(now.getTime() + 200 * day) }), now), false);
  assert.equal(expiresSoon(product({ expiryDate: new Date(now.getTime() - day) }), now), false);
});

test('a product cannot be sold when inactive, unpriced, expired or short of stock', () => {
  assert.equal(unavailableReason(product(), 30, now), null);
  assert.match(unavailableReason(product({ isActive: false }), 1, now)!, /no longer sold/);
  assert.match(unavailableReason(product({ price: 0 }), 1, now)!, /no price/);
  assert.match(unavailableReason(product({ expiryDate: new Date(now.getTime() - day) }), 1, now)!, /expiry/);
  assert.match(unavailableReason(product({ stock: 0 }), 1, now)!, /out of stock/);
  assert.match(unavailableReason(product({ stock: 3 }), 4, now)!, /Only 3/);
});

test('the shop never sees cost price, batch or exact stock; the till sees stock but not cost', () => {
  const shop = publicProduct(product({ stock: 5 }), now) as Record<string, unknown>;
  for (const hidden of ['costPrice', 'batchNumber', 'stock', 'sku', 'expiryDate']) assert.equal(hidden in shop, false, hidden);
  assert.equal(shop.inStock, true);
  assert.equal(shop.lowStock, true);
  assert.equal(publicProduct(product({ expiryDate: new Date(now.getTime() - day) }), now).inStock, false);
  const till = tillProduct(product(), now) as Record<string, unknown>;
  assert.equal(till.stock, 30);
  assert.equal('costPrice' in till, false);
});

const form = (values: Record<string, string>) => ({ get: (k: string) => values[k] ?? null });

test('product input: required fields, known category, and prescription category forces Rx', () => {
  const ok = readProductInput(form({ name: ' Amoxicillin 500mg ', category: 'Prescription medicines', price: '450', dosageForm: 'Capsule', expiryDate: '2027-03-31' }));
  assert.equal(ok.name, 'Amoxicillin 500mg');
  assert.equal(ok.requiresPrescription, true);
  assert.equal(ok.reorderLevel, 10);
  assert.equal(ok.expiryDate!.toISOString(), '2027-03-31T20:59:59.999Z'); // end of the day in Nairobi
  assert.throws(() => readProductInput(form({ category: 'Pain & fever', price: '10' })), ProductInputError);
  assert.throws(() => readProductInput(form({ name: 'X', category: 'Cakes', price: '10' })), /category/);
  assert.throws(() => readProductInput(form({ name: 'X', category: 'Pain & fever', price: '0' })), /price/);
  assert.throws(() => readProductInput(form({ name: 'X', category: 'Pain & fever', price: '5', dosageForm: 'Slice' })), /dosage/);
  assert.throws(() => readProductInput(form({ name: 'X', category: 'Pain & fever', price: '5', expiryDate: '31/03/2027' })), /expiry/);
  assert.throws(() => readOpeningStock(form({ stock: '-1' })), /Opening stock/);
  assert.equal(readOpeningStock(form({})), 0);
});

test('prescription-only lines need a confirmed prescription reference at the till', async () => {
  const rxLine: SaleLine = { productId: 'a'.repeat(24), name: 'Amoxicillin', category: 'Prescription medicines', price: 450, quantity: 1, subtotal: 450, stockId: 'a'.repeat(24), requiresPrescription: true };
  const otc: SaleLine = { ...rxLine, name: 'Paracetamol', requiresPrescription: undefined };
  assert.equal(await checkPrescription([otc], null, undefined), null);
  await assert.rejects(checkPrescription([rxLine], null, undefined), PosSaleError);
  await assert.rejects(checkPrescription([rxLine], null, { reference: 'Dr. Otieno', verified: false }), /prescription-only/);
  await assert.rejects(checkPrescription([rxLine], null, { reference: 'ab', verified: true }), /prescription-only/);
  assert.equal(await checkPrescription([rxLine], null, { reference: ' Dr. Otieno, KNH ', verified: true }), 'Dr. Otieno, KNH');
});

test('prescription references and WhatsApp summaries', () => {
  assert.equal(prescriptionReference('65f0c0ffee00000000abc123'), 'RX-ABC123');
  assert.deepEqual(prescriptionSummary({ patientName: 'Jane', phone: '0712', deliveryMethod: 'pickup', medicines: ' ' }, 'RX-1'),
    ['Reference: RX-1', 'Patient: Jane', 'Phone: 0712', 'Collection or delivery: Collect at the pharmacy']);
});

/** A tiny in-memory stand-in for a Prisma transaction, enough for deductStock. */
function fakeTx(stock: Record<string, number>) {
  const movements: { productId: string; change: number; stockAfter: number }[] = [];
  const tx = {
    product: {
      updateMany: async ({ where, data }: { where: { id: string; stock?: { gte: number } }; data: { stock: { decrement: number } } }) => {
        if (!(where.id in stock) || (where.stock && stock[where.id] < where.stock.gte)) return { count: 0 };
        stock[where.id] -= data.stock.decrement;
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: { id: string } }) => (where.id in stock ? { name: 'P' + where.id.slice(0, 1), stock: stock[where.id] } : null),
    },
    stockMovement: { create: async ({ data }: { data: (typeof movements)[number] }) => { movements.push(data); return data; } },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, movements, stock };
}

test('stock: strict mode refuses a shortfall; duplicate lines are combined; every change is logged', async () => {
  const a = 'a'.repeat(24), b = 'b'.repeat(24);
  const ok = fakeTx({ [a]: 10, [b]: 2 });
  await deductStock(ok.tx, [{ productId: a, quantity: 3 }, { productId: a, quantity: 2 }, { productId: b, quantity: 2 }], { reason: 'SALE_POS' });
  assert.deepEqual(ok.stock, { [a]: 5, [b]: 0 });
  assert.deepEqual(ok.movements.map((m) => [m.change, m.stockAfter]), [[-5, 5], [-2, 0]]);

  const short = fakeTx({ [a]: 1 });
  await assert.rejects(deductStock(short.tx, [{ productId: a, quantity: 2 }], { reason: 'SALE_POS' }), StockError);
  assert.equal(short.stock[a], 1);
});

test('stock: force mode (customer already paid) records the sale and reports the shortfall', async () => {
  const a = 'a'.repeat(24);
  const paid = fakeTx({ [a]: 1 });
  const { shortfalls } = await deductStock(paid.tx, [{ productId: a, quantity: 3 }, { productId: 'not-an-id', quantity: 1 }], { reason: 'SALE_ONLINE' }, 'force');
  assert.equal(paid.stock[a], -2);
  assert.equal(shortfalls.length, 1);
  assert.equal(paid.movements.length, 1);
  const gone = fakeTx({});
  const missing = await deductStock(gone.tx, [{ productId: a, quantity: 1 }], { reason: 'SALE_ONLINE' }, 'force');
  assert.equal(missing.shortfalls.length, 1);
});
