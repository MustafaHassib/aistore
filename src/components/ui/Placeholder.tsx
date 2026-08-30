const RATIOS = {
  "16/9": "aspect-video",
  "9/16": "aspect-[9/16]",
  "1/1": "aspect-square",
  "4/3": "aspect-[4/3]",
} as const;

export type Ratio = keyof typeof RATIOS;

/**
 * A labelled asset slot. Keeps the layout correctly proportioned before real
 * imagery exists, and states plainly what belongs there so filling the site in
 * is a matter of reading the page rather than reading the code.
 */
export function Placeholder({
  label,
  ratio = "16/9",
}: {
  label: string;
  ratio?: Ratio;
}) {
  return (
    <div
      role="img"
      aria-label={`Placeholder: ${label}`}
      className={`${RATIOS[ratio]} flex w-full flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line bg-surface-2 p-4 text-center`}
    >
      <span aria-hidden="true" className="text-2xl opacity-40">
        🖼
      </span>
      <span className="text-xs font-semibold text-ink-3">Replace: {label}</span>
      <span className="text-[10px] uppercase tracking-wider text-ink-3">
        {ratio}
      </span>
    </div>
  );
}
