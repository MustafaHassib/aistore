import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Placeholder } from "@/components/ui/Placeholder";
import { SectionShell } from "@/components/ui/SectionShell";

describe("Button", () => {
  it("renders a button element by default", () => {
    render(<Button>Buy</Button>);
    expect(screen.getByRole("button", { name: "Buy" })).toBeInTheDocument();
  });

  it("renders an anchor when told to", () => {
    render(
      <Button as="a" href="#order">
        Order
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Order" })).toHaveAttribute(
      "href",
      "#order",
    );
  });
});

describe("Eyebrow", () => {
  it("renders its label", () => {
    render(<Eyebrow>العرض الكامل</Eyebrow>);
    expect(screen.getByText("العرض الكامل")).toBeInTheDocument();
  });
});

describe("Placeholder", () => {
  it("names the asset that belongs in the slot", () => {
    render(<Placeholder label="TikTok revenue screenshot" ratio="9/16" />);
    expect(screen.getByText(/TikTok revenue screenshot/)).toBeInTheDocument();
  });

  it("exposes itself to assistive tech as an image placeholder", () => {
    render(<Placeholder label="Hero cover" ratio="16/9" />);
    expect(screen.getByRole("img", { name: /Hero cover/ })).toBeInTheDocument();
  });
});

describe("SectionShell", () => {
  it("renders an addressable landmark with an accessible name", () => {
    render(
      <SectionShell id="offer" eyebrow="العرض" heading="كل اللي تحتاجه">
        <p>body</p>
      </SectionShell>,
    );

    const section = screen.getByRole("region", { name: "كل اللي تحتاجه" });
    expect(section).toHaveAttribute("id", "offer");
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("renders the sub-copy when provided", () => {
    render(
      <SectionShell id="x" heading="H" sub="supporting line">
        <p>body</p>
      </SectionShell>,
    );
    expect(screen.getByText("supporting line")).toBeInTheDocument();
  });
});
