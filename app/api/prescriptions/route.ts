import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getAppSession } from '@/app/lib/auth-options';
import { ImageUploadError, savePrescriptionFile } from '@/app/lib/uploads';
import { STATUS_LABELS, prescriptionReference } from '@/app/lib/prescriptions';

const text = (value: FormDataEntryValue | null, limit: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null;

/** A customer sends in a prescription (multipart, optionally with a photo or PDF of it). */
export async function POST(request: Request) {
  try {
    const session = await getAppSession();
    const formData = await request.formData();
    const patientName = text(formData.get('patientName'), 90);
    const phone = text(formData.get('phone'), 30);
    if (!patientName || !phone) return NextResponse.json({ error: 'Please share the patient’s name and a phone number.' }, { status: 400 });
    const deliveryMethod = text(formData.get('deliveryMethod'), 20) === 'delivery' ? 'delivery' : 'pickup';
    const deliveryAddress = deliveryMethod === 'delivery' ? text(formData.get('deliveryAddress'), 500) : null;
    if (deliveryMethod === 'delivery' && !deliveryAddress) {
      return NextResponse.json({ error: 'Please add the delivery address, or choose to collect at the pharmacy.' }, { status: 400 });
    }
    const source = text(formData.get('source'), 20) === 'whatsapp' ? 'whatsapp' : 'form';

    // The file is optional: without one, staff check the original prescription at handover.
    const upload = formData.get('file');
    const hasFile = upload instanceof File && upload.size > 0;
    const stored = hasFile ? await savePrescriptionFile(upload) : null;

    const created = await prisma.prescriptionRequest.create({
      data: {
        userId: session?.user?.id ?? null,
        patientName,
        phone,
        medicines: text(formData.get('medicines'), 500),
        notes: text(formData.get('notes'), 1000),
        file: stored?.file ?? null,
        fileType: stored?.fileType ?? null,
        deliveryMethod,
        deliveryAddress,
        source,
      },
    });
    return NextResponse.json({ success: true, reference: prescriptionReference(created.id) }, { status: 201 });
  } catch (error) {
    if (error instanceof ImageUploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error saving prescription:', error);
    return NextResponse.json({ error: 'We could not send your prescription. Please try again.' }, { status: 500 });
  }
}

/** The signed-in customer's own prescriptions, newest first. */
export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const requests = await prisma.prescriptionRequest.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  return NextResponse.json(requests.map((r) => ({
    id: r.id,
    reference: prescriptionReference(r.id),
    status: r.status,
    statusLabel: STATUS_LABELS[r.status] || r.status,
    medicines: r.medicines,
    pharmacistNote: r.pharmacistNote,
    hasFile: !!r.file,
    createdAt: r.createdAt,
  })), { headers: { 'Cache-Control': 'no-store' } });
}
