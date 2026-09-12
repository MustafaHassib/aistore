import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { OrderForm } from "@/components/order/OrderForm";
import messages from "../../messages/en.json";

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
}));

const F = messages.orderForm;

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrderForm />
    </NextIntlClientProvider>,
  );
}

const pngFile = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "proof.png", {
    type: "image/png",
  });

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: status < 400, status, json: async () => body })),
  );
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(new RegExp(F.name)), "Sara Ali");
  await user.type(screen.getByLabelText(new RegExp(F.phone)), "01012345678");
  await user.type(screen.getByLabelText(new RegExp(F.email)), "sara@example.com");
  await user.upload(screen.getByTestId("proof-input"), pngFile());
}

function submittedBody(): FormData {
  const mock = fetch as unknown as { mock: { calls: [string, RequestInit][] } };
  return mock.mock.calls[0][1].body as FormData;
}

beforeEach(() => {
  push.mockReset();
  sessionStorage.clear();
  // Patch only the method: replacing the whole URL global would destroy the
  // constructor that attribution capture depends on.
  URL.createObjectURL = () => "blob:preview";
  URL.revokeObjectURL = () => {};
  mockFetch(201, { reference: "DA-AB123" });
});

describe("OrderForm", () => {
  it("renders the required fields", () => {
    renderForm();
    expect(screen.getByLabelText(new RegExp(F.name))).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(F.phone))).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(F.email))).toBeInTheDocument();
  });

  it("rejects a malformed phone before sending anything", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(new RegExp(F.name)), "Sara Ali");
    await user.type(screen.getByLabelText(new RegExp(F.phone)), "12345");
    await user.type(screen.getByLabelText(new RegExp(F.email)), "sara@example.com");
    await user.upload(screen.getByTestId("proof-input"), pngFile());
    await user.click(screen.getByRole("button", { name: new RegExp(F.submit) }));

    expect(await screen.findByText(F.invalidPhone)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an oversized file without sending it", async () => {
    const user = userEvent.setup();
    renderForm();

    const huge = new File([new Uint8Array(6 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });
    await user.upload(screen.getByTestId("proof-input"), huge);

    expect(await screen.findByText(F.proofTooLarge)).toBeInTheDocument();
  });

  it("submits a valid order and routes to the confirmation", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: new RegExp(F.submit) }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const body = submittedBody();

    expect(body.get("phone")).toBe("01012345678");
    expect(body.get("offerCode")).toBe("main");
    expect(body.get("proof")).toBeInstanceOf(File);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/thanks?ref=DA-AB123"),
    );
  });

  it("never sends an amount", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: new RegExp(F.submit) }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(submittedBody().get("amount")).toBeNull();
  });

  it("includes captured attribution in the submission", async () => {
    sessionStorage.setItem(
      "attribution",
      JSON.stringify({ utmSource: "tiktok", utmCampaign: "launch" }),
    );

    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: new RegExp(F.submit) }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = submittedBody();
    expect(body.get("utmSource")).toBe("tiktok");
    expect(body.get("utmCampaign")).toBe("launch");
  });

  it("surfaces a rate-limit response", async () => {
    mockFetch(429, { error: "too_many_requests" });

    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: new RegExp(F.submit) }));

    expect(await screen.findByText(F.errorRateLimited)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
