import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";

export async function GET() {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") return errorResponse("UNAUTHORIZED", "Admins only", 403);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalOrders,
    todayOrders,
    pendingOrders,
    totalUsers,
    totalDistributors,
    totalSalesmen,
    recentOrders,
    ordersByStatus,
  ] = await Promise.all([
    prisma.order.count({ where: { deletedAt: null } }),
    prisma.order.count({ where: { createdAt: { gte: startOfToday }, deletedAt: null } }),
    prisma.order.count({ where: { status: "PENDING", deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, role: { in: ["DISTRIBUTOR", "SALESMAN"] } } }),
    prisma.user.count({ where: { deletedAt: null, role: "DISTRIBUTOR" } }),
    prisma.user.count({ where: { deletedAt: null, role: "SALESMAN" } }),
    // Daily order counts for last 30 days (raw query for grouping by date)
    prisma.$queryRaw<{ date: string; count: bigint; total: number }[]>`
      SELECT
        DATE("createdAt")::text AS date,
        COUNT(*)::bigint AS count,
        COALESCE(SUM(
          (SELECT SUM(oi."unitPrice" * oi.quantity) FROM "OrderItem" oi WHERE oi."orderId" = o.id)
        ), 0)::float AS total
      FROM "Order" o
      WHERE o."createdAt" >= ${startOf30Days}
        AND o."deletedAt" IS NULL
        AND o.status NOT IN ('DRAFT', 'CANCELLED')
      GROUP BY DATE("createdAt")
      ORDER BY date DESC
      LIMIT 30
    `,
    prisma.order.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { id: true },
    }),
  ]);

  return NextResponse.json({
    summary: {
      totalOrders,
      todayOrders,
      pendingOrders,
      totalUsers,
      totalDistributors,
      totalSalesmen,
    },
    ordersByStatus: ordersByStatus.map((s) => ({ status: s.status, count: s._count.id })),
    dailyOrders: recentOrders.map((r) => ({
      date: r.date,
      count: Number(r.count),
      total: r.total,
    })),
  });
}
