export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border-[1.5px] border-line-strong bg-surface p-6 shadow-card ${className}`}
    >
      {children}
    </div>
  );
}
