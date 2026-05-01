import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/withRateLimit";
import { z } from "zod";

const DSRQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default(() => new Date().toISOString().slice(0, 10)),
});

async function handler(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const { role, id } = session.user;
  if (role !== "DISTRIBUTOR" && role !== "ADMIN")
    return errorResponse("UNAUTHORIZED", "Not authorized", 403);

  const parsed = DSRQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return errorResponse("INVALID_INPUT", "Invalid date parameter", 400);

  const { date } = parsed.data;
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const distFilter = role === "DISTRIBUTOR" ? { distributorId: id } : {};

  const orders = await prisma.order.findMany({
    where: { ...distFilter, createdAt: { gte: dayStart, lte: dayEnd }, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true } },
      salesman: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const enriched = orders.map((o) => ({
    ...o,
    total: o.items.reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0),
  }));

  const statusBreakdown: Record<string, number> = {};
  for (const o of enriched) statusBreakdown[o.status] = (statusBreakdown[o.status] ?? 0) + 1;

  const activeOrders = enriched.filter((o) => o.status !== "DRAFT" && o.status !== "CANCELLED");
  const totalRevenue = activeOrders.reduce((s, o) => s + o.total, 0);

  const salesmanMap = new Map<string, { id: string; name: string; orderCount: number; revenue: number }>();
  for (const o of enriched) {
    const row = salesmanMap.get(o.salesmanId) ?? {
      id: o.salesmanId,
      name: o.salesman.name,
      orderCount: 0,
      revenue: 0,
    };
    row.orderCount++;
    if (o.status !== "DRAFT" && o.status !== "CANCELLED") row.revenue += o.total;
    salesmanMap.set(o.salesmanId, row);
  }

  const productMap = new Map<string, { id: string; name: string; quantitySold: number; revenue: number }>();
  for (const o of activeOrders) {
    for (const item of o.items) {
      const row = productMap.get(item.productId) ?? {
        id: item.productId,
        name: item.product.name,
        quantitySold: 0,
        revenue: 0,
      };
      row.quantitySold += item.quantity;
      row.revenue += item.quantity * Number(item.unitPrice);
      productMap.set(item.productId, row);
    }
  }

  return NextResponse.json({
    date,
    summary: { totalOrders: enriched.length, totalRevenue, statusBreakdown },
    bySalesman: Array.from(salesmanMap.values()).sort((a, b) => b.revenue - a.revenue),
    byProduct: Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue),
    orders: enriched.map((o) => ({
      id: o.id,
      status: o.status,
      createdAt: o.createdAt,
      total: o.total,
      discountAmount: Number(o.discountAmount),
      notes: o.notes,
      customer: o.customer,
      salesman: o.salesman,
      items: o.items.map((i) => ({
        productName: i.product.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        amount: i.quantity * Number(i.unitPrice),
      })),
    })),
  });
}

export const GET = withRateLimit("DISTRIBUTOR", handler as Parameters<typeof withRateLimit>[1]);
