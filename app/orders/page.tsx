import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAppSession } from '@/app/lib/auth-options';
import OrdersTab from '@/app/components/OrdersTab';
import Wordmark from '@/app/components/Wordmark';
export default async function OrdersPage() {
  const session = await getAppSession();
  if (!session?.user?.id) redirect('/login?callbackUrl=/orders');
  return <><header className="shop-header"><div className="shop-container header-inner"><Wordmark /><Link href="/#shop" className="text-link">Continue shopping →</Link></div></header><main><OrdersTab userId={session.user.id} /></main></>;
}

