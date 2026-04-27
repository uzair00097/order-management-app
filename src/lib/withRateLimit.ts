import { NextRequest, NextResponse } from "next/server";
import { rateLimitByRole } from "@/lib/ratelimit";
import { errorResponse } from "@/lib/errors";

type Handler = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<NextResponse>;

export function withRateLimit(role: string, handler: Handler): Handler {
  return async (req, ctx) => {
    // Skip rate limiting when Upstash is not configured
    if (!process.env.UPSTASH_REDIS_REST_URL?.startsWith("https://")) {
      return handler(req, ctx);
    }

    const limiter = rateLimitByRole[role] ?? rateLimitByRole["SALESMAN"];
    const identifier = `${role}:${req.ip ?? "anonymous"}`;
    const { success } = await limiter.limit(identifier);

    if (!success) {
      return errorResponse("RATE_LIMITED", "Too many requests. Please slow down.", 429) as NextResponse;
    }

    return handler(req, ctx);
  };
}
