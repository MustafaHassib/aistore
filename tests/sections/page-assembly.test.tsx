import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { SECTIONS } from "@/config/sections";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

function renderPage(locale: "ar" | "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "ar" ? ar : en}
    >
      <SectionRenderer />
    </NextIntlClientProvider>,
  );
}

describe("page assembly", () => {
  it("renders an element for every section in the manifest", () => {
    const { container } = renderPage("en");

    for (const section of SECTIONS) {
      expect(
        container.querySelector(`#${section.id}`),
        `No element rendered with id "${section.id}"`,
      ).not.toBeNull();
    }
  });

  it("renders the sections in manifest order", () => {
    const { container } = renderPage("en");

    const rendered = Array.from(container.querySelectorAll("section[id]")).map(
      (node) => node.id,
    );

    expect(rendered).toEqual(SECTIONS.map((section) => section.id));
  });

  it("renders the same section set in Arabic", () => {
    const { container } = renderPage("ar");

    const rendered = Array.from(container.querySelectorAll("section[id]")).map(
      (node) => node.id,
    );

    expect(rendered).toEqual(SECTIONS.map((section) => section.id));
  });

  it("renders exactly one h1 across the whole page", () => {
    const { container } = renderPage("en");
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("gives every section heading an accessible name", () => {
    const { container } = renderPage("en");

    for (const section of container.querySelectorAll("section[id]")) {
      const labelled =
        section.getAttribute("aria-labelledby") ??
        section.getAttribute("aria-label");
      expect(labelled, `Section "${section.id}" has no accessible name`).toBeTruthy();
    }
  });

  it("carries at least one order call to action", () => {
    const { container } = renderPage("en");
    expect(
      container.querySelectorAll('a[href="#order"]').length,
    ).toBeGreaterThan(1);
  });
});
