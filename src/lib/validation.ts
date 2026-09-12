import { z } from "zod";

export const PAYMENT_METHODS = ["instapay", "etisalat"] as const;
export const OFFER_CODES = ["main", "exit60", "mini"] as const;

/** Egyptian mobile numbers: 010, 011, 012, and 015, then eight digits. */
const EGYPT_MOBILE = /^01[0125]\d{8}$/;

export const MAX_PROOF_BYTES = 6 * 1024 * 1024;

/**
 * Shared by the browser and the route handler, so the two cannot disagree
 * about what a valid order is.
 *
 * `amount` is deliberately absent: Zod strips unknown keys, so a client that
 * submits one is ignored rather than trusted. The server resolves it from
 * `offerCode`.
 */
export const orderFieldsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(EGYPT_MOBILE, "invalid_phone"),
  email: z.email().max(120).transform((value) => value.trim().toLowerCase()),
  paymentMethod: z.enum(PAYMENT_METHODS),
  offerCode: z.enum(OFFER_CODES),
  locale: z.enum(["ar", "en"]),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
  utmContent: z.string().trim().max(120).optional(),
  utmTerm: z.string().trim().max(120).optional(),
  referrer: z.string().trim().max(500).optional(),
  landingPage: z.string().trim().max(500).optional(),
});

export type OrderFields = z.infer<typeof orderFieldsSchema>;
