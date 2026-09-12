import { randomInt } from "node:crypto";

/** No O/I/L/0/1: customers read these back to support over the phone. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function makeReference(): string {
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `DA-${code}`;
}
