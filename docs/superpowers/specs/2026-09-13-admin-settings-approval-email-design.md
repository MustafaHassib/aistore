# Admin Settings, Approval Email, and Proof Review — Design

**Date:** 2026-09-13
**Status:** Awaiting owner review
**Supersedes:** the "No email or Telegram notification" non-goal in
`2026-08-30-bilingual-ai-system-landing-design.md`

---

## 1. Purpose

Close the loop between an approved order and the customer. Today the owner marks an order
`confirmed` in `/admin/orders` and nothing happens — the customer is never told, and never
receives the product.

This project adds:

- An admin-editable **delivery link**, stored in the database, changeable without a deploy.
- An **approval email**: confirming an order sends the customer a bilingual message containing
  that link.
- **Delivery state** on each order, so a failed send is visible and retryable.
- A **full-size proof viewer**, because payment reference numbers are unreadable at 112px.

### Non-goals

- **No decline email.** Rejecting an order stays silent; the owner follows up out-of-band.
- **No admin-editable email copy.** Subject and body live in code. Content editing arrives with
  the landing-page CMS, which is a separate project.
- **No per-customer or per-tier links.** One global link serves every approved order.
- **No landing-page content management.** Explicitly deferred to its own spec.
- **No customer-facing status page or login.** The email is the only outbound channel.

---

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Link scope | One global link in settings | Same product for every tier; one field to maintain |
| Settings storage | `settings` key-value table | The CMS project will add many keys; avoids a schema change per field |
| Email provider | Resend | One API key, no SMTP sockets from serverless, healthy free tier |
| Provider abstraction | Swappable driver, mirroring `lib/storage.ts` | Dev and tests must never send real mail |
| Email copy | Fixed in code, bilingual | Less to build; no way to save a broken template at 2am |
| Decline behaviour | No email | Automated rejection over a payment dispute reads badly |
| Send failure | Approve anyway, record, allow retry | Approval is a financial decision; a mail outage must not block it |
| Repeat confirm | Does not resend | Re-marking an already-confirmed order must be safe |
| Proof viewer | Native `<dialog>` | Matches the repo's native-element preference (FAQ uses `details`/`summary`) |
| Production DDL | `npm run db:migrate` | Keeps the "no migration toolchain" call while fixing a real gap |

### Rejected alternatives

- **Delivery link as an env var.** No deploy-free edit, and the owner asked for it in the admin
  panel specifically.
- **Typed singleton `site_settings` row.** Cleaner reads, but every new setting becomes a schema
  change — and the next project adds many.
- **SMTP via nodemailer.** Works with an existing mailbox, but serverless SMTP is slow and flaky
  and deliverability rides on that mailbox's reputation.
- **Blocking approval until the email sends.** A provider outage would halt all order processing,
  and one typo'd customer address would block that order permanently.
- **Fire-and-forget sending.** The owner would learn about failures only when a customer
  complains.

---

## 3. Architecture

### New files

| Path | Purpose |
|---|---|
| `src/lib/settings.ts` | `getSetting`, `setSetting`, `getDeliveryLink` |
| `src/lib/email.ts` | Driver selection and `sendApprovalEmail` |
| `src/lib/email-template.ts` | Bilingual HTML and plain-text bodies |
| `src/lib/migrate.ts` | DDL extracted from `db.ts`, callable by script and by PGlite startup |
| `src/app/(admin)/admin/settings/page.tsx` | Settings form |
| `src/components/admin/ProofViewer.tsx` | Client lightbox |
| `scripts/migrate.mjs` | `npm run db:migrate` entry point |

### Changed files

| Path | Change |
|---|---|
| `src/lib/schema.ts` | `settings` table; three columns on `orders` |
| `src/lib/db.ts` | Import migrate from its own module; run it for PGlite as today |
| `src/app/(admin)/admin/actions.ts` | `setStatus` sends on confirm; add `saveSettings`, `resendApprovalEmail` |
| `src/app/(admin)/admin/orders/page.tsx` | Email state column, Resend button, settings link, lightbox |
| `.env.example` | `RESEND_API_KEY`, `EMAIL_FROM` |
| `package.json` | `resend` dependency; `db:migrate` script |

---

## 4. Data model

### `settings`

