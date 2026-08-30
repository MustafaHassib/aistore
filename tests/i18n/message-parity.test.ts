import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

type Json = Record<string, unknown>;

/**
 * Flattens to dotted paths. Arrays contribute their index, so a section with
 * four cards in Arabic and three in English is caught as a shape mismatch, not
 * just a missing key.
 */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => keyPaths(item, `${prefix}[${i}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Json).flatMap(([k, v]) =>
      keyPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

function valueAt(messages: unknown, path: string): unknown {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .reduce<unknown>((acc, key) => (acc as Json)?.[key], messages);
}

describe("message parity", () => {
  it("ar.json and en.json have identical key trees", () => {
    const arKeys = keyPaths(ar).sort();
    const enKeys = keyPaths(en).sort();

    const missingInEn = arKeys.filter((k) => !enKeys.includes(k));
    const missingInAr = enKeys.filter((k) => !arKeys.includes(k));

    expect(missingInEn, `Missing from en.json:\n${missingInEn.join("\n")}`).toEqual([]);
    expect(missingInAr, `Missing from ar.json:\n${missingInAr.join("\n")}`).toEqual([]);
  });

  it("no message value is an empty string", () => {
    const empties = Object.entries({ ar, en }).flatMap(([locale, messages]) =>
      keyPaths(messages)
        .filter((path) => {
          const value = valueAt(messages, path);
          return typeof value === "string" && value.trim() === "";
        })
        .map((path) => `${locale}: ${path}`),
    );

    expect(empties, `Empty strings:\n${empties.join("\n")}`).toEqual([]);
  });
});
