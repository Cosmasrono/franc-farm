import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { hashPassword } from '@/app/lib/auth';
import { signupRole } from '@/app/lib/admin-accounts';
import { adminAccounts, countAdmins } from '@/app/lib/admin-count';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 150) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Please fill in your name, email and password.' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    // Check if user exists (any capitalisation of the same address)
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // The developer becomes super admin; the first other sign-up claims the one admin slot.
    let user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: signupRole(email, await countAdmins()) },
    });
    if (user.role === 'ADMIN') {
      // Two sign-ups at the same moment could both see an empty slot: only the earliest keeps it.
      const [first] = await prisma.user.findMany({ where: adminAccounts, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1, select: { id: true } });
      if (first?.id !== user.id) user = await prisma.user.update({ where: { id: user.id }, data: { role: 'USER' } });
    }

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}