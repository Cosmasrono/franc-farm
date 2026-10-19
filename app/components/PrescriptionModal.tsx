'use client';

import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { X, Upload, ClipboardPlus, FileText } from 'lucide-react';
import { useSession } from 'next-auth/react';

const send = async (form: HTMLFormElement) => {
  const formData = new FormData(form);
  const res = await fetch('/api/prescriptions', { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data.reference as string;
};

export default function PrescriptionModal({ isOpen, onClose, medicine = '', onSent }: { isOpen: boolean; onClose: () => void; medicine?: string; onSent?: () => void }) {
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [fileLabel, setFileLabel] = useState<{ name: string; preview: string | null } | null>(null);
  const [handover, setHandover] = useState<'pickup' | 'delivery'>('pickup');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    const form = e.currentTarget;
    try {
      setReference(await send(form));
      form.reset();
      setFileLabel(null);
      onSent?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send your prescription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setFileLabel(null); return; }
    if (!file.type.startsWith('image/')) { setFileLabel({ name: file.name, preview: null }); return; }
    const reader = new FileReader();
    reader.onloadend = () => setFileLabel({ name: file.name, preview: reader.result as string });
    reader.readAsDataURL(file);
  };

  const field = 'w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent';
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl">
          <div className="flex justify-between items-center p-6 border-b">
            <div className="flex items-center gap-3">
              <ClipboardPlus className="w-8 h-8 text-[#0e6b5c]" />
              <DialogTitle className="text-2xl font-bold">Send a prescription</DialogTitle>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-2.5 -m-2.5 text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
          </div>

          {reference ? (
            <div className="p-8 text-center" role="status">
              <p className="text-lg font-semibold text-emerald-800">Thank you — your prescription is with our pharmacist.</p>
              <p className="text-sm text-stone-600 mt-3 leading-7">Your reference is <strong>{reference}</strong>. We will call you to confirm availability and the cost before anything is prepared.{session?.user ? ' You can follow it under My orders.' : ' Sign in next time to follow your prescriptions under My orders.'}</p>
              <button className="shop-button mt-6" onClick={onClose}>Done</button>
            </div>
          ) : <>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && <div className="bg-red-100 text-red-800 p-4 rounded-lg text-center" role="alert">{error}</div>}

            <div className="grid md:grid-cols-2 gap-6">
              <label className="block text-sm font-medium">Patient&apos;s name *
                <input name="patientName" type="text" required maxLength={90} autoComplete="name" defaultValue={session?.user?.name || ''} className={`mt-2 ${field}`} />
              </label>
              <label className="block text-sm font-medium">Phone number *
                <input name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="0712 345 678" className={`mt-2 ${field}`} />
              </label>
            </div>

            <div>
              <p className="block text-sm font-medium mb-2">Prescription (photo or PDF) <span className="font-normal text-stone-400">(optional)</span></p>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 px-6 py-3 bg-[#0e6b5c] text-white rounded-lg cursor-pointer hover:bg-[#0a5246] transition focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-teal-600">
                  <Upload className="w-5 h-5" />
                  Choose file
                  <input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileChange} className="sr-only" />
                </label>
                {fileLabel?.preview
                  // eslint-disable-next-line @next/next/no-img-element -- a local preview of a file the customer just chose, never fetched over the network
                  ? <img src={fileLabel.preview} alt="Preview of your prescription" className="h-20 w-20 object-cover rounded-lg border" />
                  : fileLabel && <span className="flex items-center gap-2 text-sm text-stone-600"><FileText size={18} /> {fileLabel.name}</span>}
              </div>
              <p className="text-xs text-gray-500 mt-2">JPEG, PNG, WebP or PDF, up to 5 MB. Stored privately: only our pharmacy team can open it. If you don&apos;t attach it now, have the original prescription ready when you collect or receive your order.</p>
            </div>

            <label className="block text-sm font-medium">Medicines you need <span className="font-normal text-stone-400">(optional)</span>
              <input name="medicines" type="text" maxLength={500} defaultValue={medicine} placeholder="e.g. Amoxicillin 500mg" className={`mt-2 ${field}`} />
            </label>

            <fieldset>
              <legend className="block text-sm font-medium mb-2">Collect or deliver? *</legend>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['pickup', 'Collect at the pharmacy', 'Pick up and pay at the counter.'],
                  ['delivery', 'Delivery', 'KSh 350, or free on orders of KSh 5,000 and above.'],
                ] as const).map(([value, label, hint]) => (
                  <label key={value} className={`p-3 border rounded-lg cursor-pointer transition ${handover === value ? 'border-[#0e6b5c] bg-[#f0f8f5]' : 'border-gray-300 hover:bg-gray-50'}`}>
                    <input type="radio" name="deliveryMethod" value={value} checked={handover === value} onChange={() => setHandover(value)} className="mr-2 accent-[#0e6b5c]" />
                    <span className="font-semibold text-sm">{label}</span>
                    <span className="block text-xs text-gray-500 mt-1">{hint}</span>
                  </label>
                ))}
              </div>
              {handover === 'delivery' && (
                <label className="block text-sm font-medium mt-4">Delivery address *
                  <textarea name="deliveryAddress" required rows={2} maxLength={500} placeholder="Area, street, building, apartment/house number" className={`mt-2 ${field}`} />
                </label>
              )}
            </fieldset>

            <label className="block text-sm font-medium">A note for the pharmacist <span className="font-normal text-stone-400">(optional)</span>
              <textarea name="notes" rows={2} maxLength={1000} placeholder="Allergies, other medicines you take, or when you need it" className={`mt-2 ${field}`} />
            </label>

            <div className="flex gap-4 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 shop-button">{isSubmitting ? 'Sending…' : 'Send to pharmacist'}</button>
            </div>
          </form>
          </>}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
