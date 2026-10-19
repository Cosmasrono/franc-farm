import { NextResponse } from 'next/server';
import { getAppSession } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';

export async function GET() {
  try {
    const session = await getAppSession();

    if (!session?.user?.id) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}