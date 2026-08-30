import { describe, expect, it } from "vitest";
import { directionOf, LOCALES } from "@/lib/types";
import { routing } from "@/i18n/routing";

describe("locale configuration", () => {
  it("defaults to Arabic", () => {
    expect(routing.defaultLocale).toBe("ar");
  });

  it("always prefixes the locale so both locales are crawlable", () => {
    expect(routing.localePrefix).toBe("always");
  });

  it("maps each locale to the correct text direction", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("en")).toBe("ltr");
  });

  it("exposes exactly the two supported locales", () => {
    expect([...LOCALES]).toEqual(["ar", "en"]);
  });
});
