import { expect, test } from "@playwright/test";
import { SECTIONS } from "../src/config/sections";

test.describe("landing page", () => {
  test("renders every section in the manifest", async ({ page }) => {
    await page.goto("/ar");
    for (const section of SECTIONS) {
      await expect(
        page.locator(`#${section.id}`),
        `Section "${section.id}" is missing`,
      ).toHaveCount(1);
    }
  });

  test("every call to action reaches the order section", async ({ page }) => {
    await page.goto("/en");
    const ctas = page.locator('a[href="#order"]');
    expect(await ctas.count()).toBeGreaterThan(1);

    await ctas.first().click();
    await expect(page).toHaveURL(/#order$/);
    await expect(page.locator("#order")).toBeInViewport();
  });

  test("the countdown survives a reload instead of restarting", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByTestId("countdown-clock")).toBeVisible();

    const stored = await page.evaluate(() =>
      window.localStorage.getItem("offer-deadline"),
    );
    expect(stored).not.toBeNull();

    await page.reload();
    const after = await page.evaluate(() =>
      window.localStorage.getItem("offer-deadline"),
    );
    expect(after).toBe(stored);
  });

  test("opens an FAQ answer on click", async ({ page }) => {
    await page.goto("/en");
    const first = page.locator("#faq details").first();
    await expect(first).not.toHaveAttribute("open", "");
    await first.locator("summary").click();
    await expect(first).toHaveAttribute("open", "");
  });

  test("has exactly one h1 per locale", async ({ page }) => {
    for (const locale of ["ar", "en"]) {
      await page.goto(`/${locale}`);
      await expect(page.locator("h1")).toHaveCount(1);
    }
  });

  test("keeps the sticky CTA hidden while the hero is still on screen", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only behaviour");

    await page.goto("/en");
    await expect(page.getByTestId("sticky-cta")).toBeHidden();
  });

  test("shows the sticky CTA on mobile once the hero scrolls away", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only behaviour");

    await page.goto("/en");
    await page.locator("#offer").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("sticky-cta")).toBeVisible();
  });

  test("hides the sticky CTA while the order form is on screen", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only behaviour");

    await page.goto("/en");
    await page.locator("#order").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("sticky-cta")).toBeHidden();
  });

  test("states no earnings guarantee in both locales", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("#faq")).toContainText("no guarantee of any income");

    await page.goto("/ar");
    await expect(page.locator("#faq")).toContainText("مفيش أي ضمان");
  });
});
