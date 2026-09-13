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

    // Not getByRole("alert"): Next renders its own route announcer with that
    // role, so the locator would be ambiguous.
    await expect(page.getByTestId("login-error")).toContainText(/incorrect/i);
  });

  test("signs in and shows the order list", async ({ page }) => {
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
