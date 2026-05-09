import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

let _limiters: Record<string, Ratelimit> | null = null;

export function getRateLimiter(role: string): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  if (!_limiters) {
    _limiters = {
      SALESMAN: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m") }),
      DISTRIBUTOR: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, "1 m") }),
      ADMIN: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(300, "1 m") }),
    };
  }

  return _limiters[role] ?? _limiters.SALESMAN;
}
