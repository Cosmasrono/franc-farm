// Sample till sales over the last two weeks, so the till, POS reports and
// System Reports have something to show. Run `pnpm mock:products` first.
//
//   pnpm mock:pos          add sample sales (and take them out of stock)
//   pnpm mock:pos:clean    remove sample sales and put their stock back
//   pnpm mock:pos:reset    remove, then add fresh
//
// Sample sales have sale numbers starting SAMPLE-, so cleaning never touches real sales.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TAG = 'SAMPLE-';
const DAYS = 14;

// Same sequence every run, so the sample figures are stable.
let seed = 20261003;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];
const CUSTOMERS = ['Wanjiku M.', 'Otieno J.', 'Achieng P.', 'Kamau D.', 'Njeri W.', 'Mutua K.', 'Chebet L.', 'Omondi R.', null, null, null];
const DOCTORS = ['Dr. A. Otieno, Kenyatta National Hospital', 'Dr. M. Wambui, Nairobi West Clinic', 'Dr. S. Kiprono, Mbagathi Hospital', 'Dr. F. Hassan, Aga Khan OPD'];

async function clean() {
  const sales = await prisma.posSale.findMany({ where: { saleNumber: { startsWith: TAG } }, select: { saleNumber: true } });
  const refs = sales.map((s) => s.saleNumber);
  const movements = await prisma.stockMovement.findMany({ where: { reference: { in: refs } } });
  for (const m of movements) {
    // Put the units back on products that still exist.
    await prisma.product.updateMany({ where: { id: m.productId }, data: { stock: { increment: -m.change } } });
  }
  await prisma.stockMovement.deleteMany({ where: { reference: { in: refs } } });
  const removed = await prisma.posSale.deleteMany({ where: { saleNumber: { startsWith: TAG } } });
  console.log(`Removed ${removed.count} sample sales and returned their stock.`);
}

async function add() {
  // Older accounts have no isActive/deletedAt fields at all, so filter them here rather than in the query.
  const staff = await prisma.user.findMany({
    where: { role: { in: ['CASHIER', 'ADMIN', 'SUPER_ADMIN'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, role: true, isActive: true, deletedAt: true },
  });
  const usable = staff.filter((u) => u.isActive !== false && !u.deletedAt);
  const cashier = usable.find((u) => u.role === 'CASHIER') || usable[0];
  if (!cashier) throw new Error('No staff account found. Create a cashier or admin first.');

  const products = await prisma.product.findMany({ where: { sku: { startsWith: TAG }, isActive: true } });
  if (!products.length) throw new Error('No sample products found. Run `pnpm mock:products` first.');
  const now = Date.now();
  const sellable = () => products.filter((p) => p.stock > 0 && (!p.expiryDate || p.expiryDate.getTime() > now));

  let made = 0;
  for (let d = DAYS - 1; d >= 0; d--) {
    const salesToday = 3 + Math.floor(rand() * 5); // 3–7 sales a day
    for (let n = 0; n < salesToday; n++) {
      const day = new Date(now - d * 86_400_000);
      day.setHours(8 + Math.floor(rand() * 11), Math.floor(rand() * 60), 0, 0); // opening hours, 8am–7pm
      if (day.getTime() > now) continue;

      // 1–3 different products, mostly over the counter; about one sale in five includes a prescription.
      const withRx = rand() < 0.2;
      const lines: { product: (typeof products)[number]; quantity: number }[] = [];
      const count = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < count; i++) {
        const pool = sellable().filter((p) => p.requiresPrescription === (withRx && i === 0) && !lines.some((l) => l.product.id === p.id));
        if (!pool.length) continue;
        const product = pick(pool);
        const quantity = Math.min(product.stock, product.price < 300 ? 1 + Math.floor(rand() * 3) : 1);
        lines.push({ product, quantity });
        product.stock -= quantity; // keep the in-memory count honest for the next pick
      }
      if (!lines.length) continue;

      const items = lines.map(({ product, quantity }) => ({
        productId: product.id, stockId: product.id, name: product.name, category: product.category,
        price: product.price, quantity, subtotal: Math.round(product.price * quantity * 100) / 100,
        ...(product.requiresPrescription && { requiresPrescription: true }),
      }));
      const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
      const discount = subtotal > 2000 && rand() < 0.25 ? Math.round(subtotal * 0.05) : 0;
      const total = subtotal - discount;
      const mpesa = rand() < 0.6;
      const tendered = mpesa ? total : Math.ceil(total / 100) * 100 + (rand() < 0.5 ? 0 : 500);
      const saleNumber = `${TAG}POS-${day.toISOString().slice(0, 10).replace(/-/g, '')}-${String(made + 1).padStart(4, '0')}`;
      const rx = items.some((i) => i.requiresPrescription) ? pick(DOCTORS) : null;

      await prisma.$transaction(async (tx) => {
        await tx.posSale.create({
          data: {
            saleNumber, cashierId: cashier.id, cashierName: cashier.name, items, subtotal, discount, total,
            paymentMethod: mpesa ? 'MPESA' : 'CASH', amountPaid: tendered, changeDue: Math.round((tendered - total) * 100) / 100,
            mpesaCode: mpesa ? `SMP${String(made).padStart(7, '0')}` : null,
            customerName: pick(CUSTOMERS), notes: 'Sample sale', prescriptionRef: rx, prescriptionCheckedBy: rx ? cashier.name : null,
            status: 'COMPLETED', createdAt: day,
          },
        });
        for (const { product, quantity } of lines) {
          const updated = await tx.product.update({ where: { id: product.id }, data: { stock: { decrement: quantity } } });
          await tx.stockMovement.create({
            data: { productId: product.id, productName: product.name, change: -quantity, stockAfter: updated.stock, reason: 'SALE_POS', reference: saleNumber, note: 'Sample sale', userId: cashier.id, userName: cashier.name, createdAt: day },
          });
        }
      });
      made++;
    }
  }
  console.log(`Added ${made} sample sales over the last ${DAYS} days, rung up as ${cashier.name}.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--clean') || args.includes('--reset')) await clean();
  if (!args.includes('--clean')) await add();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
