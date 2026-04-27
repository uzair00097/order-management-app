import { prisma } from "@/lib/prisma";

export async function checkIdempotency(userId: string, key: string) {
  const record = await prisma.idempotencyRecord.findUnique({
    where: { userId_key: { userId, key } },
  });

  if (!record) return null;

  if (record.expiresAt < new Date()) {
    await prisma.idempotencyRecord.delete({ where: { userId_key: { userId, key } } });
    return null;
  }

  return record;
}

export async function storeIdempotency(
  userId: string,
  key: string,
  responseStatus: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responseBody: any
) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.idempotencyRecord.create({
    data: { userId, key, responseStatus, responseBody, expiresAt },
  });
}
