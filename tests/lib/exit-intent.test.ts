import { describe, expect, it } from "vitest";
import { nextStage } from "@/lib/exit-intent";

describe("nextStage", () => {
  it("offers the discount first when nothing has been seen", () => {
    expect(nextStage(null)).toBe(0);
  });

  it("offers the Mini version after the discount was dismissed", () => {
    expect(nextStage("0")).toBe(1);
  });

  it("stops offering once both stages have been seen", () => {
    expect(nextStage("1")).toBeNull();
  });

  it("stops offering for a stage index beyond the last", () => {
    expect(nextStage("9")).toBeNull();
  });

  it("starts over when the stored value is not a stage index", () => {
    expect(nextStage("garbage")).toBe(0);
  });

  it("starts over when the stored value is negative", () => {
    expect(nextStage("-2")).toBe(0);
  });
});
