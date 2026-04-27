import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { CreateProductSchema, PaginationSchema } from "@/lib/validations";
import { checkIdempotency, storeIdempotency } from "@/lib/idempotency";
import { withRateLimit } from "@/lib/withRateLimit";
import { errorResponse } from "@/lib/errors";

function toTsQuery(search: string) {
  return search.trim().split(/\s+/).filter(Boolean).map((w) => `${w}:*`).join(" & ");
}

async function getHandler(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const { id, role, distributorId } = session.user;
  if (role === "ADMIN") return errorResponse("UNAUTHORIZED", "Admins do not access products directly", 403);
  const effectiveDistributorId = role === "DISTRIBUTOR" ? id : distributorId;
  if (!effectiveDistributorId) return errorResponse("UNAUTHORIZED", "No distributor assigned", 403);

  const { searchParams } = req.nextUrl;
  const parsed = PaginationSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return errorResponse("INVALID_INPUT", "Invalid query params", 400);

  const { limit, cursor, search } = parsed.data;

  type ProductRow = { id: string; name: string; price: string; stock: number };
  let products: ProductRow[];

  if (search) {
    // Full-text search via tsvector (no cursor — search results are bounded)
    const tsq = toTsQuery(search);
    const pattern = "%" + search + "%";
    products = await prisma.$queryRaw<ProductRow[]>(
      Prisma.sql`
        SELECT id, name, price::text, stock
        FROM "Product"
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
    const rows = await prisma.product.findMany({
      where: { distributorId: effectiveDistributorId, deletedAt: null },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true, stock: true },
    });
    products = rows.map((r) => ({ ...r, price: r.price.toString() }));
  }

  const hasMore = products.length > limit;
  const data = hasMore ? products.slice(0, limit) : products;

  return NextResponse.json({ data, nextCursor: hasMore && !search ? data[data.length - 1].id : null });
}

async function postHandler(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);
  if (session.user.role !== "DISTRIBUTOR") return errorResponse("UNAUTHORIZED", "Only distributors can create products", 403);

  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (!idempotencyKey) return errorResponse("INVALID_INPUT", "Idempotency-Key header is required", 400);

  const existing = await checkIdempotency(session.user.id, idempotencyKey);
  if (existing) return NextResponse.json(existing.responseBody, { status: existing.responseStatus });

  const body = await req.json();
  const parsed = CreateProductSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", parsed.error.issues[0].message, 400, parsed.error.issues[0].path.join("."));
  }

  const { name, price, stock } = parsed.data;
  const { id: userId } = session.user;

  const product = await prisma.product.create({
    data: { name, price, stock, distributorId: userId },
    select: { id: true, name: true, price: true, stock: true },
  });

  await prisma.auditLog.create({
    data: { userId, action: "PRODUCT_CREATED", entityType: "Product", entityId: product.id },
  });

  const responseBody = product;
  await storeIdempotency(userId, idempotencyKey, 201, responseBody);

  return NextResponse.json(responseBody, { status: 201 });
}

export const GET = withRateLimit("SALESMAN", getHandler as Parameters<typeof withRateLimit>[1]);
export const POST = withRateLimit("DISTRIBUTOR", postHandler as Parameters<typeof withRateLimit>[1]);
