import { getAppSession } from '@/app/lib/auth-options';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    hasPayHeroUsername: !!process.env.PAYHERO_API_USERNAME,
    hasPayHeroPassword: !!process.env.PAYHERO_API_PASSWORD,
    hasPayHeroChannelId: !!process.env.PAYHERO_CHANNEL_ID,
    payheroChannelId: process.env.PAYHERO_CHANNEL_ID || null,
    payheroBaseUrl: process.env.PAYHERO_BASE_URL || 'https://backend.payhero.co.ke/api/v2',
    hasPayHeroCallbackUrl: !!process.env.PAYHERO_CALLBACK_URL,
    allPayHeroKeys: Object.keys(process.env).filter(key => key.startsWith('PAYHERO')),
    totalEnvVars: Object.keys(process.env).length,
  });
}