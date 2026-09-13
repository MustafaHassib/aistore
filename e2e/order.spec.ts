import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Playwright compiles specs to CJS, so import.meta is unavailable here.
const FIXTURE = join(process.cwd(), "e2e/fixtures/proof.png");

const BASE_FIELDS = {
  name: "E2E Buyer",
  phone: "01012345678",
  email: "e2e@example.com",
  paymentMethod: "instapay",
  offerCode: "main",
  locale: "en",
};

test.describe("ordering", () => {
  test("submits an order and lands on the confirmation", async ({ page }) => {
    await page.goto("/en?utm_source=playwright&utm_campaign=e2e");

    await page.locator("#order").scrollIntoViewIfNeeded();
    await page.getByLabel(/Full name/i).fill("E2E Buyer");
    await page.getByLabel(/Sender phone number/i).fill("01012345678");
    await page.getByLabel(/Email to receive the files/i).fill("e2e@example.com");
    await page.getByTestId("proof-input").setInputFiles(FIXTURE);

    await page
      .getByRole("button", { name: /Send the order and get the system/i })
      .click();

    await expect(page).toHaveURL(/\/en\/thanks\?ref=DA-/);
    await expect(page.getByText(/^DA-[0-9A-Z]{5}$/)).toBeVisible();
  });

  test("blocks an invalid phone number client-side", async ({ page }) => {
    await page.goto("/en");
    await page.locator("#order").scrollIntoViewIfNeeded();

    await page.getByLabel(/Full name/i).fill("E2E Buyer");
    await page.getByLabel(/Sender phone number/i).fill("12345");
    await page.getByLabel(/Email to receive the files/i).fill("e2e@example.com");
    await page.getByTestId("proof-input").setInputFiles(FIXTURE);
    await page
      .getByRole("button", { name: /Send the order and get the system/i })
      .click();

    await expect(page).not.toHaveURL(/thanks/);
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("rejects a disguised non-image at the API", async ({ request }) => {
    const response = await request.post("/api/orders", {
      multipart: {
        ...BASE_FIELDS,
        email: "disguised@example.com",
        proof: {
          name: "proof.png",
          mimeType: "image/png",
          buffer: Buffer.from("<?php system($_GET['c']); ?>"),
        },
      },
    });

    expect(response.status()).toBe(415);
  });

  test("rejects a missing proof at the API", async ({ request }) => {
    const response = await request.post("/api/orders", {
      multipart: { ...BASE_FIELDS, email: "noproof@example.com" },
    });

    expect(response.status()).toBe(422);
  });

  test("accepts a real image and ignores a client-supplied amount", async ({
    request,
  }) => {
    const response = await request.post("/api/orders", {
      multipart: {
        ...BASE_FIELDS,
        email: "amount@example.com",
        amount: "1",
        proof: {
          name: "proof.png",
          mimeType: "image/png",
          buffer: await readFile(FIXTURE),
        },
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.reference).toMatch(/^DA-[0-9A-Z]{5}$/);
  });
});
