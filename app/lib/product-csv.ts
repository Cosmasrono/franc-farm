import { ProductInputError, readOpeningStock, readProductInput } from './product-input';

/** Enough for a full supplier price list in one file. */
export const MAX_IMPORT_ROWS = 5000;

export const PRODUCT_COLUMNS = ['name', 'category', 'price', 'stock', 'sku', 'genericName', 'description', 'strength', 'dosageForm', 'packSize', 'manufacturer', 'costPrice', 'reorderLevel', 'batchNumber', 'expiryDate', 'requiresPrescription', 'isActive', 'image'] as const;

const normalizeHeading = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases: Record<string, string[]> = {
  name: ['product', 'product name', 'item', 'item name', 'medicine name'],
  category: ['product category', 'item category'],
  price: ['selling price', 'sale price', 'retail price', 'unit price', 'price ksh', 'selling price ksh', 'price kes', 'selling price kes'],
  stock: ['quantity', 'qty', 'stock quantity', 'quantity in stock', 'stock on hand', 'opening stock', 'available stock'],
  sku: ['barcode', 'product code', 'item code', 'shelf code'],
  genericName: ['generic', 'active ingredient', 'ingredient'],
  description: ['product description', 'item description'],
  strength: ['medicine strength'],
  dosageForm: ['form'],
  packSize: ['pack', 'package size'],
  manufacturer: ['brand', 'brand name'],
  costPrice: ['cost', 'buying price', 'purchase price', 'unit cost', 'cost price ksh', 'cost price kes'],
  reorderLevel: ['reorder point', 'minimum stock', 'min stock'],
  batchNumber: ['batch', 'batch no', 'lot number', 'lot no'],
  expiryDate: ['expiry', 'expiration date', 'expiration', 'exp date'],
  requiresPrescription: ['prescription required', 'prescription only', 'rx only'],
  isActive: ['active', 'on sale'],
  image: ['image url', 'photo', 'photo url'],
};
const columnLookup = new Map(PRODUCT_COLUMNS.flatMap(column => [column, ...(aliases[column] || [])].map(alias => [normalizeHeading(alias), column] as const)));

function delimiterFor(csv: string) {
  const counts = new Map([[',', 0], [';', 0], ['\t', 0]]);
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (c === '\r' || c === '\n') break;
      if (counts.has(c)) counts.set(c, counts.get(c)! + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

export function exportProductsCsv(products: Record<string, unknown>[]) {
  const cell = (value: unknown) => {
    let text = value == null ? '' : String(value);
    // Keep spreadsheet applications from treating product text as a formula.
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [PRODUCT_COLUMNS.join(','), ...products.map(p => PRODUCT_COLUMNS.map(key => cell(key === 'expiryDate' && p[key] ? new Date(String(p[key])).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' }) : p[key])).join(','))].join('\r\n');
}

export function parseProductsCsv(csv: string, defaultCategory = '') {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false, closed = false;
  csv = csv.replace(/^\uFEFF/, '');
  const delimiter = delimiterFor(csv);
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else value += c;
    } else if (c === delimiter || c === '\n' || c === '\r') {
      row.push(value); value = ''; closed = false;
      if (c !== delimiter) { if (row.some(v => v.trim())) rows.push(row); row = []; if (c === '\r' && csv[i + 1] === '\n') i++; }
    } else if (c === '"' && !value && !closed) quoted = true;
    else { if (closed || c === '"') throw new ProductInputError('Invalid CSV quoting. Save the file as CSV and try again.'); value += c; }
  }
  if (quoted) throw new ProductInputError('The CSV contains an unclosed quote.');
  row.push(value); if (row.some(v => v.trim())) rows.push(row);
  const originalHeaders = rows.shift()?.map(v => v.trim()) || [];
  const headers = originalHeaders.map(h => columnLookup.get(normalizeHeading(h)));
  const matched = headers.filter(h => h !== undefined);
  if (new Set(matched).size !== matched.length) throw new ProductInputError('Multiple headings match the same field. Keep only one name, price, stock or other inventory column.');
  const missing = (['name', 'category', 'price'] as const).filter(h => !headers.includes(h) && !(h === 'category' && defaultCategory));
  if (missing.length) throw new ProductInputError(`Missing required columns: ${missing.join(', ')}. Accepted examples: Product Name, Category, Selling Price. Found: ${originalHeaders.join(', ') || '(no headings)'}.`);
  const unknown = originalHeaders.filter((h, i) => !headers[i] && !['unitmargin', 'marginpct'].includes(normalizeHeading(h)));
  if (unknown.length) throw new ProductInputError(`Unrecognised columns: ${unknown.map(h => h || '(blank)').join(', ')}. Rename them to inventory fields or remove these columns. Accepted headings include Product Name, Category, Selling Price, Quantity and Barcode.`);
  if (!rows.length || rows.length > MAX_IMPORT_ROWS) throw new ProductInputError(`Import between 1 and ${MAX_IMPORT_ROWS.toLocaleString('en')} products at a time.`);
  const seen = new Set<string>();
  return rows.map((values, index) => {
    try {
      if (values.length !== headers.length) throw new ProductInputError('Column count does not match the header.');
      const data = Object.fromEntries(headers.flatMap((h, i) => h ? [[h, values[i].replace(/^'(?=[\s]*[=+@-]|[\t\r\n])/, '')]] : []));
      if (!data.category?.trim()) data.category = defaultCategory;
      for (const key of ['requiresPrescription', 'isActive']) if (data[key] && !['true', 'false', '1', '0'].includes(data[key])) throw new ProductInputError(`${key} must be true or false.`);
      const source = { get: (name: string) => data[name] };
      const product = readProductInput(source);
      if (data.expiryDate && product.expiryDate?.toISOString().slice(0, 10) !== data.expiryDate) throw new ProductInputError('Enter a real expiry date.');
      for (const key of [`name:${product.name.toLowerCase()}`, ...(product.sku ? [`sku:${product.sku.toLowerCase()}`] : [])]) {
        if (seen.has(key)) throw new ProductInputError('Duplicate name or SKU in this file.');
        seen.add(key);
      }
      const image = data.image || null;
      if (image && !/^\/images\/[\w/.-]+$/.test(image) && !/^https?:\/\//.test(image)) throw new ProductInputError('Image must be an image path or an HTTP(S) URL.');
      return { ...product, stock: readOpeningStock(source), isActive: !['false', '0'].includes(data.isActive), image };
    } catch (error) {
      if (error instanceof ProductInputError) throw new ProductInputError(`Row ${index + 2}: ${error.message}`);
      throw error;
    }
  });
}
