import { defineRouting } from "next-intl/routing";
import { LOCALES } from "@/lib/types";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "ar",
  // Both locales always carry their prefix, so each has its own crawlable URL
  // and neither is served from an ambiguous root.
  localePrefix: "always",
});
