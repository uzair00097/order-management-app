import { NextRequest, NextResponse } from "next/server";
import { getSession, invalidateTokenCache } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { errorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/withRateLimit";

const AssignSchema = z.object({ distributorId: z.string().uuid().nullable() });

async function patchHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") return errorResponse("UNAUTHORIZED", "Admins only", 403);

  const body = await req.json();
  const parsed = AssignSchema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_INPUT", parsed.error.issues[0].message, 400);

  const user = await prisma.user.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!user) return errorResponse("NOT_FOUND", "User not found", 404);
  if (user.role !== "SALESMAN") return errorResponse("INVALID_INPUT", "Can only reassign salesmen", 400);

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      distributorId: parsed.data.distributorId,
      tokenVersion: { increment: 1 }, // force re-login after reassignment
    },
    select: { id: true, name: true, role: true, distributorId: true },
  });

  await invalidateTokenCache(params.id);

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "USER_REASSIGNED",
      entityType: "User",
      entityId: params.id,
      metadata: { from: user.distributorId, to: parsed.data.distributorId },
    },
  });

  return NextResponse.json(updated);
}

async function deleteHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") return errorResponse("UNAUTHORIZED", "Admins only", 403);

  const user = await prisma.user.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!user) return errorResponse("NOT_FOUND", "User not found", 404);
  if (params.id === session.user.id) return errorResponse("INVALID_INPUT", "Cannot delete yourself", 400);

  await prisma.user.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), tokenVersion: { increment: 1 } },
  });

  await invalidateTokenCache(params.id);

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "USER_DELETED", entityType: "User", entityId: params.id },
  });

  return new NextResponse(null, { status: 204 });
}

export const PATCH = withRateLimit("ADMIN", patchHandler as Parameters<typeof withRateLimit>[1]);
export const DELETE = withRateLimit("ADMIN", deleteHandler as Parameters<typeof withRateLimit>[1]);
