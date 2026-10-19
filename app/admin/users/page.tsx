import { redirect } from 'next/navigation';
import { getAppSession } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';
import Link from 'next/link';
import UsersManager from './UsersManager';
import { effectiveRole } from '@/app/lib/admin-accounts';

export default async function AdminUsersPage() {
  const session = await getAppSession();

  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user?.role || '')) {
    redirect('/login');
  }

  const users = await prisma.user.findMany({
    where: { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main className="shop-container shop-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">STAFF & USER ACCOUNTS</p>
          <h1 className="font-serif text-4xl">Team & Cashier Directory</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/pos" className="shop-button">
            Open POS Terminal →
          </Link>
          <Link href="/admin/dashboard" className="shop-button secondary">
            Admin Dashboard
          </Link>
        </div>
      </div>

      <UsersManager initialUsers={JSON.parse(JSON.stringify(users.map((u) => ({ ...u, role: effectiveRole(u.email, u.role) }))))} currentUser={{ id: session.user.id, role: session.user.role }} />
    </main>
  );
}
