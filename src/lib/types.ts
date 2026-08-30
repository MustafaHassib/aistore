export const LOCALES = ["ar", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export type Direction = "rtl" | "ltr";

export function directionOf(locale: Locale): Direction {
  return locale === "ar" ? "rtl" : "ltr";
}
