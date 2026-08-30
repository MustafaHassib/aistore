import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { absoluteUrl, alternatesFor } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const { languages } = alternatesFor("/");

  return routing.locales.map((locale) => ({
    url: absoluteUrl(`/${locale}`),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: locale === routing.defaultLocale ? 1 : 0.9,
    alternates: { languages },
  }));
}
