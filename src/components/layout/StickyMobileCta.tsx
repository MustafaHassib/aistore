"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";
import { PRICING } from "@/config/pricing";
import type { Locale } from "@/lib/types";

/**
 * Appears on small viewports once the hero has scrolled away, and hides again
 * while the order section is on screen so it never covers the form it points at.
 */
export function StickyMobileCta() {
  const t = useTranslations("stickyCta");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) return;

    const order = document.getElementById("order");

    let heroGone = false;
    let orderVisible = false;
    const sync = () => setVisible(heroGone && !orderVisible);

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        heroGone = !entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    heroObserver.observe(hero);

    let orderObserver: IntersectionObserver | undefined;
    if (order) {
      orderObserver = new IntersectionObserver(
        ([entry]) => {
          orderVisible = entry.isIntersecting;
          sync();
        },
        { threshold: 0 },
      );
      orderObserver.observe(order);
    }

    return () => {
      heroObserver.disconnect();
      orderObserver?.disconnect();
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-line-strong bg-surface p-3 md:hidden">
      <Button as="a" href="#order" size="md" className="w-full">
        {t("label", { price: formatMoney(PRICING.main, locale, tc("currency")) })}
      </Button>
    </div>
  );
}
