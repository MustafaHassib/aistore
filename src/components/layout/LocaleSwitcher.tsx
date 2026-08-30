"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/lib/types";

/**
 * Swaps locale on the current path rather than sending the visitor home, and
 * lets next-intl persist the choice so a return visit skips negotiation.
 */
export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const t = useTranslations("common");

  const other: Locale = locale === "ar" ? "en" : "ar";

  return (
    <Link
      href={pathname}
      locale={other}
      hrefLang={other}
      className="inline-flex w-fit rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2"
    >
      {t("switchTo")}
    </Link>
  );
}
