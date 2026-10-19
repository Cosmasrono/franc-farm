import { test, expect } from '@playwright/test';
import { verifiedPaymentStatus } from '../app/lib/payment-verification';
test('provider verification rejects forged success, missing amounts, underpayments and mismatched references', () => {
  expect(verifiedPaymentStatus(2000, 'ref', { status: 'SUCCESS', amount: 1 })).toBe('PENDING');
  expect(verifiedPaymentStatus(2000, 'ref', { status: 'SUCCESS' })).toBe('PENDING');
  expect(verifiedPaymentStatus(2000, 'ref', { status: 'SUCCESS', amount: 2000, reference: 'someone-else' })).toBe('PENDING');
  expect(verifiedPaymentStatus(2000, 'ref', { status: 'QUEUED', amount: 2000 })).toBe('PENDING');
  expect(verifiedPaymentStatus(2000, 'ref', null)).toBe('PENDING');
  expect(verifiedPaymentStatus(2000, 'ref', { status: 'SUCCESS', amount: 2000, reference: 'ref' })).toBe('COMPLETED');
});
test('anonymous requests cannot change products, stock or prescriptions, or read customer data', async ({ request }) => {
  const id = '507f1f77bcf86cd799439011';
  expect((await request.get('/api/admin/products')).status()).toBe(403);
  expect((await request.post('/api/admin/products', { multipart: { name: 'X', category: 'Pain & fever', price: '1' } })).status()).toBe(403);
  expect((await request.delete('/api/admin/products/' + id)).status()).toBe(403);
  expect((await request.post('/api/admin/products/' + id + '/stock', { data: { change: 100, reason: 'RESTOCK' } })).status()).toBe(403);
  expect((await request.get('/api/admin/products/' + id + '/stock')).status()).toBe(403);
  expect((await request.get('/api/prescriptions/' + id + '/file')).status()).toBe(401);
  expect((await request.get('/api/prescriptions')).status()).toBe(401);
  expect((await request.get('/api/orders/user/' + id)).status()).toBe(403);
  expect((await request.get('/api/pos/products')).status()).toBe(401);
  expect((await request.post('/api/mpesa', { data: { isTestMode: true } })).status()).toBe(401);
  expect((await request.get('/api/check-payment?paymentId=' + id + '&simulateSuccess=true')).status()).toBe(401);
  // Prescription files are never served from the public folder.
  expect((await request.get('/storage/prescriptions/x.png')).status()).toBe(404);
});
