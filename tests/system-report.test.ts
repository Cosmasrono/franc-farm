import assert from 'node:assert/strict';
import test from 'node:test';
import { financialReport, reportCsv } from '../app/lib/system-report';
import { mpesaHealth } from '../app/lib/mpesa-health';
import { verifiedPaymentStatus } from '../app/lib/payment-verification';
import { formatKenyanPhoneNumber } from '../app/lib/payhero';

test('reports count POS settlements once and exclude unpaid, failed and voided sales', () => {
  const rows = financialReport([
    { total: 100, status: 'COMPLETED', paymentMethod: 'CASH' },
    { total: 200, status: 'COMPLETED', paymentMethod: 'MPESA' },
    { total: 999, status: 'VOIDED', paymentMethod: 'CASH' },
  ], [
    { amount: 100, status: 'COMPLETED', resultDesc: 'Paid at POS (CASH)' },
    { amount: 50, status: 'COMPLETED', resultDesc: null },
    { amount: 900, status: 'PENDING', resultDesc: null },
    { amount: 800, status: 'FAILED', resultDesc: null },
  ], [{ amount: 400, category: 'Rent' }]);
  assert.equal(rows.find((row) => row.metric === 'Recorded income')?.value, 350);
  assert.equal(rows.find((row) => row.metric === 'Estimated profit / loss')?.value, -50);
  assert.equal(rows.find((row) => row.metric === 'POS MPESA')?.value, 200);
});

test('money adds in cents and an empty report is zero', () => {
  const rows = financialReport([], [], [{ amount: 0.1, category: 'Other' }, { amount: 0.2, category: 'Other' }]);
  assert.equal(rows.find((row) => row.metric === 'Recorded expenses')?.value, 0.3);
  assert.ok(financialReport([], [], []).every((row) => row.value === 0));
  const csv = reportCsv([{ section: 'Expenses', metric: '=BAD()', value: -50, unit: 'KSh' }], '2026-01-01', '2026-01-31');
  assert.ok(csv.includes("'=BAD()"));
  assert.ok(csv.includes('"-50"'));
});

test('M-Pesa readiness checks missing credentials, invalid channel and local callback', () => {
  assert.equal(mpesaHealth({}).ready, false);
  const env = { PAYHERO_API_USERNAME: 'test', PAYHERO_API_PASSWORD: 'test', PAYHERO_CHANNEL_ID: '1', APP_URL: 'https://pharmacy.example.com' };
  assert.equal(mpesaHealth(env).ready, true);
  assert.equal(mpesaHealth({ ...env, PAYHERO_CHANNEL_ID: '-1' }).ready, false);
  assert.equal(mpesaHealth({ ...env, APP_URL: 'http://localhost:3000' }).ready, false);
});

test('M-Pesa verification rejects wrong amounts and references and normalizes Kenyan phones', () => {
  assert.equal(verifiedPaymentStatus(100, 'ref', { status: 'SUCCESS', amount: 100, reference: 'ref' }), 'COMPLETED');
  for (const result of [null, { status: 'SUCCESS' }, { status: 'SUCCESS', amount: 1 }, { status: 'SUCCESS', amount: 100, reference: 'other' }]) assert.equal(verifiedPaymentStatus(100, 'ref', result), 'PENDING');
  assert.equal(verifiedPaymentStatus(100, 'ref', { status: 'CANCELLED' }), 'FAILED');
  assert.equal(formatKenyanPhoneNumber('+254 712 345 678'), '0712345678');
  assert.equal(formatKenyanPhoneNumber('112345678'), '0112345678');
});
