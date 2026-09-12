"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_PROOF_BYTES } from "@/lib/validation";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function ProofUpload({
  file,
  onChange,
  error,
}: {
  file: File | null;
  onChange: (file: File | null, error?: string) => void;
  error?: string;
}) {
  const t = useTranslations("orderForm");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function accept(next: File | null) {
    if (!next) {
      setPreview(null);
      onChange(null);
      return;
    }

    // Client-side checks are feedback only; the server re-checks the bytes.
    if (next.size > MAX_PROOF_BYTES) {
      setPreview(null);
      onChange(null, t("proofTooLarge"));
      return;
    }
    if (!ACCEPTED.includes(next.type)) {
      setPreview(null);
      onChange(null, t("proofWrongType"));
      return;
    }

    setPreview(URL.createObjectURL(next));
    onChange(next);
  }

  return (
    <div>
      <label htmlFor="proof" className="text-xs font-semibold text-ink-2">
        {t("proof")} *
      </label>

      <input
        ref={inputRef}
        id="proof"
        data-testid="proof-input"
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={(event) => accept(event.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-2 flex w-full flex-col items-center gap-2 rounded-card border-[1.5px] border-dashed border-line bg-surface-2 p-5 text-center"
      >
        {preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={preview}
            alt={file?.name ?? ""}
            className="max-h-40 rounded-card object-contain"
          />
        ) : (
          <span className="text-sm font-semibold text-ink-2">{t("proofCta")}</span>
        )}
        <span className="text-[11px] text-ink-3">{t("proofHint")}</span>
      </button>

      {file ? <p className="mt-2 text-xs text-ink-3">{file.name}</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
