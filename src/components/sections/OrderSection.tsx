import { useTranslations } from "next-intl";
import { SectionShell } from "@/components/ui/SectionShell";
import { OrderForm } from "@/components/order/OrderForm";

/**
 * The id="order" anchor is load-bearing: the hero CTA, the offer CTA, the
 * sticky mobile bar, and both exit-popup stages all target it.
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
      <OrderForm />
    </SectionShell>
  );
}
