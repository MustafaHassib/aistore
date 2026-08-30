import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { OfferStack } from "@/components/sections/OfferStack";
import { PRICING } from "@/config/pricing";
import { percentOff } from "@/lib/format";
import messages from "../../messages/en.json";

function renderOffer() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OfferStack id="offer" namespace="offer" />
    </NextIntlClientProvider>,
  );
}

describe("OfferStack", () => {
  it("renders every line item", () => {
    renderOffer();
    for (const item of messages.offer.items) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    }
  });

  it("sums only the priced items into the stated total value", () => {
    renderOffer();
    const expected = messages.offer.items.reduce(
      (sum, item) => sum + (item.price ?? 0),
      0,
    );
    expect(screen.getByTestId("offer-total")).toHaveTextContent(
      expected.toLocaleString("en-US"),
    );
  });

  it("labels unpriced items as ongoing rather than showing a zero", () => {
    renderOffer();
    const unpriced = messages.offer.items.filter((item) => item.price === null);
    expect(screen.getAllByText(messages.offer.ongoing)).toHaveLength(
      unpriced.length,
    );
    expect(screen.queryByText("0 EGP")).not.toBeInTheDocument();
  });

  it("reads the live price from pricing config, not from messages", () => {
    renderOffer();
    expect(screen.getByTestId("offer-now")).toHaveTextContent(
      String(PRICING.main),
    );
    expect(screen.getByTestId("offer-was")).toHaveTextContent(
      PRICING.original.toLocaleString("en-US"),
    );
  });

  it("states a discount that matches the configured prices", () => {
    renderOffer();
    const percent = percentOff(PRICING.original, PRICING.main);
    expect(screen.getByText(new RegExp(`${percent}%`))).toBeInTheDocument();
  });

  it("shows a total value well above the asking price", () => {
    renderOffer();
    const total = messages.offer.items.reduce(
      (sum, item) => sum + (item.price ?? 0),
      0,
    );
    expect(total).toBeGreaterThan(PRICING.main);
  });

  it("points its call to action at the order section", () => {
    renderOffer();
    expect(
      screen.getByRole("link", { name: new RegExp(messages.offer.cta) }),
    ).toHaveAttribute("href", "#order");
  });
});
