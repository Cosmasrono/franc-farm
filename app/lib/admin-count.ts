import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { DEVELOPER_EMAIL } from './admin-accounts';

/** Accounts holding the admin slot (not the developer; deleted accounts free the slot). */
export const adminAccounts: Prisma.UserWhereInput = {
  role: 'ADMIN',
  NOT: { email: DEVELOPER_EMAIL },
  OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
};

export const countAdmins = (exceptId?: string) =>
  prisma.user.count({ where: exceptId ? { AND: [adminAccounts, { NOT: { id: exceptId } }] } : adminAccounts });
