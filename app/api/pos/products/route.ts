import { NextResponse } from 'next/server';
import { getAppSession } from '@/app/lib/auth-options';
import { loadPosProducts } from '@/app/lib/pos-catalog';

export async function GET() {
  const session = await getAppSession();
  if (!session?.user || !['CASHIER', 'ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Please sign in to the till.' }, { status: 401 });
  }

  try {
    return NextResponse.json({ products: await loadPosProducts() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error fetching POS products:', error);
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}
