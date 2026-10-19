import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Admin user credentials
  const adminEmail = 'ccosmas001@gmail.com';
  const adminPassword = '22360010sS$';

  // Hash the admin password
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  // Create or update the admin user
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: hashedPassword, role: UserRole.SUPER_ADMIN },
    create: {
      name: 'Admin User',
      email: adminEmail,
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
    },
  });

  console.log(`Admin user with email ${adminUser.email} has been created/updated.`);

  // You can add more seeding data here, e.g., initial courses, cakes, etc.

}

main()
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
