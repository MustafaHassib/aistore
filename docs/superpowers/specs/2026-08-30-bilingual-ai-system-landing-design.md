# Bilingual AI-System Landing Page — Design

**Date:** 2026-08-30
**Status:** Approved for planning
**Reference:** `https://digitalassets.sbs/ai-system/` — used as a *structural* reference only

---

## 1. Purpose

Build a bilingual (Arabic / English) single-page conversion funnel in Next.js for a digital
product, using the reference site's section structure and funnel mechanics with an original
visual identity and placeholder content the owner fills in later.

The site must:

- Render all 21 funnel sections in the same order as the reference.
- Serve Arabic (RTL) and English (LTR) from one codebase and one stylesheet.
- Accept orders: customer details plus a payment-proof image upload.
- Let the owner review and fulfil orders from a password-protected admin page.

### Non-goals

- No online payment processing. Payment happens out-of-band (InstaPay / Etisalat Cash);
  the site collects proof of transfer only.
- No CMS. Copy lives in JSON files edited by a developer.
- No dark mode.
- No email or Telegram notification. Orders are reviewed in the admin page.
- No content, imagery, video, testimonial, or earnings claim is copied from the reference site.

---

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js App Router, TypeScript | Required by the brief |
| i18n | `next-intl` | App-Router-native; handles negotiation, plurals, number formatting |
| Locales | `ar` (default), `en` | Arabic is the primary market |
| Styling | Tailwind v4, CSS custom properties as tokens | Single stylesheet drives both directions |
| Direction handling | CSS logical properties | Avoids a mirrored stylesheet and `[dir=rtl]` overrides |
| Visual identity | "Warm Studio" — light editorial, clay accent | Chosen from three rendered mockups |
| Hosting | Vercel | Chosen by owner |
| Object storage | Vercel Blob | No persistent disk on Vercel |
| Database | Neon Postgres via Drizzle ORM | Serverless-friendly; typed schema |
| Admin auth | Single shared password → signed httpOnly cookie | Single-operator tool; no user accounts needed |
| Content source | `messages/{ar,en}.json` | Owner's fill-in surface |

### Rejected alternatives

- **Hand-rolled i18n** — would require reimplementing locale negotiation, plural rules, and
  number formatting. Not worth avoiding one dependency.
- **CMS-backed content (Sanity / Payload)** — a second service and a schema layer for a single
  landing page. Revisit if multi-variant offer testing becomes a requirement.
- **Local disk + SQLite** — incompatible with Vercel's ephemeral filesystem.

---

## 3. Visual identity — "Warm Studio"

Light, editorial, high-contrast. Deliberately *not* the dark neon-green treatment of the
reference: a credible-looking page outperforms a hype-looking one for a product whose main
objection is "is this a scam".

### Tokens

Declared once in `src/app/globals.css` and exposed to Tailwind via `@theme`.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FBF8F3` | Page ground |
| `--surface` | `#FFFFFF` | Cards |
| `--surface-2` | `#F3EEE6` | Alternating section bands |
| `--ink` | `#1C1917` | Headings |
| `--ink-2` | `#57534E` | Body text |
| `--ink-3` | `#8A817A` | Muted / captions |
| `--line` | `#E4DED4` | Hairlines |
| `--line-strong` | `#1C1917` | Card borders (1.5px) |
| `--accent` | `#DC4A1E` | CTAs, emphasis |
| `--accent-soft` | `#FEE9DC` | Eyebrow pills, tints |
| `--accent-line` | `#F8C9A9` | Pill borders |
| `--highlight` | `#FBBF8E` | Marker sweep under headline phrases |
| `--success` / `--success-soft` | `#166534` / `#DCFCE7` | ✅ after-column, savings badges |
| `--danger` | `#B91C1C` | ❌ before-column |

Radii `6px` (controls) / `8px` (cards). Container `1140px`.
Signature treatment: **1.5px `--line-strong` border with a hard offset shadow**
(`3px 3px 0` on controls, `5px 5px 0` on cards) instead of soft glows.

### Typography

Self-hosted via `next/font` — no Google Fonts request, no layout shift.

