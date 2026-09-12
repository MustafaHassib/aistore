import { beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/session";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => cookieStore.set(name, value),
    delete: (name: string) => cookieStore.delete(name),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-value-at-least-32-chars-long";
  cookieStore.clear();
});

describe("requireAdmin", () => {
  it("redirects to the login page without a session", async () => {
    const { requireAdmin } = await import("@/lib/admin-guard");
    await expect(requireAdmin()).rejects.toThrow(/REDIRECT:\/admin/);
  });

  it("redirects when the cookie fails verification", async () => {
    cookieStore.set("admin_session", "forged.token");
    const { requireAdmin } = await import("@/lib/admin-guard");
    await expect(requireAdmin()).rejects.toThrow(/REDIRECT:\/admin/);
  });

  it("allows a valid session through", async () => {
    cookieStore.set("admin_session", signSession({ sub: "admin" }));
    const { requireAdmin } = await import("@/lib/admin-guard");
    await expect(requireAdmin()).resolves.toBeUndefined();
  });

  it("redirects on an expired session", async () => {
    cookieStore.set("admin_session", signSession({ sub: "admin" }, -1000));
    const { requireAdmin } = await import("@/lib/admin-guard");
    await expect(requireAdmin()).rejects.toThrow(/REDIRECT:\/admin/);
  });

  it("reports non-admin without redirecting via isAdmin", async () => {
    const { isAdmin } = await import("@/lib/admin-guard");
    expect(await isAdmin()).toBe(false);

    cookieStore.set("admin_session", signSession({ sub: "admin" }));
    expect(await isAdmin()).toBe(true);
  });
});
