"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  DEADLINE_STORAGE_KEY,
  resolveDeadline,
  splitRemaining,
} from "@/lib/countdown";
import { formatMoney, percentOff } from "@/lib/format";
import { PRICING } from "@/config/pricing";
import type { Locale } from "@/lib/types";

const WINDOW_HOURS = 24;

export function CountdownTopbar() {
  const t = useTranslations("topbar");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;

  // null until the effect runs, so server and first client render agree.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(DEADLINE_STORAGE_KEY);
    const deadline = resolveDeadline(Date.now(), stored, WINDOW_HOURS);
    window.localStorage.setItem(DEADLINE_STORAGE_KEY, String(deadline));

    const tick = () => setRemaining(deadline - Date.now());
    tick();

    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const currency = tc("currency");
  const offer = t("offer", {
    percent: percentOff(PRICING.original, PRICING.main),
    now: formatMoney(PRICING.main, locale, currency),
    was: formatMoney(PRICING.original, locale, currency),
  });

  const expired = remaining !== null && remaining <= 0;
  const parts = remaining !== null && !expired ? splitRemaining(remaining) : null;

  return (
    <div className="sticky top-0 z-50 border-b-[1.5px] border-line-strong bg-accent text-white">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-center gap-x-4 gap-y-1 px-5 py-2 text-center text-xs font-semibold md:text-sm">
        <span>🔥 {offer}</span>

        {expired ? <span className="opacity-90">{t("expired")}</span> : null}

        {parts ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="opacity-90">{t("endsIn")}</span>
            {/* Clock values read left-to-right in Arabic too; inheriting RTL
                here would render them as SS:MM:HH. */}
            <span
              data-testid="countdown-clock"
              dir="ltr"
              className="inline-flex items-center gap-1 font-mono tabular-nums"
            >
              <b data-testid="countdown-hours">{parts.hours}</b>:
              <b data-testid="countdown-minutes">{parts.minutes}</b>:
              <b data-testid="countdown-seconds">{parts.seconds}</b>
            </span>
          </span>
        ) : null}

        <span className="hidden opacity-80 sm:inline">
          ⚡ {t("instantDelivery")} · 🔒 {t("securePayment")}
        </span>
      </div>
    </div>
  );
}
