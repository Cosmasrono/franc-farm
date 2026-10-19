import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getAppSession } from '@/app/lib/auth-options';
import { isObjectId } from '@/app/lib/products';
import { readPrescriptionFile } from '@/app/lib/uploads';

const STAFF = ['CASHIER', 'ADMIN', 'SUPER_ADMIN'];

/** The prescription file, for pharmacy staff or the customer who sent it. Never cached. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const { id } = await params;
  if (!isObjectId(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const request = await prisma.prescriptionRequest.findUnique({ where: { id }, select: { userId: true, file: true, fileType: true } });
  const allowed = request && (STAFF.includes(session.user.role) || (request.userId && request.userId === session.user.id));
  if (!request || !allowed || !request.file) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const bytes = await readPrescriptionFile(request.file);
  if (!bytes) return NextResponse.json({ error: 'The file is missing.' }, { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': request.fileType || 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
