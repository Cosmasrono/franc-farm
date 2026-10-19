import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAppSession } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';
import { BRAND } from '@/app/lib/brand';
import { expiresSoon, isExpired, isLowStock } from '@/app/lib/products';
import { OPEN_STATUSES } from '@/app/lib/prescriptions';
import AdminChat from './AdminChat';

export default async function AdminDashboardPage() {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) redirect('/login');

  const [users, payments, posSales, products, prescriptions] = await Promise.all([
    prisma.user.count(),
    prisma.payment.count({ where: { status: 'COMPLETED' } }),
    prisma.posSale.count(),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, stock: true, reorderLevel: true, expiryDate: true, batchNumber: true },
      orderBy: { name: 'asc' },
    }),
    prisma.prescriptionRequest.count({ where: { status: { in: OPEN_STATUSES } } }),
  ]);
  const now = new Date();
  const out = products.filter((p) => p.stock <= 0);
  const low = products.filter((p) => p.stock > 0 && isLowStock(p));
  const expired = products.filter((p) => p.stock > 0 && isExpired(p, now));
  const expiring = products.filter((p) => p.stock > 0 && expiresSoon(p, now)).sort((a, b) => a.expiryDate!.getTime() - b.expiryDate!.getTime());

  return (
    <main className="shop-container shop-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{BRAND.name.toUpperCase()} · ADMINISTRATION</p>
          <h1 className="font-serif text-4xl">The pharmacy, at a glance.</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/pos" className="shop-button">Launch POS Terminal ⚡</Link>
          <Link href="/" className="shop-button secondary">Home page</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-10">
        {([
          ['Prescriptions to review', prescriptions, '/admin/prescriptions', prescriptions > 0],
          ['Out of stock', out.length, '/admin/products?filter=out', out.length > 0],
          ['Low stock', low.length, '/admin/products?filter=low', low.length > 0],
          ['Expired on shelf', expired.length, '/admin/products?filter=expired', expired.length > 0],
          ['Online payments', payments, '/admin/orders', false],
          ['POS sales', posSales, '/admin/pos-sales', false],
        ] as const).map(([label, count, href, alert]) => (
          <Link href={href} className={`checkout-panel hover:border-[#0e6b5c] ${alert ? 'border-amber-400! bg-amber-50' : ''}`} key={label}>
            <p className="text-xs text-stone-500">{label}</p>
            <p className="font-serif text-4xl mt-3">{count}</p>
          </Link>
        ))}
      </div>

      <AdminChat />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
        {[
          { path: '/pos', title: 'POS Terminal', description: 'Sell over the counter and dispense prescriptions.', isTerminal: true },
          { path: '/admin/products', title: 'Products & stock', description: 'Add products, receive deliveries, track batches and expiry.' },
          { path: '/admin/prescriptions', title: 'Prescriptions', description: 'Review prescriptions sent in by customers.' },
          { path: '/admin/orders', title: 'Online Orders & Payments', description: 'Review web customer payments.' },
          { path: '/admin/pos-sales', title: 'POS Sales & Reports', description: 'Counter sales, cashier totals and receipts.' },
          { path: '/admin/reports', title: 'System Reports', description: 'Sales, expenses, profit and loss, and inventory.' },
          { path: '/admin/expenses', title: 'Expenses', description: 'Record spending and get AI insights on profit.' },
          { path: '/admin/users', title: 'Staff & User Directory', description: 'Manage cashiers, staff accounts, and customers.' },
          { path: '/admin/promotions', title: 'Promotions', description: 'Schedule messages for the storefront.' },
        ].map(({ path, title, description, isTerminal }) => (
          <Link href={path} className={`checkout-panel hover:border-[#0e6b5c] transition-colors ${isTerminal ? 'bg-[#f1f7f5] border-[#0e6b5c]/40' : ''}`} key={path}>
            <div className="flex justify-between items-start">
              <h2>{title}</h2>
              {isTerminal && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#0e6b5c] text-white">Live</span>}
            </div>
            <p className="text-sm text-stone-500 mt-1">{description}</p>
            <span className="text-link mt-4 block">Open →</span>
          </Link>
        ))}
      </div>

      <section className="checkout-panel overflow-x-auto">
        <h2>Stock that needs attention</h2>
        {!out.length && !low.length && !expired.length && !expiring.length ? (
          <p className="text-sm text-stone-500">All stock is in date and above its reorder level.{products.length ? '' : ' Add products under Products & stock to start tracking.'}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200"><tr><th className="p-3">Product</th><th className="p-3">Issue</th><th className="p-3">In stock</th><th className="p-3">Expiry</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {[
                ...expired.map((p) => ({ p, issue: 'Expired — remove from the shelf' })),
                ...out.map((p) => ({ p, issue: 'Out of stock' })),
                ...expiring.map((p) => ({ p, issue: 'Expires within 90 days' })),
                ...low.map((p) => ({ p, issue: `Low (reorder at ${p.reorderLevel})` })),
              ].slice(0, 30).map(({ p, issue }, i) => (
                <tr key={p.id + i}>
                  <td className="p-3"><Link className="text-link mt-0!" href={`/admin/products?focus=${p.id}`}>{p.name}</Link></td>
                  <td className="p-3">{issue}</td>
                  <td className="p-3">{p.stock}</td>
                  <td className="p-3">{p.expiryDate ? p.expiryDate.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' }) : '—'}{p.batchNumber ? ` · ${p.batchNumber}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="text-xs text-stone-500 mt-6">{users} registered accounts.</p>
    </main>
  );
}
