import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@demo.com",
      passwordHash: await hash("admin123"),
      role: "ADMIN",
    },
  });

  const distributor = await prisma.user.upsert({
    where: { email: "distributor@demo.com" },
    update: { name: "HR ENTERPRICES" },
    create: {
      name: "HR ENTERPRICES",
      email: "distributor@demo.com",
      passwordHash: await hash("dist123"),
      role: "DISTRIBUTOR",
    },
  });

  const salesman = await prisma.user.upsert({
    where: { email: "salesman@demo.com" },
    update: {},
    create: {
      name: "Test Salesman",
      email: "salesman@demo.com",
      passwordHash: await hash("sales123"),
      role: "SALESMAN",
      distributorId: distributor.id,
    },
  });

  await prisma.product.createMany({
    skipDuplicates: true,
    data: [
      { name: "Coca Cola 1L", price: 80, stock: 500, distributorId: distributor.id },
      { name: "Pepsi 1.5L", price: 90, stock: 300, distributorId: distributor.id },
      { name: "Lays Classic 50g", price: 30, stock: 1000, distributorId: distributor.id },
    ],
  });

  await prisma.customer.createMany({
    skipDuplicates: true,
    data: [
      {
        name: "Ali General Store",
        address: "Shop 12, Main Bazaar, Karachi",
        phone: "03001234567",
        distributorId: distributor.id,
      },
      {
        name: "Hassan Traders",
        address: "Block B, Gulshan, Lahore",
        phone: "03219876543",
        distributorId: distributor.id,
      },
    ],
  });

  console.log("Seed complete:", { admin: admin.email, distributor: distributor.email, salesman: salesman.email });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
