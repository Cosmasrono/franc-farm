import assert from 'node:assert/strict';
import test from 'node:test';
import { exportProductsCsv, parseProductsCsv } from '../app/lib/product-csv';

test('CSV round trip preserves quotes, commas, multiline descriptions, stock and prescription requirements', () => {
  const csv = exportProductsCsv([{ name: 'Medicine, "A"', category: 'Prescription medicines', price: 120, stock: 15, description: 'Line one\nLine two', expiryDate: '2028-02-29T20:59:59.999Z' }]);
  const [product] = parseProductsCsv(csv);
  assert.equal(product.name, 'Medicine, "A"');
  assert.equal(product.description, 'Line one\nLine two');
  assert.equal(product.stock, 15);
  assert.equal(product.requiresPrescription, true);
  assert.equal(product.expiryDate?.toISOString(), '2028-02-29T20:59:59.999Z');
});

test('invalid rows, duplicate names, duplicate headers and impossible dates are rejected', () => {
  assert.throws(() => parseProductsCsv('name,category,price,stock\nA,Pain & fever,100,-2'), /Row 2.*stock/);
  assert.throws(() => parseProductsCsv('name,category,price\nA,Pain & fever,100\na,Pain & fever,100'), /Duplicate/);
  assert.throws(() => parseProductsCsv('name,category,price,price\nA,Pain & fever,100,100'), /headings/);
  assert.throws(() => parseProductsCsv('name,category,price,expiryDate\nA,Pain & fever,100,2027-02-30'), /real expiry/);
  assert.throws(() => parseProductsCsv('name,category,price\n"Unclosed,Pain & fever,100'), /unclosed/);
});

test('spreadsheet formulas are escaped in export and restored safely on import', () => {
  const csv = exportProductsCsv([{ name: '=1+1', category: 'Pain & fever', price: 100, stock: 0 }]);
  assert.ok(csv.includes('"\'=1+1"'));
  assert.equal(parseProductsCsv(csv)[0].name, '=1+1');
});

test('empty templates and oversized imports cannot create products', () => {
  assert.throws(() => parseProductsCsv(exportProductsCsv([])), /between 1 and 5,000/);
  assert.equal(parseProductsCsv('name,category,price\n' + Array.from({ length: 5000 }, (_, i) => `Product ${i},Pain & fever,100`).join('\n')).length, 5000);
  assert.throws(() => parseProductsCsv('name,category,price\n' + Array.from({ length: 5001 }, (_, i) => `Product ${i},Pain & fever,100`).join('\n')), /between 1 and 5,000/);
});

test('common spreadsheet headings accept spaces, punctuation and mixed case', () => {
  const [product] = parseProductsCsv('Product Name,PRODUCT_CATEGORY,Selling Price (KSh),Quantity,Barcode,Cost Price,Expiry Date\nSample,Pain & fever,120,8,00123,80,2028-12-31');
  assert.equal(product.name, 'Sample');
  assert.equal(product.price, 120);
  assert.equal(product.stock, 8);
  assert.equal(product.sku, '00123');
  assert.equal(product.costPrice, 80);
});

test('semicolon and tab separated spreadsheets retain quoted delimiters', () => {
  for (const separator of [';', '\t']) {
    const [product] = parseProductsCsv(['Item Name', 'Category', 'Unit Price', 'Qty'].join(separator) + '\r\n' + ['"Medicine; with, punctuation"', 'Pain & fever', '100', '4'].join(separator));
    assert.equal(product.name, 'Medicine; with, punctuation');
    assert.equal(product.stock, 4);
  }
});

test('ambiguous aliases and unknown headings have actionable errors', () => {
  assert.throws(() => parseProductsCsv('name,category,price,Selling Price\nA,Pain & fever,100,200'), /Multiple headings/);
  assert.throws(() => parseProductsCsv('name,category,price,Warehouse\nA,Pain & fever,100,Main'), /Unrecognised columns: Warehouse/);
  assert.throws(() => parseProductsCsv('Product Name,Quantity\nA,10'), /Missing required columns: category, price/);
});

test('inventory sheet without category uses selected category and ignores calculated margins', () => {
  const csv = 'Name,Strength,Form,CostPrice,SellingPrice,Stock,UnitMargin,MarginPct\nMedicine,500 mg,Tablet,80,100,12,20,20%';
  const [product] = parseProductsCsv(csv, 'Prescription medicines');
  assert.equal(product.category, 'Prescription medicines');
  assert.equal(product.requiresPrescription, true);
  assert.equal(product.dosageForm, 'Tablet');
  assert.equal(product.costPrice, 80);
  assert.equal(product.price, 100);
  assert.equal(product.stock, 12);
  assert.ok(!('UnitMargin' in product));
  assert.throws(() => parseProductsCsv(csv), /Missing required columns: category/);
  assert.throws(() => parseProductsCsv(csv, 'Invalid category'), /Choose a category/);
});

test('selected category fills blanks but never overrides an explicit category', () => {
  const rows = parseProductsCsv('Name,Category,Price\nA,Pain & fever,100\nB,,200', 'Prescription medicines');
  assert.equal(rows[0].category, 'Pain & fever');
  assert.equal(rows[1].category, 'Prescription medicines');
});
