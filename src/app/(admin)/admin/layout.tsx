import type { Metadata } from "next";
import "../../globals.css";

export const metadata: Metadata = {
  title: "Orders admin",
  // An operator tool, never an index target.
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body className="bg-bg text-ink-2 antialiased">{children}</body>
    </html>
  );
}
