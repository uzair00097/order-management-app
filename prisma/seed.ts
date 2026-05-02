import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@hrenterprices.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@hrenterprices.com",
      passwordHash: await hash("admin123"),
      role: "ADMIN",
    },
  });

  const distributor = await prisma.user.upsert({
    where: { email: "hr@hrenterprices.com" },
    update: { name: "HR ENTERPRICES" },
    create: {
      name: "HR ENTERPRICES",
      email: "hr@hrenterprices.com",
      passwordHash: await hash("dist123"),
      role: "DISTRIBUTOR",
    },
  });

  const salesman = await prisma.user.upsert({
    where: { email: "salesman@hrenterprices.com" },
    update: {},
    create: {
      name: "Salesman",
      email: "salesman@hrenterprices.com",
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
  console.log("IMPORTANT: Change all default passwords before going live.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
