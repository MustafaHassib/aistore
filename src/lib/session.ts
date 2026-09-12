import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const KEY_LENGTH = 64;

export async function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
): Promise<string> {
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, salt, digest] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !digest) return false;

  const derived = await scrypt(password, salt, KEY_LENGTH);
  const expected = Buffer.from(digest, "hex");

  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signSession(
  claims: Record<string, unknown>,
  maxAgeMs: number = SESSION_MAX_AGE_MS,
): string {
  const body = JSON.stringify({ ...claims, exp: Date.now() + maxAgeMs });
  const payload = Buffer.from(body).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expected = sign(payload);

  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof claims.exp !== "number" || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
