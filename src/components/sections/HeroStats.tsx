import { useLocale, useTranslations } from "next-intl";
import { StatCounter } from "@/components/ui/StatCounter";
import type { Locale } from "@/lib/types";

type StatItem = { value: number; suffix?: string; label: string };

export function HeroStats() {
  const t = useTranslations("heroStats");
  const locale = useLocale() as Locale;
  const items = t.raw("items") as StatItem[];

  return (
    <section
      id="heroStats"
      aria-label={t("label")}
      className="border-y-[1.5px] border-line-strong bg-surface-2"
    >
      <div className="mx-auto grid max-w-page grid-cols-2 gap-8 px-5 py-12 md:grid-cols-4">
        {items.map((item) => (
          <StatCounter
            key={item.label}
            value={item.value}
            suffix={item.suffix}
            label={item.label}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}
