import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzlePglite<typeof schema>>;

let instance: Database | null = null;

/**
 * Postgres in every environment. PGlite runs the real engine in-process for
 * development and tests, Neon serves production — so the dialect, schema, and
 * queries never diverge between what is tested and what ships.
 */
export async function getDb(): Promise<Database> {
  if (instance) return instance;

  if (process.env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { neon } = await import("@neondatabase/serverless");
    instance = drizzle(neon(process.env.DATABASE_URL), {
      schema,
    }) as unknown as Database;
    return instance;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(process.env.PGLITE_PATH ?? "./.pglite");
  instance = drizzlePglite(client, { schema });
  await migrate(instance);
  return instance;
}

/**
 * Idempotent DDL. The schema is small enough that a migration toolchain would
 * cost more than it saves, and this keeps dev and test startup to one call.
 */
// gen_random_uuid() is core Postgres since 13, so no pgcrypto extension is
// needed — PGlite does not ship one anyway.
async function migrate(db: Database): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reference text NOT NULL UNIQUE,
      name text NOT NULL,
      phone text NOT NULL,
      email text NOT NULL,
      payment_method text NOT NULL,
      offer_code text NOT NULL,
      amount integer NOT NULL,
      proof_key text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      locale text NOT NULL,
      utm_source text, utm_medium text, utm_campaign text,
      utm_content text, utm_term text,
      referrer text, landing_page text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at);`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);`,
  );
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS rate_limit (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket text NOT NULL,
      hit_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS rate_limit_bucket_idx ON rate_limit (bucket, hit_at);`,
  );
}

/** Tests only: drops the cached handle so each file gets a fresh database. */
export function resetDbForTests(): void {
  instance = null;
}
