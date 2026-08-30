import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { CardGrid } from "@/components/sections/CardGrid";

const messages = {
  painPoints: {
    eyebrow: "The reality",
    heading: "Daily content is draining",
    sub: "Consistency is the hard part.",
    items: [
      {
        icon: "🧠",
        title: "Deciding what to post",
        desc: "Starts from zero every day.",
      },
      {
        icon: "📱",
        title: "One quiet day breaks momentum",
        desc: "The algorithm rewards regularity.",
        note: "✓ Handled by the system",
      },
    ],
  },
  minimal: {
    heading: "No eyebrow, no sub",
    items: [{ title: "Bare item" }],
  },
};

function renderGrid(namespace: keyof typeof messages = "painPoints") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CardGrid id={namespace} namespace={namespace} columns={2} />
    </NextIntlClientProvider>,
  );
}

describe("CardGrid", () => {
  it("renders the section heading as a labelled region", () => {
    renderGrid();
    const region = screen.getByRole("region", {
      name: messages.painPoints.heading,
    });
    expect(region).toHaveAttribute("id", "painPoints");
  });

  it("renders every item's title and description", () => {
    renderGrid();
    for (const item of messages.painPoints.items) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
      if (item.desc) expect(screen.getByText(item.desc)).toBeInTheDocument();
    }
  });

  it("hides decorative icons from assistive technology", () => {
    renderGrid();
    const icons = screen.getAllByTestId("card-icon");
    expect(icons).toHaveLength(2);
    icons.forEach((icon) => expect(icon).toHaveAttribute("aria-hidden", "true"));
  });

  it("renders the sub-copy and eyebrow", () => {
    renderGrid();
    expect(screen.getByText(messages.painPoints.sub)).toBeInTheDocument();
    expect(screen.getByText(messages.painPoints.eyebrow)).toBeInTheDocument();
  });

  it("renders an optional note only where one is supplied", () => {
    renderGrid();
    expect(screen.getByText("✓ Handled by the system")).toBeInTheDocument();
  });

  it("omits the eyebrow and sub-copy when the namespace has none", () => {
    renderGrid("minimal");
    expect(screen.getByText("Bare item")).toBeInTheDocument();
    expect(screen.queryByTestId("card-icon")).not.toBeInTheDocument();
  });
});
