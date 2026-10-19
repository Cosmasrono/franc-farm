import { NextRequest, NextResponse } from 'next/server';
import { getAppSession } from '@/app/lib/auth-options';
import { CheckoutError, getCheckout } from '@/app/lib/checkout';
import { parseLocation } from '@/app/lib/delivery';
export async function GET(request: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in to check out.' }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const location = parseLocation(params.get('lat'), params.get('lng'));
  try { return NextResponse.json(await getCheckout(session.user.id, params.get('deliveryMethod') || 'delivery', location), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return NextResponse.json({ error: e instanceof CheckoutError ? e.message : 'Unable to prepare checkout.' }, { status: e instanceof CheckoutError ? e.status : 500 }); }
}

