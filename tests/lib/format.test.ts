import { describe, expect, it } from "vitest";
import { formatMoney, formatNumber, percentOff } from "@/lib/format";
import { amountFor, PRICING } from "@/config/pricing";

describe("formatNumber", () => {
  it("uses Western digits in Arabic, not Arabic-Indic", () => {
    const result = formatNumber(1999, "ar");
    expect(result).toContain("1");
    expect(result).not.toMatch(/[٠-٩]/);
  });

  it("groups thousands in both locales", () => {
    expect(formatNumber(1999, "en")).toBe("1,999");
    expect(formatNumber(1999, "ar")).toBe("1,999");
  });

  it("leaves values under a thousand ungrouped", () => {
    expect(formatNumber(999, "ar")).toBe("999");
  });
});

describe("formatMoney", () => {
  it("puts the currency after the amount", () => {
    expect(formatMoney(999, "ar", "ج.م")).toBe("999 ج.م");
    expect(formatMoney(999, "en", "EGP")).toBe("999 EGP");
  });
});

describe("percentOff", () => {
  it("computes the headline discount", () => {
    expect(percentOff(1999, 999)).toBe(50);
    expect(percentOff(999, 399)).toBe(60);
  });

  it("returns 0 when there is no discount", () => {
    expect(percentOff(999, 999)).toBe(0);
  });

  it("never returns a negative discount", () => {
    expect(percentOff(999, 1999)).toBe(0);
  });
});

describe("pricing", () => {
  it("resolves an amount for every offer code", () => {
    expect(amountFor("main")).toBe(PRICING.main);
    expect(amountFor("exit60")).toBe(PRICING.exit);
    expect(amountFor("mini")).toBe(PRICING.mini);
  });

  it("keeps the advertised discounts truthful", () => {
    expect(percentOff(PRICING.original, PRICING.main)).toBe(50);
    expect(percentOff(PRICING.main, PRICING.exit)).toBe(60);
  });
});
