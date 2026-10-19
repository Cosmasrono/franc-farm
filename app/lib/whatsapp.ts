import { BRAND, WHATSAPP_INTERNATIONAL, WHATSAPP_NUMBER } from './brand';
import { prescriptionSummary, type PrescriptionDetails } from './prescriptions';

export { WHATSAPP_NUMBER };

export function whatsappLink(message?: string, number: string = WHATSAPP_INTERNATIONAL) {
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

// Kenyan numbers are usually written 07…, +2547…, or 2547…; wa.me accepts only the last form.
export function toWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.length === 9) return '254' + digits;
  return digits;
}

export function prescriptionMessage(details: PrescriptionDetails = {}, reference?: string) {
  const summary = prescriptionSummary(details, reference);
  return [
    `*Prescription — ${BRAND.name}*`,
    'Hello, I would like to fill a prescription. I will send a clear photo of it in this chat.',
    ...(summary.length ? ['', ...summary] : []),
    '',
    'Kindly confirm availability and the cost. Thank you.',
  ].join('\n');
}

export function generalEnquiryMessage(product?: string) {
  return product
    ? `Hello ${BRAND.name}, I would like to ask about ${product}.`
    : `Hello ${BRAND.name}, I have a question.`;
}

export function pharmacistReplyMessage(name: string, reference: string) {
  return `Hello ${name.split(' ')[0] || name}, this is the pharmacist at ${BRAND.name} about your prescription (reference ${reference}). I would like to confirm a few details before we prepare it.`;
}
