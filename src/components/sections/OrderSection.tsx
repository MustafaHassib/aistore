import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { SectionShell } from "@/components/ui/SectionShell";

/**
 * Placeholder. Plan B (order intake) replaces this card body with the real
 * form. The id="order" anchor is load-bearing: the hero CTA, the offer CTA,
 * the sticky mobile bar, and both exit-popup stages all target it.
 */
export function OrderSection({
  id,
  namespace,
  band = "alt",
}: {
  id: string;
  namespace: string;
  band?: "base" | "alt";
}) {
  const t = useTranslations(namespace);

  return (
    <SectionShell
      id={id}
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      sub={t("sub")}
      band={band}
    >
      <Card className="mx-auto max-w-xl text-center">
        <p className="text-sm text-ink-3">{t("placeholder")}</p>
      </Card>
    </SectionShell>
  );
}
