const REQUIRED_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
] as const;

const PRODUCTION_REQUIRED_VARS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CRON_SECRET",
  "QUEUE_SECRET",
  "SENTRY_DSN",
] as const;

function validateEnv() {
  const missing: string[] = [];
  // next build runs with NODE_ENV=production; skip runtime-only checks during that phase
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) missing.push(key);
  }

  if (process.env.NODE_ENV === "production" && !isBuildPhase) {
    for (const key of PRODUCTION_REQUIRED_VARS) {
      if (!process.env[key]) missing.push(key);
    }

    if (process.env.PREVIEW_MODE === "true") {
      throw new Error(
        "[env] PREVIEW_MODE=true is not allowed in production. " +
        "This flag disables authentication and must never be set in a live environment."
      );
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables:\n  ${missing.join("\n  ")}\n` +
      "Copy .env.example to .env.local and fill in the values."
    );
  }
}

// Runs once at module load time — fails fast at startup rather than on first request
validateEnv();

export {};
