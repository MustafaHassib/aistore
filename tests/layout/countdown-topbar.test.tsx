import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { CountdownTopbar } from "@/components/layout/CountdownTopbar";
import { DEADLINE_STORAGE_KEY } from "@/lib/countdown";
import messages from "../../messages/en.json";

function renderTopbar() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CountdownTopbar />
    </NextIntlClientProvider>,
  );
}

describe("CountdownTopbar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fixes a deadline on first visit and persists it", () => {
    renderTopbar();
    expect(localStorage.getItem(DEADLINE_STORAGE_KEY)).not.toBeNull();
  });

  it("reuses the stored deadline instead of restarting the window", () => {
    // Time is frozen, so the first tick reads exactly two hours remaining.
    const stored = String(Date.now() + 2 * 3_600_000);
    localStorage.setItem(DEADLINE_STORAGE_KEY, stored);

    renderTopbar();

    expect(localStorage.getItem(DEADLINE_STORAGE_KEY)).toBe(stored);
    expect(screen.getByTestId("countdown-hours")).toHaveTextContent("02");
    expect(screen.getByTestId("countdown-minutes")).toHaveTextContent("00");
  });

  it("shows an expired state rather than resetting once the deadline passes", () => {
    localStorage.setItem(DEADLINE_STORAGE_KEY, String(Date.now() - 1000));

    renderTopbar();

    expect(screen.getByText(messages.topbar.expired)).toBeInTheDocument();
    expect(screen.queryByTestId("countdown-hours")).not.toBeInTheDocument();
  });

  it("renders the clock left-to-right so it is not mirrored in Arabic", () => {
    localStorage.setItem(DEADLINE_STORAGE_KEY, String(Date.now() + 3_600_000));

    renderTopbar();

    const clock = screen.getByTestId("countdown-clock");
    expect(clock).toHaveAttribute("dir", "ltr");
  });
});
