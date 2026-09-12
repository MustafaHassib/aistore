import { describe, expect, it } from "vitest";
import { makeReference } from "@/lib/reference";

describe("makeReference", () => {
  it("produces a quotable DA-XXXXX code", () => {
    expect(makeReference()).toMatch(/^DA-[0-9A-Z]{5}$/);
  });

  it("omits characters that are misread aloud", () => {
    const sample = Array.from({ length: 400 }, makeReference).join("");
    expect(sample).not.toMatch(/[OIL01]/);
  });

  it("does not repeat across a large sample", () => {
    const codes = new Set(Array.from({ length: 2000 }, makeReference));
    expect(codes.size).toBeGreaterThan(1990);
  });
});