- Arabic: **IBM Plex Sans Arabic** (400/500/600/700)
- English: **Inter** (400/500/600/700/800)

The locale layout selects the face; both share one modular type scale.

### Motion

Entrance fades and the stat count-up only. All motion gated behind
`prefers-reduced-motion: reduce`.

---

## 4. Architecture

### Routes

| Route | Purpose |
|---|---|
| `/` | Middleware negotiates locale, redirects to `/ar` or `/en` |
| `/ar`, `/en` | The landing page, statically generated |
| `/ar/thanks`, `/en/thanks` | Post-order confirmation, shows order reference |
| `/admin` | Password login |
| `/admin/orders` | Order list and proof review |
| `/admin/proof/[id]` | Authenticated proof image stream |
| `/api/orders` | `POST` — order submission (multipart) |

`/admin/*` sits in an `(admin)` route group **outside** the `[locale]` segment. It is an
operator tool, English only, not translated and not RTL-tested.

### Layout

```
src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx           # <html lang dir>, font, NextIntlClientProvider
│   │   ├── page.tsx             # renders the ordered section manifest
│   │   └── thanks/page.tsx
│   ├── (admin)/admin/
│   │   ├── page.tsx             # login form
│   │   ├── orders/page.tsx      # order table
│   │   └── proof/[id]/route.ts  # authenticated image stream
│   ├── api/orders/route.ts
│   └── globals.css              # @theme tokens
├── components/
│   ├── sections/                # 21 section components, one file each
│   ├── ui/                      # Button, Card, Chip, Eyebrow, Accordion, Modal,
│   │                            # Countdown, StatCounter, VideoCard, Placeholder,
│   │                            # LocaleSwitcher, StickyMobileCta
│   └── order/                   # OrderForm, PaymentTabs, ProofUpload, OrderSummary
├── config/
│   ├── pricing.ts               # single source of truth for all money
│   └── sections.ts              # ordered section manifest
├── lib/
│   ├── db.ts                    # Drizzle client
│   ├── schema.ts                # orders + rate_limit tables
│   ├── storage.ts               # blob adapter (put / get / delete)
│   ├── validation.ts            # Zod schemas, shared client + server
│   ├── file-type.ts             # magic-byte sniffing
│   ├── format.ts                # locale-aware money and number formatting
│   ├── attribution.ts           # UTM / referrer capture and retrieval
│   ├── rate-limit.ts
│   └── session.ts               # admin cookie sign / verify
├── i18n/
│   ├── routing.ts
│   └── request.ts
├── middleware.ts
└── messages/{ar,en}.json
```

---

## 5. Content and i18n model

`messages/ar.json` defines the structure; `en.json` mirrors it key-for-key. Each section owns
a namespace. Repeated content is arrays, so items are added or removed without touching
component code.

```jsonc
"offer": {
  "eyebrow": "🔥 العرض الكامل",
  "heading": "كل اللي تحتاجه عشان تبدأ",
  "items": [
    { "icon": "✅", "title": "…", "desc": "…", "price": 1500 },
    { "icon": "🎁", "title": "…", "desc": "…", "price": 750 }
  ]
}
```

### Rules

1. **Money is never a string in messages.** All amounts live in `config/pricing.ts`:

   ```ts
   export const PRICING = {
     original: 1999,
     main: 999,
     exit: 399,
     mini: 149,
     currency: "EGP",
   } as const;
   ```

   The topbar, offer card, order summary, both exit popups, and every CTA label read from
   this object. Changing a price is a one-line edit. (The reference hardcodes them in ~8
   places.)

2. **Western digits in both locales.** `999`, not `٩٩٩` — matches Egyptian marketing
   convention. Controlled by a single formatter in `lib/format.ts`; switching is one change.

3. **Logical properties only.** `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`,
   `text-start`/`text-end`. No `left`/`right` in component styles. Enforced by a custom ESLint
   rule (`no-restricted-syntax` matching physical-direction utility classes inside `className`
   string literals) so it cannot silently regress into an English-only layout.

