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

/** A fresh bucket per test keeps the rate limiter from leaking between cases. */
const ip = () => `10.0.0.${Math.random()}`;

async function rowFor(reference: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(orders)
    .where(eq(orders.reference, reference));
  return row;
}

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

    const row = await rowFor(result.reference);
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

    expect((await rowFor(result.reference)).amount).toBe(PRICING.main);
  });

  it("captures attribution fields when present", async () => {
    const result = await createOrder(
      form({
        utmSource: "tiktok",
        utmCampaign: "launch",
        referrer: "https://t.co/x",
      }),
      ip(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await rowFor(result.reference);
    expect(row.utmSource).toBe("tiktok");
    expect(row.utmCampaign).toBe("launch");
    expect(row.referrer).toBe("https://t.co/x");
  });

  it("rejects an invalid phone number", async () => {
    expect(await createOrder(form({ phone: "12345" }), ip())).toMatchObject({
      ok: false,
      status: 422,
    });
  });

  it("rejects a missing proof file", async () => {
    const data = form();
    data.delete("proof");

    expect(await createOrder(data, ip())).toMatchObject({
      ok: false,
      status: 422,
    });
  });

  it("rejects a disguised non-image", async () => {
    const payload = new TextEncoder().encode("<?php system($_GET['c']); ?>");
    const disguised = new File([payload], "transfer.png", { type: "image/png" });

    expect(await createOrder(form({}, disguised), ip())).toMatchObject({
      ok: false,
      status: 415,
    });
  });

  it("rejects a file over the size limit", async () => {
    const huge = new File([new Uint8Array(6 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });

    expect(await createOrder(form({}, huge), ip())).toMatchObject({
      ok: false,
      status: 413,
    });
  });

  it("stores nothing when validation fails", async () => {
    const db = await getDb();
    const before = (await db.select().from(orders)).length;
    await createOrder(form({ email: "nope" }), ip());
    const after = (await db.select().from(orders)).length;

    expect(after).toBe(before);
  });

  it("rate-limits repeated submissions from one address", async () => {
    const address = ip();
    const results = [];
    for (let i = 0; i < 7; i += 1) {
      results.push(await createOrder(form(), address));
    }

    expect(results.some((r) => !r.ok && r.status === 429)).toBe(true);
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });
});
