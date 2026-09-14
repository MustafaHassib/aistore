# Admin Settings and Approval Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirming an order in the admin panel emails the customer a delivery link that the owner sets from an admin settings page, with failures recorded and retryable.

**Architecture:** A `settings` key-value table holds the link. A swappable email module picks Resend when configured and an in-process log driver otherwise, so dev and tests never send real mail. Approval logic lives in a plain module (`src/lib/approval.ts`) that server actions wrap, so it is unit-testable without mocking any Next.js API. The status write commits independently of the send, so a mail failure never blocks a financial decision.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM, Postgres (PGlite in dev/test, Neon in production), Zod v4, Resend, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-admin-settings-approval-email-design.md`

## Global Constraints

- **No decline email.** Only a transition into `confirmed` sends anything.
- **Email copy lives in code**, not in the database. Settings holds the link only.
- **One global link** for every approved order, under the settings key `delivery_link`.
- **`sendApprovalEmail` never throws.** It returns `{ ok: true } | { ok: false, error }`.
- **Approval always commits**, even when the send fails. `confirmed` is written before any send is attempted.
- **Re-confirming an already-confirmed order never resends.**
- **Tests never send real mail.** `RESEND_API_KEY` is deleted in `vitest.setup.ts` and absent from `playwright.config.ts`.
- **Every DDL statement is idempotent** (`IF NOT EXISTS`), because it runs on every PGlite boot and on every production deploy.
- **Locale fallback is `ar`**, the site's default, for any unrecognised value.
- **Admin UI copy is English only.** The admin panel is a single-operator tool and is not localised (see `src/app/(admin)/admin/layout.tsx`, which hardcodes `lang="en" dir="ltr"`).
- **Use CSS logical properties**, never `left`/`right`/`ml-`/`mr-`. `tests/lint/logical-properties.test.ts` enforces this and will fail the build otherwise.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `src/lib/schema.sql` | The single source of truth for DDL, shared by dev/test startup and the production script |
| `src/lib/migrate.ts` | Reads `schema.sql`, splits it, runs each statement through a caller-supplied executor |
| `scripts/migrate.mjs` | `npm run db:migrate` — applies `schema.sql` to `DATABASE_URL` |
| `src/lib/settings.ts` | `getSetting` / `setSetting` / `getDeliveryLink` |
| `src/lib/email-template.ts` | Bilingual subject, HTML, and plain-text bodies |
| `src/lib/email.ts` | Driver selection and `sendApprovalEmail` |
| `src/lib/approval.ts` | Status transition and delivery logic, free of Next.js APIs |
| `src/app/(admin)/admin/settings/page.tsx` | Reads the current link, renders the form |
| `src/app/(admin)/admin/settings/SettingsForm.tsx` | Client form bound to the save action |
| `src/components/admin/ProofViewer.tsx` | Full-size proof lightbox |

**Modified:**

| Path | Change |
|---|---|
| `src/lib/schema.ts` | Add `settings` table and three `orders` columns |
| `src/lib/db.ts` | Delegate DDL to `migrate.ts` via a dynamic import |
| `src/lib/validation.ts` | Add `deliveryLinkSchema` |
| `src/app/(admin)/admin/actions.ts` | Thin wrappers: `saveSettings`, `setStatus`, `resendApprovalEmail` |
| `src/app/(admin)/admin/orders/page.tsx` | Email state, Resend button, Settings link, lightbox |
| `vitest.setup.ts` | Delete `RESEND_API_KEY` |
| `.env.example` | `RESEND_API_KEY`, `EMAIL_FROM` |
| `package.json` | `resend` dependency, `db:migrate` script |

Why `approval.ts` is separate from `actions.ts`: `actions.ts` carries a `"use server"` directive and imports `next/headers` and `next/cache`. Putting the logic in a plain module means Task 6's tests need no module mocking at all, and the action file stays a three-line wrapper.

---

## Task 1: Database shape and a migration path that reaches production

**Files:**
- Create: `src/lib/schema.sql`, `src/lib/migrate.ts`, `scripts/migrate.mjs`
- Modify: `src/lib/schema.ts`, `src/lib/db.ts:36-90`, `package.json`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `runMigrations(execute: (statement: string) => Promise<unknown>): Promise<void>` from `@/lib/migrate`; `settings` table and `Settings`/`NewSettings` types from `@/lib/schema`; `orders.emailStatus`, `orders.emailSentAt`, `orders.emailError` columns.

**Why this task exists:** `migrate()` in `src/lib/db.ts:55` is only called on the PGlite branch of `connect()`. A production Neon database receives no DDL from this codebase at all, and no `drizzle.config.ts` is committed. Adding a table and three columns is impossible to deploy until this is fixed.

- [ ] **Step 1: Write the failing test**

Append to `tests/db/schema.test.ts`, inside the existing `describe("database", ...)` block:

```ts
  it("creates the settings table", async () => {
    const db = await getDb();
    const result = await db.execute(
      sql`SELECT to_regclass('public.settings') AS table_name`,
    );
    const rows = (result as unknown as { rows: { table_name: string }[] }).rows;
    expect(rows[0].table_name).toBe("settings");
  });

  it("stores a setting keyed by name", async () => {
    const db = await getDb();
    const [row] = await db
      .insert(settings)
      .values({ key: "delivery_link", value: "https://example.com/course" })
      .returning();

    expect(row.value).toBe("https://example.com/course");
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it("gives orders nullable email delivery columns", async () => {
    const db = await getDb();
    const [row] = await db
      .insert(orders)
      .values({
        reference: "DA-EMAIL",
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

    // Null, not a default: an order confirmed before this shipped was never
    // emailed, and that is what null means.
    expect(row.emailStatus).toBeNull();
    expect(row.emailSentAt).toBeNull();
    expect(row.emailError).toBeNull();
  });
```

Update the import at the top of the file from `import { orders } from "@/lib/schema";` to:

```ts
import { orders, settings } from "@/lib/schema";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/db/schema.test.ts`
Expected: FAIL — `settings` is not exported from `@/lib/schema`.

- [ ] **Step 3: Add the table and columns to the Drizzle schema**

In `src/lib/schema.ts`, add these three fields to the `orders` table definition, immediately after `landingPage`:

```ts
    // Null until a send is attempted; 'sent' or 'failed' afterwards.
    emailStatus: text("email_status"),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    // Provider message on failure. Shown to the admin only, never the customer.
    emailError: text("email_error"),
```

Then append the new table and types at the end of the file:

```ts
/**
 * Key-value rather than typed columns: the landing-page CMS project will add
 * many keys, and each one would otherwise be a schema change.
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
```

- [ ] **Step 4: Move the DDL into a shared SQL file**

Create `src/lib/schema.sql`. This is the single source of truth — `src/lib/migrate.ts` and `scripts/migrate.mjs` both read it, so dev, test, and production can never drift.

```sql
-- Idempotent DDL, applied on every PGlite boot and by `npm run db:migrate`.
-- Statements are split on semicolons, so this file must contain no semicolon
-- inside a string literal or a function body. Plain DDL only.
-- gen_random_uuid() is core Postgres since 13, so no pgcrypto extension is
-- needed -- PGlite does not ship one anyway.

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

ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_error text;

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  hit_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_bucket_idx ON rate_limit (bucket, hit_at);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 5: Create the migrate module**

Create `src/lib/migrate.ts`:

```ts
import { readFile } from "node:fs/promises";

/**
 * Takes an executor rather than a database handle so the caller decides how a
 * statement is run -- Drizzle in the app, a bare Neon client in the deploy
 * script. Keeping this module free of driver imports is what lets both use it.
 */
export async function runMigrations(
  execute: (statement: string) => Promise<unknown>,
): Promise<void> {
  for (const statement of await loadStatements()) {
    await execute(statement);
  }
}

export async function loadStatements(): Promise<string[]> {
  const source = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  return splitStatements(source);
}

/** Comments are stripped first so a trailing one does not become a statement. */
export function splitStatements(source: string): string[] {
  return source
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}
```

- [ ] **Step 6: Point db.ts at the new module**

In `src/lib/db.ts`, delete the entire `migrate()` function (currently `src/lib/db.ts:49-90`, the JSDoc block through the closing brace) and replace the PGlite branch of `connect()` with this:

```ts
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(process.env.PGLITE_PATH ?? "./.pglite");
  const db = drizzlePglite(client, { schema });

  // Dynamic, like the drivers above: migrate reads schema.sql off disk, which
  // only exists in dev and test. Production applies DDL with npm run db:migrate.
  const { runMigrations } = await import("./migrate");
  await runMigrations((statement) => db.execute(sql.raw(statement)));

  return db;
```

The existing `import { sql } from "drizzle-orm";` at the top stays — `sql.raw` needs it.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -- tests/db/schema.test.ts`
Expected: PASS, all six tests.

- [ ] **Step 8: Create the production migration script**

Create `scripts/migrate.mjs`. Standalone so it needs no bundler or TS loader, matching `scripts/hash-password.mjs`. The split logic is repeated here rather than imported because this file cannot import TypeScript; the SQL itself — the part that matters — is still shared.

```js
// Applies src/lib/schema.sql to DATABASE_URL. Run once per deploy that
// changes the schema. Every statement is idempotent, so re-running is safe.
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. Usage: DATABASE_URL=... npm run db:migrate");
  process.exit(1);
}

const source = await readFile(new URL("../src/lib/schema.sql", import.meta.url), "utf8");
const statements = source
  .replace(/^\s*--.*$/gm, "")
  .split(";")
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

const client = neon(url);
for (const statement of statements) {
  await client.query(statement);
  console.log(`ok: ${statement.split("\n")[0].slice(0, 70)}`);
}
console.log(`Applied ${statements.length} statements.`);
```

- [ ] **Step 9: Register the script**

In `package.json`, add to `"scripts"`, after `"admin:hash"`:

```json
    "db:migrate": "node scripts/migrate.mjs"
```

- [ ] **Step 10: Verify nothing else regressed**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. `tests/api/orders.test.ts` and `tests/lib/rate-limit.test.ts` exercise the same migration path and must still pass.

- [ ] **Step 11: Commit**

```bash
git add src/lib/schema.sql src/lib/migrate.ts src/lib/schema.ts src/lib/db.ts scripts/migrate.mjs package.json tests/db/schema.test.ts
git commit -m "feat: add settings table, order email columns, and a production migration path"
```

---

## Task 2: Settings accessor and delivery-link validation

**Files:**
- Create: `src/lib/settings.ts`
- Modify: `src/lib/validation.ts`
- Test: `tests/lib/settings.test.ts`, `tests/lib/validation.test.ts`

**Interfaces:**
- Consumes: `settings` table from `@/lib/schema` (Task 1).
- Produces: `DELIVERY_LINK_KEY: string`, `getSetting(key: string): Promise<string | null>`, `setSetting(key: string, value: string): Promise<void>`, `getDeliveryLink(): Promise<string | null>` from `@/lib/settings`; `deliveryLinkSchema` from `@/lib/validation`.

- [ ] **Step 1: Write the failing settings test**

Create `tests/lib/settings.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import {
  DELIVERY_LINK_KEY,
  getDeliveryLink,
  getSetting,
  setSetting,
} from "@/lib/settings";

afterEach(() => resetDbForTests());

describe("settings", () => {
  it("returns null for a key that was never set", async () => {
    expect(await getSetting("never_set")).toBeNull();
  });

  it("round-trips a value", async () => {
    await setSetting("delivery_link", "https://example.com/a");
    expect(await getSetting("delivery_link")).toBe("https://example.com/a");
  });

  it("overwrites rather than duplicating on a second write", async () => {
    await setSetting("delivery_link", "https://example.com/a");
    await setSetting("delivery_link", "https://example.com/b");
    expect(await getSetting("delivery_link")).toBe("https://example.com/b");
  });

  it("reads the delivery link through its named accessor", async () => {
    expect(await getDeliveryLink()).toBeNull();
    await setSetting(DELIVERY_LINK_KEY, "https://example.com/course");
    expect(await getDeliveryLink()).toBe("https://example.com/course");
  });
});
```

- [ ] **Step 2: Write the failing validation test**

Append to `tests/lib/validation.test.ts` a new top-level block:

```ts
describe("deliveryLinkSchema", () => {
  it("accepts an https URL", () => {
    expect(deliveryLinkSchema.parse("https://example.com/course")).toBe(
      "https://example.com/course",
    );
  });

  it("accepts an http URL", () => {
    expect(deliveryLinkSchema.safeParse("http://example.com").success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(deliveryLinkSchema.parse("  https://example.com  ")).toBe(
      "https://example.com",
    );
  });

  it("rejects a javascript: URL", () => {
    expect(deliveryLinkSchema.safeParse("javascript:alert(1)").success).toBe(false);
  });

  it("rejects a data: URL", () => {
    expect(deliveryLinkSchema.safeParse("data:text/html,<script>").success).toBe(
      false,
    );
  });

  it("rejects a relative path", () => {
    expect(deliveryLinkSchema.safeParse("/course").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(deliveryLinkSchema.safeParse("").success).toBe(false);
    expect(deliveryLinkSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects a URL longer than 2000 characters", () => {
    const long = `https://example.com/${"a".repeat(2000)}`;
    expect(deliveryLinkSchema.safeParse(long).success).toBe(false);
  });
});
```

Add `deliveryLinkSchema` to the existing import from `@/lib/validation` at the top of that file.

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npm test -- tests/lib/settings.test.ts tests/lib/validation.test.ts`
Expected: FAIL — neither `@/lib/settings` nor `deliveryLinkSchema` exists.

