import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getServerSession as nextAuthGetServerSession } from 'next-auth/next';
import bcrypt from 'bcryptjs';
import { prisma } from '@/app/lib/prisma';
import { accountCanSignIn, accountSessionIsValid } from '@/app/lib/user-access';
import { effectiveRole } from '@/app/lib/admin-accounts';

// Typed representation of our extended session user
export interface AppUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: string;
}

export interface AppSession {
  user: AppUser;
  expires: string;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt' as const,
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'your-email@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Emails are matched case-insensitively (older accounts may be stored in mixed case).
        const user = await prisma.user.findFirst({
          where: { email: { equals: credentials.email.trim(), mode: 'insensitive' } },
        });

        if (!user || !accountCanSignIn(user)) return null;

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: effectiveRole(user.email, user.role),
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as AppUser).role;
        token.id = user.id;
        token.sessionVersion = (user as AppUser & { sessionVersion: number }).sessionVersion;
        return token;
      }
      // Check every authenticated request. Re-enabling an account does not revive old sessions.
      if (token.id) {
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { email: true, role: true, isActive: true, deletedAt: true, sessionVersion: true },
        });
        if (!accountSessionIsValid(current, token.sessionVersion)) {
          token.id = '';
          token.role = '';
        } else {
          // The admin list overrides the stored role, so removing an email takes effect immediately.
          token.role = effectiveRole(current!.email, current!.role);
        }
      }
      return token;
    },
    async session({ session, token }) {
      return { ...session, user: { ...session.user, role: token.role as string, id: token.id as string } };
    },
  },
  // .env names it AUTH_SECRET; next-auth v4 reads NEXTAUTH_SECRET. Accept both,
  // so tokens are never signed with next-auth's development fallback.
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
};

/**
 * Typed wrapper around getServerSession that returns our extended AppSession.
 * Use this in all API routes instead of calling getServerSession(authOptions) directly.
 */
export async function getAppSession(): Promise<AppSession | null> {
  const session = await nextAuthGetServerSession(authOptions) as AppSession | null;
  return session?.user?.id ? session : null;
}
