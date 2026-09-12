import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { rateLimit } from "./schema";

/**
 * Postgres-backed sliding window. Vercel runs multiple isolated instances, so
 * an in-memory counter would see a fraction of the traffic and silently fail
 * to limit anything.
 *
 * Returns true when the request is allowed.
 */
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - windowMs);

  await db
    .delete(rateLimit)
    .where(and(eq(rateLimit.bucket, bucket), lt(rateLimit.hitAt, cutoff)));

  const [counted] = await db
    .select({ hits: sql<number>`count(*)::int` })
    .from(rateLimit)
    .where(and(eq(rateLimit.bucket, bucket), gte(rateLimit.hitAt, cutoff)));

  if ((counted?.hits ?? 0) >= limit) return false;

  await db.insert(rateLimit).values({ bucket });
  return true;
}
