# Order Intake & Admin (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept orders with a payment-proof upload, persist them, and let the owner review and fulfil them from a password-protected admin page.

**Architecture:** A `POST /api/orders` route handler validates with a Zod schema shared by the browser and the server, sniffs the uploaded file's magic bytes, stores it through a storage adapter, and writes an order row via Drizzle. Persistence is Postgres in both environments — PGlite in dev and test, Neon in production — so the dialect, schema, and queries never diverge. The admin is a single shared password behind an HMAC-signed httpOnly cookie.

**Tech Stack:** Next.js 16, Drizzle ORM, PGlite (dev/test) / Neon (prod), Vercel Blob (prod) / local disk (dev), Zod, `node:crypto` for hashing and cookie signing.

**Spec:** `docs/superpowers/specs/2026-08-30-bilingual-ai-system-landing-design.md` (§7 order submission, §8 admin)

**Depends on:** Plan A (`2026-08-30-bilingual-landing-site.md`), complete. Task 9 replaces `OrderSection`'s placeholder body.

## Global Constraints

- **`amount` is resolved server-side** from `offerCode` via `amountFor()`. Never accepted from the client.
- **Never trust a declared MIME type.** Allowlist is JPEG/PNG/WebP, confirmed by magic bytes.
- **Max upload 6 MB**, rejected before the whole body is buffered.
- **Proof images are never served from a public URL.** Blob keys stay server-side; images stream through an authenticated admin route.
- **No secret is committed.** Every new key is documented in `.env.example` only.
- **Logical properties only** — the Plan A lint guard still applies to all new components.
- **Message parity still enforced** — every new string lands in both `ar.json` and `en.json`.
- **`/admin` is English-only** and sits outside the `[locale]` segment.
- **Commit after every task.**

---

## Task 1: Database foundation

**Files:**
- Create: `src/lib/schema.ts`, `src/lib/db.ts`, `drizzle.config.ts`
- Modify: `package.json`, `.env.example`, `.gitignore`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Produces: `orders` and `rateLimit` tables from `src/lib/schema.ts`; `getDb(): Promise<Database>` and `resetDbForTests()` from `src/lib/db.ts`

- [ ] **Step 1: Install dependencies**

```bash
npm install drizzle-orm zod @vercel/blob
npm install -D drizzle-kit @electric-sql/pglite
npm install @neondatabase/serverless
```

- [ ] **Step 2: Write the schema**

Create `src/lib/schema.ts`:

```ts
import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: text("reference").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    paymentMethod: text("payment_method").notNull(),
    offerCode: text("offer_code").notNull(),
    // Resolved server-side from offerCode. Never taken from the client.
    amount: integer("amount").notNull(),
    // Storage key, never exposed to any client.
    proofKey: text("proof_key").notNull(),
    status: text("status").notNull().default("pending"),
    locale: text("locale").notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    referrer: text("referrer"),
    landingPage: text("landing_page"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("orders_created_at_idx").on(table.createdAt),
    index("orders_status_idx").on(table.status),
  ],
);

/** Sliding-window counter. Vercel runs isolated instances, so an in-memory
 *  limiter would silently fail to limit anything. */
export const rateLimit = pgTable(
  "rate_limit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bucket: text("bucket").notNull(),
    hitAt: timestamp("hit_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("rate_limit_bucket_idx").on(table.bucket, table.hitAt)],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
```

- [ ] **Step 3: Write the client**

Create `src/lib/db.ts`:

```ts
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzlePglite<typeof schema>>;

let instance: Database | null = null;

/**
 * Postgres in every environment. PGlite runs the real engine in-process for
 * dev and tests, Neon serves production — so dialect, schema, and queries
 * never diverge between what is tested and what ships.
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

/** Idempotent DDL. Small enough that a migration toolchain would cost more
 *  than it saves, and it keeps dev and test startup to a single call. */
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
```

- [ ] **Step 4: Write the failing test**

Create `tests/db/schema.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb, resetDbForTests } from "@/lib/db";
import { orders } from "@/lib/schema";

afterEach(() => resetDbForTests());

describe("database", () => {
  it("creates the orders table with a working default id", async () => {
    const db = await getDb();
    const [row] = await db
      .insert(orders)
      .values({
        reference: `DA-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        name: "Test Buyer",
        phone: "01012345678",
        email: "buyer@example.com",
        paymentMethod: "instapay",
        offerCode: "main",
        amount: 999,
        proofKey: "orders/test.jpg",
        locale: "ar",
      })
      .returning();

    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.status).toBe("pending");
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("rejects a duplicate reference", async () => {
    const db = await getDb();
    const base = {
      reference: "DA-DUPE1",
      name: "A",
      phone: "01012345678",
      email: "a@example.com",
      paymentMethod: "instapay",
      offerCode: "main" as const,
      amount: 999,
      proofKey: "orders/a.jpg",
      locale: "ar",
    };

    await db.insert(orders).values(base);
    await expect(db.insert(orders).values(base)).rejects.toThrow();
  });

  it("creates the rate_limit table", async () => {
    const db = await getDb();
    const result = await db.execute(
      sql`SELECT to_regclass('public.rate_limit') AS table_name`,
    );
    const rows = (result as unknown as { rows: { table_name: string }[] }).rows;
    expect(rows[0].table_name).toBe("rate_limit");
  });
});
```

- [ ] **Step 5: Point tests at a throwaway database**

Add to `vitest.setup.ts`:

```ts
// Each run gets its own on-disk PGlite directory, removed by the gitignore
// rather than left to collide between runs.
process.env.PGLITE_PATH = `./.pglite-test`;
delete process.env.DATABASE_URL;
```

Add to `.gitignore`:

```
.pglite
.pglite-test
.uploads
```

- [ ] **Step 6: Run the test**

Run: `rm -rf .pglite-test && npm test -- tests/db/schema.test.ts`
Expected: PASS — 3 tests. If `gen_random_uuid()` is missing, add `CREATE EXTENSION IF NOT EXISTS pgcrypto;` as the first statement in `migrate`.

- [ ] **Step 7: Document the environment**

Append to `.env.example`:

```bash
# Postgres connection string. Leave unset in development and tests to use an
# in-process PGlite database instead.
DATABASE_URL=

# Vercel Blob. Leave unset in development to store uploads on local disk.
BLOB_READ_WRITE_TOKEN=

# Admin access. Generate the hash with: npm run admin:hash -- 'your password'
ADMIN_PASSWORD_HASH=
SESSION_SECRET=
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Postgres schema and dual-driver database client"
```

---

## Task 2: Validation, offer resolution, and order references

**Files:**
- Create: `src/lib/validation.ts`, `src/lib/reference.ts`
- Test: `tests/lib/validation.test.ts`, `tests/lib/reference.test.ts`

**Interfaces:**
- Produces: `orderFieldsSchema`, `type OrderFields`, `PAYMENT_METHODS`, `OFFER_CODES` from `src/lib/validation.ts`; `makeReference(): string` from `src/lib/reference.ts`

- [ ] **Step 1: Write the failing validation test**

Create `tests/lib/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { orderFieldsSchema } from "@/lib/validation";

const valid = {
  name: "Mostafa Hassib",
  phone: "01012345678",
  email: "buyer@example.com",
  paymentMethod: "instapay",
  offerCode: "main",
  locale: "ar",
};

