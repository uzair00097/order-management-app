import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/withRateLimit";

async function getHandler(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const { id, role, distributorId } = session.user;
  if (role === "ADMIN") return errorResponse("UNAUTHORIZED", "Admins do not access products directly", 403);
  const effectiveDistributorId = role === "DISTRIBUTOR" ? id : distributorId;
  if (!effectiveDistributorId) return errorResponse("UNAUTHORIZED", "No distributor assigned", 403);

  const raw = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);

  if (ids.length === 0) return NextResponse.json({ ids: [] });

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, distributorId: effectiveDistributorId, deletedAt: null },
    select: { id: true },
  });

  return NextResponse.json({ ids: products.map((p) => p.id) });
}

export const GET = withRateLimit("SALESMAN", getHandler as Parameters<typeof withRateLimit>[1]);