```ts
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

One key is defined by this project: `delivery_link`. Absent row means unset.

### `orders` — three added columns

```ts
// null until a send is attempted; 'sent' | 'failed' afterwards.
emailStatus: text("email_status"),
emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
// Provider message on failure, shown to the admin only.
emailError: text("email_error"),
```

Nullable with no default, so existing rows need no backfill. An order confirmed before this
project shipped reads as `null` — never sent — which is accurate.

### Migration

`migrate()` currently lives in `db.ts` and runs **only on the PGlite branch**; a production Neon
database receives no DDL at all, and no `drizzle.config.ts` is committed. Adding a table and
three columns makes that gap blocking.

Fix: move the DDL to `src/lib/migrate.ts`, append

```sql
CREATE TABLE IF NOT EXISTS settings (...);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_error text;
```

and expose `scripts/migrate.mjs` as `npm run db:migrate`, to be run once per deploy that changes
the schema. PGlite keeps auto-migrating on startup, so dev and test behaviour is unchanged. Every
statement stays idempotent, so re-running is safe.

---

## 5. Settings

`src/lib/settings.ts`:

```ts
export async function getSetting(key: string): Promise<string | null>;
export async function setSetting(key: string, value: string): Promise<void>;
export async function getDeliveryLink(): Promise<string | null>;
```

`setSetting` is an upsert (`ON CONFLICT (key) DO UPDATE`). No caching — the admin panel is
`force-dynamic` and the setting is read once per approval, so a stale read would be worse than
the query it saves.

### Validation

The link is validated before it is stored, with zod, following `lib/validation.ts`:

- Must parse as an absolute URL.
- Protocol must be `http:` or `https:` — rejects `javascript:`, `data:`, and `mailto:`.
- Max 2000 characters.

An invalid value re-renders the form with the error and does not write.

### Page

`/admin/settings`, behind `requireAdmin()`, `force-dynamic`. One labelled field, a save button,
success and error states. Reached from a link in the `/admin/orders` header. Reuses `Button` and
`Card`.

---

## 6. Email

### Driver

`src/lib/email.ts` mirrors the shape of `lib/storage.ts`: a real driver when configured, a local
one otherwise.

```ts
export type EmailResult = { ok: true } | { ok: false; error: string };

export async function sendApprovalEmail(input: {
  to: string;
  name: string;
  reference: string;
  locale: string;
  link: string;
}): Promise<EmailResult>;
```

Resend is used when `RESEND_API_KEY` is set — imported dynamically, as the Neon and Blob drivers
already are, so it is never bundled into environments that do not use it. Otherwise a log driver
records the message to an in-process buffer and prints a line to the server log. Tests assert
against that buffer. **The log driver never throws**, so an unconfigured environment behaves like
a successful send rather than failing every approval.

If `RESEND_API_KEY` is set but `EMAIL_FROM` is missing, the driver does **not** silently fall
back to logging — it returns a failure naming the missing variable, so a half-configured
production deployment surfaces as visible failed sends rather than as mail nobody ever receives.

`sendApprovalEmail` never throws. Provider errors are caught and returned as
`{ ok: false, error }`, because the caller's contract is that approval proceeds regardless.

### Template

`src/lib/email-template.ts` returns `{ subject, html, text }` for a locale. Plain HTML with inline
styles and no tables — a single centred column, system font stack, the link rendered as both a
button and a bare URL so it survives clients that strip styling. The Arabic version sets
`dir="rtl"` and `lang="ar"` on the wrapper.

A plain-text alternative ships alongside the HTML; text-only clients and spam filters both
penalise its absence.

Draft copy, for the owner to revise:

- **EN** — Subject: `Your order {reference} is confirmed`
  Body: `Hi {name}, we've confirmed your payment. Here's your access link: {link}`
- **AR** — Subject: `تم تأكيد طلبك {reference}`
  Body: `مرحباً {name}، تم تأكيد الدفع الخاص بك. هذا هو رابط الوصول: {link}`

Locale comes from `orders.locale`, captured at order time. An unrecognised value falls back to
Arabic, the site's default locale.

---

## 7. Approval flow

`setStatus(id, status)` in `actions.ts` gains this shape:

1. `requireAdmin()`, validate the status value — unchanged.
2. Read the order first; needed for the email and to detect a repeat confirm.
3. Write the new status. **This commits independently of anything below.**
4. Return early unless the transition is *into* `confirmed` from some other status, and
   `emailStatus` is not already `'sent'`.
5. Read the delivery link. If unset, record `emailStatus: 'failed'` with an error naming the
   missing setting, and return — the order stays confirmed.
6. Send. Record `'sent'` with `emailSentAt`, or `'failed'` with the provider error.
7. `revalidatePath("/admin/orders")`.

Step 4 is what makes the action idempotent: re-marking a confirmed order confirmed sends nothing,
and a pending → confirmed → pending → confirmed cycle sends exactly once.

`resendApprovalEmail(id)` runs steps 5–7 alone, for the Resend button. It requires the order to be
`confirmed` and does **not** require the previous attempt to have failed, so the owner can also
re-send after fixing a typo'd address.

### Orders list

Each row gains a small email-state indicator: nothing when null, `emailed` with the timestamp when
sent, and `email failed` with the error plus a **Resend** button when failed. The header links to
Settings and warns when the delivery link is unset, since approvals will fail until it is.

---

## 8. Proof viewer

`ProofViewer` is a client component wrapping the existing thumbnail. Clicking it calls
`showModal()` on a native `<dialog>` holding the full-size image at `max-height: 90vh`. Escape
closes it natively; a backdrop click closes it via a click handler comparing `event.target` to the
dialog element.

The image keeps loading from `/admin/proof/[id]`, so it is still streamed through the
authenticated route and the storage key is still never exposed. `next/image` remains unusable here
for the reason already documented in the orders page.

---

## 9. Testing

### Unit — Vitest

- `settings`: round-trip; upsert overwrites rather than duplicating; unset key returns null.
- Link validation: accepts `https://`; rejects `javascript:`, a relative path, empty, and >2000
  characters.
