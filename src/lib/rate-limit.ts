import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Fixed-window rate limiter backed by Postgres so limits hold across
 * serverless instances. Fails open if the database is unavailable.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = new Date();
  const nextReset = new Date(now.getTime() + windowSeconds * 1000);
  try {
    const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${nextReset})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN ${nextReset} ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"`;
    const row = rows[0];
    if (Math.random() < 0.01) {
      void prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 86_400_000) } } }).catch(() => {});
    }
    return { success: row.count <= limit, remaining: Math.max(0, limit - row.count), resetAt: row.resetAt };
  } catch (error) {
    console.error("[rate-limit] failed open", error);
    return { success: true, remaining: limit, resetAt: nextReset };
  }
}

export async function getClientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Convenience: limit an action per client IP. */
export async function limitByIp(action: string, limit: number, windowSeconds: number) {
  const ip = await getClientIp();
  return rateLimit(`${action}:${ip}`, limit, windowSeconds);
}

/**
 * CSRF defence for JSON route handlers: require a same-origin Origin header.
 * (Server Actions get this check from Next.js automatically.)
 */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
