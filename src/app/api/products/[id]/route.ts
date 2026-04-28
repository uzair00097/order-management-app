import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UpdateProductSchema } from "@/lib/validations";
import { errorResponse } from "@/lib/errors";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);
  if (session.user.role !== "DISTRIBUTOR") return errorResponse("UNAUTHORIZED", "Only distributors can update products", 403);

  const body = await req.json();
  const parsed = UpdateProductSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", parsed.error.issues[0].message, 400, parsed.error.issues[0].path.join("."));
  }

  const { id: userId } = session.user;

  const product = await prisma.product.findFirst({
    where: { id: params.id, distributorId: userId, deletedAt: null },
  });
  if (!product) return errorResponse("NOT_FOUND", "Product not found", 404);

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, name: true, price: true, stock: true, imageUrl: true },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: product.id,
      metadata: { before: { price: product.price, stock: product.stock }, after: parsed.data },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);
  if (session.user.role !== "DISTRIBUTOR") return errorResponse("UNAUTHORIZED", "Only distributors can delete products", 403);

  const { id: userId } = session.user;

  const product = await prisma.product.findFirst({
    where: { id: params.id, distributorId: userId, deletedAt: null },
  });
  if (!product) return errorResponse("NOT_FOUND", "Product not found", 404);

  await prisma.product.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: { userId, action: "PRODUCT_DELETED", entityType: "Product", entityId: product.id },
  });

  return new NextResponse(null, { status: 204 });
}
