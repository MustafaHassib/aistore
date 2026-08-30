/**
 * Every amount shown anywhere on the site. The topbar, offer card, order
 * summary, exit popups, and CTA labels all read from here, so changing a price
 * is a one-line edit rather than a hunt through message files.
 */
export const PRICING = {
  original: 1999,
  main: 999,
  exit: 399,
  mini: 149,
} as const;

export type OfferCode = "main" | "exit60" | "mini";

const AMOUNTS: Record<OfferCode, number> = {
  main: PRICING.main,
  exit60: PRICING.exit,
  mini: PRICING.mini,
};

/**
 * Resolves an offer code to its amount. Plan B's API calls this server-side so
 * a price is never accepted from the client — a price the client submits is a
 * price the customer can edit.
 */
export function amountFor(code: OfferCode): number {
  return AMOUNTS[code];
}
