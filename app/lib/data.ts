import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function getUserByEmail(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
      },
    });
    
    return user;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}