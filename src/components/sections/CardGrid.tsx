import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { SectionShell } from "@/components/ui/SectionShell";

export type CardItem = {
  icon?: string;
  title: string;
  desc?: string;
  note?: string;
};

const COLUMNS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * Serves every section shaped as "heading plus a grid of short cards" —
 * pain points, how it works, objections, and the three proof sections.
 * A new one is a manifest entry plus a message namespace, not a new component.
 */
export function CardGrid({
  id,
  namespace,
  columns = 3,
  band = "base",
}: {
  id: string;
  namespace: string;
  columns?: 2 | 3 | 4;
  band?: "base" | "alt";
}) {
  const t = useTranslations(namespace);
  const items = t.raw("items") as CardItem[];
  const eyebrow = t.has("eyebrow") ? t("eyebrow") : undefined;
  const sub = t.has("sub") ? t("sub") : undefined;

  return (
    <SectionShell
      id={id}
      eyebrow={eyebrow}
      heading={t("heading")}
      sub={sub}
      band={band}
    >
      <ul className={`grid gap-5 ${COLUMNS[columns]}`}>
        {items.map((item) => (
          <li key={item.title}>
            <Card className="h-full">
              {item.icon ? (
                <span
                  data-testid="card-icon"
                  aria-hidden="true"
                  className="block text-2xl"
                >
                  {item.icon}
                </span>
              ) : null}
              <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
              {item.desc ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  {item.desc}
                </p>
              ) : null}
              {item.note ? (
                <p className="mt-3 text-xs font-semibold text-success">
                  {item.note}
                </p>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
