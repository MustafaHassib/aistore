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
      offerCode: "main",
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
