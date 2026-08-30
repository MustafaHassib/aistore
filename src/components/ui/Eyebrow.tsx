export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-control border border-accent-line bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent">
      {children}
    </span>
  );
}
