import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Physical-direction utilities are the single most common way a bilingual site
 * silently becomes an English-only one: they look fine in LTR and break the
 * Arabic layout without any test noticing. This guard makes that a build error.
 */
/**
 * `(?:[\w-]+:)*` allows a variant chain, so `sm:text-left` and
 * `hover:md:ml-4` are caught too. Without it, any responsive or state variant
 * walks straight past the guard.
 */
const VARIANT = String.raw`(?:^|["'\s])(?:[\w-]+:)*`;

const PHYSICAL = [
  new RegExp(`${VARIANT}-?(?:ml|mr|pl|pr)-`),
  new RegExp(`${VARIANT}text-(?:left|right)(?:["'\\s]|$)`),
  new RegExp(`${VARIANT}(?:border|rounded)-(?:l|r)-`),
  new RegExp(`${VARIANT}(?:left|right)-\\d`),
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

describe("logical properties", () => {
  it("no source file uses physical-direction utilities", () => {
    const offenders: string[] = [];

    for (const file of walk("src")) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (PHYSICAL.some((re) => re.test(line))) {
          offenders.push(`${file}:${i + 1}  ${line.trim()}`);
        }
      });
    }

    expect(
      offenders,
      `Physical-direction utilities break RTL. Use ms/me, ps/pe, text-start/text-end, border-s/border-e, rounded-s/rounded-e, start-*/end-*.\n\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
