import type { Locale } from "@/lib/types";

/**
 * `-u-nu-latn` forces Western digits in Arabic. Egyptian marketing copy uses
 * them, and the design depends on their glyph widths — Arabic-Indic numerals
 * would change every price's footprint.
 */
const INTL_LOCALE: Record<Locale, string> = {
  ar: "ar-EG-u-nu-latn",
  en: "en-US",
};

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

export function formatMoney(
  value: number,
  locale: Locale,
  currency: string,
): string {
  return `${formatNumber(value, locale)} ${currency}`;
}

/** Rounded discount percentage, floored at 0 so a price rise never reads as a deal. */
export function percentOff(from: number, to: number): number {
  if (from <= 0 || to >= from) return 0;
  return Math.round(((from - to) / from) * 100);
}
