import { redirect } from 'next/navigation';
import { getAppSession } from '@/app/lib/auth-options';
import AdminShell from './AdminShell';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) redirect('/login');
  return <AdminShell>{children}</AdminShell>;
}

