import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { errorResponse } from "@/lib/errors";

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["DISTRIBUTOR", "SALESMAN"]),
  distributorId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") return errorResponse("UNAUTHORIZED", "Admins only", 403);

  const { searchParams } = req.nextUrl;
  const role = searchParams.get("role");

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(role ? { role: role as "ADMIN" | "DISTRIBUTOR" | "SALESMAN" } : { role: { in: ["DISTRIBUTOR", "SALESMAN"] } }),
    },
    select: {
      id: true, name: true, email: true, role: true, distributorId: true, createdAt: true,
      distributor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: users });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") return errorResponse("UNAUTHORIZED", "Admins only", 403);

  const body = await req.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_INPUT", parsed.error.issues[0].message, 400);

  const { name, email, password, role, distributorId } = parsed.data;

  if (role === "SALESMAN" && !distributorId) {
    return errorResponse("INVALID_INPUT", "distributorId is required for SALESMAN role", 400);
  }

  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (existing) return errorResponse("INVALID_INPUT", "Email already in use", 400);

  const user = await prisma.user.create({
    data: {
      name, email,
      passwordHash: await bcrypt.hash(password, 12),
      role,
      distributorId: distributorId ?? null,
    },
    select: { id: true, name: true, email: true, role: true, distributorId: true },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "USER_CREATED", entityType: "User", entityId: user.id },
  });

  return NextResponse.json(user, { status: 201 });
}
