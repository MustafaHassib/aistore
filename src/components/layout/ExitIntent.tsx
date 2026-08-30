"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { PRICING } from "@/config/pricing";
import { formatMoney, percentOff } from "@/lib/format";
import { EXIT_STORAGE_KEY, nextStage } from "@/lib/exit-intent";
import type { Locale } from "@/lib/types";

type Stage = {
  eyebrow: string;
  heading: string;
  sub: string;
  cta: string;
  dismiss: string;
};

const STAGE_PRICE = [PRICING.exit, PRICING.mini];

export function ExitIntent() {
  const t = useTranslations("exitIntent");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const stages = t.raw("stages") as Stage[];

  const [active, setActive] = useState<0 | 1 | null>(null);

  const tryOpen = useCallback(() => {
    setActive((current) => {
      if (current !== null) return current;
      return nextStage(window.sessionStorage.getItem(EXIT_STORAGE_KEY));
    });
  }, []);

  useEffect(() => {
    const onMouseOut = (event: MouseEvent) => {
      // Only a departure through the top edge counts; relatedTarget is null
      // when the cursor leaves the document rather than moving between nodes.
      if (event.relatedTarget === null && event.clientY <= 0) tryOpen();
    };

    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [tryOpen]);

  const dismiss = () => {
    setActive((current) => {
      if (current !== null) {
        window.sessionStorage.setItem(EXIT_STORAGE_KEY, String(current));
      }
      return null;
    });
  };

  if (active === null) return null;

  const stage = stages[active];
  const currency = tc("currency");
  const price = formatMoney(STAGE_PRICE[active], locale, currency);
  const percent = percentOff(PRICING.main, PRICING.exit);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/50 p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-heading"
        className="w-full max-w-md rounded-card border-[1.5px] border-line-strong bg-surface p-7 text-center shadow-card"
      >
        <span className="inline-flex rounded-control border border-accent-line bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent">
          {stage.eyebrow}
        </span>

        <h2 id="exit-heading" className="mt-4 text-2xl font-bold leading-snug">
          {t(`stages.${active}.heading`, { percent })}
        </h2>
        <p className="mt-3 text-sm text-ink-2">{stage.sub}</p>

        <p className="mt-5 text-4xl font-bold tracking-tight text-ink">{price}</p>

        <Button as="a" href="#order" className="mt-6 w-full" onClick={dismiss}>
          {t(`stages.${active}.cta`, { price })}
        </Button>

        <button
          type="button"
          onClick={dismiss}
          className="mt-3 w-full text-xs font-semibold text-ink-3 underline"
        >
          {stage.dismiss}
        </button>
      </div>
    </div>
  );
}
