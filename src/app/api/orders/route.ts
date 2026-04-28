import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateOrderSchema, PaginationSchema } from "@/lib/validations";
import { checkIdempotency, storeIdempotency } from "@/lib/idempotency";
import { errorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/withRateLimit";

async function getHandler(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const { searchParams } = req.nextUrl;
  const parsed = PaginationSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return errorResponse("INVALID_INPUT", "Invalid query params", 400);

  const { limit, cursor, status, from, to, customerId } = parsed.data;
  const { id, role, distributorId } = session.user;

  const where: Record<string, unknown> = {
    deletedAt: null,
    ...(status && { status }),
    ...(customerId && { customerId }),
    ...(from || to
      ? { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }
      : {}),
  };

  if (role === "SALESMAN") where.salesmanId = id;
  else if (role === "DISTRIBUTOR") where.distributorId = id;
  // ADMIN sees all — no extra filter

  const orders = await prisma.order.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true } },
      salesman: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });

  const hasMore = orders.length > limit;
  const data = hasMore ? orders.slice(0, limit) : orders;

  return NextResponse.json({
    data,
    nextCursor: hasMore ? data[data.length - 1].id : null,
  });
}

async function postHandler(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);
  if (session.user.role !== "SALESMAN") return errorResponse("UNAUTHORIZED", "Only salesmen can create orders", 403);

  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (!idempotencyKey) return errorResponse("INVALID_INPUT", "Idempotency-Key header is required", 400);

  const existing = await checkIdempotency(session.user.id, idempotencyKey);
  if (existing) {
    return NextResponse.json(existing.responseBody, { status: existing.responseStatus });
  }

  const body = await req.json();
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", parsed.error.issues[0].message, 400, parsed.error.issues[0].path.join("."));
  }

  const { customerId, items, notes, discountAmount, lat, lng } = parsed.data;
  const { id: salesmanId, distributorId } = session.user;

  if (!distributorId) return errorResponse("UNAUTHORIZED", "Salesman not assigned to a distributor", 403);

  // Verify customer belongs to this distributor
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, distributorId, deletedAt: null },
  });
  if (!customer) return errorResponse("NOT_FOUND", "Customer not found", 404);

  // Verify all products belong to this distributor
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, distributorId, deletedAt: null },
  });
  if (products.length !== productIds.length) {
    return errorResponse("NOT_FOUND", "One or more products not found", 404);
  }

  type ProductRow = { id: string; price: Prisma.Decimal | number };
  const productMap = new Map<string, ProductRow>(
    (products as ProductRow[]).map((p) => [p.id, p])
  );

  // Create as DRAFT — cart is persisted in DB before salesman explicitly submits
  const order = await prisma.order.create({
    data: {
      salesmanId,
      distributorId,
      customerId,
      status: "DRAFT",
      notes,
      discountAmount,
      lat,
      lng,
      updatedBy: salesmanId,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: productMap.get(item.productId)!.price,
        })),
      },
    },
    select: { id: true, status: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: salesmanId,
      action: "ORDER_DRAFT_CREATED",
      entityType: "Order",
      entityId: order.id,
    },
  });

  const responseBody = { id: order.id, status: order.status, createdAt: order.createdAt };
  await storeIdempotency(salesmanId, idempotencyKey, 201, responseBody);

  return NextResponse.json(responseBody, { status: 201 });
}

export const GET = withRateLimit("SALESMAN", getHandler as Parameters<typeof withRateLimit>[1]);
export const POST = withRateLimit("SALESMAN", postHandler as Parameters<typeof withRateLimit>[1]);
