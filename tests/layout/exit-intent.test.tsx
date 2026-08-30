import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { ExitIntent } from "@/components/layout/ExitIntent";
import { EXIT_STORAGE_KEY } from "@/lib/exit-intent";
import messages from "../../messages/en.json";

function renderExitIntent() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ExitIntent />
    </NextIntlClientProvider>,
  );
}

/** Simulates the cursor leaving through the top edge of the viewport. */
function leaveViewport() {
  fireEvent.mouseOut(document, { clientY: -5, relatedTarget: null });
}

async function dismiss(stage: 0 | 1) {
  const user = userEvent.setup({ advanceTimers: () => {} });
  await user.click(
    screen.getByRole("button", {
      name: messages.exitIntent.stages[stage].dismiss,
    }),
  );
}

describe("ExitIntent", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("stays hidden until the visitor tries to leave", () => {
    renderExitIntent();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the discount stage on the first exit attempt", () => {
    renderExitIntent();
    leaveViewport();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText(messages.exitIntent.stages[0].sub),
    ).toBeInTheDocument();
  });

  it("ignores a mouseout that is not leaving through the top", () => {
    renderExitIntent();
    fireEvent.mouseOut(document, { clientY: 300, relatedTarget: null });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("records the stage so it is not shown twice in one session", async () => {
    renderExitIntent();
    leaveViewport();
    await dismiss(0);

    expect(sessionStorage.getItem(EXIT_STORAGE_KEY)).toBe("0");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the Mini stage on the next exit attempt", async () => {
    renderExitIntent();

    leaveViewport();
    await dismiss(0);
    leaveViewport();

    expect(
      screen.getByText(messages.exitIntent.stages[1].sub),
    ).toBeInTheDocument();
  });

  it("stops appearing once both stages are spent", async () => {
    renderExitIntent();

    leaveViewport();
    await dismiss(0);
    leaveViewport();
    await dismiss(1);
    leaveViewport();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("labels the dialog with its heading", () => {
    renderExitIntent();
    leaveViewport();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName();
  });
});
