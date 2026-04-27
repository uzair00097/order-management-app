import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const rateLimitByRole: Record<string, Ratelimit> = {
  SALESMAN: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m") }),
  DISTRIBUTOR: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, "1 m") }),
  ADMIN: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(300, "1 m") }),
};
