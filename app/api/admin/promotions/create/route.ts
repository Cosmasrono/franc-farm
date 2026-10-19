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
    const message = formData.get('message') as string;
    const dayOfWeek = parseInt(formData.get('dayOfWeek') as string);
    const active = formData.get('active') === 'on';

    const startDateStr = formData.get('startDate') as string;
    const endDateStr = formData.get('endDate') as string;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    await prisma.promotion.create({
      data: {
        message,
        daysOfWeek: [dayOfWeek], // Corrected from dayOfWeek to daysOfWeek as an array
        active,
        startDate: startDateStr ? new Date(startDateStr) : null,
        endDate: endDateStr ? new Date(endDateStr) : null,
      },
    });

    return NextResponse.redirect(new URL('/admin/promotions', req.url));
  } catch (error) {
    console.error('Error creating promotion:', error);
    return NextResponse.json(
      { error: 'Failed to create promotion' },
      { status: 500 }
    );
  }
}