4. **Locale switching.** `LocaleSwitcher` in the topbar swaps between `/ar` and `/en` on the
   *same* path, preserving the query string, and writes the choice to the `NEXT_LOCALE` cookie
   so return visits skip negotiation. Both locales are always crawlable at their own URL.

5. **Placeholder assets.** Every image and video slot renders a `<Placeholder>` at the correct
   aspect ratio, labelled with what belongs there (e.g. *"Replace: TikTok revenue screenshot
   · 9:16"*). Layout is correctly proportioned before any real asset exists.

---

## 6. Sections

Rendered from `config/sections.ts` in this order. Reordering, removing, or duplicating a
section is a one-line edit to that array.

**Sections are composed from a small set of primitives, not written one file per section.**
Most of the reference's sections are the same shape — eyebrow, heading, sub-copy, then a grid
of cards or media. Writing 21 near-identical components would be duplication that has to be
maintained 21 times. Instead:

| Primitive | Serves |
|---|---|
| `SectionShell` | Every section: eyebrow, heading with marker highlight, sub-copy, band variant |
| `CardGrid` | PainPoints, HowItWorks, TopObjections, ProofTikTok, ProofViews, ProofAffiliate |
| `MediaGrid` | ProofResults, ProofPlatforms, SampleVideos, Reviews |
| `BeforeAfter` | The ❌ / ✅ column pair |
| `OfferStack` | The 13-item priced stack and price reveal |
| `Faq` | The Q&A accordion |
| `Hero`, `HeroStats`, `FinalCta` | One-off layouts |

`config/sections.ts` maps each section id to a primitive, a message namespace, and a band
variant. Adding a section is a manifest entry plus a message namespace — no new component.

| # | Section id | Primitive | Notes |
|---|---|---|---|
| 1 | `topbar` | `CountdownTopbar` | Sticky, layout-level. Evergreen deadline |
| 2 | `hero` | `Hero` | Pain bullets, headline, chips, CTA, trust row |
| 3 | `heroStats` | `HeroStats` | 4 count-up figures |
| 4 | `proofResults` | `MediaGrid` | Results grid + framing copy |
| 5 | `proofPlatforms` | `MediaGrid` | Multi-platform reach |
| 6 | `painPoints` | `CardGrid` | 4 cards |
| 7 | `beforeAfter` | `BeforeAfter` | ❌ / ✅ column pair |
| 8 | `demo` | `MediaGrid` | Single video, poster, click-to-play |
| 9 | `howItWorks` | `CardGrid` | 6 numbered steps |
| 10 | `sampleVideos` | `MediaGrid` | 3 video cards |
| 11 | `objections` | `CardGrid` | 3 cards |
| 12 | `reviews` | `MediaGrid` | Review images + video reviews |
| 13 | `proofTikTok` | `CardGrid` | Earnings screenshots |
| 14 | `proofViews` | `CardGrid` | Views screenshots |
| 15 | `proofAffiliate` | `CardGrid` | Commission screenshots |
| 16 | `offer` | `OfferStack` | 13 line items with prices, then reveal |
| 17 | `order` | `OrderSection` | Summary + `OrderForm` (Plan B) |
| 18 | `faq` | `Faq` | 14 Q&A |
| 19 | `finalCta` | `FinalCta` | Urgency close |
| 20 | `footer` | `SiteFooter` | Layout-level. Copyright + delivery disclaimer |
| 21 | `exitIntent` | `ExitIntent` | Layout-level. Two-stage popup |

### Interactive behaviour

- **`CountdownTopbar`** — on first visit, writes `deadline = now + OFFER_WINDOW_HOURS` to
  `localStorage`. Subsequent visits read it. Reaching zero shows an expired state rather than
  resetting to `00:00:00`.
- **`StatCounter`** — counts up when scrolled into view (`IntersectionObserver`); renders the
  final value immediately under reduced-motion.
- **`VideoCard`** — `preload="none"`, poster image, plays on click. Video bandwidth is only
  spent on intent.
- **`Faq`** — built on native `<details>`/`<summary>`; keyboard-accessible and functional
  without JS.
- **`PaymentTabs`** — InstaPay ⇄ Etisalat Cash, copy-to-clipboard on the cash number with a
  confirmation state.
- **`ProofUpload`** — drag/drop and tap-to-select, client-side thumbnail preview, type and
  size rejection before any network request.
- **`ExitIntent`** — desktop `mouseleave` toward the top edge; mobile fast-scroll-up plus a
  `history.pushState` back-button trap. Fires once per session via `sessionStorage`.
  Two stages: 60% off, then the Mini offer.
`StickyMobileCta` and `LocaleSwitcher` are **not** manifest sections — they are layout-level
overlays rendered by `[locale]/layout.tsx`. `StickyMobileCta` appears on viewports `< md`
once the hero has scrolled past, and hides itself while `OrderSection` is in view so it never
covers the form it points at.

---

## 7. Order submission

`POST /api/orders`, `multipart/form-data`.

### Pipeline

1. **Rate-limit** by IP — 5 submissions per hour. Reject over threshold with `429` before any
   parsing, so the endpoint cannot be used as free image hosting. Implemented as a
   Postgres-backed sliding window (`rate_limit` table, keyed on IP hash) rather than an
   in-memory counter: Vercel runs multiple isolated instances, so an in-memory limiter silently
   fails to limit anything. Same mechanism guards `/admin` login attempts.
2. **Validate fields** against a Zod schema in `lib/validation.ts`, imported by both the form
   and the route so client and server cannot disagree about what is valid.
   - `name` — 2–80 chars
   - `phone` — Egyptian mobile, `^01[0125]\d{8}$`
   - `email` — valid address, ≤ 120 chars
   - `paymentMethod` — `"instapay" | "etisalat"`
   - `offerCode` — `"main" | "exit60" | "mini"`
3. **Validate the file**
   - Size ≤ 6 MB, rejected before buffering the whole body.
   - Extension and declared MIME in the allowlist (`jpeg`, `png`, `webp`).
   - **Magic-byte sniff** confirming the bytes match the claimed type. Trusting a
     client-supplied MIME type is how this exact upload pattern gets exploited.
4. **Store** the image in Vercel Blob under a random key (`orders/<uuid>.<ext>`).
5. **Persist** the order row.
6. **Respond** with the order reference; the client redirects to
   `/[locale]/thanks?ref=<reference>`.

### Schema

```ts
orders {
  id            uuid pk
  reference     text unique          // short human-quotable code, e.g. "DA-7K3M2"
  name          text
  phone         text
  email         text
  paymentMethod text                 // instapay | etisalat
  offerCode     text                 // main | exit60 | mini
  amount        integer              // EGP, resolved server-side from offerCode
  proofKey      text                 // blob key, never exposed to the client
  status        text default 'pending' // pending | confirmed | rejected
  locale        text                 // ar | en
  utmSource     text null
  utmMedium     text null
  utmCampaign   text null
  utmContent    text null
  utmTerm       text null
  referrer      text null
  landingPage   text null
  createdAt     timestamptz default now()
}
```

**`amount` is resolved server-side from `offerCode`**, never accepted from the client. A
submitted price is a price a customer can edit.

UTM parameters, referrer, and landing page are captured on first page view into
`sessionStorage` and submitted as hidden fields — this is what makes ad spend attributable.

---

## 8. Admin

### Auth

`/admin` accepts a single password compared against `ADMIN_PASSWORD_HASH` (bcrypt/argon2, not
plaintext) and issues a signed `httpOnly`, `secure`, `sameSite=lax` session cookie with a
7-day expiry. Middleware guards `/admin/*` and `/admin/proof/*`. Login attempts are
rate-limited.

A single shared password is the right weight here: one operator, no user management, no
password-reset flow to build or secure.

### Order review

`/admin/orders` lists orders newest-first:

- Reference, name, phone, email, method, amount, offer code, status, timestamp
- Proof thumbnail opening into a lightbox
- Status toggle: pending → confirmed / rejected
- Search by phone, email, or reference
- Filter by status

### Proof image access

Proof images are **not** served from public blob URLs. `/admin/proof/[id]` takes the **order
id**, verifies the admin session, looks up that order's `proofKey`, and streams the blob. The
blob key is never sent to any client. Vercel Blob URLs are unguessable but public, and these files
are customer bank-transfer screenshots carrying names, phone numbers, and account details.
Gating them behind the session is a small amount of extra work for materially better handling
of other people's payment data.

---

## 9. SEO, metadata, and analytics

A bilingual site that gets this wrong has the two locales competing with each other in search
results, so it is part of the foundation rather than a finishing touch.

- **Per-locale metadata** generated from the `meta` namespace in each message file: title,
  description, and Open Graph tags in the page's own language.
- **`hreflang` alternates** — every page declares `ar`, `en`, and `x-default` pointing at `/ar`,
  plus a self-referencing canonical. This is what stops Google treating the two locales as
  duplicate content.
- **`lang` and `dir`** set on `<html>` from the route segment, not from a client effect, so
  they are correct in the initial HTML for crawlers and screen readers.
- **`sitemap.xml` and `robots.txt`** generated by Next's metadata routes, listing both locales.
- **Localised Open Graph image** per locale, generated at build time with `next/og`.
- **Analytics is out of scope for this build.** The reference site runs GTM and a Meta pixel;
  the schema captures UTM parameters and referrer so attribution data is not lost in the
  meantime, and a tag can be added later without a data backfill.

---

## 10. Testing

### Unit — Vitest

- Price formatting per locale; `config/pricing.ts` propagation
- Phone and email validation, including rejection cases
- Magic-byte file sniffing: valid JPEG/PNG/WebP accepted; a renamed non-image rejected
- Countdown deadline maths, including the expired state
- Server-side `offerCode → amount` resolution ignores any client-supplied amount

### Locale parity — Vitest

Asserts `ar.json` and `en.json` have identical key trees. In a bilingual project this is the
highest-value test available: it converts "we shipped an untranslated section" from a
production discovery into a failing build.

### End-to-end — Playwright

The critical path:

1. `/ar` renders with `dir="rtl"` and Arabic type
2. Locale switch to `/en` renders `dir="ltr"` and Latin type
3. Fill the order form, upload a fixture image, submit
4. Land on `/thanks` with an order reference
5. Log into `/admin`, see the order, open the proof, mark it confirmed

Plus: rejecting an oversized file, rejecting a disguised non-image, and unauthenticated
`/admin/proof/[id]` returning `401`.

### Manual checks

- Lighthouse ≥ 90 across the board on both locales
- RTL/LTR visual pass at 375 / 768 / 1440 widths
- Keyboard-only traversal of form, accordion, and modals

---

## 11. Configuration

```
DATABASE_URL              # Neon Postgres
BLOB_READ_WRITE_TOKEN     # Vercel Blob
ADMIN_PASSWORD_HASH       # argon2/bcrypt hash
SESSION_SECRET            # cookie signing key
NEXT_PUBLIC_SITE_URL
OFFER_WINDOW_HOURS        # countdown window, default 24
```

`.env.example` ships with every key documented. No secret is committed.

---

## 12. Build order

1. Scaffold; tokens, fonts, i18n routing, middleware; locale parity test
2. Layout shell, `CountdownTopbar`, `Hero`, `SiteFooter` in both locales
3. Remaining static sections against placeholder content
4. Interactive components: stat counters, video cards, accordion, exit intent, sticky CTA
5. Order form → API → Blob → Postgres, with unit tests
6. Admin auth, order review, authenticated proof streaming
7. SEO metadata, `hreflang` alternates, sitemap, OG images
8. Playwright suite, Lighthouse, RTL/LTR visual pass

---

## 13. Open items for the owner

These do not block implementation; each has a working placeholder.

- Real copy for both locales (English currently a translation of the Arabic baseline)
- Product name, logo, and domain
- Payment destinations: InstaPay link and Etisalat Cash number
- Proof imagery, review assets, and sample videos
- Whether the stated figures (buyer counts, view counts, earnings) reflect verifiable results;
  placeholders remain until confirmed
