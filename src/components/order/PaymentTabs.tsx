"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PAYMENT } from "@/config/payment";

export type PaymentMethod = "instapay" | "etisalat";

export function PaymentTabs({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  const t = useTranslations("orderForm");
  const [copied, setCopied] = useState(false);

  const tabClass = (method: PaymentMethod) =>
    `flex-1 rounded-control border-[1.5px] px-3 py-2 text-xs font-semibold transition-colors ${
      value === method
        ? "border-line-strong bg-accent text-white"
        : "border-line bg-surface text-ink-2"
    }`;

  return (
    <div>
      <p className="text-xs font-semibold text-ink-2">{t("paymentMethod")}</p>

      <div role="tablist" className="mt-2 flex gap-2">
        {(["instapay", "etisalat"] as const).map((method) => (
          <button
            key={method}
            type="button"
            role="tab"
            aria-selected={value === method}
            onClick={() => onChange(method)}
            className={tabClass(method)}
          >
            {t(method)}
          </button>
        ))}
      </div>

      {value === "instapay" ? (
        <div className="mt-3 rounded-card border border-line bg-surface-2 p-4">
          <p className="text-xs text-ink-2">{t("instapayHint")}</p>
          {PAYMENT.instapayUrl ? (
            <a
              href={PAYMENT.instapayUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex rounded-control border-[1.5px] border-line-strong bg-surface px-3 py-2 text-xs font-bold text-ink"
            >
              {t("instapayOpen")}
            </a>
          ) : (
            <p className="mt-2 text-xs font-semibold text-danger">
              {t("missingPayment")}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-card border border-line bg-surface-2 p-4">
          <p className="text-xs text-ink-2">{t("etisalatHint")}</p>
          {PAYMENT.etisalatNumber ? (
            <div className="mt-2 flex items-center gap-2">
              <span dir="ltr" className="font-mono text-sm font-bold text-ink">
                {PAYMENT.etisalatNumber}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(PAYMENT.etisalatNumber);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="rounded-control border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink"
              >
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs font-semibold text-danger">
              {t("missingPayment")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
