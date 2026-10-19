import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../app/lib/prisma';
import { archivedAccountEmail, createManagedUser, DuplicateAccountError } from '../app/lib/create-managed-user';

test('creating an account with a deleted email releases it without reusing the old identity', async (t) => {
  const calls: string[] = [];
  const original = { findFirst: prisma.user.findFirst, update: prisma.user.update, create: prisma.user.create };
  const tx = { user: {
    findFirst: async () => ({ id: 'old-id', email: 'staff@example.com', deletedAt: new Date(), isActive: false }),
    update: async (args: { data: { email: string } }) => { assert.equal(args.data.email, archivedAccountEmail('old-id')); calls.push('archive'); },
    create: async (args: { data: { email: string } }) => { calls.push('create'); return { id: 'new-id', ...args.data }; },
  } };
  Object.assign(prisma.user, tx.user);
  t.after(() => { Object.assign(prisma.user, original); });
  const user = await createManagedUser({ name: 'Staff', email: 'staff@example.com', password: 'hashed', role: 'CASHIER' });
  assert.equal(user.id, 'new-id');
  assert.equal(user.email, 'staff@example.com');
  assert.deepEqual(calls, ['archive', 'create']);
});

test('active and disabled accounts still prevent duplicate creation', async (t) => {
  const original = { findFirst: prisma.user.findFirst, update: prisma.user.update, create: prisma.user.create };
  t.after(() => { Object.assign(prisma.user, original); });
  for (const isActive of [true, false]) {
    const tx = { user: { findFirst: async () => ({ deletedAt: null, isActive }) } };
    Object.assign(prisma.user, tx.user);
    await assert.rejects(createManagedUser({ name: 'Staff', email: 'staff@example.com', password: 'hashed', role: 'CASHIER' }), DuplicateAccountError);
  }
});
