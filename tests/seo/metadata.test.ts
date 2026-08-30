import { describe, expect, it } from "vitest";
import { absoluteUrl, alternatesFor, SITE_URL } from "@/lib/site";
import { routing } from "@/i18n/routing";

describe("site URLs", () => {
  it("builds absolute URLs without doubling slashes", () => {
    expect(absoluteUrl("/ar")).toBe(`${SITE_URL}/ar`);
    expect(absoluteUrl("ar")).toBe(`${SITE_URL}/ar`);
  });

  it("never ends the base URL with a trailing slash", () => {
    expect(SITE_URL.endsWith("/")).toBe(false);
  });
});

describe("alternatesFor", () => {
  it("declares an alternate for every supported locale", () => {
    const { languages } = alternatesFor("/");
    for (const locale of routing.locales) {
      expect(languages).toHaveProperty(locale);
    }
  });

  it("points x-default at the default locale", () => {
    const { languages } = alternatesFor("/");
    expect(languages["x-default"]).toBe(absoluteUrl(`/${routing.defaultLocale}`));
  });

  it("self-references the canonical for the given locale path", () => {
    expect(alternatesFor("/", "en").canonical).toBe(absoluteUrl("/en"));
    expect(alternatesFor("/", "ar").canonical).toBe(absoluteUrl("/ar"));
  });

  it("keeps sub-paths on each locale alternate", () => {
    const { languages, canonical } = alternatesFor("/thanks", "en");
    expect(canonical).toBe(absoluteUrl("/en/thanks"));
    expect(languages.ar).toBe(absoluteUrl("/ar/thanks"));
  });
});
