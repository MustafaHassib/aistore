import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { Faq } from "@/components/sections/Faq";
import messages from "../../messages/en.json";
import ar from "../../messages/ar.json";

function renderFaq() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Faq id="faq" namespace="faq" />
    </NextIntlClientProvider>,
  );
}

describe("Faq", () => {
  it("renders every question", () => {
    renderFaq();
    for (const item of messages.faq.items) {
      expect(screen.getByText(item.q)).toBeInTheDocument();
    }
  });

  it("starts with every answer collapsed", () => {
    const { container } = renderFaq();
    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(messages.faq.items.length);
    details.forEach((node) => expect(node).not.toHaveAttribute("open"));
  });

  it("opens an answer when its question is activated", async () => {
    const user = userEvent.setup();
    const { container } = renderFaq();

    await user.click(screen.getByText(messages.faq.items[0].q));

    expect(container.querySelector("details")).toHaveAttribute("open");
  });

  it("renders answers as text in the document so they are indexable", () => {
    renderFaq();
    expect(screen.getByText(messages.faq.items[0].a)).toBeInTheDocument();
  });

  it("states plainly in both locales that earnings are not guaranteed", () => {
    const enAnswer = messages.faq.items.find((item) =>
      /guaranteed/i.test(item.q),
    )?.a;
    const arAnswer = ar.faq.items.find((item) => item.q.includes("مضمونة"))?.a;

    expect(enAnswer).toMatch(/^No\./);
    expect(arAnswer?.startsWith("لا.")).toBe(true);
  });
});
