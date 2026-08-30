import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Hero } from "@/components/sections/Hero";
import messages from "../../messages/en.json";

function renderHero() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Hero />
    </NextIntlClientProvider>,
  );
}

describe("Hero", () => {
  it("exposes an element with id 'hero' so the sticky CTA can observe it", () => {
    const { container } = renderHero();
    expect(container.querySelector("#hero")).not.toBeNull();
  });

  it("renders the full headline across its three parts", () => {
    renderHero();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(messages.hero.headlineBefore);
    expect(heading).toHaveTextContent(messages.hero.headlineHighlight);
    expect(heading).toHaveTextContent(messages.hero.headlineAfter);
  });

  it("renders exactly one level-one heading", () => {
    renderHero();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders every pain point and chip", () => {
    renderHero();
    for (const pain of messages.hero.pains) {
      expect(screen.getByText(pain)).toBeInTheDocument();
    }
    for (const chip of messages.hero.chips) {
      expect(screen.getByText(chip)).toBeInTheDocument();
    }
  });

  it("links its call to action at the order section", () => {
    renderHero();
    expect(
      screen.getByRole("link", { name: new RegExp(messages.hero.cta) }),
    ).toHaveAttribute("href", "#order");
  });

  it("names the cover asset that still needs supplying", () => {
    renderHero();
    expect(
      screen.getByRole("img", { name: new RegExp(messages.hero.coverAsset) }),
    ).toBeInTheDocument();
  });
});
