import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

function safeCompareSecret(received: string | null): boolean {
  const expected = process.env.CRON_SECRET ?? "";
  if (!received || !expected) return false;
  try {
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Protected by CRON_SECRET header — set in Vercel cron config and env vars
export async function POST(req: NextRequest) {
  if (!safeCompareSecret(req.headers.get("x-cron-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await prisma.idempotencyRecord.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  logger.info("Idempotency cleanup completed", { deletedCount: deleted.count });

  return NextResponse.json({ deleted: deleted.count });
}
