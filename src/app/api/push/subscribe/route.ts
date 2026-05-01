import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { errorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/withRateLimit";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

async function postHandler(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const body = await req.json();
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_INPUT", "Invalid subscription data", 400);

  const { endpoint, keys } = parsed.data;

  // Prevent one user from claiming another user's push subscription
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint },
    select: { userId: true },
  });
  if (existing && existing.userId !== session.user.id) {
    // Browser reused an endpoint — delete stale record so this user can claim it
    await prisma.pushSubscription.delete({ where: { endpoint } });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    update: {
      // Never update userId — only refresh keys
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });

  return NextResponse.json({ ok: true });
}

async function deleteHandler(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const body = await req.json();
  const { endpoint } = z.object({ endpoint: z.string() }).parse(body);

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}

export const POST = withRateLimit("SALESMAN", postHandler as Parameters<typeof withRateLimit>[1]);
export const DELETE = withRateLimit("SALESMAN", deleteHandler as Parameters<typeof withRateLimit>[1]);
