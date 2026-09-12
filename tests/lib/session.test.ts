import { beforeEach, describe, expect, it } from "vitest";
import {
  hashPassword,
  signSession,
  verifyPassword,
  verifySession,
} from "@/lib/session";

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-value-at-least-32-chars-long";
});

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("never stores the password in the hash", async () => {
    const stored = await hashPassword("hunter2");
    expect(stored).not.toContain("hunter2");
  });

  it("rejects a malformed stored hash rather than throwing", async () => {
    expect(await verifyPassword("x", "not-a-valid-hash")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$salt$digest")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const token = signSession({ sub: "admin" });
    expect(verifySession(token)).toMatchObject({ sub: "admin" });
  });

  it("rejects a tampered payload", () => {
    const token = signSession({ sub: "admin" });
    const signature = token.split(".")[1];
    const forged = `${Buffer.from('{"sub":"root"}').toString("base64url")}.${signature}`;

    expect(verifySession(forged)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSession({ sub: "admin" });
    process.env.SESSION_SECRET = "a-completely-different-secret-value-here";

    expect(verifySession(token)).toBeNull();
  });

  it("rejects an expired token", () => {
    expect(verifySession(signSession({ sub: "admin" }, -1000))).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifySession("")).toBeNull();
    expect(verifySession("nonsense")).toBeNull();
    expect(verifySession("a.b.c")).toBeNull();
  });

  it("refuses to sign without a usable secret", () => {
    process.env.SESSION_SECRET = "short";
    expect(() => signSession({ sub: "admin" })).toThrow(/SESSION_SECRET/);
  });
});

describe("the admin:hash CLI", () => {
  it("produces a hash the app accepts", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);

    // The script reimplements hashing so it can run without a TS loader.
    // This guards against the two drifting apart.
    const { stdout } = await run("node", [
      "scripts/hash-password.mjs",
      "a shared secret",
    ]);

    expect(await verifyPassword("a shared secret", stdout.trim())).toBe(true);
    expect(await verifyPassword("a different secret", stdout.trim())).toBe(false);
  });
});
