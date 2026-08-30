/** The marker sweep behind an emphasised headline phrase. */
export function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="marker-sweep">{children}</span>;
}
