import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { BeforeAfter } from "@/components/sections/BeforeAfter";
import messages from "../../messages/en.json";

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BeforeAfter id="beforeAfter" namespace="beforeAfter" />
    </NextIntlClientProvider>,
  );
}

describe("BeforeAfter", () => {
  it("renders both columns with their labels", () => {
    renderSection();
    expect(
      screen.getByText(messages.beforeAfter.before.label),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.beforeAfter.after.label),
    ).toBeInTheDocument();
  });

  it("renders every before item inside the before column", () => {
    renderSection();
    const column = screen.getByTestId("before-column");
    for (const item of messages.beforeAfter.before.items) {
      expect(within(column).getByText(item)).toBeInTheDocument();
    }
  });

  it("renders every after item inside the after column", () => {
    renderSection();
    const column = screen.getByTestId("after-column");
    for (const item of messages.beforeAfter.after.items) {
      expect(within(column).getByText(item)).toBeInTheDocument();
    }
  });

  it("keeps the two columns balanced", () => {
    expect(messages.beforeAfter.before.items).toHaveLength(
      messages.beforeAfter.after.items.length,
    );
  });

  it("hides the directional arrow from assistive technology", () => {
    renderSection();
    expect(screen.getByTestId("before-after-arrow")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("renders as a labelled region", () => {
    renderSection();
    expect(
      screen.getByRole("region", { name: messages.beforeAfter.heading }),
    ).toBeInTheDocument();
  });
});
