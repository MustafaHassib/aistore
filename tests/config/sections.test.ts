import { describe, expect, it } from "vitest";
import { SECTIONS } from "@/config/sections";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

describe("section manifest", () => {
  it("gives every section a unique id", () => {
    const ids = SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the order section every call to action targets", () => {
    expect(SECTIONS.some((section) => section.id === "order")).toBe(true);
  });

  it("points every namespaced section at a namespace that exists in both locales", () => {
    for (const section of SECTIONS) {
      if (!section.namespace) continue;
      expect(ar, `ar.json is missing "${section.namespace}"`).toHaveProperty(
        section.namespace,
      );
      expect(en, `en.json is missing "${section.namespace}"`).toHaveProperty(
        section.namespace,
      );
    }
  });

  it("alternates bands so no two adjacent sections share a background", () => {
    const bands = SECTIONS.map((section) => section.band ?? "base");
    const clashes = bands
      .map((band, i) => (i > 0 && band === bands[i - 1] ? SECTIONS[i].id : null))
      .filter(Boolean);

    expect(clashes, `Adjacent sections share a band: ${clashes.join(", ")}`).toEqual(
      [],
    );
  });

  it("gives every section that needs a namespace one", () => {
    const needsNamespace = SECTIONS.filter(
      (section) => !["hero", "heroStats", "finalCta"].includes(section.kind),
    );
    for (const section of needsNamespace) {
      expect(section.namespace, `"${section.id}" has no namespace`).toBeTruthy();
    }
  });
});
