import { setRequestLocale } from "next-intl/server";
import { SectionRenderer } from "@/components/sections/SectionRenderer";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <SectionRenderer />
    </main>
  );
}
