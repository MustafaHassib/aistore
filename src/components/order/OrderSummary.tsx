import { useLocale, useTranslations } from "next-intl";
import { PRICING } from "@/config/pricing";
import { formatMoney, formatNumber, percentOff } from "@/lib/format";
import type { Locale } from "@/lib/types";

export function OrderSummary() {
  const t = useTranslations("orderForm");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const includes = t.raw("includes") as string[];

  return (
    <div className="rounded-card border border-line bg-surface-2 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
        {t("summaryTitle")}
      </p>
      <p className="mt-2 text-sm font-bold text-ink">{t("productName")}</p>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-sm text-ink-3 line-through">
          {formatNumber(PRICING.original, locale)}
        </span>
        <span className="text-3xl font-bold text-ink">
          {formatNumber(PRICING.main, locale)}
        </span>
        <span className="text-sm font-semibold text-ink-2">{tc("currency")}</span>
      </p>

      <span className="mt-2 inline-flex rounded-control bg-success-soft px-2 py-1 text-xs font-bold text-success">
        −{percentOff(PRICING.original, PRICING.main)}% ·{" "}
        {formatMoney(PRICING.original - PRICING.main, locale, tc("currency"))}
      </span>

      <ul className="mt-4 flex flex-col gap-2">
        {includes.map((item) => (
          <li key={item} className="flex gap-2 text-xs text-ink-2">
            <span aria-hidden="true" className="text-success">
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
