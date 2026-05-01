import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { CreateCustomerSchema, PaginationSchema } from "@/lib/validations";
import { checkIdempotency, storeIdempotency } from "@/lib/idempotency";
import { errorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/withRateLimit";

function toTsQuery(search: string) {
  // Strip PostgreSQL tsquery special characters to prevent injection
  const sanitized = search.replace(/[&|!:*'"\\()]/g, " ");
  return sanitized.trim().split(/\s+/).filter(Boolean).map((w) => `${w}:*`).join(" & ");
}

async function getHandler(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const { id, role, distributorId } = session.user;
  if (role === "ADMIN") return errorResponse("UNAUTHORIZED", "Admins do not access customers directly", 403);
  const effectiveDistributorId = role === "DISTRIBUTOR" ? id : distributorId;
  if (!effectiveDistributorId) return errorResponse("UNAUTHORIZED", "No distributor assigned", 403);

  const { searchParams } = req.nextUrl;
  const parsed = PaginationSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return errorResponse("INVALID_INPUT", "Invalid query params", 400);

  const { limit, cursor, search } = parsed.data;

  type CustomerRow = { id: string; name: string; address: string; phone: string | null; creditLimit: string };
  let customers: CustomerRow[];

  if (search) {
    const tsq = toTsQuery(search);
    const pattern = "%" + search + "%";
    customers = await prisma.$queryRaw<CustomerRow[]>(
      Prisma.sql`
        SELECT id, name, address, phone, "creditLimit"::text AS "creditLimit"
        FROM "Customer"
        WHERE "distributorId" = ${effectiveDistributorId}
          AND "deletedAt" IS NULL
          AND (
            to_tsvector('simple', name) @@ to_tsquery('simple', ${tsq})
            OR name ILIKE ${pattern}
          )
        ORDER BY ts_rank(to_tsvector('simple', name), to_tsquery('simple', ${tsq})) DESC, name ASC
        LIMIT ${Prisma.raw(String(limit + 1))}
      `
    );
  } else {
    const rows = await prisma.customer.findMany({
      where: { distributorId: effectiveDistributorId, deletedAt: null },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true, phone: true, creditLimit: true },
    });
    customers = rows.map((r) => ({ ...r, creditLimit: r.creditLimit.toString() }));
  }

  const hasMore = customers.length > limit;
  const data = hasMore ? customers.slice(0, limit) : customers;

  return NextResponse.json({ data, nextCursor: hasMore && !search ? data[data.length - 1].id : null });
}

async function postHandler(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);
  if (session.user.role !== "DISTRIBUTOR") return errorResponse("UNAUTHORIZED", "Only distributors can create customers", 403);

  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (!idempotencyKey) return errorResponse("INVALID_INPUT", "Idempotency-Key header is required", 400);

  const existing = await checkIdempotency(session.user.id, idempotencyKey);
  if (existing) return NextResponse.json(existing.responseBody, { status: existing.responseStatus });

  const body = await req.json();
  const parsed = CreateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", parsed.error.issues[0].message, 400, parsed.error.issues[0].path.join("."));
  }

  const { id: userId } = session.user;

  const customer = await prisma.customer.create({
    data: { ...parsed.data, distributorId: userId },
    select: { id: true, name: true, address: true, phone: true, creditLimit: true },
  });

  await prisma.auditLog.create({
    data: { userId, action: "CUSTOMER_CREATED", entityType: "Customer", entityId: customer.id },
  });

  const responseBody = customer;
  await storeIdempotency(userId, idempotencyKey, 201, responseBody);

  return NextResponse.json(responseBody, { status: 201 });
}

export const GET = withRateLimit("SALESMAN", getHandler as Parameters<typeof withRateLimit>[1]);
export const POST = withRateLimit("DISTRIBUTOR", postHandler as Parameters<typeof withRateLimit>[1]);
