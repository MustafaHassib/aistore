import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t-[1.5px] border-line-strong bg-surface-2">
      <div className="mx-auto flex max-w-page flex-col gap-4 px-5 py-10 text-sm text-ink-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold text-ink">{t("brand")}</p>
          <p className="mt-2">{t("rights", { year: new Date().getFullYear() })}</p>
          <p className="mt-1 max-w-prose text-xs">{t("disclaimer")}</p>
        </div>
        <LocaleSwitcher />
      </div>
    </footer>
  );
}
