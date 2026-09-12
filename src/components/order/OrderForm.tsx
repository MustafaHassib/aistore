"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { captureAttribution, readAttribution } from "@/lib/attribution";
import { OrderSummary } from "./OrderSummary";
import { PaymentTabs, type PaymentMethod } from "./PaymentTabs";
import { ProofUpload } from "./ProofUpload";

const EGYPT_MOBILE = /^01[0125]\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<
  Record<"name" | "phone" | "email" | "proof" | "form", string>
>;

export function OrderForm() {
  const t = useTranslations("orderForm");
  const locale = useLocale();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("instapay");
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    captureAttribution(window.location.href, document.referrer);
  }, []);

  function validate(): Errors {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = t("required");
    if (!EGYPT_MOBILE.test(phone.trim())) next.phone = t("invalidPhone");
    if (!EMAIL.test(email.trim())) next.email = t("invalidEmail");
    if (!proof) next.proof = t("required");
    return next;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSending(true);
    const body = new FormData();
    body.set("name", name.trim());
    body.set("phone", phone.trim());
    body.set("email", email.trim());
    body.set("paymentMethod", method);
    body.set("offerCode", "main");
    body.set("locale", locale);
    body.set("proof", proof!);

    for (const [key, value] of Object.entries(readAttribution())) {
      if (value) body.set(key, value);
    }
    // No amount is sent: the server resolves it from offerCode.

    try {
      const response = await fetch("/api/orders", { method: "POST", body });
      const data = await response.json();

      if (!response.ok) {
        setErrors({
          form:
            response.status === 429 ? t("errorRateLimited") : t("errorGeneric"),
        });
        return;
      }

      router.push(`/thanks?ref=${data.reference}`);
    } catch {
      setErrors({ form: t("errorGeneric") });
    } finally {
      setSending(false);
    }
  }

  const field =
    "mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
      <OrderSummary />

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="name" className="text-xs font-semibold text-ink-2">
            {t("name")} *
          </label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={field}
          />
          {errors.name ? (
            <p role="alert" className="mt-1 text-xs font-semibold text-danger">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="phone" className="text-xs font-semibold text-ink-2">
            {t("phone")} *
          </label>
          <input
            id="phone"
            inputMode="tel"
            dir="ltr"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={`${field} text-start`}
          />
          {errors.phone ? (
            <p role="alert" className="mt-1 text-xs font-semibold text-danger">
              {errors.phone}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="email" className="text-xs font-semibold text-ink-2">
            {t("email")} *
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={`${field} text-start`}
          />
          {errors.email ? (
            <p role="alert" className="mt-1 text-xs font-semibold text-danger">
              {errors.email}
            </p>
          ) : null}
        </div>

        <PaymentTabs value={method} onChange={setMethod} />

        <ProofUpload
          file={proof}
          error={errors.proof}
          onChange={(file, error) => {
            setProof(file);
            setErrors((current) => ({ ...current, proof: error }));
          }}
        />

        {errors.form ? (
          <p role="alert" className="text-xs font-semibold text-danger">
            {errors.form}
          </p>
        ) : null}

        <Button type="submit" disabled={sending}>
          {sending ? t("submitting") : t("submit")}
        </Button>

        <ul className="flex flex-wrap justify-center gap-3">
          {(t.raw("trust") as string[]).map((item) => (
            <li key={item} className="text-[11px] text-ink-3">
              {item}
            </li>
          ))}
        </ul>
      </form>
    </div>
  );
}
