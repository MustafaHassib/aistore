import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/types";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export function absoluteUrl(path: string): string {
  return `${SITE_URL}/${path.replace(/^\/+/, "")}`;
}

/**
 * Canonical plus hreflang alternates. Without these, two locales of the same
 * page read as duplicate content and compete with each other in search results
 * instead of each ranking for its own language.
 */
export function alternatesFor(
  path = "/",
  locale: Locale = routing.defaultLocale,
): { canonical: string; languages: Record<string, string> } {
  const suffix = path === "/" ? "" : `/${path.replace(/^\/+/, "")}`;

  const languages: Record<string, string> = {};
  for (const supported of routing.locales) {
    languages[supported] = absoluteUrl(`/${supported}${suffix}`);
  }
  languages["x-default"] = absoluteUrl(`/${routing.defaultLocale}${suffix}`);

  return {
    canonical: absoluteUrl(`/${locale}${suffix}`),
    languages,
  };
}
