import { NextRequest, NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/webpush";
import { z } from "zod";

const Schema = z.object({
  userId: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  url: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-queue-secret");
  const expected = process.env.QUEUE_SECRET ?? "dev-queue-secret";
  if (secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await sendPushToUser(parsed.data.userId, {
    title: parsed.data.title,
    body: parsed.data.body,
    url: parsed.data.url,
  });

  return NextResponse.json({ ok: true });
}
