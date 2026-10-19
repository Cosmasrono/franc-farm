// app/api/admin/promotions/toggle/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAppSession } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getAppSession();
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const id = formData.get('id') as string;
    const active = formData.get('active') === 'true';

    await prisma.promotion.update({
      where: { id },
      data: { active },
    });

    return NextResponse.redirect(new URL('/admin/promotions', req.url));
  } catch (error) {
    console.error('Error toggling promotion:', error);
    return NextResponse.json(
      { error: 'Failed to toggle promotion' },
      { status: 500 }
    );
  }
}