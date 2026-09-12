import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  // A confirmation page has nothing to rank for and should not be indexed.
  robots: { index: false, follow: false },
};

export default async function ThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { ref } = await searchParams;
  const t = await getTranslations("thanks");

  // Rendered rather than trusted: only ever display a well-formed reference.
  const reference = ref && /^DA-[0-9A-Z]{5}$/.test(ref) ? ref : null;

  return (
    <main className="mx-auto flex max-w-xl flex-col justify-center px-5 py-24">
      <Card className="text-center">
        <p aria-hidden="true" className="text-4xl">
          ✅
        </p>
        <h1 className="mt-4 text-2xl font-bold text-ink">{t("title")}</h1>

        {reference ? (
          <p className="mt-4">
            <span className="text-xs text-ink-3">{t("referenceLabel")}</span>
            <br />
            <span dir="ltr" className="font-mono text-xl font-bold text-ink">
              {reference}
            </span>
          </p>
        ) : null}

        <p className="mt-4 text-sm leading-relaxed text-ink-2">{t("body")}</p>

        <div className="mt-6">
          <Button as="a" href={`/${locale}`} size="md">
            {t("back")}
          </Button>
        </div>
      </Card>
    </main>
  );
}
