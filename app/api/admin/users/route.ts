import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getAppSession } from '@/app/lib/auth-options';
import bcrypt from 'bcryptjs';
import { userManagementError } from '@/app/lib/user-access';
import { effectiveRole, isDeveloperEmail, roleChangeError } from '@/app/lib/admin-accounts';
import { countAdmins } from '@/app/lib/admin-count';
import { archivedAccountEmail, createManagedUser, DuplicateAccountError } from '@/app/lib/create-managed-user';
import { sendAccountEmail } from '@/app/lib/account-email';
import { Prisma, type UserRole } from '@prisma/client';

// MongoDB accounts created before this field was added have no deletedAt key.
const visibleUsers = { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] };
const userFields = { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } as const;

export async function GET() {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      where: visibleUsers,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Show the role each account really has under the admin list.
    return NextResponse.json({ users: users.map((u) => ({ ...u, role: effectiveRole(u.email, u.role) })) });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 150) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const role = body.role;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      return NextResponse.json({ error: 'Enter a valid email and a password of at least 8 characters.' }, { status: 400 });
    }

    // The developer's email is always super admin; only one other admin may exist.
    const assignedRole = isDeveloperEmail(email) ? 'SUPER_ADMIN' : (['USER', 'CASHIER', 'ADMIN'].includes(role) ? role : 'CASHIER');
    const notAllowed = roleChangeError(session.user.role, email, assignedRole, assignedRole === 'ADMIN' ? await countAdmins() : 0);
    if (notAllowed) return NextResponse.json({ error: notAllowed }, { status: 403 });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await createManagedUser({
        name,
        email,
        password: hashedPassword,
        role: assignedRole as UserRole,
    });

    let emailStatus: 'sent' | 'failed' = 'sent';
    try {
      await sendAccountEmail(newUser, password);
    } catch {
      // Never log the credentials, SMTP configuration or email body.
      emailStatus = 'failed';
    }
    return NextResponse.json({ success: true, user: newUser, emailStatus,
      message: emailStatus === 'sent'
        ? `Account created. Login details sent to ${newUser.email}.`
        : 'Account created, but the login email could not be sent. Do not create the account again. Check the email settings or share the login details directly.',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateAccountError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'An account with this email already exists. Refresh the directory to manage it.' }, { status: 409 });
    console.error('Error creating staff user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const { userId, role, isActive } = body;

    if ((role === undefined) === (isActive === undefined)) {
      return NextResponse.json({ error: 'Choose one change: role or enabled status.' }, { status: 400 });
    }

    const validRoles = ['USER', 'CASHIER', 'ADMIN', 'SUPER_ADMIN'];
    if (typeof userId !== 'string' || !/^[a-f\d]{24}$/i.test(userId) || (role !== undefined && !validRoles.includes(role)) || (isActive !== undefined && typeof isActive !== 'boolean')) {
      return NextResponse.json({ error: 'Invalid user, role or enabled status.' }, { status: 400 });
    }
    const target = await prisma.user.findFirst({ where: { id: userId, ...visibleUsers }, select: { id: true, email: true, role: true, sessionVersion: true } });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const denied = userManagementError(session.user, target, role)
      ?? (role !== undefined ? roleChangeError(session.user.role, target.email, role, role === 'ADMIN' ? await countAdmins(target.id) : 0) : null);
    if (denied) {
      return NextResponse.json({ error: denied }, { status: 403 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId, role: target.role, ...visibleUsers },
      data: role !== undefined ? { role } : { isActive, sessionVersion: target.sessionVersion + 1 },
      select: userFields,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAppSession();
  if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const userId = body?.userId;
    if (typeof userId !== 'string' || !/^[a-f\d]{24}$/i.test(userId)) {
      return NextResponse.json({ error: 'Invalid user ID.' }, { status: 400 });
    }
    const target = await prisma.user.findFirst({ where: { id: userId, ...visibleUsers }, select: { id: true, role: true, sessionVersion: true } });
    if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    const denied = userManagementError(session.user, target);
    if (denied) return NextResponse.json({ error: denied }, { status: 403 });

    // Retain the record so historical payments, prescriptions and cashier sales stay linked.
    await prisma.user.update({
      where: { id: userId, role: target.role, ...visibleUsers },
      data: { isActive: false, deletedAt: new Date(), sessionVersion: target.sessionVersion + 1, email: archivedAccountEmail(userId) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user. Please refresh and try again.' }, { status: 500 });
  }
}
