import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/sections/Hero";
import { HeroStats } from "@/components/sections/HeroStats";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <Hero />
      <HeroStats />
    </main>
  );
}
