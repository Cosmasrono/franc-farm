import type { UserRole } from '@prisma/client';

/**
 * Who can run the pharmacy:
 * - the developer, by email, is always the super admin;
 * - exactly one admin: the first person to sign up while there is none (or one the developer appoints);
 * - everyone else is a customer (USER), or a CASHIER when an admin makes them one.
 */
export const DEVELOPER_EMAIL = 'ccosmas001@gmail.com';
export const MAX_ADMINS = 1; // besides the developer

export const isDeveloperEmail = (email: string | null | undefined) => !!email && email.trim().toLowerCase() === DEVELOPER_EMAIL;

/** Role for a new public sign-up, given how many admin accounts already exist. */
export function signupRole(email: string, adminCount: number): UserRole {
  if (isDeveloperEmail(email)) return 'SUPER_ADMIN';
  return adminCount < MAX_ADMINS ? 'ADMIN' : 'USER';
}

/** The role an account actually gets: only the developer can be super admin. */
export function effectiveRole(email: string | null | undefined, storedRole: string): UserRole {
  if (isDeveloperEmail(email)) return 'SUPER_ADMIN';
  return storedRole === 'SUPER_ADMIN' ? 'USER' : (storedRole as UserRole);
}

/** Why a staff-management change to this role is not allowed, or null. `otherAdmins` excludes the account being changed. */
export function roleChangeError(actorRole: string, email: string | null | undefined, nextRole: string, otherAdmins: number) {
  if (isDeveloperEmail(email)) return nextRole === 'SUPER_ADMIN' ? null : "The developer's account is always the super admin.";
  if (nextRole === 'SUPER_ADMIN') return 'Only the developer can be the super admin.';
  if (nextRole === 'ADMIN') {
    if (actorRole !== 'SUPER_ADMIN') return 'Only the developer can appoint the admin.';
    if (otherAdmins >= MAX_ADMINS) return 'There is already an admin. Change their role first; only one admin is allowed.';
  }
  return null;
}
