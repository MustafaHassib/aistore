import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionShell } from "@/components/ui/SectionShell";
import { PRICING } from "@/config/pricing";
import { formatMoney, formatNumber, percentOff } from "@/lib/format";
import type { Locale } from "@/lib/types";

type OfferItem = {
  icon?: string;
  title: string;
  desc?: string;
  price: number | null;
};

export function OfferStack({
  id,
  namespace,
  band = "base",
}: {
  id: string;
  namespace: string;
  band?: "base" | "alt";
}) {
  const t = useTranslations(namespace);
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;

  const items = t.raw("items") as OfferItem[];
  const currency = tc("currency");

  // Derived, never authored: the stack total always matches the line items.
  const totalValue = items.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const percent = percentOff(PRICING.original, PRICING.main);

  return (
    <SectionShell
      id={id}
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      sub={t("sub")}
      band={band}
    >
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.title}
              className="flex items-start gap-4 rounded-card border border-line bg-surface p-4"
            >
              {item.icon ? (
                <span aria-hidden="true" className="text-xl">
                  {item.icon}
                </span>
              ) : null}

              <div className="flex-1">
                <h3 className="text-sm font-bold text-ink">{item.title}</h3>
                {item.desc ? (
                  <p className="mt-1 text-xs leading-relaxed text-ink-2">
                    {item.desc}
                  </p>
                ) : null}
              </div>

              <span className="whitespace-nowrap text-xs font-bold text-ink-3">
                {item.price === null
                  ? t("ongoing")
                  : formatMoney(item.price, locale, currency)}
              </span>
            </li>
          ))}
        </ul>

        <Card className="lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            {t("totalLabel")}
          </p>
          <p
            data-testid="offer-total"
            className="text-xl font-bold text-ink-3 line-through"
          >
            {formatMoney(totalValue, locale, currency)}
          </p>

          <hr className="my-4 border-line" />

          <p className="text-xs text-ink-3">
            {t("wasLabel")}:{" "}
            <span data-testid="offer-was" className="line-through">
              {formatNumber(PRICING.original, locale)}
            </span>
          </p>

          <p className="mt-1 text-xs font-semibold text-ink-2">{t("nowLabel")}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span
              data-testid="offer-now"
              className="text-5xl font-bold tracking-tight text-ink"
            >
              {formatNumber(PRICING.main, locale)}
            </span>
            <span className="text-base font-semibold text-ink-2">{currency}</span>
          </p>

          <span className="mt-3 inline-flex rounded-control border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
            {t("savingsLabel", { percent })}
          </span>

          <Button as="a" href="#order" className="mt-6 w-full">
            {t("cta")} <span aria-hidden="true">←</span>
          </Button>

          <p className="mt-3 text-center text-[11px] text-ink-3">{t("trust")}</p>
        </Card>
      </div>
    </SectionShell>
  );
}
