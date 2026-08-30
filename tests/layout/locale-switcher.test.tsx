import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import messages from "../../messages/en.json";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  Link: ({
    children,
    href,
    locale,
    ...rest
  }: React.ComponentProps<"a"> & { href: string; locale?: string }) => (
    <a href={href} data-locale={locale} {...rest}>
      {children}
    </a>
  ),
}));

function renderSwitcher(locale: "ar" | "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleSwitcher />
    </NextIntlClientProvider>,
  );
}

describe("LocaleSwitcher", () => {
  it("links to the other locale on the same path", () => {
    renderSwitcher("en");

    const link = screen.getByRole("link", { name: messages.common.switchTo });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveAttribute("data-locale", "ar");
  });

  it("declares the target language with hrefLang", () => {
    renderSwitcher("en");
    expect(screen.getByRole("link")).toHaveAttribute("hreflang", "ar");
  });

  it("targets English when the current locale is Arabic", () => {
    renderSwitcher("ar");
    expect(screen.getByRole("link")).toHaveAttribute("data-locale", "en");
  });
});
