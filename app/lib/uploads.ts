import { mkdir, readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
export class ImageUploadError extends Error {}

const MAX_BYTES = 5 * 1024 * 1024;

/** Checks the file's real content, not just its name, and returns the extension to store it under. */
async function sniff(file: File, allowPdf: boolean) {
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_BYTES) throw new ImageUploadError('Choose a file smaller than 5 MB.');
  const bytes = Buffer.from(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  const pdf = bytes.toString('ascii', 0, 5) === '%PDF-';
  const extension = jpeg && file.type === 'image/jpeg' ? 'jpg' : png && file.type === 'image/png' ? 'png' : webp && file.type === 'image/webp' ? 'webp' : allowPdf && pdf && file.type === 'application/pdf' ? 'pdf' : null;
  if (!extension) throw new ImageUploadError(allowPdf ? 'Choose a JPEG, PNG, WebP or PDF file.' : 'Choose a JPEG, PNG, or WebP image.');
  return { bytes, extension };
}

/** Product photos: public, served straight from /uploads. */
export async function saveImage(file: File, folder: 'products') {
  const { bytes, extension } = await sniff(file, false);
  const directory = path.join(process.cwd(), 'public', 'uploads', folder);
  await mkdir(directory, { recursive: true });
  const filename = randomUUID() + '.' + extension;
  await writeFile(path.join(directory, filename), bytes);
  return '/uploads/' + folder + '/' + filename;
}

// Prescriptions are medical records, so they are kept outside /public and only
// handed out by /api/prescriptions/[id]/file after checking who is asking.
const PRIVATE_DIR = path.join(process.cwd(), 'storage', 'prescriptions');
export const FILE_TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };

export async function savePrescriptionFile(file: File) {
  const { bytes, extension } = await sniff(file, true);
  await mkdir(PRIVATE_DIR, { recursive: true });
  const filename = randomUUID() + '.' + extension;
  await writeFile(path.join(PRIVATE_DIR, filename), bytes);
  return { file: filename, fileType: FILE_TYPES[extension] };
}

export async function readPrescriptionFile(filename: string) {
  // Stored names are always <uuid>.<ext>; anything else is refused before touching the disk.
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i.test(filename)) return null;
  return readFile(path.join(PRIVATE_DIR, filename)).catch(() => null);
}
