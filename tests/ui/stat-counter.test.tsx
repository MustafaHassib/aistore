import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCounter } from "@/components/ui/StatCounter";

/** Fires the observer callback immediately so the counter starts on render. */
function stubIntersectionObserver() {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private cb: IntersectionObserverCallback) {}
      observe() {
        this.cb(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    },
  );
}

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  stubIntersectionObserver();
  stubReducedMotion(true);
});

describe("StatCounter", () => {
  it("renders the final value immediately under reduced motion", () => {
    render(<StatCounter value={1500} suffix="+" label="buyers" locale="en" />);
    expect(screen.getByText("1,500+")).toBeInTheDocument();
  });

  it("formats the figure for the active locale without Arabic-Indic digits", () => {
    render(<StatCounter value={1500} label="buyers" locale="ar" />);
    expect(screen.getByText("1,500")).toBeInTheDocument();
  });

  it("associates the figure with its label", () => {
    render(<StatCounter value={5} label="videos daily" locale="en" />);
    expect(screen.getByText("videos daily")).toBeInTheDocument();
  });

  it("renders the real figure on first paint even when motion is allowed", () => {
    // The server HTML, no-JS visitors, and crawlers must never see a zero
    // where a stat belongs. The count-up replaces this value on scroll.
    stubReducedMotion(false);
    render(<StatCounter value={1500} label="buyers" locale="en" />);
    expect(screen.getByTestId("stat-value")).toHaveTextContent("1,500");
  });
});
