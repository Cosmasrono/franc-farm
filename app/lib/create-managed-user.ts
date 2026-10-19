import { prisma } from './prisma';
import { duplicateAccountMessage } from './user-access';
import type { UserRole } from '@prisma/client';

export class DuplicateAccountError extends Error {}

export function archivedAccountEmail(id: string) {
  return `deleted-${id}@accounts.invalid`;
}

/** Release legacy deleted emails and create a separate account without transferring history. */
export async function createManagedUser(data: { name: string; email: string; password: string; role: UserRole }) {
    const existing = await prisma.user.findFirst({ where: { email: { equals: data.email, mode: 'insensitive' } } });
    if (existing && !existing.deletedAt) throw new DuplicateAccountError(duplicateAccountMessage(existing));
    if (existing) {
      // Commit the released unique email before inserting its replacement in MongoDB.
      await prisma.user.update({
        where: { id: existing.id, deletedAt: existing.deletedAt },
        data: { email: archivedAccountEmail(existing.id) },
      });
    }
    return prisma.user.create({
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
}
