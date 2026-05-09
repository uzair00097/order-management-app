import { NextRequest, NextResponse } from "next/server";
import { getRateLimiter } from "@/lib/ratelimit";
import { errorResponse } from "@/lib/errors";

type Handler = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<NextResponse>;

export function withRateLimit(role: string, handler: Handler): Handler {
  return async (req, ctx) => {
    const limiter = getRateLimiter(role);
    if (!limiter) return handler(req, ctx);

    const identifier = `${role}:${req.ip ?? "anonymous"}`;
    const { success } = await limiter.limit(identifier);

    if (!success) {
      return errorResponse("RATE_LIMITED", "Too many requests. Please slow down.", 429) as NextResponse;
    }

    return handler(req, ctx);
  };
}
