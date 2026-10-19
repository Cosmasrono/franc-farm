import { test, expect } from '@playwright/test';
const id = '507f1f77bcf86cd799439011';
const base = { genericName: null, description: null, strength: null, dosageForm: 'Tablet', packSize: null, image: null, lowStock: false };
const products = [
  { ...base, id, name: 'Paracetamol 500mg', genericName: 'Paracetamol', category: 'Pain & fever', price: 120, requiresPrescription: false, inStock: true },
  { ...base, id: '507f1f77bcf86cd799439012', name: 'Vitamin C 1000mg', category: 'Vitamins & supplements', price: 850, requiresPrescription: false, inStock: true, lowStock: true },
  { ...base, id: '507f1f77bcf86cd799439013', name: 'Amoxicillin 500mg', category: 'Prescription medicines', price: 450, requiresPrescription: true, inStock: true },
  { ...base, id: '507f1f77bcf86cd799439014', name: 'Ibuprofen 400mg', category: 'Pain & fever', price: 200, requiresPrescription: false, inStock: false },
];
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: null } }));
  await page.route('**/api/promotions', route => route.fulfill({ json: {} }));
  await page.route('**/api/products', route => route.fulfill({ json: products }));
});

test('homepage, categories, search, prescription-only products and the prescription form', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // The promotions banner fetches only once React is running, so clicks after it are handled.
  const hydrated = page.waitForRequest('**/api/promotions');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await hydrated;
  await expect(page.getByRole('heading', { name: /Your health.*looked after/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('homepage.png'), fullPage: true });

  // A category card opens the shop already filtered.
  await page.getByRole('button', { name: /Pain & fever/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pain & fever' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Paracetamol 500mg' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vitamin C 1000mg' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Ibuprofen 400mg to bag' })).toBeDisabled();

  await page.getByRole('navigation', { name: 'Product categories' }).getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search products' }).fill('paracetamol');
  await expect(page.getByRole('heading', { name: 'Paracetamol 500mg' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vitamin C 1000mg' })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search products' }).fill('no-such-medicine');
  await expect(page.getByRole('heading', { name: 'No matches.' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all products' }).click();
  await page.getByRole('combobox', { name: 'Sort products' }).selectOption('high');
  await expect(page.locator('.product-card').first().getByRole('heading')).toHaveText('Vitamin C 1000mg');

  // Prescription-only medicine can't go in the bag; it opens the prescription form instead.
  await expect(page.getByRole('button', { name: 'Add Amoxicillin 500mg to bag' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Send a prescription for Amoxicillin 500mg' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Send a prescription' })).toBeVisible();
  await expect(page.getByLabel(/Medicines you need/)).toHaveValue('Amoxicillin 500mg');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Health & wellness products' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('catalog.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('sending a prescription requires the file and shows the reference', async ({ page }) => {
  let sent: string | null = null;
  await page.route('**/api/prescriptions', async route => {
    sent = route.request().postData();
    await route.fulfill({ status: 201, json: { success: true, reference: 'RX-ABC123' } });
  });
  const hydrated = page.waitForRequest('**/api/promotions');
  await page.goto('/#prescriptions');
  await hydrated;
  await page.getByRole('button', { name: 'Send a prescription' }).first().click();
  await page.getByLabel(/Patient.s name/).fill('Jane Wanjiku');
  await page.getByLabel(/Phone number/).fill('0712345678');
  await page.locator('input[name="file"]').setInputFiles({ name: 'rx.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') });
  await page.getByRole('button', { name: 'Send to pharmacist' }).click();
  await expect(page.getByText('RX-ABC123')).toBeVisible();
  expect(sent).toContain('Jane Wanjiku');
});

test('checkout preserves the paid amount and items after confirmation', async ({ page }, testInfo) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { id, name: 'Test Customer', email: 'test@example.com', role: 'USER' }, expires: '2099-01-01T00:00:00.000Z' } }));
  const quote = { items: [{ id, productId: id, name: 'Paracetamol 500mg', price: 120, quantity: 2, image: '' }], subtotal: 240, deliveryFee: 350, total: 590 };
  await page.route('**/api/checkout?**', route => route.fulfill({ json: quote }));
  await page.route('**/api/mpesa', async route => {
    const body = route.request().postDataJSON();
    expect(body.expectedAmount).toBe(590);
    expect(body.deliveryLocation).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('isTestMode');
    await route.fulfill({ json: { paymentId: id, amount: 590, quote } });
  });
  await page.route('**/api/check-payment?**', route => route.fulfill({ json: { status: 'completed', amount: 590, mpesaReceiptNumber: 'CONFIRMED123' } }));
  await page.goto('/payment');
  await expect(page.getByRole('button', { name: 'Pin your delivery location to continue' })).toBeDisabled();
  await page.getByRole('application', { name: /choose your delivery location/ }).click({ position: { x: 200, y: 100 } });
  await page.getByLabel('House, building or landmark').fill('Test street, Nairobi');
  await page.getByLabel('Phone number').fill('0712345678');
  await page.screenshot({ path: testInfo.outputPath('checkout.png'), fullPage: true });
  await page.getByRole('button', { name: /Pay.*590/ }).click();
  await expect(page.getByRole('heading', { name: 'Payment received.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Paracetamol 500mg' })).toBeVisible();
  await expect(page.getByText('CONFIRMED123', { exact: false })).toBeVisible();
  await expect(page.locator('.checkout-total.final')).toContainText('590');
  await page.screenshot({ path: testInfo.outputPath('receipt.png'), fullPage: true });
});

test('failed bag updates retain items and explain the failure', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { id, name: 'Test', role: 'USER' } } }));
  await page.route('**/api/cart**', route => route.request().method() === 'GET'
    ? route.fulfill({ json: [{ id, productId: id, name: 'Paracetamol 500mg', price: 120, quantity: 1, image: '', problem: null }] })
    : route.fulfill({ status: 500, json: { error: 'Unavailable' } }));
  await page.goto('/');
  await page.getByRole('button', { name: /Shopping bag/ }).click();
  await page.getByRole('button', { name: 'Remove Paracetamol 500mg', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Unavailable');
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Paracetamol 500mg' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a bag line that can no longer be bought blocks checkout', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { id, name: 'Test', role: 'USER' } } }));
  await page.route('**/api/cart**', route => route.fulfill({ json: [{ id, productId: id, name: 'Ibuprofen 400mg', price: 200, quantity: 1, image: '', problem: 'Ibuprofen 400mg is out of stock.' }] }));
  await page.goto('/');
  await page.getByRole('button', { name: /Shopping bag/ }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('out of stock');
  await expect(page.getByRole('button', { name: /Continue to checkout/ })).toBeDisabled();
});
