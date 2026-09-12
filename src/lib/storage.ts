import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const KEY_PATTERN = /^orders\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

function localRoot(): string {
  return resolve(process.env.UPLOAD_DIR ?? "./.uploads");
}

/**
 * Keys are generated, never client-supplied — but the check costs nothing and
 * this function is one refactor away from taking user input.
 */
function assertSafeKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(`Refusing unsafe storage key: ${key}`);
  }
}

function usingBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function putProof(
  bytes: Uint8Array,
  extension: string,
): Promise<string> {
  const key = `orders/${randomUUID()}.${extension}`;

  if (usingBlob()) {
    const { put } = await import("@vercel/blob");
    await put(key, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return key;
  }

  const path = join(localRoot(), key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return key;
}

export async function getProof(key: string): Promise<Uint8Array | null> {
  assertSafeKey(key);

  if (usingBlob()) {
    const { head } = await import("@vercel/blob");
    try {
      const meta = await head(key, { token: process.env.BLOB_READ_WRITE_TOKEN });
      const response = await fetch(meta.url);
      if (!response.ok) return null;
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  try {
    return new Uint8Array(await readFile(join(localRoot(), key)));
  } catch {
    return null;
  }
}

export async function deleteProof(key: string): Promise<void> {
  assertSafeKey(key);

  if (usingBlob()) {
    const { del } = await import("@vercel/blob");
    await del(key, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return;
  }

  await rm(join(localRoot(), key), { force: true });
}
