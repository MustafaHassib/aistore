import { amountFor } from "@/config/pricing";
import { getDb } from "./db";
import { orders } from "./schema";
import { checkRateLimit } from "./rate-limit";
import { extensionFor, sniffImageType } from "./file-type";
import { makeReference } from "./reference";
import { putProof } from "./storage";
import { MAX_PROOF_BYTES, orderFieldsSchema } from "./validation";

export type OrderResult =
  | { ok: true; reference: string }
  | { ok: false; status: number; error: string };

/**
 * Configurable so end-to-end runs, which all originate from one address, do
 * not trip a limit meant for the public internet. Production leaves it unset.
 */
const RATE_LIMIT = Number(process.env.ORDER_RATE_LIMIT ?? 5);
const RATE_WINDOW_MS = 60 * 60 * 1000;

function text(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export async function createOrder(
  form: FormData,
  ip: string,
): Promise<OrderResult> {
  // Cheapest rejection first, before parsing or buffering anything.
  const allowed = await checkRateLimit(
    `orders:${ip}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!allowed) {
    return { ok: false, status: 429, error: "too_many_requests" };
  }

  const parsed = orderFieldsSchema.safeParse({
    name: text(form, "name"),
    phone: text(form, "phone"),
    email: text(form, "email"),
    paymentMethod: text(form, "paymentMethod"),
    offerCode: text(form, "offerCode"),
    locale: text(form, "locale"),
    utmSource: text(form, "utmSource"),
    utmMedium: text(form, "utmMedium"),
    utmCampaign: text(form, "utmCampaign"),
    utmContent: text(form, "utmContent"),
    utmTerm: text(form, "utmTerm"),
    referrer: text(form, "referrer"),
    landingPage: text(form, "landingPage"),
  });

  if (!parsed.success) {
    return { ok: false, status: 422, error: "invalid_fields" };
  }

  const proof = form.get("proof");
  if (!(proof instanceof File) || proof.size === 0) {
    return { ok: false, status: 422, error: "missing_proof" };
  }

  // Checked before reading the body into memory.
  if (proof.size > MAX_PROOF_BYTES) {
    return { ok: false, status: 413, error: "proof_too_large" };
  }

  const bytes = new Uint8Array(await proof.arrayBuffer());
  const imageType = sniffImageType(bytes);
  if (!imageType) {
    return { ok: false, status: 415, error: "unsupported_file" };
  }

  const proofKey = await putProof(bytes, extensionFor(imageType));
  const fields = parsed.data;

  const db = await getDb();
  const [row] = await db
    .insert(orders)
    .values({
      ...fields,
      reference: makeReference(),
      // Resolved here, never read from the request.
      amount: amountFor(fields.offerCode),
      proofKey,
    })
    .returning({ reference: orders.reference });

  return { ok: true, reference: row.reference };
}
