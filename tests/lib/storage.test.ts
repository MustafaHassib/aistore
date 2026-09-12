import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { deleteProof, getProof, putProof } from "@/lib/storage";

afterEach(async () => {
  await rm("./.uploads-test", { recursive: true, force: true });
});

describe("proof storage", () => {
  it("round-trips the exact bytes it was given", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const key = await putProof(bytes, "png");

    expect(await getProof(key)).toEqual(bytes);
  });

  it("namespaces keys under orders/ with the right extension", async () => {
    const key = await putProof(new Uint8Array([1]), "webp");
    expect(key).toMatch(/^orders\/[0-9a-f-]{36}\.webp$/);
  });

  it("gives every upload a distinct key", async () => {
    const a = await putProof(new Uint8Array([1]), "jpg");
    const b = await putProof(new Uint8Array([1]), "jpg");
    expect(a).not.toBe(b);
  });

  it("returns null for a key that was never stored", async () => {
    const key = `orders/${crypto.randomUUID()}.png`;
    expect(await getProof(key)).toBeNull();
  });

  it("refuses to escape the storage root", async () => {
    await expect(getProof("../../etc/passwd")).rejects.toThrow(/unsafe/);
    await expect(getProof("orders/../../../etc/passwd")).rejects.toThrow(/unsafe/);
  });

  it("removes a stored proof", async () => {
    const key = await putProof(new Uint8Array([9]), "png");
    await deleteProof(key);
    expect(await getProof(key)).toBeNull();
  });
});
