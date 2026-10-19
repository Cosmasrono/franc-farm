import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAppSession } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';
import { BRAND } from '@/app/lib/brand';
import { OPEN_STATUSES, PRESCRIPTION_STATUSES, STATUS_LABELS, handoverLabel, prescriptionReference } from '@/app/lib/prescriptions';
import { pharmacistReplyMessage, toWhatsAppNumber, whatsappLink } from '@/app/lib/whatsapp';

const ERRORS: Record<string, string> = {
  missing_request: 'That prescription could not be identified. Please try again.',
  unknown_status: 'That status is not recognised.',
  update_failed: 'The status could not be updated. Please try again.',
};

// What each button does, in the order a prescription moves through.
const ACTIONS: Record<string, string> = {
  reviewing: 'Start review',
  ready: 'Ready to dispense',
  declined: 'Decline',
  pending: 'Reopen',
};

export default async function PrescriptionsPage({ searchParams }: { searchParams: Promise<{ error?: string; show?: string }> }) {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) redirect('/login');
  const { error, show } = await searchParams;
  const all = show === 'all';
  const requests = await prisma.prescriptionRequest.findMany({
    where: all ? {} : { status: { in: OPEN_STATUSES } },
    orderBy: { createdAt: all ? 'desc' : 'asc' },
    take: 200,
  });

  return <main className="shop-container shop-section">
    <div className="section-heading">
      <div>
        <p className="eyebrow">{BRAND.name.toUpperCase()} · ADMINISTRATION</p>
        <h1 className="font-serif text-4xl">Prescriptions.</h1>
      </div>
      <div className="flex gap-3">
        <Link href={all ? '/admin/prescriptions' : '/admin/prescriptions?show=all'} className="shop-button secondary">{all ? 'Show open only' : 'Show all'}</Link>
        <Link href="/admin/dashboard" className="shop-button secondary">Back to dashboard</Link>
      </div>
    </div>
    <p className="text-sm text-stone-500 mb-8">{all ? `${requests.length} most recent prescriptions.` : `${requests.length} waiting, oldest first.`} Mark one ready when the pharmacist has checked it; it is marked dispensed automatically when it is paid for at the till.</p>

    {error && <div className="notice" role="alert">{ERRORS[error] || 'Something went wrong. Please try again.'}</div>}

    {!requests.length ? <div className="empty-state">
      <h2>{all ? 'No prescriptions yet.' : 'Nothing waiting.'}</h2>
      <p>Prescriptions sent from the website or WhatsApp will appear here.</p>
    </div> : <div className="grid gap-5">
      {requests.map(rx => {
        const reference = prescriptionReference(rx.id);
        const replyLink = whatsappLink(pharmacistReplyMessage(rx.patientName, reference), toWhatsAppNumber(rx.phone));
        return <article key={rx.id} className="checkout-panel">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <h2 className="font-serif text-2xl">{rx.patientName}</h2>
              <p className="text-sm text-stone-600 mt-1">{rx.phone} · {reference}</p>
              <p className="text-xs text-stone-500 mt-1">Received {rx.createdAt.toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })} · {rx.source === 'whatsapp' ? 'WhatsApp' : 'Website'}{rx.reviewedBy ? ` · Last updated by ${rx.reviewedBy}` : ''}</p>
            </div>
            <span className="enquiry-status" data-status={rx.status}>{STATUS_LABELS[rx.status] || rx.status}</span>
          </div>

          <dl className="enquiry-details mt-6">
            <div><dt>Collection or delivery</dt><dd>{handoverLabel(rx)}</dd></div>
            <div><dt>Medicines asked for</dt><dd>{rx.medicines || 'Not specified — read the prescription'}</dd></div>
            {rx.notes && <div><dt>Customer&apos;s note</dt><dd>{rx.notes}</dd></div>}
            {rx.pharmacistNote && <div><dt>Pharmacist&apos;s note</dt><dd>{rx.pharmacistNote}</dd></div>}
            <div><dt>Prescription</dt><dd>{rx.file
              ? <a className="text-link mt-0!" href={`/api/prescriptions/${rx.id}/file`} target="_blank" rel="noopener noreferrer">Open the prescription ({rx.fileType === 'application/pdf' ? 'PDF' : 'image'})</a>
              : rx.source === 'whatsapp' ? 'Sent on WhatsApp — check the chat' : 'Not attached — check the original at handover'}</dd></div>
          </dl>

          <form action="/api/prescriptions/status" method="POST" className="mt-6 grid gap-3">
            <input type="hidden" name="id" value={rx.id} />
            <label className="text-xs text-stone-500">Note for the record (optional, shown to a signed-in customer)
              <input name="pharmacistNote" maxLength={500} className="block w-full border border-stone-300 rounded p-2.5 mt-1 text-sm" placeholder="e.g. Generic substituted with consent; KSh 1,200 quoted by phone" />
            </label>
            <div className="enquiry-actions mt-0! pt-3!">
              <a className="whatsapp-button" href={replyLink} target="_blank" rel="noopener noreferrer">Message on WhatsApp</a>
              {PRESCRIPTION_STATUSES.filter(status => status !== rx.status && ACTIONS[status]).map(status =>
                <button key={status} name="status" value={status} className="text-link">{ACTIONS[status]}</button>)}
            </div>
          </form>
        </article>;
      })}
    </div>}
  </main>;
}
