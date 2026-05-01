import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UpdateCustomerSchema } from "@/lib/validations";
import { errorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/withRateLimit";

async function deleteHandler(_req: NextRequest, { params }: { params: Record<string, string> }) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);
  if (session.user.role !== "DISTRIBUTOR") return errorResponse("UNAUTHORIZED", "Only distributors can delete customers", 403);

  const { id: userId } = session.user;

  const customer = await prisma.customer.findFirst({
    where: { id: params.id, distributorId: userId, deletedAt: null },
  });
  if (!customer) return errorResponse("NOT_FOUND", "Customer not found", 404);

  await prisma.customer.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: { userId, action: "CUSTOMER_DELETED", entityType: "Customer", entityId: params.id },
  });

  return new NextResponse(null, { status: 204 });
}

async function patchHandler(req: NextRequest, { params }: { params: Record<string, string> }) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);
  if (session.user.role !== "DISTRIBUTOR") return errorResponse("UNAUTHORIZED", "Only distributors can update customers", 403);

  const { id: userId } = session.user;

  const customer = await prisma.customer.findFirst({
    where: { id: params.id, distributorId: userId, deletedAt: null },
  });
  if (!customer) return errorResponse("NOT_FOUND", "Customer not found", 404);

  const body = await req.json();
  const parsed = UpdateCustomerSchema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_INPUT", parsed.error.issues[0].message, 400);

  const updated = await prisma.customer.update({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, name: true, address: true, phone: true, creditLimit: true },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "CUSTOMER_UPDATED",
      entityType: "Customer",
      entityId: params.id,
    },
  });

  return NextResponse.json(updated);
}

export const DELETE = withRateLimit("DISTRIBUTOR", deleteHandler);
export const PATCH = withRateLimit("DISTRIBUTOR", patchHandler);
