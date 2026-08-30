import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Highlight } from "@/components/ui/Highlight";
import { Placeholder } from "@/components/ui/Placeholder";

export function Hero() {
  const t = useTranslations("hero");
  const pains = t.raw("pains") as string[];
  const chips = t.raw("chips") as string[];

  return (
    <section id="hero" aria-labelledby="hero-heading" className="bg-bg">
      <div className="mx-auto grid max-w-page items-center gap-12 px-5 py-14 md:py-20 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <ul className="flex flex-wrap gap-2">
            {pains.map((pain) => (
              <li
                key={pain}
                className="rounded-control border border-line bg-surface px-3 py-1.5 text-xs text-ink-3"
              >
                {pain}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm font-semibold text-accent">{t("kicker")}</p>

          <h1
            id="hero-heading"
            className="mt-3 text-4xl font-bold leading-[1.25] tracking-tight md:text-5xl"
          >
            {t("headlineBefore")} <Highlight>{t("headlineHighlight")}</Highlight>{" "}
            {t("headlineAfter")}
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2">
            {t("sub")}
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Chip key={chip}>{chip}</Chip>
            ))}
          </div>

          <div className="mt-8">
            <Button as="a" href="#order">
              {t("cta")} <span aria-hidden="true">←</span>
            </Button>
            <p className="mt-3 text-xs text-ink-3">{t("trust")}</p>
          </div>
        </div>

        <Placeholder label={t("coverAsset")} ratio="4/3" />
      </div>
    </section>
  );
}
