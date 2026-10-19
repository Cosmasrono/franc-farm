import assert from 'node:assert/strict';
import test from 'node:test';
import { parseExpense } from '../app/lib/expenses';

const now = new Date('2026-09-29T22:30:00Z');
const expense = { amount: '1250.50', category: 'Stock purchases', description: ' Paracetamol 500mg ', date: '2026-09-30', paymentMethod: 'MPESA' };

test('records an expense using the Kenya calendar day and numeric amount', () => {
  const result = parseExpense(expense, now);
  assert.equal(result.date.toISOString(), '2026-09-29T21:00:00.000Z');
  assert.equal(result.amount, 1250.5);
  assert.equal(result.description, 'Paracetamol 500mg');
  assert.equal(result.vendor, null);
});

test('rejects impossible, malformed and future dates', () => {
  for (const date of ['2026-02-30', '2026-09-30extra', '2026-10-01', '', 'invalid']) {
    assert.throws(() => parseExpense({ ...expense, date }, now), /date/);
  }
});

test('rejects invalid amounts including values that would round to zero', () => {
  for (const amount of [true, [], null, '', 0, -1, 0.001, Infinity, 'abc', 10_000_001]) {
    assert.throws(() => parseExpense({ ...expense, amount }, now), /amount/);
  }
  assert.equal(parseExpense({ ...expense, amount: '0.01' }, now).amount, 0.01);
});

test('only accepts known categories and payment methods', () => {
  assert.throws(() => parseExpense({ ...expense, paymentMethod: 'toString' }, now), /paid/);
  assert.throws(() => parseExpense({ ...expense, category: 'Unknown' }, now), /category/);
  assert.throws(() => parseExpense({ ...expense, description: ' ' }, now), /spent/);
});
