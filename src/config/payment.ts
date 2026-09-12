/** Replace both with the owner's real destinations before launch. */
export const PAYMENT = {
  instapayUrl: process.env.NEXT_PUBLIC_INSTAPAY_URL ?? "",
  etisalatNumber: process.env.NEXT_PUBLIC_ETISALAT_NUMBER ?? "",
} as const;
