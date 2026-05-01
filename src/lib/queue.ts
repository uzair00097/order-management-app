import { Client } from "@upstash/qstash";
import { logger } from "@/lib/logger";

const qstash = process.env.QSTASH_TOKEN
  ? new Client({ token: process.env.QSTASH_TOKEN })
  : null;

export async function enqueue(path: string, body: unknown): Promise<void> {
  const url = `${process.env.NEXTAUTH_URL}${path}`;

  if (!qstash) {
    // No QStash configured — call synchronously (dev / small scale)
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-queue-secret": process.env.QUEUE_SECRET ?? "dev-queue-secret",
      },
      body: JSON.stringify(body),
    }).catch((err: unknown) => {
      logger.error("Synchronous queue delivery failed", {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    });
    return;
  }

  await qstash.publishJSON({
    url,
    body: body as Record<string, unknown>,
    headers: { "x-queue-secret": process.env.QUEUE_SECRET ?? "" },
    retries: 3,
  });
}
