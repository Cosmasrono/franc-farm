import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAppSession } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';
import { PRESCRIPTION_STATUSES, type PrescriptionStatus } from '@/app/lib/prescriptions';
import { isObjectId } from '@/app/lib/products';

/** Moves a prescription along (form post from the admin prescriptions page). */
export async function POST(request: NextRequest) {
  const back = (query = '') => NextResponse.redirect(new URL('/admin/prescriptions' + query, request.url), 303);
  try {
    const session = await getAppSession();
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url), 303);
    }
    const formData = await request.formData();
    const id = formData.get('id');
    const status = formData.get('status');
    const note = formData.get('pharmacistNote');
    if (!isObjectId(id)) return back('?error=missing_request');
    if (typeof status !== 'string' || !PRESCRIPTION_STATUSES.includes(status as PrescriptionStatus)) return back('?error=unknown_status');

    await prisma.prescriptionRequest.update({
      where: { id },
      data: {
        status,
        reviewedBy: session.user.name || session.user.email || 'Pharmacist',
        reviewedAt: new Date(),
        ...(typeof note === 'string' && note.trim() && { pharmacistNote: note.trim().slice(0, 500) }),
      },
    });
    revalidatePath('/admin/prescriptions');
    revalidatePath('/admin/dashboard');
    return back();
  } catch (error) {
    console.error('Error updating prescription status:', error);
    return back('?error=update_failed');
  }
}
