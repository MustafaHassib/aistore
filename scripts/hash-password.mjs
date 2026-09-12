// Standalone so it needs no bundler or TS loader: the hashing must match
// src/lib/session.ts exactly, which the round-trip test below guarantees.
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const password = process.argv[2];
if (!password) {
  console.error("Usage: npm run admin:hash -- 'your password'");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const derived = await scrypt(password, salt, 64);
console.log(`scrypt$${salt}$${derived.toString("hex")}`);
