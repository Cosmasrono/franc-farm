import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveRole, roleChangeError, signupRole } from '../app/lib/admin-accounts';

const developer = 'ccosmas001@gmail.com';

test('the developer signs up as super admin, in any capitalisation, even when the admin slot is taken', () => {
  assert.equal(signupRole(developer, 0), 'SUPER_ADMIN');
  assert.equal(signupRole('CCosmas001@Gmail.com', 1), 'SUPER_ADMIN');
  assert.equal(effectiveRole(developer, 'USER'), 'SUPER_ADMIN');
});

test('the first other sign-up becomes the one admin; everyone after is a customer', () => {
  assert.equal(signupRole('owner@example.com', 0), 'ADMIN');
  assert.equal(signupRole('shopper@example.com', 1), 'USER');
});

test('only the developer can be super admin; admins, cashiers and customers keep their roles', () => {
  assert.equal(effectiveRole('someone@example.com', 'SUPER_ADMIN'), 'USER');
  assert.equal(effectiveRole('owner@example.com', 'ADMIN'), 'ADMIN');
  assert.equal(effectiveRole('till@example.com', 'CASHIER'), 'CASHIER');
  assert.equal(effectiveRole('shopper@example.com', 'USER'), 'USER');
});

test('staff management allows one admin, appointed by the developer, and never a second super admin', () => {
  assert.equal(roleChangeError('SUPER_ADMIN', 'owner@example.com', 'ADMIN', 0), null);
  assert.match(roleChangeError('SUPER_ADMIN', 'second@example.com', 'ADMIN', 1)!, /already an admin/);
  assert.match(roleChangeError('ADMIN', 'second@example.com', 'ADMIN', 0)!, /developer/);
  assert.match(roleChangeError('SUPER_ADMIN', 'someone@example.com', 'SUPER_ADMIN', 0)!, /Only the developer/);
  assert.match(roleChangeError('SUPER_ADMIN', developer, 'CASHIER', 0)!, /always the super admin/);
  assert.equal(roleChangeError('ADMIN', 'till@example.com', 'CASHIER', 1), null);
  assert.equal(roleChangeError('ADMIN', 'shopper@example.com', 'USER', 1), null);
});
