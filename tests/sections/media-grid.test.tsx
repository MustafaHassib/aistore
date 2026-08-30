import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { MediaGrid } from "@/components/sections/MediaGrid";

const messages = {
  sampleVideos: {
    eyebrow: "Made with the system",
    heading: "Results from our own channels",
    sub: "Examples of the kind of output the system produces.",
    items: [
      {
        kind: "video",
        label: "Horror POV sample",
        ratio: "9/16",
        title: "Horror POV",
        badge: "[your view count]",
      },
      {
        kind: "image",
        label: "Review screenshot",
        ratio: "9/16",
        title: "Buyer review",
        caption: "A short note on what this shows.",
      },
    ],
  },
};

function renderGrid() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MediaGrid id="sampleVideos" namespace="sampleVideos" columns={3} />
    </NextIntlClientProvider>,
  );
}

describe("MediaGrid", () => {
  it("renders a labelled placeholder for every media slot", () => {
    renderGrid();
    expect(
      screen.getByRole("img", { name: /Horror POV sample/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Review screenshot/ }),
    ).toBeInTheDocument();
  });

  it("renders titles, badges, and captions", () => {
    renderGrid();
    expect(screen.getByText("Horror POV")).toBeInTheDocument();
    expect(screen.getByText("[your view count]")).toBeInTheDocument();
    expect(
      screen.getByText("A short note on what this shows."),
    ).toBeInTheDocument();
  });

  it("renders the section as a labelled region", () => {
    renderGrid();
    expect(
      screen.getByRole("region", { name: messages.sampleVideos.heading }),
    ).toBeInTheDocument();
  });

  it("gives every media slot the requested aspect ratio", () => {
    renderGrid();
    for (const image of screen.getAllByRole("img")) {
      expect(image.className).toContain("aspect-[9/16]");
    }
  });
});
