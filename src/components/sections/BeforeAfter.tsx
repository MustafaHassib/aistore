import { useTranslations } from "next-intl";
import { SectionShell } from "@/components/ui/SectionShell";

type Column = { label: string; items: string[] };

export function BeforeAfter({
  id,
  namespace,
  band = "alt",
}: {
  id: string;
  namespace: string;
  band?: "base" | "alt";
}) {
  const t = useTranslations(namespace);
  const before = t.raw("before") as Column;
  const after = t.raw("after") as Column;
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
      <div className="grid items-start gap-5 md:grid-cols-[1fr_auto_1fr]">
        <Column
          testId="before-column"
          label={before.label}
          items={before.items}
          tone="danger"
        />

        {/* Rotates a quarter turn where the columns stack, and mirrors in RTL.
            The arrow carries directional meaning, so a transform is correct
            here — a logical property cannot flip a glyph. */}
        <div
          data-testid="before-after-arrow"
          aria-hidden="true"
          className="mx-auto rotate-90 text-2xl text-ink-3 md:rotate-0 md:self-center rtl:md:-scale-x-100"
        >
          →
        </div>

        <Column
          testId="after-column"
          label={after.label}
          items={after.items}
          tone="success"
        />
      </div>
    </SectionShell>
  );
}

function Column({
  testId,
  label,
  items,
  tone,
}: {
  testId: string;
  label: string;
  items: string[];
  tone: "danger" | "success";
}) {
  const accent =
    tone === "danger"
      ? "border-danger/30 bg-surface text-danger"
      : "border-success/30 bg-success-soft text-success";

  return (
    <div
      data-testid={testId}
      className="rounded-card border-[1.5px] border-line-strong bg-surface p-6 shadow-card"
    >
      <h3
        className={`mb-4 inline-flex rounded-control border px-3 py-1.5 text-sm font-bold ${accent}`}
      >
        {label}
      </h3>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item}
            className="border-b border-line pb-3 text-sm text-ink-2 last:border-b-0 last:pb-0"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
