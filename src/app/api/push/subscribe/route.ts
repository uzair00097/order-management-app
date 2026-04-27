import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { errorResponse } from "@/lib/errors";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const body = await req.json();
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) return errorResponse("INVALID_INPUT", "Invalid subscription data", 400);

  const { endpoint, keys } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    update: {
      userId: session.user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const body = await req.json();
  const { endpoint } = z.object({ endpoint: z.string() }).parse(body);

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
