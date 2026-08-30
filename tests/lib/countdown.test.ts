import { describe, expect, it } from "vitest";
import { resolveDeadline, splitRemaining } from "@/lib/countdown";

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

describe("resolveDeadline", () => {
  it("starts a new window when nothing is stored", () => {
    expect(resolveDeadline(NOW, null, 24)).toBe(NOW + 24 * HOUR);
  });

  it("keeps a stored future deadline across refreshes", () => {
    const stored = String(NOW + 5 * HOUR);
    expect(resolveDeadline(NOW, stored, 24)).toBe(NOW + 5 * HOUR);
  });

  it("keeps an expired deadline expired instead of resetting it", () => {
    const stored = String(NOW - HOUR);
    expect(resolveDeadline(NOW, stored, 24)).toBe(NOW - HOUR);
  });

  it("starts a new window when the stored value is not a number", () => {
    expect(resolveDeadline(NOW, "not-a-number", 24)).toBe(NOW + 24 * HOUR);
  });

  it("starts a new window when the stored value is empty", () => {
    expect(resolveDeadline(NOW, "", 24)).toBe(NOW + 24 * HOUR);
  });
});

describe("splitRemaining", () => {
  it("zero-pads each unit to two digits", () => {
    expect(splitRemaining(2 * HOUR + 5 * 60_000 + 9_000)).toEqual({
      hours: "02",
      minutes: "05",
      seconds: "09",
    });
  });

  it("rolls hours beyond 24 rather than wrapping to days", () => {
    expect(splitRemaining(30 * HOUR).hours).toBe("30");
  });

  it("clamps a negative remainder to zero", () => {
    expect(splitRemaining(-5000)).toEqual({
      hours: "00",
      minutes: "00",
      seconds: "00",
    });
  });
});