- [ ] **Step 4: Add the validation schema**

Append to `src/lib/validation.ts`:

```ts
/**
 * The admin pastes this and it goes straight into an email. Restricting the
 * protocol is what stops a javascript: or data: URL being mailed to customers.
 */
export const deliveryLinkSchema = z
  .string()
  .trim()
  .min(1, "required")
  .max(2000, "too_long")
  .refine((value) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return false;
    }
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  }, "invalid_url");
```

- [ ] **Step 5: Write the settings module**

Create `src/lib/settings.ts`:

```ts
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { settings } from "./schema";

export const DELIVERY_LINK_KEY = "delivery_link";

/**
 * Deliberately uncached. The admin pages are force-dynamic and the link is
 * read once per approval, so a stale read would cost more than the query saves.
 */
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function getDeliveryLink(): Promise<string | null> {
  return getSetting(DELIVERY_LINK_KEY);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- tests/lib/settings.test.ts tests/lib/validation.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/settings.ts src/lib/validation.ts tests/lib/settings.test.ts tests/lib/validation.test.ts
git commit -m "feat: add settings store and delivery-link validation"
```

---

## Task 3: Settings page and save action

**Files:**
- Create: `src/app/(admin)/admin/settings/page.tsx`
- Modify: `src/app/(admin)/admin/actions.ts`
- Test: `e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `getDeliveryLink`, `setSetting`, `DELIVERY_LINK_KEY` from `@/lib/settings`; `deliveryLinkSchema` from `@/lib/validation`; `requireAdmin` from `@/lib/admin-guard`.
- Produces: `SettingsState = { error?: string; saved?: boolean }` and `saveSettings(previous: SettingsState, formData: FormData): Promise<SettingsState>` from the admin actions module; the route `/admin/settings`.

- [ ] **Step 1: Write the failing end-to-end test**

Append to `e2e/admin.spec.ts`, inside `test.describe("admin", ...)`:

```ts
  test("saves and persists the delivery link", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel(/password/i).fill("e2e-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin\/orders/);

    await page.getByRole("link", { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/admin\/settings/);

    await page.getByLabel(/delivery link/i).fill("https://example.com/course");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByTestId("settings-saved")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel(/delivery link/i)).toHaveValue(
      "https://example.com/course",
    );
  });

  test("rejects a delivery link that is not http(s)", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel(/password/i).fill("e2e-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.goto("/admin/settings");
    await page.getByLabel(/delivery link/i).fill("javascript:alert(1)");
    await page.getByRole("button", { name: /save/i }).click();

    // Not getByRole("alert"): Next renders its own route announcer with that
    // role, so the locator would be ambiguous.
    await expect(page.getByTestId("settings-error")).toBeVisible();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run e2e -- e2e/admin.spec.ts --project=desktop`
Expected: FAIL — no Settings link exists on the orders page.

- [ ] **Step 3: Add the save action**

Append to `src/app/(admin)/admin/actions.ts`:

```ts
export type SettingsState = { error?: string; saved?: boolean };

export async function saveSettings(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();

  const parsed = deliveryLinkSchema.safeParse(
    String(formData.get("deliveryLink") ?? ""),
  );

  if (!parsed.success) {
    return { error: "Enter a full http:// or https:// link." };
  }

  await setSetting(DELIVERY_LINK_KEY, parsed.data);
  revalidatePath("/admin/orders");
  return { saved: true };
}
```

Add to the imports at the top of the same file:

```ts
import { DELIVERY_LINK_KEY, setSetting } from "@/lib/settings";
import { deliveryLinkSchema } from "@/lib/validation";
```

- [ ] **Step 4: Build the settings page**

Create `src/app/(admin)/admin/settings/page.tsx`. It is a server component that reads the current value and hands it to a client form, so the field is populated on load.

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { getDeliveryLink } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettings() {
  await requireAdmin();
  const deliveryLink = await getDeliveryLink();

  return (
    <main className="mx-auto max-w-page px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Settings</h1>
          <p className="mt-1 text-sm text-ink-3">
            The link every approved customer receives by email.
          </p>
        </div>
        <Link href="/admin/orders" className="text-sm font-semibold text-accent underline">
          Back to orders
        </Link>
      </header>

      <SettingsForm deliveryLink={deliveryLink ?? ""} />
    </main>
  );
}
```

- [ ] **Step 5: Build the form**

Create `src/app/(admin)/admin/settings/SettingsForm.tsx`, following the `useActionState` pattern already used by the login page:

```tsx
"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "../actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const initial: SettingsState = {};

export function SettingsForm({ deliveryLink }: { deliveryLink: string }) {
  const [state, action, pending] = useActionState(saveSettings, initial);

  return (
    <Card className="mt-8">
      <form action={action} className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-ink-2" htmlFor="deliveryLink">
          Delivery link
        </label>
        <input
          id="deliveryLink"
          name="deliveryLink"
          type="url"
          defaultValue={deliveryLink}
          placeholder="https://example.com/your-product"
          className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent"
        />
        <p className="text-xs text-ink-3">
          Approving an order emails this link to the customer. Approvals will be
          recorded as failed until it is set.
        </p>

        {state?.error ? (
          <p role="alert" data-testid="settings-error" className="text-xs font-semibold text-danger">
            {state.error}
          </p>
        ) : null}

        {state?.saved ? (
          <p data-testid="settings-saved" className="text-xs font-semibold text-success">
            Saved.
          </p>
        ) : null}

        <div>
          <Button type="submit" size="md" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
```

- [ ] **Step 6: Link Settings from the orders header**

In `src/app/(admin)/admin/orders/page.tsx`, replace the sign-out form in the header with a group holding both controls:

```tsx
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings"
            className="text-sm font-semibold text-accent underline"
          >
            Settings
          </Link>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="md">
              Sign out
            </Button>
          </form>
        </div>
```

Add `import Link from "next/link";` at the top of that file.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run e2e -- e2e/admin.spec.ts --project=desktop`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(admin)/admin/settings" "src/app/(admin)/admin/actions.ts" "src/app/(admin)/admin/orders/page.tsx" e2e/admin.spec.ts
git commit -m "feat: add admin settings page for the delivery link"
```

---

## Task 4: Bilingual email template

**Files:**
- Create: `src/lib/email-template.ts`
- Test: `tests/lib/email-template.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type EmailContent = { subject: string; html: string; text: string }` and `approvalEmail(input: { name: string; reference: string; locale: string; link: string }): EmailContent` from `@/lib/email-template`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/email-template.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { approvalEmail } from "@/lib/email-template";

const input = {
  name: "Sara",
  reference: "DA-AB123",
  locale: "en",
  link: "https://example.com/course",
};

describe("approvalEmail", () => {
  it("puts the link in both the HTML and the plain-text body", () => {
    const mail = approvalEmail(input);
    expect(mail.html).toContain("https://example.com/course");
    expect(mail.text).toContain("https://example.com/course");
  });

  it("includes the customer name and reference", () => {
    const mail = approvalEmail(input);
    expect(mail.html).toContain("Sara");
    expect(mail.subject).toContain("DA-AB123");
  });

  it("renders English for the en locale", () => {
    const mail = approvalEmail(input);
    expect(mail.html).toContain('lang="en"');
    expect(mail.html).toContain('dir="ltr"');
  });

  it("renders right-to-left Arabic for the ar locale", () => {
    const mail = approvalEmail({ ...input, locale: "ar" });
    expect(mail.html).toContain('lang="ar"');
    expect(mail.html).toContain('dir="rtl"');
    expect(mail.subject).toContain("تم تأكيد طلبك");
  });

  it("falls back to Arabic for an unrecognised locale", () => {
    const mail = approvalEmail({ ...input, locale: "fr" });
    expect(mail.html).toContain('lang="ar"');
  });

  it("escapes a name containing HTML so it cannot inject markup", () => {
    const mail = approvalEmail({ ...input, name: "<script>alert(1)</script>" });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/lib/email-template.test.ts`
Expected: FAIL — `@/lib/email-template` does not exist.

- [ ] **Step 3: Write the template module**

Create `src/lib/email-template.ts`. Inline styles and a single centred column, with no tables: email clients strip stylesheets, and tables are the main source of the RTL rendering differences flagged in the spec.

```ts
export type EmailContent = { subject: string; html: string; text: string };

type Copy = {
  subject: (reference: string) => string;
  greeting: (name: string) => string;
  body: string;
  cta: string;
  fallback: string;
  signoff: string;
};

const COPY: Record<"ar" | "en", Copy> = {
  en: {
    subject: (reference) => `Your order ${reference} is confirmed`,
    greeting: (name) => `Hi ${name},`,
    body: "We've confirmed your payment. Here's your access link:",
    cta: "Open your access link",
    fallback: "If the button doesn't work, copy this into your browser:",
    signoff: "Thanks for your order.",
  },
  ar: {
    subject: (reference) => `تم تأكيد طلبك ${reference}`,
    greeting: (name) => `مرحباً ${name}،`,
    body: "تم تأكيد الدفع الخاص بك. هذا هو رابط الوصول:",
    cta: "افتح رابط الوصول",
    fallback: "إذا لم يعمل الزر، انسخ هذا الرابط إلى متصفحك:",
    signoff: "شكراً لطلبك.",
  },
};

/** The site's default locale, and the fallback for anything unrecognised. */
function resolve(locale: string): "ar" | "en" {
  return locale === "en" ? "en" : "ar";
}

/**
 * Names come from a public form and land in an HTML document. Escaping is not
 * optional here.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function approvalEmail(input: {
  name: string;
  reference: string;
  locale: string;
  link: string;
}): EmailContent {
  const lang = resolve(input.locale);
  const copy = COPY[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const name = escapeHtml(input.name);
  const link = escapeHtml(input.link);
  const reference = escapeHtml(input.reference);

  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}">
<body style="margin:0;padding:24px;background:#f6f5f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1.5px solid #1a1a1a;border-radius:12px;padding:32px">
    <p style="margin:0 0 16px;font-size:16px">${copy.greeting(name)}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6">${copy.body}</p>
    <p style="margin:0 0 24px">
      <a href="${link}" style="display:inline-block;background:#c2543d;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:8px">${copy.cta}</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#6b6b6b">${copy.fallback}</p>
    <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${link}" style="color:#c2543d">${link}</a></p>
    <p style="margin:0;font-size:13px;color:#6b6b6b">${copy.signoff} — ${reference}</p>
  </div>
</body>
</html>`;

  const text = [
    copy.greeting(input.name),
    "",
    copy.body,
    input.link,
    "",
    `${copy.signoff} — ${input.reference}`,
  ].join("\n");

  return { subject: copy.subject(input.reference), html, text };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/lib/email-template.test.ts`
Expected: PASS, all six tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-template.ts tests/lib/email-template.test.ts
git commit -m "feat: add bilingual approval email template"
```

---

## Task 5: Email driver

**Files:**
- Create: `src/lib/email.ts`
- Modify: `vitest.setup.ts`, `.env.example`, `package.json`
- Test: `tests/lib/email.test.ts`

**Interfaces:**
- Consumes: `approvalEmail`, `EmailContent` from `@/lib/email-template` (Task 4).
- Produces: `type EmailResult = { ok: true } | { ok: false; error: string }`, `type SentEmail = { to: string; subject: string; html: string; text: string }`, `sendApprovalEmail(input: { to: string; name: string; reference: string; locale: string; link: string }): Promise<EmailResult>`, `sentEmails(): SentEmail[]`, `clearSentEmails(): void` from `@/lib/email`.

- [ ] **Step 1: Install the dependency**

Run: `npm install resend`

- [ ] **Step 2: Stop tests from ever reaching a real provider**

In `vitest.setup.ts`, alongside the existing deletions at the end of the file, add:

```ts
// Without this a developer's .env would make the whole suite send real mail.
delete process.env.RESEND_API_KEY;
```

- [ ] **Step 3: Write the failing test**

Create `tests/lib/email.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { clearSentEmails, sendApprovalEmail, sentEmails } from "@/lib/email";

const input = {
  to: "buyer@example.com",
  name: "Sara",
  reference: "DA-AB123",
  locale: "en",
  link: "https://example.com/course",
};

beforeEach(() => {
  clearSentEmails();
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

describe("sendApprovalEmail", () => {
  it("succeeds through the log driver when no API key is configured", async () => {
    expect(await sendApprovalEmail(input)).toEqual({ ok: true });
  });

  it("records what it would have sent", async () => {
    await sendApprovalEmail(input);

    const [mail] = sentEmails();
    expect(mail.to).toBe("buyer@example.com");
    expect(mail.subject).toContain("DA-AB123");
    expect(mail.html).toContain("https://example.com/course");
    expect(mail.text).toContain("https://example.com/course");
  });

  it("fails loudly when an API key is set but EMAIL_FROM is missing", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    const result = await sendApprovalEmail(input);
    expect(result).toEqual({ ok: false, error: "EMAIL_FROM is not set." });
    // A half-configured deployment must not silently fall back to logging.
    expect(sentEmails()).toHaveLength(0);
  });

  it("returns a failure rather than throwing when the provider errors", async () => {
    process.env.RESEND_API_KEY = "re_definitely_invalid_key";
    process.env.EMAIL_FROM = "Store <orders@example.com>";

    const result = await sendApprovalEmail(input);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- tests/lib/email.test.ts`
Expected: FAIL — `@/lib/email` does not exist.

- [ ] **Step 5: Write the email module**

Create `src/lib/email.ts`:

```ts
import { approvalEmail } from "./email-template";

export type EmailResult = { ok: true } | { ok: false; error: string };

export type SentEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * On globalThis for the same reason the database handle is: Next bundles route
 * handlers and server actions into separate chunks, so a module-level array
 * would give each chunk its own buffer.
 */
const globalForEmail = globalThis as typeof globalThis & {
  __sentEmails?: SentEmail[];
};

export function sentEmails(): SentEmail[] {
  return (globalForEmail.__sentEmails ??= []);
}

export function clearSentEmails(): void {
  globalForEmail.__sentEmails = [];
}

/**
 * Never throws. The caller's contract is that approval commits regardless of
 * what the mail provider does, so every failure comes back as a value.
 */
export async function sendApprovalEmail(input: {
  to: string;
  name: string;
  reference: string;
  locale: string;
  link: string;
}): Promise<EmailResult> {
  const content = approvalEmail(input);
  const apiKey = process.env.RESEND_API_KEY;

  // Log driver: development, tests, and any environment without a provider.
  if (!apiKey) {
    sentEmails().push({ to: input.to, ...content });
    console.info(`[email] would send "${content.subject}" to ${input.to}`);
    return { ok: true };
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    // Deliberately not a fall back to logging: a half-configured production
    // deploy must surface as visible failed sends, not as mail nobody gets.
    return { ok: false, error: "EMAIL_FROM is not set." };
  }

  try {
    // Dynamic, like the Neon and Blob drivers, so it is never bundled into
    // environments that do not use it.
    const { Resend } = await import("resend");
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: input.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- tests/lib/email.test.ts`
Expected: PASS, all four tests.

- [ ] **Step 7: Document the configuration**

Append to `.env.example`:

```
# Resend. Leave unset in development and tests to log emails instead of sending.
RESEND_API_KEY=
# Verified sender, e.g. "Store <orders@yourdomain.com>". Required whenever
# RESEND_API_KEY is set — approvals are recorded as failed without it.
EMAIL_FROM=
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/email.ts tests/lib/email.test.ts vitest.setup.ts .env.example package.json package-lock.json
git commit -m "feat: add swappable email driver with Resend and a log fallback"
```

---

## Task 6: Approval flow

**Files:**
- Create: `src/lib/approval.ts`
- Modify: `src/app/(admin)/admin/actions.ts:60-70`
- Test: `tests/lib/approval.test.ts`

**Interfaces:**
- Consumes: `getDeliveryLink` from `@/lib/settings` (Task 2); `sendApprovalEmail`, `sentEmails`, `clearSentEmails` from `@/lib/email` (Task 5); `orders`, `Order` from `@/lib/schema` (Task 1).
- Produces: `ORDER_STATUSES: readonly ["pending", "confirmed", "rejected"]`, `applyStatus(id: string, status: string): Promise<void>`, `resendApproval(id: string): Promise<void>` from `@/lib/approval`; `resendApprovalEmail(id: string): Promise<void>` from the admin actions module.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/approval.test.ts`. Note there is no module mocking here at all — that is the reason the logic lives outside the `"use server"` file.

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, resetDbForTests } from "@/lib/db";
import { orders } from "@/lib/schema";
import { clearSentEmails, sentEmails } from "@/lib/email";
import { DELIVERY_LINK_KEY, setSetting } from "@/lib/settings";
import { applyStatus, resendApproval } from "@/lib/approval";

let counter = 0;

async function seedOrder() {
  const db = await getDb();
  const [row] = await db
    .insert(orders)
    .values({
      reference: `DA-T${(counter++).toString().padStart(4, "0")}`,
      name: "Sara",
      phone: "01012345678",
      email: "buyer@example.com",
      paymentMethod: "instapay",
      offerCode: "main",
      amount: 999,
      proofKey: "orders/test.jpg",
      locale: "en",
    })
    .returning();
  return row;
}

async function reload(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return row;
}

beforeEach(() => clearSentEmails());
afterEach(() => resetDbForTests());

describe("applyStatus", () => {
  it("sends the approval email when an order becomes confirmed", async () => {
    await setSetting(DELIVERY_LINK_KEY, "https://example.com/course");
    const order = await seedOrder();

    await applyStatus(order.id, "confirmed");

    expect(sentEmails()).toHaveLength(1);
    expect(sentEmails()[0].to).toBe("buyer@example.com");

    const updated = await reload(order.id);
    expect(updated.status).toBe("confirmed");
    expect(updated.emailStatus).toBe("sent");
    expect(updated.emailSentAt).toBeInstanceOf(Date);
    expect(updated.emailError).toBeNull();
  });

  it("does not resend when an already-confirmed order is confirmed again", async () => {
    await setSetting(DELIVERY_LINK_KEY, "https://example.com/course");
    const order = await seedOrder();

    await applyStatus(order.id, "confirmed");
    await applyStatus(order.id, "confirmed");

    expect(sentEmails()).toHaveLength(1);
  });

  it("sends exactly once across a confirm, unconfirm, reconfirm cycle", async () => {
    await setSetting(DELIVERY_LINK_KEY, "https://example.com/course");
    const order = await seedOrder();

    await applyStatus(order.id, "confirmed");
    await applyStatus(order.id, "pending");
    await applyStatus(order.id, "confirmed");

    expect(sentEmails()).toHaveLength(1);
  });

  it("sends nothing when an order is rejected", async () => {
    await setSetting(DELIVERY_LINK_KEY, "https://example.com/course");
    const order = await seedOrder();

    await applyStatus(order.id, "rejected");

    expect(sentEmails()).toHaveLength(0);
    expect((await reload(order.id)).status).toBe("rejected");
  });

  it("still confirms the order when the delivery link is unset", async () => {
    const order = await seedOrder();

    await applyStatus(order.id, "confirmed");

    const updated = await reload(order.id);
    // The financial decision stands; only the delivery failed.
    expect(updated.status).toBe("confirmed");
    expect(updated.emailStatus).toBe("failed");
    expect(updated.emailError).toMatch(/delivery link/i);
    expect(sentEmails()).toHaveLength(0);
  });

  it("ignores an unknown status", async () => {
    const order = await seedOrder();
    await applyStatus(order.id, "shipped");
    expect((await reload(order.id)).status).toBe("pending");
  });

  it("ignores an id that does not exist", async () => {
    await expect(
      applyStatus("00000000-0000-0000-0000-000000000000", "confirmed"),
    ).resolves.toBeUndefined();
  });
});

describe("resendApproval", () => {
  it("sends again for a confirmed order", async () => {
    await setSetting(DELIVERY_LINK_KEY, "https://example.com/course");
    const order = await seedOrder();
    await applyStatus(order.id, "confirmed");
    clearSentEmails();

    await resendApproval(order.id);

    expect(sentEmails()).toHaveLength(1);
    expect((await reload(order.id)).emailStatus).toBe("sent");
  });

  it("recovers an order whose first attempt failed for a missing link", async () => {
    const order = await seedOrder();
    await applyStatus(order.id, "confirmed");
    expect((await reload(order.id)).emailStatus).toBe("failed");

    await setSetting(DELIVERY_LINK_KEY, "https://example.com/course");
    await resendApproval(order.id);

    const updated = await reload(order.id);
    expect(updated.emailStatus).toBe("sent");
    expect(updated.emailError).toBeNull();
  });

  it("refuses an order that is not confirmed", async () => {
    await setSetting(DELIVERY_LINK_KEY, "https://example.com/course");
    const order = await seedOrder();

    await resendApproval(order.id);

    expect(sentEmails()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/lib/approval.test.ts`
Expected: FAIL — `@/lib/approval` does not exist.

- [ ] **Step 3: Write the approval module**

Create `src/lib/approval.ts`:

```ts
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { orders, type Order } from "./schema";
import { sendApprovalEmail } from "./email";
import { getDeliveryLink } from "./settings";

export const ORDER_STATUSES = ["pending", "confirmed", "rejected"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

function isStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Writes the status, then attempts delivery. The two are deliberately
 * independent: approving an order is a financial decision and must not be
 * blocked by a mail provider being down.
 */
export async function applyStatus(id: string, status: string): Promise<void> {
  if (!isStatus(status)) return;

  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return;

  await db.update(orders).set({ status }).where(eq(orders.id, id));

  const becameConfirmed = status === "confirmed" && order.status !== "confirmed";
  // emailStatus is what makes a confirm/unconfirm/reconfirm cycle send once.
  if (becameConfirmed && order.emailStatus !== "sent") {
    await deliver(order);
  }
}

/** The Resend button. Allowed even after a success, so a typo'd address can be fixed. */
export async function resendApproval(id: string): Promise<void> {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order || order.status !== "confirmed") return;

  await deliver(order);
}

async function deliver(order: Order): Promise<void> {
  const db = await getDb();
  const link = await getDeliveryLink();

  if (!link) {
    await db
      .update(orders)
      .set({
        emailStatus: "failed",
        emailError: "Delivery link is not set. Add it in Settings, then resend.",
      })
      .where(eq(orders.id, order.id));
    return;
  }

  const result = await sendApprovalEmail({
    to: order.email,
    name: order.name,
    reference: order.reference,
    locale: order.locale,
    link,
  });

  await db
    .update(orders)
    .set(
      result.ok
        ? { emailStatus: "sent", emailSentAt: new Date(), emailError: null }
        : { emailStatus: "failed", emailError: result.error },
    )
    .where(eq(orders.id, order.id));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/lib/approval.test.ts`
Expected: PASS, all ten tests.

- [ ] **Step 5: Reduce the server actions to wrappers**

In `src/app/(admin)/admin/actions.ts`, replace the whole existing `setStatus` function with:

```ts
export async function setStatus(id: string, status: string): Promise<void> {
  await requireAdmin();
  await applyStatus(id, status);
  revalidatePath("/admin/orders");
}

export async function resendApprovalEmail(id: string): Promise<void> {
  await requireAdmin();
  await resendApproval(id);
  revalidatePath("/admin/orders");
}
```

Add the import:

```ts
import { applyStatus, resendApproval } from "@/lib/approval";
```

Then delete the now-unused imports from that file: `eq` from `drizzle-orm`, `getDb` from `@/lib/db`, and `orders` from `@/lib/schema`. Keep `getDb` only if `saveSettings` still needs it — it does not, so remove it.

- [ ] **Step 6: Verify the whole suite**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/approval.ts tests/lib/approval.test.ts "src/app/(admin)/admin/actions.ts"
git commit -m "feat: email the delivery link when an order is confirmed"
```

---

## Task 7: Email state and Resend button in the order list

**Files:**
- Modify: `src/app/(admin)/admin/orders/page.tsx`
- Test: `e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `resendApprovalEmail`, `setStatus` from the admin actions module (Task 6); `getDeliveryLink` from `@/lib/settings` (Task 2).
- Produces: no exports. The orders page gains `data-testid="email-state"` and a Resend button.

**Note on end-to-end assertions:** the log driver's buffer lives in the server process, which Playwright cannot read. The test asserts the recorded state in the UI instead, which proves the send path ran and its result was persisted. Message content is covered by Task 4 and Task 5.

- [ ] **Step 1: Write the failing test**

Append to `e2e/admin.spec.ts`, inside `test.describe("admin", ...)`:

```ts
  test("emails the customer when an order is approved", async ({ page }) => {
    // Submit a real order so there is something to approve.
    await page.goto("/en");
    await page.locator("#order").scrollIntoViewIfNeeded();
    await page.getByLabel(/Full name/i).fill("Approval Buyer");
    await page.getByLabel(/Sender phone number/i).fill("01012345678");
    await page.getByLabel(/Email to receive the files/i).fill("approve@example.com");
    await page
      .getByTestId("proof-input")
      .setInputFiles(join(process.cwd(), "e2e/fixtures/proof.png"));
    await page
      .getByRole("button", { name: /Send the order and get the system/i })
      .click();
    await expect(page).toHaveURL(/\/en\/thanks\?ref=DA-/);

    await page.goto("/admin");
    await page.getByLabel(/password/i).fill("e2e-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.goto("/admin/settings");
    await page.getByLabel(/delivery link/i).fill("https://example.com/course");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByTestId("settings-saved")).toBeVisible();

    await page.goto("/admin/orders");
    const row = page.locator("li", { hasText: "approve@example.com" }).first();
    await row.getByRole("button", { name: /mark confirmed/i }).click();

    await expect(
      page
        .locator("li", { hasText: "approve@example.com" })
        .first()
        .getByTestId("email-state"),
    ).toContainText(/emailed/i);
  });
```

Add this import at the top of `e2e/admin.spec.ts`:

```ts
import { join } from "node:path";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run e2e -- e2e/admin.spec.ts --project=desktop`
Expected: FAIL — no element with `data-testid="email-state"`.

- [ ] **Step 3: Warn when the delivery link is unset**

In `src/app/(admin)/admin/orders/page.tsx`, read the link alongside the orders. Add to the imports:

```ts
import { getDeliveryLink } from "@/lib/settings";
import { resendApprovalEmail } from "../actions";
```

and inside the component, after the existing `const pending = ...` line:

```tsx
  const deliveryLink = await getDeliveryLink();
```

Then render the warning immediately after the closing `</header>` tag:

```tsx
      {deliveryLink ? null : (
        <p
          data-testid="link-warning"
          className="mt-6 rounded-card border-[1.5px] border-line-strong bg-surface px-4 py-3 text-sm font-semibold text-danger"
        >
          No delivery link is set. Approvals will be recorded as failed until you
          add one in Settings.
        </p>
      )}
```

- [ ] **Step 4: Render the email state and the Resend button**

In the same file, inside the `<div className="mt-4 flex flex-wrap items-center gap-2">` block, after the status-change forms, add:

```tsx
                <span data-testid="email-state" className="text-xs text-ink-3">
                  {row.emailStatus === "sent"
                    ? `emailed ${row.emailSentAt?.toISOString() ?? ""}`
                    : row.emailStatus === "failed"
                      ? `email failed: ${row.emailError ?? "unknown error"}`
                      : "not emailed"}
                </span>

                {row.status === "confirmed" ? (
                  <form
                    action={async () => {
                      "use server";
                      await resendApprovalEmail(row.id);
                    }}
                  >
                    <Button type="submit" variant="ghost" size="md">
                      Resend email
                    </Button>
                  </form>
                ) : null}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run e2e -- e2e/admin.spec.ts --project=desktop`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/admin/orders/page.tsx" e2e/admin.spec.ts
git commit -m "feat: show email delivery state and a resend control per order"
```

---

## Task 8: Full-size proof viewer

**Files:**
- Create: `src/components/admin/ProofViewer.tsx`
- Modify: `src/app/(admin)/admin/orders/page.tsx`
- Test: `tests/admin/proof-viewer.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `ProofViewer({ src, alt }: { src: string; alt: string })` from `@/components/admin/ProofViewer`.

- [ ] **Step 1: Write the failing test**

Create `tests/admin/proof-viewer.test.tsx`. jsdom does not implement `HTMLDialogElement.showModal`, so the test stubs it the same way `vitest.setup.ts` stubs `matchMedia`.

```tsx
import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProofViewer } from "@/components/admin/ProofViewer";

beforeAll(() => {
  // jsdom ships no dialog implementation; every browser the admin runs in has one.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

describe("ProofViewer", () => {
  it("renders a clickable thumbnail", () => {
    render(<ProofViewer src="/admin/proof/abc" alt="Payment proof for DA-AB123" />);
    expect(
      screen.getByRole("button", { name: /payment proof for DA-AB123/i }),
    ).toBeInTheDocument();
  });

  it("keeps the dialog closed until the thumbnail is clicked", () => {
    render(<ProofViewer src="/admin/proof/abc" alt="Payment proof" />);
    expect(screen.getByTestId("proof-dialog")).not.toHaveAttribute("open");
  });

  it("opens the dialog on click", async () => {
    render(<ProofViewer src="/admin/proof/abc" alt="Payment proof" />);
    await userEvent.click(screen.getByRole("button", { name: /payment proof/i }));
    expect(screen.getByTestId("proof-dialog")).toHaveAttribute("open");
  });

  it("closes when the close control is used", async () => {
    render(<ProofViewer src="/admin/proof/abc" alt="Payment proof" />);
    await userEvent.click(screen.getByRole("button", { name: /payment proof/i }));
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.getByTestId("proof-dialog")).not.toHaveAttribute("open");
  });

  it("points both images at the authenticated proof route", () => {
    render(<ProofViewer src="/admin/proof/abc" alt="Payment proof" />);
    for (const image of screen.getAllByRole("img")) {
      expect(image).toHaveAttribute("src", "/admin/proof/abc");
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/admin/proof-viewer.test.tsx`
Expected: FAIL — `@/components/admin/ProofViewer` does not exist.

- [ ] **Step 3: Write the component**

Create `src/components/admin/ProofViewer.tsx`:

```tsx
"use client";

import { useRef } from "react";

/**
 * Native <dialog> rather than a hand-rolled overlay, matching the FAQ's use of
 * details/summary: Escape, focus trapping, and the backdrop come for free.
 */
export function ProofViewer({ src, alt }: { src: string; alt: string }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="shrink-0 rounded-card border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label={alt}
      >
        {/* next/image is wrong here: the optimizer fetches the source itself
            and would not carry the admin session cookie, so the proof would
            401. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-28 w-28 rounded-card object-cover" />
      </button>

      <dialog
        ref={dialog}
        data-testid="proof-dialog"
        onClick={(event) => {
          // The dialog element itself is the backdrop; the image sits inside a
          // child, so a click landing on the dialog means a click outside.
          if (event.target === dialog.current) dialog.current?.close();
        }}
        className="max-w-[90vw] rounded-card border-[1.5px] border-line-strong bg-surface p-4 backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[80vh] w-auto rounded-card" />
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="self-end rounded-control border-[1.5px] border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink"
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/admin/proof-viewer.test.tsx`
Expected: PASS, all five tests.

- [ ] **Step 5: Use it in the order list**

In `src/app/(admin)/admin/orders/page.tsx`, replace the entire `<a href={...}>` block wrapping the thumbnail — the anchor, its comments, and the `<img>` inside it — with:

```tsx
                <ProofViewer
                  src={`/admin/proof/${row.id}`}
                  alt={`Payment proof for ${row.reference}`}
                />
```

Add the import:

```ts
import { ProofViewer } from "@/components/admin/ProofViewer";
```

The two `eslint-disable` comments and the `next/image` explanation move into the component with the markup; do not leave orphaned copies behind in the page.

- [ ] **Step 6: Cover it end-to-end in a real browser**

The unit test runs against a stubbed `showModal`, so it proves the wiring but not
that a real dialog opens and Escape closes it. Append to `e2e/admin.spec.ts`,
inside `test.describe("admin", ...)`:

```ts
  test("opens a payment proof full size and closes it with Escape", async ({ page }) => {
    await page.goto("/en");
    await page.locator("#order").scrollIntoViewIfNeeded();
    await page.getByLabel(/Full name/i).fill("Lightbox Buyer");
    await page.getByLabel(/Sender phone number/i).fill("01012345678");
    await page.getByLabel(/Email to receive the files/i).fill("lightbox@example.com");
    await page
      .getByTestId("proof-input")
      .setInputFiles(join(process.cwd(), "e2e/fixtures/proof.png"));
    await page
      .getByRole("button", { name: /Send the order and get the system/i })
      .click();
    await expect(page).toHaveURL(/\/en\/thanks\?ref=DA-/);

    await page.goto("/admin");
    await page.getByLabel(/password/i).fill("e2e-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin\/orders/);

    const row = page.locator("li", { hasText: "lightbox@example.com" }).first();
    const dialog = row.getByTestId("proof-dialog");

    await expect(dialog).toBeHidden();
    await row.getByRole("button", { name: /payment proof for DA-/i }).click();
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
```

Run: `npm run e2e -- e2e/admin.spec.ts --project=desktop`
Expected: PASS. The `join` import was already added in Task 7.

- [ ] **Step 7: Verify the whole suite**

Run: `npm test && npm run typecheck && npm run lint && npm run e2e`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/ProofViewer.tsx tests/admin/proof-viewer.test.tsx "src/app/(admin)/admin/orders/page.tsx" e2e/admin.spec.ts
git commit -m "feat: open payment proofs full size in a dialog"
```

---

## Deployment checklist

Not code. Hand this to the owner when the branch merges.

- [ ] Create a Resend account and verify the sending domain via its DNS record.
- [ ] Set `RESEND_API_KEY` and `EMAIL_FROM` in the Vercel project.
- [ ] Run `DATABASE_URL=<production url> npm run db:migrate` once, before the deploy goes live.
- [ ] Sign in to `/admin/settings` and save the real delivery link **before** approving any order.
- [ ] Send one real approval to your own address and confirm both the English and Arabic renderings.
