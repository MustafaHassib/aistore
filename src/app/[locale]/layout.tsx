import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { routing } from "@/i18n/routing";
import { directionOf, type Locale } from "@/lib/types";
import { absoluteUrl, alternatesFor, SITE_URL } from "@/lib/site";
import { CountdownTopbar } from "@/components/layout/CountdownTopbar";
import { ExitIntent } from "@/components/layout/ExitIntent";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { StickyMobileCta } from "@/components/layout/StickyMobileCta";
import "../globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const typed = locale as Locale;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL(SITE_URL),
    title: t("title"),
    description: t("description"),
    alternates: alternatesFor("/", typed),
    openGraph: {
      type: "website",
      locale: typed === "ar" ? "ar_EG" : "en_US",
      url: absoluteUrl(`/${typed}`),
      title: t("title"),
      description: t("description"),
      siteName: t("siteName"),
      // Static per-locale share cards. Dynamic generation via next/og was
      // dropped: Satori cannot shape Arabic text (it fails on GSUB
      // lookupType 5 / substFormat 3 in every Arabic face tried), so the
      // Arabic card would have been unrenderable. Replace these two files
      // with designed artwork — 1200x630.
      images: [{ url: `/og/${typed}.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [`/og/${typed}.png`],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  const typed = locale as Locale;
  const dir = directionOf(typed);
  const fontClass = typed === "ar" ? "font-ar" : "font-en";

  return (
    <html
      lang={typed}
      dir={dir}
      className={`${plexArabic.variable} ${inter.variable}`}
    >
      <body className={`${fontClass} bg-bg text-ink-2 antialiased`}>
        <NextIntlClientProvider>
          <CountdownTopbar />
          {children}
          <SiteFooter />
          <StickyMobileCta />
          <ExitIntent />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
