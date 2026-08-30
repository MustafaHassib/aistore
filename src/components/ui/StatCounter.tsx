"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/types";

const DURATION_MS = 1200;

export function StatCounter({
  value,
  label,
  suffix = "",
  locale,
}: {
  value: number;
  label: string;
  suffix?: string;
  locale: Locale;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Starts at the final value so the server HTML, no-JS visitors, crawlers,
  // and anyone who prefers reduced motion all see the real figure. The count-up
  // only replaces it once the element scrolls into view with motion allowed.
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / DURATION_MS);
          // Ease-out cubic: quick off the mark, settled at the end.
          const eased = 1 - Math.pow(1 - progress, 3);
          setShown(Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <div ref={ref} className="text-center">
      <div
        data-testid="stat-value"
        className="text-4xl font-bold tabular-nums text-ink md:text-5xl"
      >
        {formatNumber(shown, locale)}
        {suffix}
      </div>
      <p className="mt-2 text-sm text-ink-3">{label}</p>
    </div>
  );
}
