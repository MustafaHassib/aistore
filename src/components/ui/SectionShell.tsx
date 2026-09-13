import { Eyebrow } from "./Eyebrow";

/**
 * The frame every section shares: eyebrow, heading, optional sub-copy, and an
 * alternating background band. Sections supply only their content.
 */
export function SectionShell({
  id,
  eyebrow,
  heading,
  sub,
  band = "base",
  children,
}: {
  id: string;
  eyebrow?: string;
  heading: React.ReactNode;
  sub?: string;
  band?: "base" | "alt";
  children: React.ReactNode;
}) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={band === "alt" ? "bg-surface-2" : "bg-bg"}
    >
      <div className="mx-auto max-w-page px-5 py-16 md:py-24">
        <header className="mb-10 max-w-3xl">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h2
            id={headingId}
            className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-4xl"
          >
            {heading}
          </h2>
          {sub ? (
            <p className="mt-4 text-base leading-relaxed text-ink-2">{sub}</p>
          ) : null}
        </header>
        {children}
      </div>
    </section>
  );
}
