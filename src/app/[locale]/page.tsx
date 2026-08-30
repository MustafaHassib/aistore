import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("meta");

  return (
    <main className="mx-auto max-w-page px-6 py-24">
      <h1 className="text-4xl font-bold">{t("title")}</h1>
    </main>
  );
}
