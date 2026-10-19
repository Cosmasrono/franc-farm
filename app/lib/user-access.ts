export interface AccountAccess {
  isActive?: boolean;
  deletedAt?: Date | null;
  sessionVersion?: number;
}

export function duplicateAccountMessage(account: AccountAccess) {
  if (account.isActive === false) return 'This email belongs to a disabled account. Close this form and enable the existing account in the directory.';
  return 'An account with this email already exists. Close this form to manage its role in the directory, or use a different email address.';
}

export function accountCanSignIn(account: AccountAccess | null) {
  return !!account && account.isActive !== false && !account.deletedAt;
}

export function accountSessionIsValid(account: AccountAccess | null, version: unknown) {
  return accountCanSignIn(account) && (account?.sessionVersion ?? 0) === (version ?? 0);
}

export function userManagementError(actor: { id: string; role: string }, target: { id: string; role: string }, nextRole?: string) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) return 'Administrator access is required.';
  if (actor.id === target.id) return 'You cannot change access to your own account.';
  if ((target.role === 'SUPER_ADMIN' || nextRole === 'SUPER_ADMIN') && actor.role !== 'SUPER_ADMIN') {
    return 'Only a super admin can manage a super admin account.';
  }
  return null;
}
