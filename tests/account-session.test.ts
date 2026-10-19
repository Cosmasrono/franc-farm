import assert from 'node:assert/strict';
import test from 'node:test';
import { authOptions } from '../app/lib/auth-options';
import { prisma } from '../app/lib/prisma';

const jwt = authOptions.callbacks!.jwt!;

test('an existing token loses access immediately after disable, delete or removal', async (t) => {
  for (const account of [
    { role: 'ADMIN', isActive: false, deletedAt: null, sessionVersion: 1 },
    { role: 'ADMIN', isActive: true, deletedAt: new Date(), sessionVersion: 0 },
    null,
  ]) {
    const original = prisma.user.findUnique;
    prisma.user.findUnique = (async () => account) as unknown as typeof original;
    t.after(() => { prisma.user.findUnique = original; });
    const token = await jwt({ token: { id: '507f1f77bcf86cd799439011', role: 'ADMIN', sessionVersion: 0 } } as unknown as Parameters<typeof jwt>[0]);
    assert.equal(token.id, '');
    assert.equal(token.role, '');
    prisma.user.findUnique = original;
  }
});

test('enabled accounts use their current role, but old sessions remain invalid after re-enabling', async (t) => {
  const original = prisma.user.findUnique;
  prisma.user.findUnique = (async () => ({ role: 'USER', isActive: true, deletedAt: null, sessionVersion: 2 })) as unknown as typeof original;
  t.after(() => { prisma.user.findUnique = original; });
  const oldToken = await jwt({ token: { id: '507f1f77bcf86cd799439011', role: 'ADMIN', sessionVersion: 0 } } as unknown as Parameters<typeof jwt>[0]);
  assert.equal(oldToken.id, '');
  const newToken = await jwt({ token: { id: '507f1f77bcf86cd799439011', role: 'ADMIN', sessionVersion: 2 } } as unknown as Parameters<typeof jwt>[0]);
  assert.equal(newToken.role, 'USER');
  assert.equal(newToken.id, '507f1f77bcf86cd799439011');
});