describe("orderFieldsSchema", () => {
  it("accepts a well-formed order", () => {
    expect(orderFieldsSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["01012345678", "01112345678", "01212345678", "01512345678"])(
    "accepts the Egyptian mobile prefix %s",
    (phone) => {
      expect(orderFieldsSchema.safeParse({ ...valid, phone }).success).toBe(true);
    },
  );

  it.each([
    ["too short", "0101234567"],
    ["too long", "010123456789"],
    ["wrong prefix", "01312345678"],
    ["not a mobile", "0221234567"],
    ["letters", "0101234567a"],
  ])("rejects a phone that is %s", (_label, phone) => {
    expect(orderFieldsSchema.safeParse({ ...valid, phone }).success).toBe(false);
  });

  it("trims surrounding whitespace from the name", () => {
    const parsed = orderFieldsSchema.parse({ ...valid, name: "  Sara  " });
    expect(parsed.name).toBe("Sara");
  });

  it("rejects a name that is only whitespace", () => {
    expect(orderFieldsSchema.safeParse({ ...valid, name: "   " }).success).toBe(
      false,
    );
  });

  it("lowercases the email so duplicates collapse", () => {
    const parsed = orderFieldsSchema.parse({ ...valid, email: "A@Example.COM" });
    expect(parsed.email).toBe("a@example.com");
  });

  it("rejects a malformed email", () => {
    expect(
      orderFieldsSchema.safeParse({ ...valid, email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("rejects an unknown payment method", () => {
    expect(
      orderFieldsSchema.safeParse({ ...valid, paymentMethod: "bitcoin" }).success,
    ).toBe(false);
  });

  it("rejects an unknown offer code", () => {
    expect(
      orderFieldsSchema.safeParse({ ...valid, offerCode: "free" }).success,
    ).toBe(false);
  });

  it("ignores any amount supplied by the client", () => {
    const parsed = orderFieldsSchema.parse({ ...valid, amount: 1 });
    expect(parsed).not.toHaveProperty("amount");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/lib/validation.test.ts`
Expected: FAIL — `Cannot find module '@/lib/validation'`.

- [ ] **Step 3: Implement validation**

Create `src/lib/validation.ts`:

```ts
import { z } from "zod";

export const PAYMENT_METHODS = ["instapay", "etisalat"] as const;
export const OFFER_CODES = ["main", "exit60", "mini"] as const;

/** Egyptian mobile numbers: 010, 011, 012, and 015, then eight digits. */
const EGYPT_MOBILE = /^01[0125]\d{8}$/;

export const MAX_PROOF_BYTES = 6 * 1024 * 1024;

export const orderFieldsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(EGYPT_MOBILE, "invalid_phone"),
  email: z.string().trim().toLowerCase().email().max(120),
  paymentMethod: z.enum(PAYMENT_METHODS),
  offerCode: z.enum(OFFER_CODES),
  locale: z.enum(["ar", "en"]),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
  utmContent: z.string().trim().max(120).optional(),
  utmTerm: z.string().trim().max(120).optional(),
  referrer: z.string().trim().max(500).optional(),
  landingPage: z.string().trim().max(500).optional(),
});

export type OrderFields = z.infer<typeof orderFieldsSchema>;
```

> `amount` is deliberately absent. Zod strips unknown keys by default, so a
> client that submits one is ignored rather than trusted.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/lib/validation.test.ts`
Expected: PASS — 15 tests.

- [ ] **Step 5: Write the failing reference test**

Create `tests/lib/reference.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeReference } from "@/lib/reference";

describe("makeReference", () => {
  it("produces a quotable DA-XXXXX code", () => {
    expect(makeReference()).toMatch(/^DA-[0-9A-Z]{5}$/);
  });

  it("omits characters that are misread aloud", () => {
    const sample = Array.from({ length: 400 }, makeReference).join("");
    expect(sample).not.toMatch(/[OIL01]/);
  });

  it("does not repeat across a large sample", () => {
    const codes = new Set(Array.from({ length: 2000 }, makeReference));
    expect(codes.size).toBeGreaterThan(1990);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- tests/lib/reference.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the reference generator**

Create `src/lib/reference.ts`:

```ts
import { randomInt } from "node:crypto";

/** No O/I/L/0/1: customers read these over the phone to support. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function makeReference(): string {
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `DA-${code}`;
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm test -- tests/lib/reference.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add shared order validation and readable order references"
```

---

## Task 3: File-type sniffing and the storage adapter

**Files:**
- Create: `src/lib/file-type.ts`, `src/lib/storage.ts`
- Test: `tests/lib/file-type.test.ts`, `tests/lib/storage.test.ts`

**Interfaces:**
- Produces: `sniffImageType(bytes: Uint8Array): "jpeg" | "png" | "webp" | null` and `extensionFor(type)` from `src/lib/file-type.ts`; `putProof(bytes, ext): Promise<string>`, `getProof(key): Promise<Uint8Array | null>`, `deleteProof(key): Promise<void>` from `src/lib/storage.ts`

- [ ] **Step 1: Write the failing sniff test**

Create `tests/lib/file-type.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extensionFor, sniffImageType } from "@/lib/file-type";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function webp(): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  bytes.set([0x24, 0x00, 0x00, 0x00], 4); // size
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  return bytes;
}

describe("sniffImageType", () => {
  it("identifies JPEG, PNG, and WebP by their magic bytes", () => {
    expect(sniffImageType(jpeg)).toBe("jpeg");
    expect(sniffImageType(png)).toBe("png");
    expect(sniffImageType(webp())).toBe("webp");
  });

  it("rejects a PHP script that claims to be a JPEG", () => {
    const payload = new TextEncoder().encode("<?php system($_GET['c']); ?>");
    expect(sniffImageType(payload)).toBeNull();
  });

  it("rejects a GIF, which is not on the allowlist", () => {
    const gif = new TextEncoder().encode("GIF89a-----------");
    expect(sniffImageType(gif)).toBeNull();
  });

  it("rejects a RIFF container that is not WebP", () => {
    const wav = webp();
    wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
    expect(sniffImageType(wav)).toBeNull();
  });

  it("rejects input too short to carry a signature", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });

  it("maps each accepted type to a file extension", () => {
    expect(extensionFor("jpeg")).toBe("jpg");
    expect(extensionFor("png")).toBe("png");
    expect(extensionFor("webp")).toBe("webp");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/lib/file-type.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement sniffing**

Create `src/lib/file-type.ts`:

```ts
export type ImageType = "jpeg" | "png" | "webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

function isAscii(bytes: Uint8Array, text: string, offset: number): boolean {
  return startsWith(
    bytes,
    [...text].map((char) => char.charCodeAt(0)),
    offset,
  );
}

/**
 * Identifies an image by its actual bytes. A client-supplied MIME type is a
 * claim, not evidence — trusting it is how this exact upload pattern gets
 * turned into arbitrary file hosting.
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length < 12) return null;

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  if (isAscii(bytes, "RIFF", 0) && isAscii(bytes, "WEBP", 8)) return "webp";

  return null;
}

export function extensionFor(type: ImageType): string {
  return type === "jpeg" ? "jpg" : type;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/lib/file-type.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Write the failing storage test**

Create `tests/lib/storage.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { deleteProof, getProof, putProof } from "@/lib/storage";

afterEach(async () => {
  await rm("./.uploads-test", { recursive: true, force: true });
});

describe("proof storage", () => {
  it("round-trips the exact bytes it was given", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const key = await putProof(bytes, "png");

    expect(await getProof(key)).toEqual(bytes);
  });

  it("namespaces keys under orders/ with the right extension", async () => {
    const key = await putProof(new Uint8Array([1]), "webp");
    expect(key).toMatch(/^orders\/[0-9a-f-]{36}\.webp$/);
  });

  it("gives every upload a distinct key", async () => {
    const a = await putProof(new Uint8Array([1]), "jpg");
    const b = await putProof(new Uint8Array([1]), "jpg");
    expect(a).not.toBe(b);
  });

  it("returns null for a key that was never stored", async () => {
    expect(await getProof("orders/missing.png")).toBeNull();
  });

  it("refuses to escape the storage root", async () => {
    await expect(getProof("../../etc/passwd")).rejects.toThrow();
  });

  it("removes a stored proof", async () => {
    const key = await putProof(new Uint8Array([9]), "png");
    await deleteProof(key);
    expect(await getProof(key)).toBeNull();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- tests/lib/storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the storage adapter**

Create `src/lib/storage.ts`:

```ts
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const KEY_PATTERN = /^orders\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

function localRoot(): string {
  return resolve(process.env.UPLOAD_DIR ?? "./.uploads");
}

/** Keys are generated, never client-supplied — but a traversal check costs
 *  nothing and this function is one refactor away from taking user input. */
function assertSafeKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(`Refusing unsafe storage key: ${key}`);
  }
}

function usingBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function putProof(
  bytes: Uint8Array,
  extension: string,
): Promise<string> {
  const key = `orders/${randomUUID()}.${extension}`;

  if (usingBlob()) {
    const { put } = await import("@vercel/blob");
    // Not "public": the key is unguessable, but proofs carry names, phone
    // numbers, and bank details, so they stream through an authed route only.
    await put(key, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return key;
  }

  const path = join(localRoot(), key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return key;
}

export async function getProof(key: string): Promise<Uint8Array | null> {
  assertSafeKey(key);

  if (usingBlob()) {
    const { head } = await import("@vercel/blob");
    try {
      const meta = await head(key, { token: process.env.BLOB_READ_WRITE_TOKEN });
      const response = await fetch(meta.url);
      if (!response.ok) return null;
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  try {
    return new Uint8Array(await readFile(join(localRoot(), key)));
  } catch {
    return null;
  }
}

export async function deleteProof(key: string): Promise<void> {
  assertSafeKey(key);

  if (usingBlob()) {
    const { del } = await import("@vercel/blob");
    await del(key, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return;
  }

  await rm(join(localRoot(), key), { force: true });
}
```

- [ ] **Step 8: Point tests at a throwaway upload directory**

Add to `vitest.setup.ts`:

```ts
process.env.UPLOAD_DIR = "./.uploads-test";
delete process.env.BLOB_READ_WRITE_TOKEN;
```

- [ ] **Step 9: Run it to verify it passes**

Run: `npm test -- tests/lib/storage.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add magic-byte image sniffing and a swappable proof store"
```

---

## Task 4: Rate limiting

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `tests/lib/rate-limit.test.ts`

**Interfaces:**
- Produces: `checkRateLimit(bucket: string, limit: number, windowMs: number): Promise<boolean>` from `src/lib/rate-limit.ts` — `true` when the request is allowed

- [ ] **Step 1: Write the failing test**

Create `tests/lib/rate-limit.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";
import { resetDbForTests } from "@/lib/db";

afterEach(() => resetDbForTests());

const unique = () => `bucket-${Math.random().toString(36).slice(2)}`;

describe("checkRateLimit", () => {
  it("allows requests up to the limit", async () => {
    const bucket = unique();
    expect(await checkRateLimit(bucket, 3, 60_000)).toBe(true);
    expect(await checkRateLimit(bucket, 3, 60_000)).toBe(true);
    expect(await checkRateLimit(bucket, 3, 60_000)).toBe(true);
  });

  it("blocks the request past the limit", async () => {
    const bucket = unique();
    for (let i = 0; i < 3; i += 1) await checkRateLimit(bucket, 3, 60_000);
    expect(await checkRateLimit(bucket, 3, 60_000)).toBe(false);
  });

  it("keeps buckets independent", async () => {
    const a = unique();
    const b = unique();
    for (let i = 0; i < 3; i += 1) await checkRateLimit(a, 3, 60_000);

    expect(await checkRateLimit(a, 3, 60_000)).toBe(false);
    expect(await checkRateLimit(b, 3, 60_000)).toBe(true);
  });

  it("forgets hits that fall outside the window", async () => {
    const bucket = unique();
    for (let i = 0; i < 3; i += 1) await checkRateLimit(bucket, 3, 60_000);
    expect(await checkRateLimit(bucket, 3, 60_000)).toBe(false);

    // A zero-length window means every prior hit is already expired.
    expect(await checkRateLimit(bucket, 3, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/lib/rate-limit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the limiter**

Create `src/lib/rate-limit.ts`:

```ts
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/lib/rate-limit.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Postgres-backed sliding-window rate limiting"
```

---

## Task 5: The order submission endpoint

**Files:**
- Create: `src/app/api/orders/route.ts`, `src/lib/orders.ts`
- Test: `tests/api/orders.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4, plus `amountFor` from `src/config/pricing.ts`
- Produces: `createOrder(form: FormData, ip: string): Promise<OrderResult>` from `src/lib/orders.ts`, where `OrderResult` is `{ ok: true; reference: string } | { ok: false; status: number; error: string }`

The logic lives in `src/lib/orders.ts` so it can be tested directly with a `FormData`, rather than only through an HTTP round trip.

- [ ] **Step 1: Write the failing test**

Create `tests/api/orders.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createOrder } from "@/lib/orders";
import { getDb, resetDbForTests } from "@/lib/db";
import { orders } from "@/lib/schema";
import { PRICING } from "@/config/pricing";

afterEach(async () => {
  resetDbForTests();
  await rm("./.uploads-test", { recursive: true, force: true });
});

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

function form(overrides: Record<string, string> = {}, file?: File): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    name: "Mostafa Hassib",
    phone: "01012345678",
    email: "buyer@example.com",
    paymentMethod: "instapay",
    offerCode: "main",
    locale: "ar",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  data.set(
    "proof",
    file ?? new File([PNG], "transfer.png", { type: "image/png" }),
  );
  return data;
}

/** A fresh IP per test keeps the rate limiter from leaking between cases. */
const ip = () => `10.0.0.${Math.floor(Math.random() * 250) + 1}-${Math.random()}`;

describe("createOrder", () => {
  it("accepts a valid order and returns a reference", async () => {
    const result = await createOrder(form(), ip());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reference).toMatch(/^DA-[0-9A-Z]{5}$/);
  });

  it("persists the order with a server-resolved amount", async () => {
    const result = await createOrder(form({ offerCode: "mini" }), ip());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const db = await getDb();
    const [row] = await db
      .select()
      .from(orders)
      .where(eq(orders.reference, result.reference));

    expect(row.amount).toBe(PRICING.mini);
    expect(row.status).toBe("pending");
    expect(row.proofKey).toMatch(/^orders\//);
  });

  it("ignores an amount supplied by the client", async () => {
    const data = form();
    data.set("amount", "1");

    const result = await createOrder(data, ip());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const db = await getDb();
    const [row] = await db
      .select()
      .from(orders)
      .where(eq(orders.reference, result.reference));

    expect(row.amount).toBe(PRICING.main);
  });

  it("captures attribution fields when present", async () => {
    const result = await createOrder(
      form({ utmSource: "tiktok", utmCampaign: "launch", referrer: "https://t.co/x" }),
      ip(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const db = await getDb();
    const [row] = await db
      .select()
      .from(orders)
      .where(eq(orders.reference, result.reference));

    expect(row.utmSource).toBe("tiktok");
    expect(row.utmCampaign).toBe("launch");
    expect(row.referrer).toBe("https://t.co/x");
  });

  it("rejects an invalid phone number", async () => {
    const result = await createOrder(form({ phone: "12345" }), ip());
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("rejects a missing proof file", async () => {
    const data = form();
    data.delete("proof");

    const result = await createOrder(data, ip());
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("rejects a disguised non-image", async () => {
    const payload = new TextEncoder().encode("<?php system($_GET['c']); ?>");
    const disguised = new File([payload], "transfer.png", { type: "image/png" });

    const result = await createOrder(form({}, disguised), ip());
    expect(result).toMatchObject({ ok: false, status: 415 });
  });

  it("rejects a file over the size limit", async () => {
    const huge = new File([new Uint8Array(6 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });

    const result = await createOrder(form({}, huge), ip());
    expect(result).toMatchObject({ ok: false, status: 413 });
  });

  it("stores nothing when validation fails", async () => {
    const before = (await (await getDb()).select().from(orders)).length;
    await createOrder(form({ email: "nope" }), ip());
    const after = (await (await getDb()).select().from(orders)).length;

    expect(after).toBe(before);
  });

  it("rate-limits repeated submissions from one address", async () => {
    const address = ip();
    const results = [];
    for (let i = 0; i < 7; i += 1) results.push(await createOrder(form(), address));

    expect(results.some((r) => !r.ok && r.status === 429)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/api/orders.test.ts`
Expected: FAIL — `Cannot find module '@/lib/orders'`.

- [ ] **Step 3: Implement the order pipeline**

Create `src/lib/orders.ts`:

```ts
import { amountFor } from "@/config/pricing";
import { getDb } from "./db";
import { orders } from "./schema";
import { checkRateLimit } from "./rate-limit";
import { extensionFor, sniffImageType } from "./file-type";
import { makeReference } from "./reference";
import { putProof } from "./storage";
import { MAX_PROOF_BYTES, orderFieldsSchema } from "./validation";

export type OrderResult =
  | { ok: true; reference: string }
  | { ok: false; status: number; error: string };

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function text(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export async function createOrder(
  form: FormData,
  ip: string,
): Promise<OrderResult> {
  // Cheapest rejection first, before parsing or buffering anything.
  const allowed = await checkRateLimit(`orders:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    return { ok: false, status: 429, error: "too_many_requests" };
  }

  const parsed = orderFieldsSchema.safeParse({
    name: text(form, "name"),
    phone: text(form, "phone"),
    email: text(form, "email"),
    paymentMethod: text(form, "paymentMethod"),
    offerCode: text(form, "offerCode"),
    locale: text(form, "locale"),
    utmSource: text(form, "utmSource"),
    utmMedium: text(form, "utmMedium"),
    utmCampaign: text(form, "utmCampaign"),
    utmContent: text(form, "utmContent"),
    utmTerm: text(form, "utmTerm"),
    referrer: text(form, "referrer"),
    landingPage: text(form, "landingPage"),
  });

  if (!parsed.success) {
    return { ok: false, status: 422, error: "invalid_fields" };
  }

  const proof = form.get("proof");
  if (!(proof instanceof File) || proof.size === 0) {
    return { ok: false, status: 422, error: "missing_proof" };
  }

  // Checked before reading the body into memory.
  if (proof.size > MAX_PROOF_BYTES) {
    return { ok: false, status: 413, error: "proof_too_large" };
  }

  const bytes = new Uint8Array(await proof.arrayBuffer());
  const imageType = sniffImageType(bytes);
  if (!imageType) {
    return { ok: false, status: 415, error: "unsupported_file" };
  }

  const proofKey = await putProof(bytes, extensionFor(imageType));
  const fields = parsed.data;

  const db = await getDb();
  const [row] = await db
    .insert(orders)
    .values({
      ...fields,
      reference: makeReference(),
      // Resolved here, never read from the request.
      amount: amountFor(fields.offerCode),
      proofKey,
    })
    .returning({ reference: orders.reference });

  return { ok: true, reference: row.reference };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/api/orders.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Add the route handler**

Create `src/app/api/orders/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";

export const runtime = "nodejs";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await createOrder(form, clientIp(request));

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ reference: result.reference }, { status: 201 });
}
```

- [ ] **Step 6: Verify the whole suite and build**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add order submission pipeline and API route"
```

---

## Task 6: Admin session and password hashing

**Files:**
- Create: `src/lib/session.ts`, `scripts/hash-password.mjs`
- Modify: `package.json`
- Test: `tests/lib/session.test.ts`

**Interfaces:**
- Produces: `hashPassword(password, salt?)`, `verifyPassword(password, stored)`, `signSession(payload)`, `verifySession(token)`, `SESSION_COOKIE` from `src/lib/session.ts`

Uses `node:crypto` scrypt and HMAC rather than adding bcrypt or a JWT library — one shared password does not justify either.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/session.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  hashPassword,
  signSession,
  verifyPassword,
  verifySession,
} from "@/lib/session";

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-value-at-least-32-chars-long";
});

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("never stores the password in the hash", async () => {
    const stored = await hashPassword("hunter2");
    expect(stored).not.toContain("hunter2");
  });

  it("rejects a malformed stored hash rather than throwing", async () => {
    expect(await verifyPassword("x", "not-a-valid-hash")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const token = signSession({ sub: "admin" });
    expect(verifySession(token)).toMatchObject({ sub: "admin" });
  });

  it("rejects a tampered payload", () => {
    const token = signSession({ sub: "admin" });
    const [payload, signature] = token.split(".");
    const forged = `${Buffer.from('{"sub":"root"}').toString("base64url")}.${signature}`;

    expect(verifySession(forged)).toBeNull();
    expect(payload).not.toBe("");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSession({ sub: "admin" });
    process.env.SESSION_SECRET = "a-completely-different-secret-value-here";

    expect(verifySession(token)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signSession({ sub: "admin" }, -1000);
    expect(verifySession(token)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifySession("")).toBeNull();
    expect(verifySession("nonsense")).toBeNull();
    expect(verifySession("a.b.c")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/lib/session.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement sessions**

Create `src/lib/session.ts`:

```ts
import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const KEY_LENGTH = 64;

export async function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
): Promise<string> {
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, salt, digest] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !digest) return false;

  const derived = await scrypt(password, salt, KEY_LENGTH);
  const expected = Buffer.from(digest, "hex");

  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signSession(
  claims: Record<string, unknown>,
  maxAgeMs: number = SESSION_MAX_AGE_MS,
): string {
  const body = JSON.stringify({ ...claims, exp: Date.now() + maxAgeMs });
  const payload = Buffer.from(body).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySession(
  token: string,
): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expected = sign(payload);

  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof claims.exp !== "number" || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/lib/session.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Add the hashing helper**

Create `scripts/hash-password.mjs`:

```js
import { hashPassword } from "../src/lib/session.ts";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npm run admin:hash -- 'your password'");
  process.exit(1);
}

console.log(await hashPassword(password));
```

Add to `package.json` scripts:

```json
"admin:hash": "node --experimental-strip-types scripts/hash-password.mjs"
```

- [ ] **Step 6: Verify it produces a usable hash**

Run: `npm run admin:hash -- 'test password'`
Expected: a line beginning `scrypt$`. If `--experimental-strip-types` is unavailable, change the script to import from a compiled path or inline the scrypt call.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add scrypt password hashing and HMAC session tokens"
```

---

## Task 7: Admin login, guard, and order list

**Files:**
- Create: `src/app/(admin)/admin/layout.tsx`, `src/app/(admin)/admin/page.tsx`, `src/app/(admin)/admin/actions.ts`, `src/app/(admin)/admin/orders/page.tsx`, `src/lib/admin-guard.ts`
- Test: `tests/admin/guard.test.ts`

**Interfaces:**
- Consumes: `verifySession`, `verifyPassword`, `SESSION_COOKIE` (Task 6); `orders` (Task 1)
- Produces: `requireAdmin(): Promise<void>` from `src/lib/admin-guard.ts`; server actions `login(formData)`, `logout()`, `setStatus(id, status)`

- [ ] **Step 1: Write the failing guard test**

Create `tests/admin/guard.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/session";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => cookieStore.set(name, value),
    delete: (name: string) => cookieStore.delete(name),
  }),
}));

const redirected: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirected.push(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-value-at-least-32-chars-long";
  cookieStore.clear();
  redirected.length = 0;
});

describe("requireAdmin", () => {
  it("redirects to the login page without a session", async () => {
    const { requireAdmin } = await import("@/lib/admin-guard");
    await expect(requireAdmin()).rejects.toThrow(/REDIRECT:\/admin/);
  });

  it("redirects when the cookie fails verification", async () => {
    cookieStore.set("admin_session", "forged.token");
    const { requireAdmin } = await import("@/lib/admin-guard");
    await expect(requireAdmin()).rejects.toThrow(/REDIRECT:\/admin/);
  });

  it("allows a valid session through", async () => {
    cookieStore.set("admin_session", signSession({ sub: "admin" }));
    const { requireAdmin } = await import("@/lib/admin-guard");
    await expect(requireAdmin()).resolves.toBeUndefined();
  });

  it("redirects on an expired session", async () => {
    cookieStore.set("admin_session", signSession({ sub: "admin" }, -1000));
    const { requireAdmin } = await import("@/lib/admin-guard");
    await expect(requireAdmin()).rejects.toThrow(/REDIRECT:\/admin/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/admin/guard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the guard**

Create `src/lib/admin-guard.ts`:

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "./session";

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifySession(token) !== null;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin");
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/admin/guard.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Add the admin layout**

Create `src/app/(admin)/admin/layout.tsx`:

```tsx
import "../../globals.css";

export const metadata = {
  title: "Orders admin",
  // An operator tool, never an index target.
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body className="bg-bg text-ink-2 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Add the server actions**

Create `src/app/(admin)/admin/actions.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orders } from "@/lib/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  signSession,
  verifyPassword,
} from "@/lib/session";
import { requireAdmin } from "@/lib/admin-guard";

export async function login(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  // Same limiter as the order endpoint, so the login cannot be brute-forced.
  if (!(await checkRateLimit("admin-login", 10, 15 * 60 * 1000))) {
    return { error: "Too many attempts. Try again later." };
  }

  const password = String(formData.get("password") ?? "");
  const stored = process.env.ADMIN_PASSWORD_HASH;

  if (!stored) return { error: "Admin access is not configured." };
  if (!(await verifyPassword(password, stored))) {
    return { error: "Incorrect password." };
  }

  (await cookies()).set(SESSION_COOKIE, signSession({ sub: "admin" }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  redirect("/admin/orders");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin");
}

export async function setStatus(id: string, status: string): Promise<void> {
  await requireAdmin();

  if (!["pending", "confirmed", "rejected"].includes(status)) return;

  const db = await getDb();
  await db.update(orders).set({ status }).where(eq(orders.id, id));
  revalidatePath("/admin/orders");
}
```

- [ ] **Step 7: Add the login page**

Create `src/app/(admin)/admin/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function AdminLogin() {
  const [state, action, pending] = useActionState(login, {});

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-5">
      <Card className="w-full">
        <h1 className="text-xl font-bold text-ink">Orders admin</h1>
        <p className="mt-1 text-sm text-ink-3">Sign in to review orders.</p>

        <form action={action} className="mt-6 flex flex-col gap-3">
          <label className="text-xs font-semibold text-ink-2" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent"
          />

          {state?.error ? (
            <p role="alert" className="text-xs font-semibold text-danger">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" size="md" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
```

- [ ] **Step 8: Add the orders list**

Create `src/app/(admin)/admin/orders/page.tsx`:

```tsx
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orders } from "@/lib/schema";
import { requireAdmin } from "@/lib/admin-guard";
import { logout, setStatus } from "../actions";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-surface-2 text-ink-2",
  confirmed: "bg-success-soft text-success",
  rejected: "bg-surface text-danger",
};

export default async function AdminOrders() {
  await requireAdmin();

  const db = await getDb();
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));

  return (
    <main className="mx-auto max-w-page px-5 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Orders</h1>
          <p className="mt-1 text-sm text-ink-3">
            {rows.length} total ·{" "}
            {rows.filter((row) => row.status === "pending").length} awaiting review
          </p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="ghost" size="md">
            Sign out
          </Button>
        </form>
      </header>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-ink-3">No orders yet.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-card border-[1.5px] border-line-strong bg-surface p-5 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-ink">
                    {row.reference}
                  </p>
                  <p className="mt-1 text-sm text-ink">{row.name}</p>
                  <p className="text-xs text-ink-2">
                    {row.phone} · {row.email}
                  </p>
                  <p className="mt-1 text-xs text-ink-3">
                    {row.amount} EGP · {row.paymentMethod} · {row.offerCode} ·{" "}
                    {row.locale}
                  </p>
                  {row.utmSource ? (
                    <p className="mt-1 text-xs text-ink-3">
                      via {row.utmSource}
                      {row.utmCampaign ? ` / ${row.utmCampaign}` : ""}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-3">
                    {row.createdAt.toISOString()}
                  </p>
                </div>

                <a
                  href={`/admin/proof/${row.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                >
                  {/* Streams through an authenticated route, never a public URL. */}
                  <img
                    src={`/admin/proof/${row.id}`}
                    alt={`Payment proof for ${row.reference}`}
                    className="h-28 w-28 rounded-card border border-line object-cover"
                  />
                </a>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-control px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[row.status] ?? ""}`}
                >
                  {row.status}
                </span>

                {(["confirmed", "rejected", "pending"] as const)
                  .filter((status) => status !== row.status)
                  .map((status) => (
                    <form
                      key={status}
                      action={async () => {
                        "use server";
                        await setStatus(row.id, status);
                      }}
                    >
                      <Button type="submit" variant="ghost" size="md">
                        Mark {status}
                      </Button>
                    </form>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 9: Verify build and suite**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: all pass. `/admin` must not appear under the `[locale]` segment in the route list.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add admin login, session guard, and order review list"
```

---

## Task 8: Authenticated proof streaming

**Files:**
- Create: `src/app/(admin)/admin/proof/[id]/route.ts`
- Test: covered end to end in Task 11

**Interfaces:**
- Consumes: `isAdmin` (Task 7), `getProof` (Task 3), `orders` (Task 1)

- [ ] **Step 1: Implement the route**

Create `src/app/(admin)/admin/proof/[id]/route.ts`:

```ts
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orders } from "@/lib/schema";
import { isAdmin } from "@/lib/admin-guard";
import { getProof } from "@/lib/storage";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 401 before any lookup: an unauthenticated caller learns nothing about
  // which order ids exist.
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const db = await getDb();
  const [row] = await db
    .select({ proofKey: orders.proofKey })
    .from(orders)
    .where(eq(orders.id, id));

  if (!row) return new Response("Not found", { status: 404 });

  const bytes = await getProof(row.proofKey);
  if (!bytes) return new Response("Not found", { status: 404 });

  const extension = row.proofKey.split(".").pop() ?? "png";

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      // Customer bank details: never cached by a shared proxy.
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: stream payment proofs through an authenticated admin route"
```

---

## Task 9: The order form

**Files:**
- Create: `src/components/order/OrderForm.tsx`, `src/components/order/PaymentTabs.tsx`, `src/components/order/ProofUpload.tsx`, `src/components/order/OrderSummary.tsx`, `src/lib/attribution.ts`, `src/config/payment.ts`
- Modify: `src/components/sections/OrderSection.tsx`, `messages/ar.json`, `messages/en.json`
- Test: `tests/order/order-form.test.tsx`, `tests/lib/attribution.test.ts`

**Interfaces:**
- Consumes: `MAX_PROOF_BYTES` (Task 2), `PRICING` / `formatMoney` (Plan A)
- Produces: `<OrderForm />`, `captureAttribution()` and `readAttribution()` from `src/lib/attribution.ts`, `PAYMENT` from `src/config/payment.ts`

- [ ] **Step 1: Add payment configuration**

Create `src/config/payment.ts`:

```ts
/** Replace both with the owner's real destinations before launch. */
export const PAYMENT = {
  instapayUrl: process.env.NEXT_PUBLIC_INSTAPAY_URL ?? "",
  etisalatNumber: process.env.NEXT_PUBLIC_ETISALAT_NUMBER ?? "",
} as const;
```

Append to `.env.example`:

```bash
# Payment destinations shown on the order form.
NEXT_PUBLIC_INSTAPAY_URL=
NEXT_PUBLIC_ETISALAT_NUMBER=
```

- [ ] **Step 2: Write the failing attribution test**

Create `tests/lib/attribution.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { captureAttribution, readAttribution } from "@/lib/attribution";

beforeEach(() => sessionStorage.clear());

describe("attribution", () => {
  it("captures UTM parameters from the URL", () => {
    captureAttribution("https://x.test/ar?utm_source=tiktok&utm_campaign=launch", "");
    expect(readAttribution()).toMatchObject({
      utmSource: "tiktok",
      utmCampaign: "launch",
    });
  });

  it("keeps the first touch rather than overwriting it", () => {
    captureAttribution("https://x.test/ar?utm_source=tiktok", "");
    captureAttribution("https://x.test/ar?utm_source=facebook", "");
    expect(readAttribution().utmSource).toBe("tiktok");
  });

  it("records the referrer and landing page", () => {
    captureAttribution("https://x.test/ar?x=1", "https://t.co/abc");
    const data = readAttribution();
    expect(data.referrer).toBe("https://t.co/abc");
    expect(data.landingPage).toBe("https://x.test/ar?x=1");
  });

  it("returns an empty object before anything is captured", () => {
    expect(readAttribution()).toEqual({});
  });

  it("omits parameters that are absent", () => {
    captureAttribution("https://x.test/ar", "");
    expect(readAttribution().utmSource).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- tests/lib/attribution.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement attribution**

Create `src/lib/attribution.ts`:

```ts
const STORAGE_KEY = "attribution";

const UTM_KEYS = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_term: "utmTerm",
} as const;

export type Attribution = Partial<
  Record<
    (typeof UTM_KEYS)[keyof typeof UTM_KEYS] | "referrer" | "landingPage",
    string
  >
>;

/**
 * First-touch attribution: the campaign that brought someone in is the one
 * that earned the order, so a later visit must not overwrite it.
 */
export function captureAttribution(href: string, referrer: string): void {
  if (sessionStorage.getItem(STORAGE_KEY)) return;

  const url = new URL(href);
  const data: Attribution = {};

  for (const [param, field] of Object.entries(UTM_KEYS)) {
    const value = url.searchParams.get(param);
    if (value) data[field as keyof Attribution] = value.slice(0, 120);
  }

  if (referrer) data.referrer = referrer.slice(0, 500);
  data.landingPage = href.slice(0, 500);

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function readAttribution(): Attribution {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -- tests/lib/attribution.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 6: Add the order messages**

Add an `orderForm` namespace to **both** message files. Arabic:

```json
"orderForm": {
  "summaryTitle": "ملخص الطلب",
  "productName": "نظام AI أوتوماتيك كامل",
  "includes": [
    "النظام الأوتوماتيكي الكامل",
    "شرح تشغيل خطوة بخطوة",
    "10 بونصات حصرية",
    "دعم فني مباشر",
    "تسليم فوري على Google Drive"
  ],
  "name": "الاسم الكامل",
  "phone": "رقم المحوّل منه",
  "email": "الإيميل لاستلام الملفات",
  "paymentMethod": "طريقة الدفع",
  "instapay": "💳 InstaPay",
  "etisalat": "📱 اتصالات كاش",
  "instapayHint": "ادفع عبر InstaPay ثم ارجع وارفع صورة التحويل.",
  "instapayOpen": "💳 افتح InstaPay دلوقتي",
  "etisalatHint": "حوّل على رقم اتصالات كاش ثم ارفع صورة التحويل.",
  "copy": "📋 انسخ",
  "copied": "تم النسخ",
  "proof": "صورة التحويل",
  "proofCta": "📤 اضغط وارفع إثبات الدفع",
  "proofHint": "JPG / PNG / WEBP — بحد أقصى 6MB",
  "proofTooLarge": "الملف أكبر من 6MB.",
  "proofWrongType": "لازم صورة JPG أو PNG أو WEBP.",
  "submit": "✅ أرسل الطلب واستلم السيستم",
  "submitting": "جاري الإرسال…",
  "required": "مطلوب",
  "invalidPhone": "رقم موبايل مصري غير صحيح.",
  "invalidEmail": "إيميل غير صحيح.",
  "errorGeneric": "حصلت مشكلة. حاول تاني.",
  "errorRateLimited": "محاولات كتير. استنى شوية وحاول تاني.",
  "trust": ["🔒 طلب آمن", "📦 تسليم فوري", "🛟 ضمان التشغيل"]
}
```

English mirrors it key-for-key, with five `includes` and three `trust` entries.

Add a `thanks` namespace to both. Arabic:

```json
"thanks": {
  "title": "تم استلام طلبك",
  "referenceLabel": "رقم الطلب",
  "body": "هنراجع التحويل ونبعتلك السيستم على الإيميل اللي كتبته. احتفظ برقم الطلب ده.",
  "back": "ارجع للصفحة"
}
```

- [ ] **Step 7: Verify parity**

Run: `npm test -- tests/i18n/message-parity.test.ts`
Expected: PASS.

- [ ] **Step 8: Write the failing form test**

Create `tests/order/order-form.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { OrderForm } from "@/components/order/OrderForm";
import messages from "../../messages/en.json";

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
}));

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrderForm />
    </NextIntlClientProvider>,
  );
}

const pngFile = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "proof.png", {
    type: "image/png",
  });

beforeEach(() => {
  push.mockReset();
  sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ reference: "DA-AB123" }),
    })),
  );
});

describe("OrderForm", () => {
  it("renders the required fields", () => {
    renderForm();
    expect(screen.getByLabelText(new RegExp(messages.orderForm.name))).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(messages.orderForm.phone))).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(messages.orderForm.email))).toBeInTheDocument();
  });

  it("rejects a malformed phone before sending anything", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(new RegExp(messages.orderForm.name)), "Sara");
    await user.type(screen.getByLabelText(new RegExp(messages.orderForm.phone)), "12345");
    await user.type(
      screen.getByLabelText(new RegExp(messages.orderForm.email)),
      "sara@example.com",
    );
    await user.upload(screen.getByTestId("proof-input"), pngFile());
    await user.click(screen.getByRole("button", { name: new RegExp(messages.orderForm.submit) }));

    expect(await screen.findByText(messages.orderForm.invalidPhone)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an oversized file without sending it", async () => {
    const user = userEvent.setup();
    renderForm();

    const huge = new File([new Uint8Array(6 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });
    await user.upload(screen.getByTestId("proof-input"), huge);

    expect(
      await screen.findByText(messages.orderForm.proofTooLarge),
    ).toBeInTheDocument();
  });

  it("submits a valid order and routes to the confirmation", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(new RegExp(messages.orderForm.name)), "Sara");
    await user.type(
      screen.getByLabelText(new RegExp(messages.orderForm.phone)),
      "01012345678",
    );
    await user.type(
      screen.getByLabelText(new RegExp(messages.orderForm.email)),
      "sara@example.com",
    );
    await user.upload(screen.getByTestId("proof-input"), pngFile());
    await user.click(screen.getByRole("button", { name: new RegExp(messages.orderForm.submit) }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const body = (fetch as unknown as { mock: { calls: [string, RequestInit][] } })
      .mock.calls[0][1].body as FormData;

    expect(body.get("phone")).toBe("01012345678");
    expect(body.get("offerCode")).toBe("main");
    expect(body.get("proof")).toBeInstanceOf(File);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/thanks?ref=DA-AB123"));
  });

  it("never sends an amount", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(new RegExp(messages.orderForm.name)), "Sara");
    await user.type(
      screen.getByLabelText(new RegExp(messages.orderForm.phone)),
      "01012345678",
    );
    await user.type(
      screen.getByLabelText(new RegExp(messages.orderForm.email)),
      "sara@example.com",
    );
    await user.upload(screen.getByTestId("proof-input"), pngFile());
    await user.click(screen.getByRole("button", { name: new RegExp(messages.orderForm.submit) }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = (fetch as unknown as { mock: { calls: [string, RequestInit][] } })
      .mock.calls[0][1].body as FormData;

    expect(body.get("amount")).toBeNull();
  });

  it("surfaces a rate-limit response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: "too_many_requests" }),
      })),
    );

    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(new RegExp(messages.orderForm.name)), "Sara");
    await user.type(
      screen.getByLabelText(new RegExp(messages.orderForm.phone)),
      "01012345678",
    );
    await user.type(
      screen.getByLabelText(new RegExp(messages.orderForm.email)),
      "sara@example.com",
    );
    await user.upload(screen.getByTestId("proof-input"), pngFile());
    await user.click(screen.getByRole("button", { name: new RegExp(messages.orderForm.submit) }));

    expect(
      await screen.findByText(messages.orderForm.errorRateLimited),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 9: Run it to verify it fails**

Run: `npm test -- tests/order/order-form.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 10: Implement the form pieces**

Create `src/components/order/OrderSummary.tsx`:

```tsx
import { useLocale, useTranslations } from "next-intl";
import { PRICING } from "@/config/pricing";
import { formatMoney, formatNumber, percentOff } from "@/lib/format";
import type { Locale } from "@/lib/types";

export function OrderSummary() {
  const t = useTranslations("orderForm");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const includes = t.raw("includes") as string[];

  return (
    <div className="rounded-card border border-line bg-surface-2 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
        {t("summaryTitle")}
      </p>
      <p className="mt-2 text-sm font-bold text-ink">{t("productName")}</p>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-sm text-ink-3 line-through">
          {formatNumber(PRICING.original, locale)}
        </span>
        <span className="text-3xl font-bold text-ink">
          {formatNumber(PRICING.main, locale)}
        </span>
        <span className="text-sm font-semibold text-ink-2">{tc("currency")}</span>
      </p>

      <span className="mt-2 inline-flex rounded-control bg-success-soft px-2 py-1 text-xs font-bold text-success">
        −{percentOff(PRICING.original, PRICING.main)}% ·{" "}
        {formatMoney(PRICING.original - PRICING.main, locale, tc("currency"))}
      </span>

      <ul className="mt-4 flex flex-col gap-2">
        {includes.map((item) => (
          <li key={item} className="flex gap-2 text-xs text-ink-2">
            <span aria-hidden="true" className="text-success">
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Create `src/components/order/PaymentTabs.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PAYMENT } from "@/config/payment";

export type PaymentMethod = "instapay" | "etisalat";

export function PaymentTabs({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  const t = useTranslations("orderForm");
  const [copied, setCopied] = useState(false);

  const tabClass = (method: PaymentMethod) =>
    `flex-1 rounded-control border-[1.5px] px-3 py-2 text-xs font-semibold transition-colors ${
      value === method
        ? "border-line-strong bg-accent text-white"
        : "border-line bg-surface text-ink-2"
    }`;

  return (
    <div>
      <p className="text-xs font-semibold text-ink-2">{t("paymentMethod")}</p>

      <div role="tablist" className="mt-2 flex gap-2">
        {(["instapay", "etisalat"] as const).map((method) => (
          <button
            key={method}
            type="button"
            role="tab"
            aria-selected={value === method}
            onClick={() => onChange(method)}
            className={tabClass(method)}
          >
            {t(method)}
          </button>
        ))}
      </div>

      {value === "instapay" ? (
        <div className="mt-3 rounded-card border border-line bg-surface-2 p-4">
          <p className="text-xs text-ink-2">{t("instapayHint")}</p>
          {PAYMENT.instapayUrl ? (
            <a
              href={PAYMENT.instapayUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex rounded-control border-[1.5px] border-line-strong bg-surface px-3 py-2 text-xs font-bold text-ink"
            >
              {t("instapayOpen")}
            </a>
          ) : (
            <p className="mt-2 text-xs font-semibold text-danger">
              Replace: InstaPay payment link
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-card border border-line bg-surface-2 p-4">
          <p className="text-xs text-ink-2">{t("etisalatHint")}</p>
          {PAYMENT.etisalatNumber ? (
            <div className="mt-2 flex items-center gap-2">
              <span dir="ltr" className="font-mono text-sm font-bold text-ink">
                {PAYMENT.etisalatNumber}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(PAYMENT.etisalatNumber);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="rounded-control border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink"
              >
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs font-semibold text-danger">
              Replace: Etisalat Cash number
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

Create `src/components/order/ProofUpload.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_PROOF_BYTES } from "@/lib/validation";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function ProofUpload({
  file,
  onChange,
  error,
}: {
  file: File | null;
  onChange: (file: File | null, error?: string) => void;
  error?: string;
}) {
  const t = useTranslations("orderForm");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function accept(next: File | null) {
    if (!next) {
      setPreview(null);
      onChange(null);
      return;
    }

    // Client-side checks are for feedback only; the server re-checks the bytes.
    if (next.size > MAX_PROOF_BYTES) {
      setPreview(null);
      onChange(null, t("proofTooLarge"));
      return;
    }
    if (!ACCEPTED.includes(next.type)) {
      setPreview(null);
      onChange(null, t("proofWrongType"));
      return;
    }

    setPreview(URL.createObjectURL(next));
    onChange(next);
  }

  return (
    <div>
      <label htmlFor="proof" className="text-xs font-semibold text-ink-2">
        {t("proof")} *
      </label>

      <input
        ref={inputRef}
        id="proof"
        data-testid="proof-input"
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={(event) => accept(event.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-2 flex w-full flex-col items-center gap-2 rounded-card border-[1.5px] border-dashed border-line bg-surface-2 p-5 text-center"
      >
        {preview ? (
          <img
            src={preview}
            alt={file?.name ?? ""}
            className="max-h-40 rounded-card object-contain"
          />
        ) : (
          <span className="text-sm font-semibold text-ink-2">{t("proofCta")}</span>
        )}
        <span className="text-[11px] text-ink-3">{t("proofHint")}</span>
      </button>

      {file ? (
        <p className="mt-2 text-xs text-ink-3">{file.name}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 11: Implement the form itself**

Create `src/components/order/OrderForm.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { captureAttribution, readAttribution } from "@/lib/attribution";
import { OrderSummary } from "./OrderSummary";
import { PaymentTabs, type PaymentMethod } from "./PaymentTabs";
import { ProofUpload } from "./ProofUpload";

const EGYPT_MOBILE = /^01[0125]\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<"name" | "phone" | "email" | "proof" | "form", string>>;

export function OrderForm() {
  const t = useTranslations("orderForm");
  const locale = useLocale();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("instapay");
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    captureAttribution(window.location.href, document.referrer);
  }, []);

  function validate(): Errors {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = t("required");
    if (!EGYPT_MOBILE.test(phone.trim())) next.phone = t("invalidPhone");
    if (!EMAIL.test(email.trim())) next.email = t("invalidEmail");
    if (!proof) next.proof = t("required");
    return next;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSending(true);
    const body = new FormData();
    body.set("name", name.trim());
    body.set("phone", phone.trim());
    body.set("email", email.trim());
    body.set("paymentMethod", method);
    body.set("offerCode", "main");
    body.set("locale", locale);
    body.set("proof", proof!);

    for (const [key, value] of Object.entries(readAttribution())) {
      if (value) body.set(key, value);
    }
    // No amount is sent: the server resolves it from offerCode.

    try {
      const response = await fetch("/api/orders", { method: "POST", body });
      const data = await response.json();

      if (!response.ok) {
        setErrors({
          form:
            response.status === 429 ? t("errorRateLimited") : t("errorGeneric"),
        });
        return;
      }

      router.push(`/thanks?ref=${data.reference}`);
    } catch {
      setErrors({ form: t("errorGeneric") });
    } finally {
      setSending(false);
    }
  }

  const field =
    "mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
      <OrderSummary />

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="name" className="text-xs font-semibold text-ink-2">
            {t("name")} *
          </label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={field}
          />
          {errors.name ? (
            <p role="alert" className="mt-1 text-xs font-semibold text-danger">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="phone" className="text-xs font-semibold text-ink-2">
            {t("phone")} *
          </label>
          <input
            id="phone"
            inputMode="tel"
            dir="ltr"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={`${field} text-start`}
          />
          {errors.phone ? (
            <p role="alert" className="mt-1 text-xs font-semibold text-danger">
              {errors.phone}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="email" className="text-xs font-semibold text-ink-2">
            {t("email")} *
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={`${field} text-start`}
          />
          {errors.email ? (
            <p role="alert" className="mt-1 text-xs font-semibold text-danger">
              {errors.email}
            </p>
          ) : null}
        </div>

        <PaymentTabs value={method} onChange={setMethod} />

        <ProofUpload
          file={proof}
          error={errors.proof}
          onChange={(file, error) => {
            setProof(file);
            setErrors((current) => ({ ...current, proof: error }));
          }}
        />

        {errors.form ? (
          <p role="alert" className="text-xs font-semibold text-danger">
            {errors.form}
          </p>
        ) : null}

        <Button type="submit" disabled={sending}>
          {sending ? t("submitting") : t("submit")}
        </Button>

        <ul className="flex flex-wrap justify-center gap-3">
          {(t.raw("trust") as string[]).map((item) => (
            <li key={item} className="text-[11px] text-ink-3">
              {item}
            </li>
          ))}
        </ul>
      </form>
    </div>
  );
}
```

- [ ] **Step 12: Swap the placeholder for the real form**

In `src/components/sections/OrderSection.tsx`, replace the `<Card>` body with `<OrderForm />`, drop the now-unused `Card` import, add `import { OrderForm } from "@/components/order/OrderForm";`, and remove the `placeholder` key from both message files.

- [ ] **Step 13: Run the tests**

Run: `npm test -- tests/order/order-form.test.tsx tests/i18n/message-parity.test.ts`
Expected: PASS — 6 form tests plus parity.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: add the order form with validation, payment tabs, and proof upload"
```

---

## Task 10: The confirmation page

**Files:**
- Create: `src/app/[locale]/thanks/page.tsx`
- Test: covered end to end in Task 11

- [ ] **Step 1: Implement the page**

Create `src/app/[locale]/thanks/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  // A confirmation page has nothing to rank for and should not be indexed.
  robots: { index: false, follow: false },
};

export default async function ThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { ref } = await searchParams;
  const t = await getTranslations("thanks");

  return (
    <main className="mx-auto flex max-w-xl flex-col justify-center px-5 py-24">
      <Card className="text-center">
        <p aria-hidden="true" className="text-4xl">
          ✅
        </p>
        <h1 className="mt-4 text-2xl font-bold text-ink">{t("title")}</h1>

        {ref ? (
          <p className="mt-4">
            <span className="text-xs text-ink-3">{t("referenceLabel")}</span>
            <br />
            <span dir="ltr" className="font-mono text-xl font-bold text-ink">
              {ref}
            </span>
          </p>
        ) : null}

        <p className="mt-4 text-sm leading-relaxed text-ink-2">{t("body")}</p>

        <div className="mt-6">
          <Button as="a" href="/" size="md">
            {t("back")}
          </Button>
        </div>
      </Card>
    </main>
  );
}
```

> The back button uses a plain `href="/"` so the locale middleware re-negotiates; using `Link` here would require the locale-aware variant and gains nothing on a terminal page. If lint objects to the unused `Link` import, remove it.

- [ ] **Step 2: Verify build**

Run: `npm run typecheck && npm run build`
Expected: pass, with `/ar/thanks` and `/en/thanks` in the route list.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add the order confirmation page"
```

---

## Task 11: End-to-end coverage

**Files:**
- Create: `e2e/order.spec.ts`, `e2e/admin.spec.ts`, `e2e/fixtures/proof.png`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Give Playwright the env it needs**

The e2e server needs an admin password hash and a session secret. In `playwright.config.ts`, extend `webServer` with:

```ts
  webServer: {
    command: `npm run build && PORT=${PORT} npm run start`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      SESSION_SECRET: "e2e-session-secret-value-at-least-32-chars",
      // scrypt hash of "e2e-password", regenerate with: npm run admin:hash
      ADMIN_PASSWORD_HASH: process.env.E2E_ADMIN_HASH ?? "",
      PGLITE_PATH: "./.pglite-e2e",
      UPLOAD_DIR: "./.uploads-e2e",
      NEXT_PUBLIC_ETISALAT_NUMBER: "01000000000",
      NEXT_PUBLIC_INSTAPAY_URL: "https://example.com/instapay",
    },
  },
```

Generate the hash once and export it before running e2e:

```bash
export E2E_ADMIN_HASH="$(npm run --silent admin:hash -- 'e2e-password')"
```

Add `.pglite-e2e` and `.uploads-e2e` to `.gitignore`.

- [ ] **Step 2: Create the fixture image**

```bash
mkdir -p e2e/fixtures
node -e "
const zlib=require('zlib'),fs=require('fs');
function chunk(t,d){const c=Buffer.concat([Buffer.from(t),d]);const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const r=Buffer.alloc(4);r.writeUInt32BE(zlib.crc32?zlib.crc32(c):require('zlib').crc32(c));return Buffer.concat([l,c,r]);}
" 2>/dev/null || true
python3 -c "
import zlib, struct
w=h=8
raw=b''.join(b'\x00'+bytes([200,120,80])*w for _ in range(h))
def chunk(t,d):
    c=t+d
    return struct.pack('>I',len(d))+c+struct.pack('>I',zlib.crc32(c)&0xffffffff)
png=(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))
     +chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
open('e2e/fixtures/proof.png','wb').write(png)
print('fixture written')
"
```

- [ ] **Step 3: Write the order spec**

Create `e2e/order.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { join } from "node:path";

const FIXTURE = join(import.meta.dirname, "fixtures/proof.png");

test.describe("ordering", () => {
  test("submits an order and lands on the confirmation", async ({ page }) => {
    await page.goto("/en?utm_source=playwright&utm_campaign=e2e");

    await page.locator("#order").scrollIntoViewIfNeeded();
    await page.getByLabel(/Full name/i).fill("E2E Buyer");
    await page.getByLabel(/sender/i).fill("01012345678");
    await page.getByLabel(/email/i).fill("e2e@example.com");
    await page.getByTestId("proof-input").setInputFiles(FIXTURE);

    await page.getByRole("button", { name: /Send the order/i }).click();

    await expect(page).toHaveURL(/\/en\/thanks\?ref=DA-/);
    await expect(page.getByText(/DA-[0-9A-Z]{5}/)).toBeVisible();
  });

  test("blocks an invalid phone number client-side", async ({ page }) => {
    await page.goto("/en");
    await page.locator("#order").scrollIntoViewIfNeeded();

    await page.getByLabel(/Full name/i).fill("E2E Buyer");
    await page.getByLabel(/sender/i).fill("12345");
    await page.getByLabel(/email/i).fill("e2e@example.com");
    await page.getByTestId("proof-input").setInputFiles(FIXTURE);
    await page.getByRole("button", { name: /Send the order/i }).click();

    await expect(page).not.toHaveURL(/thanks/);
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("rejects a disguised non-image at the API", async ({ request }) => {
    const body = {
      name: "E2E Buyer",
      phone: "01012345678",
      email: "e2e@example.com",
      paymentMethod: "instapay",
      offerCode: "main",
      locale: "en",
    };

    const response = await request.post("/api/orders", {
      multipart: {
        ...body,
        proof: {
          name: "proof.png",
          mimeType: "image/png",
          buffer: Buffer.from("<?php system($_GET['c']); ?>"),
        },
      },
    });

    expect(response.status()).toBe(415);
  });

  test("ignores an amount supplied by the client", async ({ request }) => {
    const response = await request.post("/api/orders", {
      multipart: {
        name: "E2E Buyer",
        phone: "01012345678",
        email: "amount@example.com",
        paymentMethod: "instapay",
        offerCode: "main",
        locale: "en",
        amount: "1",
        proof: {
          name: "proof.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            await (await import("node:fs/promises")).readFile(FIXTURE),
          ),
        },
      },
    });

    expect(response.status()).toBe(201);
    // The stored amount is asserted in the admin spec, which can see it.
  });
});
```

- [ ] **Step 4: Write the admin spec**

Create `e2e/admin.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe("admin", () => {
  test("refuses proof access without a session", async ({ request }) => {
    const response = await request.get(
      "/admin/proof/00000000-0000-0000-0000-000000000000",
      { maxRedirects: 0 },
    );
    expect(response.status()).toBe(401);
  });

  test("sends an unauthenticated visitor to the login page", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("rejects the wrong password", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel(/password/i).fill("definitely-wrong");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("alert")).toContainText(/incorrect/i);
  });

  test("signs in and shows submitted orders", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel(/password/i).fill("e2e-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/admin\/orders/);
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  });

  test("is excluded from robots.txt", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Disallow: /admin");
  });
});
```

- [ ] **Step 5: Run the suite**

```bash
export E2E_ADMIN_HASH="$(npm run --silent admin:hash -- 'e2e-password')"
rm -rf .pglite-e2e .uploads-e2e
npm run e2e
```

Expected: all specs pass, including the 35 from Plan A. Any failure is a real defect — fix the code, not the assertion. If a label selector misses, align the test with the rendered label rather than loosening it to match anything.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add end-to-end coverage for ordering and admin review"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run everything**

```bash
rm -rf .pglite-test .uploads-test
npm test && npm run lint && npm run typecheck && npm run build
export E2E_ADMIN_HASH="$(npm run --silent admin:hash -- 'e2e-password')"
npm run e2e
```

- [ ] **Step 2: Re-run Lighthouse on both locales**

The order form adds a client island to the page, so the Plan A scores must be re-confirmed rather than assumed.

```bash
lsof -tiTCP:3100 -sTCP:LISTEN | xargs -r kill -9
rm -rf .next && npm run build
PORT=3100 npm run start &
# confirm the CSS chunk returns 200 before trusting any score
```

Expected: ≥90 in all four categories on `/ar` and `/en`, and zero colour-contrast failures — the new form fields and buttons must hold the corrected palette.

- [ ] **Step 3: Confirm no secret is committed**

```bash
git grep -nE "scrypt\\$|BLOB_READ_WRITE_TOKEN=.+|DATABASE_URL=.+" -- ':!*.md' || echo "clean"
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: final verification pass for order intake and admin"
```

---

## Definition of done

- [ ] A valid order submits, stores a row, and lands on `/thanks` with its reference
- [ ] `amount` is resolved server-side; a client-supplied amount is ignored
- [ ] A disguised non-image is rejected with 415; an oversized file with 413
- [ ] Repeated submissions from one address are rate-limited with 429
- [ ] `/admin` requires the password; `/admin/orders` lists orders newest-first
- [ ] Proof images return 401 without a session and stream with one
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run e2e` all pass
- [ ] Lighthouse still ≥90 in all four categories on both locales
- [ ] Message parity holds; every new string exists in both locales
- [ ] No secret committed; every new key documented in `.env.example`

---

## Open items for the owner

- Real InstaPay link and Etisalat Cash number (`NEXT_PUBLIC_*`)
- A production `DATABASE_URL` (Neon) and `BLOB_READ_WRITE_TOKEN` (Vercel Blob)
- An `ADMIN_PASSWORD_HASH` generated with `npm run admin:hash`
- A `SESSION_SECRET` of at least 32 random characters
- A decision on proof retention: these are customer bank screenshots, and keeping them
  indefinitely is a liability. `deleteProof` exists; a retention policy does not.
