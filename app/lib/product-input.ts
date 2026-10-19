import { DOSAGE_FORMS, PRODUCT_CATEGORIES, type ProductCategory } from './products';

export class ProductInputError extends Error {}

type Source = { get(name: string): unknown };
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const bool = (v: unknown) => v === true || v === 'true' || v === 'on' || v === '1';

/**
 * Reads and checks the product fields an admin submitted, from a form or JSON
 * (anything with a `get`). Stock is not set here: it changes only through
 * stock movements, so every change is logged.
 */
export function readProductInput(source: Source) {
  const name = text(source.get('name'), 150);
  const category = text(source.get('category'), 60);
  const price = num(source.get('price'));
  if (!name) throw new ProductInputError('Enter the product name.');
  if (!category || !PRODUCT_CATEGORIES.includes(category as ProductCategory)) throw new ProductInputError('Choose a category from the list.');
  if (price === null || !Number.isFinite(price) || price <= 0 || price > 1_000_000) throw new ProductInputError('Enter a selling price above 0.');

  const costPrice = num(source.get('costPrice'));
  if (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0)) throw new ProductInputError('Cost price cannot be negative.');
  const reorderLevel = num(source.get('reorderLevel'));
  if (reorderLevel !== null && (!Number.isInteger(reorderLevel) || reorderLevel < 0 || reorderLevel > 100_000)) throw new ProductInputError('Reorder level must be a whole number of 0 or more.');

  const dosageForm = text(source.get('dosageForm'), 40);
  if (dosageForm && !(DOSAGE_FORMS as readonly string[]).includes(dosageForm)) throw new ProductInputError('Choose a dosage form from the list.');

  const expiryRaw = text(source.get('expiryDate'), 20);
  let expiryDate: Date | null = null;
  if (expiryRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryRaw)) throw new ProductInputError('Enter the expiry date as a date.');
    expiryDate = new Date(`${expiryRaw}T23:59:59.999+03:00`); // end of that day, Kenya time
    if (Number.isNaN(expiryDate.getTime())) throw new ProductInputError('Enter a real expiry date.');
  }

  return {
    name,
    category,
    price,
    costPrice,
    reorderLevel: reorderLevel ?? 10,
    genericName: text(source.get('genericName'), 150),
    description: text(source.get('description'), 1000),
    strength: text(source.get('strength'), 60),
    dosageForm,
    packSize: text(source.get('packSize'), 80),
    manufacturer: text(source.get('manufacturer'), 120),
    sku: text(source.get('sku'), 60),
    batchNumber: text(source.get('batchNumber'), 60),
    expiryDate,
    requiresPrescription: bool(source.get('requiresPrescription')) || category === 'Prescription medicines',
  };
}

/** Opening stock when a product is first added. */
export function readOpeningStock(source: Source) {
  const stock = num(source.get('stock'));
  if (stock === null) return 0;
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) throw new ProductInputError('Opening stock must be a whole number of 0 or more.');
  return stock;
}
