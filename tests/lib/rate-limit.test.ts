import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";
import { resetDbForTests } from "@/lib/db";

afterEach(() => resetDbForTests());

const unique = () => `bucket-${Math.random().toString(36).slice(2)}`;

describe("checkRateLimit", () => {
  it("allows requests up to the limit", async () => {
    const bucket = unique();
    expect(await checkRateLimit(bucket, 3, 60_000)).toBe(true);
    expect(await checkRateLimit(bucket, 3, 60_000)).toBe(true);
    expect(await checkRateLimit(bucket, 3, 60_000)).toBe(true);
  });

  it("blocks the request past the limit", async () => {
    const bucket = unique();
    for (let i = 0; i < 3; i += 1) await checkRateLimit(bucket, 3, 60_000);
    expect(await checkRateLimit(bucket, 3, 60_000)).toBe(false);
  });

  it("keeps buckets independent", async () => {
    const a = unique();
    const b = unique();
    for (let i = 0; i < 3; i += 1) await checkRateLimit(a, 3, 60_000);

    expect(await checkRateLimit(a, 3, 60_000)).toBe(false);
    expect(await checkRateLimit(b, 3, 60_000)).toBe(true);
  });

  it("forgets hits that fall outside the window", async () => {
    const bucket = unique();
    for (let i = 0; i < 3; i += 1) await checkRateLimit(bucket, 3, 60_000);
    expect(await checkRateLimit(bucket, 3, 60_000)).toBe(false);

    // A zero-length window means every prior hit is already expired.
    expect(await checkRateLimit(bucket, 3, 0)).toBe(true);
  });
});
