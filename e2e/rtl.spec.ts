import { expect, test } from "@playwright/test";

test.describe("bilingual delivery", () => {
  test("redirects the bare root to a locale prefix", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(ar|en)$/);
  });

  test("negotiates Arabic for an Arabic-preferring browser", async ({ browser }) => {
    const context = await browser.newContext({ locale: "ar-EG" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/ar$/);
    await context.close();
  });

  test("negotiates English for an English-preferring browser", async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await context.close();
  });

  test("falls back to Arabic for an unsupported language", async ({ browser }) => {
    // German is not offered, so negotiation must land on the default locale
    // rather than on whichever locale happens to be listed first.
    const context = await browser.newContext({ locale: "de-DE" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/ar$/);
    await context.close();
  });

  test("serves Arabic right-to-left", async ({ page }) => {
    await page.goto("/ar");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", "ar");
    await expect(html).toHaveAttribute("dir", "rtl");
  });

  test("serves English left-to-right", async ({ page }) => {
    await page.goto("/en");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", "en");
    await expect(html).toHaveAttribute("dir", "ltr");
  });

  test("switches locale and keeps the visitor on the page", async ({ page }) => {
    await page.goto("/ar");
    await page.getByRole("link", { name: "English" }).first().click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("never scrolls horizontally in either locale", async ({ page }) => {
    for (const locale of ["ar", "en"]) {
      await page.goto(`/${locale}`);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflows, `${locale} overflows horizontally`).toBe(false);
    }
  });

  test("declares hreflang alternates for both locales", async ({ page }) => {
    await page.goto("/ar");
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
    await expect(
      page.locator('link[rel="alternate"][hreflang="x-default"]'),
    ).toHaveCount(1);
  });

  test("renders the clock left-to-right even in Arabic", async ({ page }) => {
    await page.goto("/ar");
    const clock = page.getByTestId("countdown-clock");
    await expect(clock).toHaveAttribute("dir", "ltr");
  });
});
