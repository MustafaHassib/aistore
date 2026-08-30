import { useTranslations } from "next-intl";
import { Placeholder, type Ratio } from "@/components/ui/Placeholder";
import { VideoCard } from "@/components/ui/VideoCard";
import { SectionShell } from "@/components/ui/SectionShell";

export type MediaItem = {
  kind?: "image" | "video";
  label: string;
  ratio?: Ratio;
  title?: string;
  caption?: string;
  badge?: string;
};

const COLUMNS: Record<1 | 2 | 3, string> = {
  1: "mx-auto max-w-3xl",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
};

/**
 * Serves every section shaped as "heading plus a grid of media" — the proof
 * sections, the demo, sample videos, and reviews.
 */
export function MediaGrid({
  id,
  namespace,
  columns = 3,
  band = "base",
}: {
  id: string;
  namespace: string;
  columns?: 1 | 2 | 3;
  band?: "base" | "alt";
}) {
  const t = useTranslations(namespace);
  const items = t.raw("items") as MediaItem[];
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
          <li key={item.label} className="flex flex-col gap-3">
            {item.kind === "video" ? (
              <VideoCard label={item.label} ratio={item.ratio} />
            ) : (
              <Placeholder label={item.label} ratio={item.ratio} />
            )}

            {item.badge ? (
              <span className="inline-flex w-fit rounded-control bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                {item.badge}
              </span>
            ) : null}
            {item.title ? (
              <h3 className="text-base font-bold">{item.title}</h3>
            ) : null}
            {item.caption ? (
              <p className="text-sm text-ink-2">{item.caption}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