- Template: link appears in both HTML and text; Arabic renders `dir="rtl"`; unknown locale falls
  back to Arabic; name and reference substitute correctly.
- Driver: log driver selected without `RESEND_API_KEY`; captured message carries the right
  recipient and subject.
- `setStatus`: confirming sends once; confirming twice sends once; rejecting sends nothing;
  missing delivery link records `failed` **and leaves the order confirmed**; a throwing provider
  records `failed` and still leaves the order confirmed.
- `resendApprovalEmail`: refuses a non-confirmed order; sends for a confirmed one.

### End-to-end — Playwright

Extends the existing admin spec:

- Sign in, save a delivery link, reload, confirm it persisted.
- Reject an invalid link, confirm the error shows and nothing was saved.
- Approve an order, assert the log driver captured a message to that customer containing the link.
- Open the proof lightbox and close it with Escape.

---

## 10. Configuration

Added to `.env.example`:

```
# Resend. Leave unset in development and tests to log emails instead of sending.
RESEND_API_KEY=
# Verified sender, e.g. "Store <orders@yourdomain.com>". Required when RESEND_API_KEY is set.
EMAIL_FROM=
```

---

## 11. Build order

1. Extract `migrate.ts`, add the `db:migrate` script — unblocks every schema change below.
2. `settings` table, `lib/settings.ts`, validation, with unit tests.
3. `/admin/settings` page and `saveSettings` action.
4. `orders` columns.
5. `lib/email.ts` driver plus `email-template.ts`, with unit tests.
6. `setStatus` rewrite and `resendApprovalEmail`, with unit tests.
7. Orders-list email state and Resend button.
8. `ProofViewer` lightbox.
9. E2E coverage.

Steps 1–4 ship a working settings panel with no email; the flow is only customer-visible from
step 6.

---

## 12. Open items for the owner

- **Resend account, verified sending domain, and API key.** Until these exist the log driver runs
  and no customer receives anything. The flow is fully testable without them.
- **`EMAIL_FROM` address** on that verified domain.
- **Final email copy**, EN and AR. Section 6 is a draft.
- **The delivery link itself** — set it in the panel before approving the first real order.
- **Run `npm run db:migrate` against production** as part of the deploy that ships this.

## 13. Known risks

- **Arabic RTL rendering varies** across Gmail, Outlook, and Apple Mail. The single-column,
  table-free template minimises it, but it will not be pixel-identical everywhere.
- **A confirmed order with a failed email is a real state.** It is visible and retryable by
  design, but it means `confirmed` does not by itself prove the customer was served — read the
  email column alongside it.
