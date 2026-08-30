import { useTranslations } from "next-intl";
import { SectionShell } from "@/components/ui/SectionShell";

type FaqItem = { q: string; a: string };

/**
 * Built on native details/summary: keyboard-accessible without any handlers,
 * and the answers still open with JavaScript disabled.
 */
export function Faq({
  id,
  namespace,
  band = "alt",
}: {
  id: string;
  namespace: string;
  band?: "base" | "alt";
}) {
  const t = useTranslations(namespace);
  const items = t.raw("items") as FaqItem[];

  return (
    <SectionShell
      id={id}
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      sub={t("sub")}
      band={band}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {items.map((item) => (
          <details
            key={item.q}
            className="group rounded-card border-[1.5px] border-line-strong bg-surface px-5 shadow-card"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-bold text-ink marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              {item.q}
              <span
                aria-hidden="true"
                className="shrink-0 text-lg text-accent transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="border-t border-line py-4 text-sm leading-relaxed text-ink-2">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}
