import assert from 'node:assert/strict';
import test from 'node:test';
import { accountCanSignIn, accountSessionIsValid, duplicateAccountMessage, userManagementError } from '../app/lib/user-access';

test('duplicate email messages distinguish active and disabled accounts', () => {
  assert.match(duplicateAccountMessage({}), /manage its role/);
  assert.match(duplicateAccountMessage({ isActive: false }), /enable the existing account/);
});

test('legacy and enabled accounts can sign in; disabled, deleted and missing accounts cannot', () => {
  assert.equal(accountCanSignIn({}), true);
  assert.equal(accountCanSignIn({ isActive: true }), true);
  assert.equal(accountCanSignIn({ isActive: false }), false);
  assert.equal(accountCanSignIn({ isActive: true, deletedAt: new Date() }), false);
  assert.equal(accountCanSignIn(null), false);
});

test('disable and re-enable never revive a previous session', () => {
  assert.equal(accountSessionIsValid({ isActive: true, sessionVersion: 0 }, 0), true);
  assert.equal(accountSessionIsValid({ isActive: false, sessionVersion: 1 }, 0), false);
  assert.equal(accountSessionIsValid({ isActive: true, sessionVersion: 2 }, 0), false);
  assert.equal(accountSessionIsValid({ isActive: true, sessionVersion: 2 }, 2), true);
  assert.equal(accountSessionIsValid({ deletedAt: new Date(), sessionVersion: 2 }, 2), false);
  assert.equal(accountSessionIsValid({}, undefined), true);
});

test('customers and cashiers cannot manage users', () => {
  for (const role of ['USER', 'CASHIER']) {
    assert.ok(userManagementError({ id: 'actor', role }, { id: 'other', role: 'USER' }));
  }
});

test('administrators cannot disable, delete or change their own access', () => {
  for (const role of ['ADMIN', 'SUPER_ADMIN']) {
    assert.match(userManagementError({ id: 'self', role }, { id: 'self', role })!, /own account/);
  }
});

test('super admin accounts and promotions are protected', () => {
  const actor = { id: 'admin', role: 'ADMIN' };
  assert.ok(userManagementError(actor, { id: 'owner', role: 'SUPER_ADMIN' }));
  assert.ok(userManagementError(actor, { id: 'other', role: 'USER' }, 'SUPER_ADMIN'));
  assert.equal(userManagementError(actor, { id: 'staff', role: 'CASHIER' }), null);
  assert.equal(userManagementError({ ...actor, role: 'SUPER_ADMIN' }, { id: 'owner', role: 'SUPER_ADMIN' }), null);
});
