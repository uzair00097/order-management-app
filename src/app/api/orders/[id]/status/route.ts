import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { UpdateOrderStatusSchema } from "@/lib/validations";
import { checkIdempotency, storeIdempotency } from "@/lib/idempotency";
import { errorResponse } from "@/lib/errors";
import { enqueue } from "@/lib/queue";

type OrderStatus = "DRAFT" | "PENDING" | "APPROVED" | "DELIVERED" | "CANCELLED";
type Transition = { from: OrderStatus; to: OrderStatus; roles: string[] };

const ALLOWED_TRANSITIONS: Transition[] = [
  { from: "DRAFT", to: "PENDING", roles: ["SALESMAN"] },
  { from: "DRAFT", to: "CANCELLED", roles: ["SALESMAN"] },
  { from: "PENDING", to: "APPROVED", roles: ["DISTRIBUTOR"] },
  { from: "PENDING", to: "CANCELLED", roles: ["DISTRIBUTOR"] },
  { from: "APPROVED", to: "DELIVERED", roles: ["DISTRIBUTOR"] },
  { from: "APPROVED", to: "CANCELLED", roles: ["ADMIN"] },
];

function isValidTransition(from: OrderStatus, to: OrderStatus, role: string): boolean {
  return ALLOWED_TRANSITIONS.some((t) => t.from === from && t.to === to && t.roles.includes(role));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (!idempotencyKey) return errorResponse("INVALID_INPUT", "Idempotency-Key header is required", 400);

  const existing = await checkIdempotency(session.user.id, idempotencyKey);
  if (existing) {
    return NextResponse.json(existing.responseBody, { status: existing.responseStatus });
  }

  const body = await req.json();
  const parsed = UpdateOrderStatusSchema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_INPUT", parsed.error.issues[0].message, 400);

  const { status: newStatus } = parsed.data;
  const { id: userId, role, distributorId } = session.user;

  const order = await prisma.order.findFirst({
    where: { id: params.id, deletedAt: null },
    include: { items: { include: { product: true } } },
  });

  if (!order) return errorResponse("NOT_FOUND", "Order not found", 404);

  // Tenant check for distributor — distributors have no distributorId field, their own id IS the distributorId
  if (role === "DISTRIBUTOR" && order.distributorId !== userId) {
    return errorResponse("UNAUTHORIZED", "Access denied", 403);
  }
  // Salesman can only cancel their own DRAFT
  if (role === "SALESMAN" && order.salesmanId !== userId) {
    return errorResponse("UNAUTHORIZED", "Access denied", 403);
  }

  if (!isValidTransition(order.status, newStatus as OrderStatus, role)) {
    return errorResponse("INVALID_TRANSITION", `Cannot transition from ${order.status} to ${newStatus}`, 400);
  }

  if (order.status === "DRAFT" && newStatus === "PENDING") {
    const customer = await prisma.customer.findUnique({
      where: { id: order.customerId },
      select: { creditLimit: true },
    });
    const creditLimit = Number(customer?.creditLimit ?? 0);
    if (creditLimit > 0) {
      const orderTotal = order.items.reduce(
        (sum, item) => sum + item.quantity * Number(item.unitPrice),
        0
      );
      const outstandingItems = await prisma.orderItem.findMany({
        where: {
          order: {
            customerId: order.customerId,
            status: { in: ["PENDING", "APPROVED"] },
            id: { not: order.id },
            deletedAt: null,
          },
        },
        select: { quantity: true, unitPrice: true },
      });
      const outstandingTotal = outstandingItems.reduce(
        (sum, item) => sum + item.quantity * Number(item.unitPrice),
        0
      );
      if (outstandingTotal + orderTotal > creditLimit) {
        return errorResponse(
          "CREDIT_LIMIT_EXCEEDED",
          `Credit limit exceeded. Limit: ${creditLimit.toFixed(2)}, Outstanding: ${outstandingTotal.toFixed(2)}, This order: ${orderTotal.toFixed(2)}`,
          422
        );
      }
    }
  }

  let responseBody: Record<string, unknown>;

  if (newStatus === "APPROVED") {
    // Atomic stock decrement inside a transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const item of order.items) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0) {
          throw new Error(`OUT_OF_STOCK:${item.product.name}`);
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: "APPROVED", updatedBy: userId },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "ORDER_APPROVED",
          entityType: "Order",
          entityId: order.id,
          metadata: { previousStatus: order.status },
        },
      });
    });

    responseBody = { id: order.id, status: "APPROVED" };
  } else if (newStatus === "CANCELLED" && order.status === "APPROVED") {
    // Restore stock when cancelling an approved order (Admin only)
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", updatedBy: userId, deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "ORDER_CANCELLED",
          entityType: "Order",
          entityId: order.id,
          metadata: { previousStatus: order.status, stockRestored: true },
        },
      });
    });

    responseBody = { id: order.id, status: "CANCELLED" };
  } else {
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: newStatus as OrderStatus,
        updatedBy: userId,
        ...(newStatus === "CANCELLED" ? { deletedAt: new Date() } : {}),
      },
      select: { id: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: `ORDER_${newStatus}`,
        entityType: "Order",
        entityId: order.id,
        metadata: { previousStatus: order.status },
      },
    });

    responseBody = { id: updated.id, status: updated.status };
  }

  // Push notification: salesman submitted → notify distributor
  if (newStatus === "PENDING") {
    enqueue("/api/queue/push", {
      userId: order.distributorId,
      title: "New Order Submitted",
      body: `A new order requires your approval.`,
      url: "/dashboard/distributor/orders",
    }).catch(() => {});
  }

  // Push notification: distributor approved/delivered → notify salesman
  if (newStatus === "APPROVED" || newStatus === "DELIVERED") {
    enqueue("/api/queue/push", {
      userId: order.salesmanId,
      title: newStatus === "APPROVED" ? "Order Approved" : "Order Delivered",
      body: `Your order has been ${newStatus.toLowerCase()}.`,
      url: "/dashboard/salesman/orders",
    }).catch(() => {});
  }

  await storeIdempotency(userId, idempotencyKey, 200, responseBody);
  return NextResponse.json(responseBody);
}
