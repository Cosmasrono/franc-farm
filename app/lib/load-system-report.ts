import { prisma } from './prisma';
import { financialReport, type ReportRow } from './system-report';
import { expiresSoon, isExpired, isLowStock } from './products';

export async function loadSystemReport(from: Date, to: Date) {
  const createdAt = { gte: from, lt: to };
  const [sales, payments, expenses, users, prescriptions, products, promotions] = await Promise.all([
    prisma.posSale.findMany({ where: { createdAt }, select: { total: true, status: true, paymentMethod: true } }),
    prisma.payment.findMany({ where: { createdAt }, select: { amount: true, status: true, resultDesc: true } }),
    prisma.expense.findMany({ where: { date: createdAt }, select: { amount: true, category: true } }),
    prisma.user.findMany({ select: { role: true, isActive: true, deletedAt: true, createdAt: true } }),
    prisma.prescriptionRequest.groupBy({ by: ['status'], where: { createdAt }, _count: { _all: true } }),
    prisma.product.findMany({ where: { isActive: true }, select: { stock: true, reorderLevel: true, expiryDate: true, costPrice: true, price: true } }),
    prisma.promotion.count({ where: { active: true } }),
  ]);
  const rows = financialReport(sales, payments, expenses);
  const add = (section: string, metric: string, value: number, unit: ReportRow['unit'] = 'count') => rows.push({ section, metric, value, unit } as ReportRow);
  const visible = users.filter((user) => !user.deletedAt);
  add('Users — current totals', 'Customers', visible.filter((user) => user.role === 'USER').length);
  add('Users — current totals', 'Staff including admins', visible.filter((user) => user.role !== 'USER').length);
  add('Users — current totals', 'Enabled', visible.filter((user) => user.isActive !== false).length);
  add('Users — current totals', 'Disabled', visible.filter((user) => user.isActive === false).length);
  add('Users — current totals', 'Deleted', users.length - visible.length);
  add('Users — selected period', 'Accounts registered (includes later deletions)', users.filter((user) => user.createdAt >= from && user.createdAt < to).length);
  for (const group of prescriptions) add('Prescriptions received in period', group.status, group._count._all);
  const now = new Date();
  add('Inventory — current totals', 'Products on sale', products.length);
  add('Inventory — current totals', 'Out of stock', products.filter((p) => p.stock <= 0).length);
  add('Inventory — current totals', 'At or below reorder level', products.filter((p) => p.stock > 0 && isLowStock(p)).length);
  add('Inventory — current totals', 'Expired (still on the shelf)', products.filter((p) => p.stock > 0 && isExpired(p, now)).length);
  add('Inventory — current totals', 'Expiring within 90 days', products.filter((p) => p.stock > 0 && expiresSoon(p, now)).length);
  // Stock value at cost; products without a cost price are left out rather than guessed.
  add('Inventory — current totals', 'Stock value at cost (where cost is recorded)', Math.round(products.reduce((sum, p) => sum + (p.costPrice && p.stock > 0 ? p.costPrice * p.stock : 0), 0)), 'KSh');
  add('Inventory — current totals', 'Promotions marked active', promotions);
  return rows;
}
