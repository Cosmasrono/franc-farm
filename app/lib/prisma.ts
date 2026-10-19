// lib/prisma.ts (create this file)
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Refresh the development client when newly added models are missing from the cached instance.
if (globalForPrisma.prisma && (!globalForPrisma.prisma.posSale || !globalForPrisma.prisma.expense)) {
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
