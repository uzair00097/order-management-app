import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

function safeCompareSecret(received: string | null): boolean {
  const expected = process.env.CRON_SECRET ?? "";
  if (!received || !expected) return false;
  try {
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Protected by CRON_SECRET — set this in Vercel env vars and vercel.json
export async function POST(req: NextRequest) {
  if (!safeCompareSecret(req.headers.get("x-cron-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);

  // Find terminal orders older than 6 months
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["DELIVERED", "CANCELLED"] },
      createdAt: { lt: cutoff },
      deletedAt: null,
    },
    include: {
      items: { include: { product: { select: { name: true } } } },
    },
    take: 500, // process in batches
  });

  if (orders.length === 0) {
    return NextResponse.json({ archived: 0 });
  }

  // Copy to archive + hard-delete originals in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.orderArchive.createMany({
      data: orders.map((o) => ({
        id: o.id,
        salesmanId: o.salesmanId,
        distributorId: o.distributorId,
        customerId: o.customerId,
        status: o.status,
        notes: o.notes,
        items: o.items.map((i) => ({
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
        })),
        orderCreatedAt: o.createdAt,
        orderUpdatedAt: o.updatedAt,
      })),
      skipDuplicates: true,
    });

    await tx.orderItem.deleteMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
    });

    await tx.order.deleteMany({
      where: { id: { in: orders.map((o) => o.id) } },
    });
  });

  return NextResponse.json({ archived: orders.length });
}
