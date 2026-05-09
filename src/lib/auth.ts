import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getRedis } from "@/lib/redis";

// --- Token-version cache ---
// Caches { tv: tokenVersion, deleted: boolean } for 60 s to avoid a DB
// round-trip on every authenticated request. Must be invalidated immediately
// when tokenVersion is incremented (forced logout / user deletion).
type TokenCacheValue = { tv: number; deleted: boolean };
const TOKEN_CACHE_TTL = 60; // seconds
const tvKey = (id: string) => `auth:tv:${id}`;

export async function invalidateTokenCache(userId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try { await redis.del(tvKey(userId)); } catch { /* ignore */ }
}

async function readTokenCache(userId: string): Promise<TokenCacheValue | null> {
  const redis = getRedis();
  if (!redis) return null;
  try { return await redis.get<TokenCacheValue>(tvKey(userId)); } catch { return null; }
}

async function writeTokenCache(userId: string, value: TokenCacheValue): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try { await redis.set(tvKey(userId), value, { ex: TOKEN_CACHE_TTL }); } catch { /* ignore */ }
}

// In-memory fallback when Redis is not configured.
// In production with multiple instances, use Redis (Upstash) instead.
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

async function checkLoginRateLimit(key: string): Promise<{ blocked: boolean; remaining: number }> {
  // Use Redis if available
  if (process.env.UPSTASH_REDIS_REST_URL?.startsWith("https://")) {
    try {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      const redisKey = `login_fail:${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) await redis.expire(redisKey, Math.floor(LOCKOUT_MS / 1000));
      return { blocked: count > MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - count) };
    } catch {
      // fall through to in-memory fallback
    }
  }

  const now = Date.now();
  const record = failedAttempts.get(key);
  if (record) {
    if (record.lockedUntil > now) {
      return { blocked: true, remaining: 0 }; // actively locked
    }
    // lockout period has passed — give user a fresh window
    if (record.lockedUntil > 0) {
      failedAttempts.delete(key);
      return { blocked: false, remaining: MAX_ATTEMPTS };
    }
    if (record.count >= MAX_ATTEMPTS) {
      failedAttempts.set(key, { count: record.count + 1, lockedUntil: now + LOCKOUT_MS });
      return { blocked: true, remaining: 0 };
    }
  }
  return { blocked: false, remaining: MAX_ATTEMPTS - (record?.count ?? 0) };
}

async function recordFailedLogin(key: string) {
  if (process.env.UPSTASH_REDIS_REST_URL?.startsWith("https://")) return; // Redis path handled in checkLoginRateLimit
  const now = Date.now();
  const record = failedAttempts.get(key) ?? { count: 0, lockedUntil: 0 };
  const newCount = record.lockedUntil < now ? 1 : record.count + 1;
  failedAttempts.set(key, {
    count: newCount,
    lockedUntil: newCount >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0,
  });
}

async function clearLoginRateLimit(key: string) {
  if (process.env.UPSTASH_REDIS_REST_URL?.startsWith("https://")) {
    try {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      await redis.del(`login_fail:${key}`);
    } catch { /* ignore */ }
  }
  failedAttempts.delete(key);
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip = (req as { headers?: Record<string, string | string[]> })?.headers?.["x-forwarded-for"];
        const ipStr = Array.isArray(ip) ? ip[0] : (ip ?? "unknown");
        const rateLimitKey = `${ipStr}:${credentials.email.toLowerCase()}`;

        const { blocked } = await checkLoginRateLimit(rateLimitKey);
        if (blocked) {
          logger.warn("Login blocked — rate limit exceeded", { route: "/api/auth/signin", key: rateLimitKey });
          throw new Error("TOO_MANY_ATTEMPTS");
        }

        const user = await prisma.user.findFirst({
          where: { email: credentials.email, deletedAt: null },
        });

        if (!user) {
          await recordFailedLogin(rateLimitKey);
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          await recordFailedLogin(rateLimitKey);
          logger.warn("Failed login attempt", { route: "/api/auth/signin", userId: user.id });
          return null;
        }

        await clearLoginRateLimit(rateLimitKey);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          distributorId: user.distributorId,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.distributorId = user.distributorId;
        token.tokenVersion = user.tokenVersion;
      }

      // Verify tokenVersion to detect forced logouts / soft-deletes.
      // Check Redis cache first; fall back to DB on a miss, then populate cache.
      if (token.id) {
        const userId = token.id as string;

        const cached = await readTokenCache(userId);
        if (cached !== null) {
          if (cached.deleted || cached.tv !== (token.tokenVersion as number)) {
            return { ...token, id: undefined as unknown as string };
          }
          return token;
        }

        // Cache miss — hit DB once and cache the result for TOKEN_CACHE_TTL seconds.
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { tokenVersion: true, deletedAt: true },
        });

        if (dbUser) {
          await writeTokenCache(userId, { tv: dbUser.tokenVersion, deleted: dbUser.deletedAt !== null });
        }

        if (!dbUser || dbUser.deletedAt || dbUser.tokenVersion !== token.tokenVersion) {
          return { ...token, id: undefined as unknown as string };
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.distributorId = token.distributorId as string | null;
      session.user.tokenVersion = token.tokenVersion as number;
      return session;
    },
  },
  pages: { signIn: "/login" },
};

export const getSession = () => getServerSession(authOptions);
