import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { PRICING } from "@/config/pricing";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/types";

export function FinalCta() {
  const t = useTranslations("finalCta");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;

  return (
    <section id="finalCta" aria-labelledby="finalCta-heading" className="bg-bg">
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2
          id="finalCta-heading"
          className="text-3xl font-bold leading-tight tracking-tight md:text-4xl"
        >
          {t("heading")}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-ink-2">{t("sub")}</p>
        <div className="mt-8">
          <Button as="a" href="#order">
            {t("cta", {
              price: formatMoney(PRICING.main, locale, tc("currency")),
            })}{" "}
            <span aria-hidden="true">←</span>
          </Button>
        </div>
        <p className="mt-3 text-xs text-ink-3">{t("trust")}</p>
      </div>
    </section>
  );
}
