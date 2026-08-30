# Bilingual Landing Site (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, deployable Arabic/English (RTL/LTR) marketing landing page in Next.js, driven by per-locale message files and a section manifest.

**Architecture:** Next.js App Router with a `/[locale]` segment. `next-intl` handles locale routing, negotiation, and message loading. All copy lives in `messages/{ar,en}.json`; all money lives in `config/pricing.ts`. Pages are assembled from an ordered manifest in `config/sections.ts` that maps each section to one of a small set of reusable primitives (`SectionShell`, `CardGrid`, `MediaGrid`, `BeforeAfter`, `OfferStack`, `Faq`). RTL/LTR share one stylesheet via CSS logical properties, enforced by a lint rule.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, next-intl v4, Vitest + Testing Library, Playwright, ESLint 9 (flat config).

**Spec:** `docs/superpowers/specs/2026-08-30-bilingual-ai-system-landing-design.md`

**Scope note:** This plan delivers everything except the order form, its API, and the admin surface — those are Plan B (`2026-08-30-order-intake-admin.md`). Task 12 renders an `OrderSection` placeholder that Plan B replaces.

## Global Constraints

- **Locales:** `ar` (default, RTL) and `en` (LTR). Locale prefix is `always` — there is no unprefixed page.
- **Logical properties only.** Never `ml-*`, `mr-*`, `pl-*`, `pr-*`, `text-left`, `text-right`, `left-*`, `right-*`, `border-l-*`, `border-r-*`, `rounded-l-*`, `rounded-r-*`. Use `ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`, `start-*`, `end-*`, `border-s-*`, `border-e-*`, `rounded-s-*`, `rounded-e-*`. Enforced by ESLint in Task 1.
- **Money is never a string in message files.** All amounts come from `config/pricing.ts`. Message files may contain `{price}` placeholders only.
- **Western digits in both locales.** `999`, never `٩٩٩`. Achieved with the `ar-EG-u-nu-latn` locale tag.
- **Message files must have identical key trees.** Enforced by the parity test in Task 2.
- **No content from `digitalassets.sbs` is copied.** Structure and section ordering only. Every image/video slot is a labelled `<Placeholder>`.
- **All motion gated behind `prefers-reduced-motion: reduce`.**
- **TypeScript `strict: true`.** No `any` in committed code.
- **Design tokens:** `--color-bg #FBF8F3`, `--color-surface #FFFFFF`, `--color-surface-2 #F3EEE6`, `--color-ink #1C1917`, `--color-ink-2 #57534E`, `--color-ink-3 #8A817A`, `--color-line #E4DED4`, `--color-line-strong #1C1917`, `--color-accent #DC4A1E`, `--color-accent-soft #FEE9DC`, `--color-accent-line #F8C9A9`, `--color-highlight #FBBF8E`, `--color-success #166534`, `--color-success-soft #DCFCE7`, `--color-danger #B91C1C`. Radii `6px` control / `8px` card. Container `1140px`.
- **Fonts:** IBM Plex Sans Arabic (ar), Inter (en), self-hosted via `next/font/google`.
- **Commit after every task.** Conventional commit prefixes (`feat:`, `test:`, `chore:`).

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/app/globals.css` | Tailwind import + `@theme` design tokens |
| `src/app/[locale]/layout.tsx` | `<html lang dir>`, font selection, providers, layout-level overlays |
| `src/app/[locale]/page.tsx` | Renders the section manifest in order |
| `src/i18n/routing.ts` | Locale list, default, prefix strategy |
| `src/i18n/request.ts` | Per-request message loading |
| `src/i18n/navigation.ts` | Locale-aware `Link`, `usePathname`, `useRouter` |
| `src/middleware.ts` | Locale negotiation and redirect |
| `src/config/pricing.ts` | Single source of truth for every amount |
| `src/config/sections.ts` | Ordered section manifest |
| `src/lib/format.ts` | Locale-aware money/number formatting |
| `src/lib/countdown.ts` | Evergreen deadline resolution, pure functions |
| `src/lib/types.ts` | Shared `Locale`, section and content item types |
| `src/components/ui/*` | Button, Eyebrow, Card, Chip, Placeholder, SectionShell |
| `src/components/sections/*` | Hero, HeroStats, CardGrid, MediaGrid, BeforeAfter, OfferStack, Faq, FinalCta, OrderSection |
| `src/components/layout/*` | CountdownTopbar, LocaleSwitcher, SiteFooter, StickyMobileCta, ExitIntent |
| `messages/{ar,en}.json` | All copy, per locale |
| `tests/` | Vitest unit + component tests |
| `e2e/` | Playwright specs |

---

## Task 1: Scaffold, design tokens, and the logical-property lint rule

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `postcss.config.mjs`
- Create: `src/app/globals.css`
- Test: `tests/lint/logical-properties.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a working `npm test`, `npm run lint`, `npm run build`; Tailwind utilities `bg-bg`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-2`, `text-ink-3`, `border-line`, `border-line-strong`, `bg-accent`, `text-accent`, `bg-accent-soft`, `border-accent-line`, `bg-highlight`, `text-success`, `bg-success-soft`, `text-danger`, `rounded-control`, `rounded-card`, `shadow-offset`, `shadow-card`, `max-w-page`, `font-ar`, `font-en`

- [ ] **Step 1: Scaffold the project**

Run in `/Users/mustafahassib/BricksNcode/aistore`:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm --turbopack --yes
```

If it refuses because the directory is non-empty, that is expected — it should proceed since only `.gitignore`, `docs/`, and `.claude/` exist. If it still refuses, scaffold into `.tmp-scaffold/`, move the contents up, and delete the temp directory. Do **not** let it overwrite `.gitignore` or `docs/`.

- [ ] **Step 2: Install remaining dependencies**

```bash
npm install next-intl
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom vite-tsconfig-paths @playwright/test
npx playwright install chromium
```

- [ ] **Step 3: Write the design tokens**

Replace `src/app/globals.css` entirely:

```css
@import "tailwindcss";

@theme {
  --color-bg: #FBF8F3;
  --color-surface: #FFFFFF;
  --color-surface-2: #F3EEE6;

  --color-ink: #1C1917;
  --color-ink-2: #57534E;
  --color-ink-3: #8A817A;

  --color-line: #E4DED4;
  --color-line-strong: #1C1917;

  --color-accent: #DC4A1E;
  --color-accent-soft: #FEE9DC;
  --color-accent-line: #F8C9A9;
  --color-highlight: #FBBF8E;

  --color-success: #166534;
  --color-success-soft: #DCFCE7;
  --color-danger: #B91C1C;

  --radius-control: 6px;
  --radius-card: 8px;

  --shadow-offset: 3px 3px 0 var(--color-line-strong);
  --shadow-card: 5px 5px 0 rgba(28, 25, 23, 0.09);

  --container-page: 1140px;

  --font-ar: var(--font-plex-arabic), system-ui, sans-serif;
  --font-en: var(--font-inter), system-ui, sans-serif;
}

@layer base {
  html {
    scroll-behavior: smooth;
  }

  body {
    background-color: var(--color-bg);
    color: var(--color-ink-2);
    -webkit-font-smoothing: antialiased;
  }

  h1, h2, h3, h4 {
    color: var(--color-ink);
    text-wrap: balance;
  }

  p {
    text-wrap: pretty;
  }

  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}

/* The marker sweep behind emphasised headline phrases. Uses inset-inline
   so it tracks the text in both directions. */
@utility marker-sweep {
  position: relative;
  display: inline;
  background-image: linear-gradient(var(--color-highlight), var(--color-highlight));
  background-repeat: no-repeat;
  background-position: 0 88%;
  background-size: 100% 0.34em;
  padding-inline: 0.06em;
}
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    globals: true,
  },
});
```

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"e2e": "playwright test"
```

- [ ] **Step 5: Write the failing lint test**

This test is the guard that keeps the site bilingual. It scans committed source for physical-direction utilities.

Create `tests/lint/logical-properties.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PHYSICAL = [
  /(^|["'\s])-?(ml|mr|pl|pr)-/,
  /(^|["'\s])text-(left|right)(["'\s]|$)/,
  /(^|["'\s])(border|rounded)-(l|r)-/,
  /(^|["'\s])(left|right)-\d/,
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

describe("logical properties", () => {
  it("no source file uses physical-direction utilities", () => {
    const offenders: string[] = [];

    for (const file of walk("src")) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (PHYSICAL.some((re) => re.test(line))) {
          offenders.push(`${file}:${i + 1}  ${line.trim()}`);
        }
      });
    }

    expect(
      offenders,
      `Physical-direction utilities break RTL. Use ms/me, ps/pe, text-start/text-end, border-s/border-e, rounded-s/rounded-e, start-*/end-*.\n\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- tests/lint/logical-properties.test.ts`
Expected: FAIL — the `create-next-app` boilerplate in `src/app/page.tsx` contains physical utilities.

- [ ] **Step 7: Clear the boilerplate**

Delete `src/app/page.tsx` and `src/app/layout.tsx` (Task 2 replaces them under `[locale]`). Delete any `src/app/favicon.ico` reference you remove. Delete the `public/*.svg` boilerplate files.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 1 test.

- [ ] **Step 9: Add the same rule to ESLint**

Append to `eslint.config.mjs` inside the exported array:

```js
{
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "JSXAttribute[name.name='className'] Literal[value=/(^|\\s)-?(ml|mr|pl|pr)-|(^|\\s)text-(left|right)(\\s|$)|(^|\\s)(border|rounded)-(l|r)-/]",
        message:
          "Physical-direction utilities break RTL. Use ms/me, ps/pe, text-start/text-end, border-s/border-e, rounded-s/rounded-e.",
      },
    ],
  },
},
```

- [ ] **Step 10: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with design tokens and RTL lint guard"
```

---

## Task 2: Locale routing, layout, and the message parity test

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`, `src/middleware.ts`
- Create: `src/lib/types.ts`
- Create: `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`
- Create: `messages/ar.json`, `messages/en.json`
- Modify: `next.config.ts`
- Test: `tests/i18n/message-parity.test.ts`, `tests/i18n/layout.test.tsx`

**Interfaces:**
- Consumes: Task 1's tokens and test setup
- Produces:
  - `routing: { locales: readonly ["ar","en"], defaultLocale: "ar" }` from `src/i18n/routing.ts`
  - `type Locale = "ar" | "en"` from `src/lib/types.ts`
  - `Link`, `usePathname`, `useRouter`, `redirect` from `src/i18n/navigation.ts`
  - `/ar` and `/en` render with correct `lang` and `dir`

- [ ] **Step 1: Write the failing parity test**

Create `tests/i18n/message-parity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

type Json = Record<string, unknown>;

/** Flattens to dotted paths. Arrays contribute their index so shape drift is caught too. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => keyPaths(item, `${prefix}[${i}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Json).flatMap(([k, v]) =>
      keyPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

describe("message parity", () => {
  it("ar.json and en.json have identical key trees", () => {
    const arKeys = keyPaths(ar).sort();
    const enKeys = keyPaths(en).sort();

    const missingInEn = arKeys.filter((k) => !enKeys.includes(k));
    const missingInAr = enKeys.filter((k) => !arKeys.includes(k));

    expect(missingInEn, `Missing from en.json:\n${missingInEn.join("\n")}`).toEqual([]);
    expect(missingInAr, `Missing from ar.json:\n${missingInAr.join("\n")}`).toEqual([]);
  });

  it("no message value is an empty string", () => {
    const empties = [
      ...Object.entries({ ar, en }).flatMap(([locale, msgs]) =>
        keyPaths(msgs)
          .filter((path) => {
            const value = path
              .replace(/\[(\d+)\]/g, ".$1")
              .split(".")
              .reduce<unknown>((acc, k) => (acc as Json)?.[k], msgs);
            return typeof value === "string" && value.trim() === "";
          })
          .map((path) => `${locale}: ${path}`),
      ),
    ];

    expect(empties, `Empty strings:\n${empties.join("\n")}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/i18n/message-parity.test.ts`
Expected: FAIL — `Cannot find module '../../messages/ar.json'`.

- [ ] **Step 3: Create minimal message files**

Create `messages/ar.json`:

```json
{
  "meta": {
    "title": "نظام AI لنشر فيديوهات قصيرة أوتوماتيك",
    "description": "نظام بيولد الفكرة، يجهز الفيديو، يكتب الكابشن والهاشتاجات، وينشر أوتوماتيك."
  },
  "common": {
    "currency": "ج.م",
    "localeName": "العربية",
    "switchTo": "English"
  }
}
```

Create `messages/en.json`:

```json
{
  "meta": {
    "title": "An AI system that posts short videos automatically",
    "description": "It generates the idea, builds the video, writes the caption and hashtags, and publishes on schedule."
  },
  "common": {
    "currency": "EGP",
    "localeName": "English",
    "switchTo": "العربية"
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/i18n/message-parity.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Create the shared types**

Create `src/lib/types.ts`:

```ts
export const LOCALES = ["ar", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export type Direction = "rtl" | "ltr";

export function directionOf(locale: Locale): Direction {
  return locale === "ar" ? "rtl" : "ltr";
}
```

- [ ] **Step 6: Wire up next-intl**

Create `src/i18n/routing.ts`:

```ts
import { defineRouting } from "next-intl/routing";
import { LOCALES } from "@/lib/types";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "ar",
  localePrefix: "always",
});
```

Create `src/i18n/navigation.ts`:

```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

Create `src/i18n/request.ts`:

```ts
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

Create `src/middleware.ts`:

```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, the admin surface (Plan B), and any file
  // with an extension.
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
```

Replace `next.config.ts`:

```ts
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 7: Write the failing layout test**

Create `tests/i18n/layout.test.tsx`:

```ts
import { describe, expect, it } from "vitest";
import { directionOf, LOCALES } from "@/lib/types";
import { routing } from "@/i18n/routing";

describe("locale configuration", () => {
  it("defaults to Arabic", () => {
    expect(routing.defaultLocale).toBe("ar");
  });

  it("always prefixes the locale so both locales are crawlable", () => {
    expect(routing.localePrefix).toBe("always");
  });

  it("maps each locale to the correct text direction", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("en")).toBe("ltr");
  });

  it("exposes exactly the two supported locales", () => {
    expect([...LOCALES]).toEqual(["ar", "en"]);
  });
});
```

- [ ] **Step 8: Run the test**

Run: `npm test -- tests/i18n/layout.test.tsx`
Expected: PASS — 4 tests. (The implementation from Step 6 already satisfies it; this test locks the configuration against regression.)

- [ ] **Step 9: Build the locale layout**

Create `src/app/[locale]/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { routing } from "@/i18n/routing";
import { directionOf, type Locale } from "@/lib/types";
import "../globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  const typed = locale as Locale;
  const dir = directionOf(typed);
  const fontClass = typed === "ar" ? "font-ar" : "font-en";

  return (
    <html lang={typed} dir={dir} className={`${plexArabic.variable} ${inter.variable}`}>
      <body className={`${fontClass} bg-bg text-ink-2 antialiased`}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 10: Add a temporary page so the route resolves**

Create `src/app/[locale]/page.tsx`:

```tsx
import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Content />;
}

function Content() {
  const t = useTranslations("meta");
  return (
    <main className="mx-auto max-w-page px-6 py-24">
      <h1 className="text-4xl font-bold">{t("title")}</h1>
    </main>
  );
}
```

- [ ] **Step 11: Verify both locales render**

```bash
npm run build
npm run dev
```

Open `http://localhost:3000/` — expect a redirect to `/ar`.
In DevTools, confirm `<html lang="ar" dir="rtl">`. Then open `/en` and confirm `<html lang="en" dir="ltr">`.

- [ ] **Step 12: Run the full suite and lint**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add locale routing, RTL/LTR layout, and message parity test"
```

---

## Task 3: Pricing, formatting, and countdown logic

These are pure functions with no React dependency, so they are tested directly and reused by every later task.

**Files:**
- Create: `src/config/pricing.ts`, `src/lib/format.ts`, `src/lib/countdown.ts`
- Test: `tests/lib/format.test.ts`, `tests/lib/countdown.test.ts`

**Interfaces:**
- Consumes: `Locale` from `src/lib/types.ts`
- Produces:
  - `PRICING: { original: 1999; main: 999; exit: 399; mini: 149 }` and `type OfferCode = "main" | "exit60" | "mini"` and `amountFor(code: OfferCode): number` from `src/config/pricing.ts`
  - `formatNumber(value: number, locale: Locale): string` and `formatMoney(value: number, locale: Locale, currency: string): string` and `percentOff(from: number, to: number): number` from `src/lib/format.ts`
  - `resolveDeadline(now: number, stored: string | null, windowHours: number): number` and `splitRemaining(ms: number): { hours: string; minutes: string; seconds: string }` from `src/lib/countdown.ts`

- [ ] **Step 1: Write the failing formatting test**

Create `tests/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatMoney, formatNumber, percentOff } from "@/lib/format";
import { amountFor, PRICING } from "@/config/pricing";

describe("formatNumber", () => {
  it("uses Western digits in Arabic, not Arabic-Indic", () => {
    const result = formatNumber(1999, "ar");
    expect(result).toContain("1");
    expect(result).not.toMatch(/[٠-٩]/);
  });

  it("groups thousands in both locales", () => {
    expect(formatNumber(1999, "en")).toBe("1,999");
    expect(formatNumber(1999, "ar")).toBe("1,999");
  });

  it("leaves values under a thousand ungrouped", () => {
    expect(formatNumber(999, "ar")).toBe("999");
  });
});

describe("formatMoney", () => {
  it("puts the currency after the amount", () => {
    expect(formatMoney(999, "ar", "ج.م")).toBe("999 ج.م");
    expect(formatMoney(999, "en", "EGP")).toBe("999 EGP");
  });
});

describe("percentOff", () => {
  it("computes the headline discount", () => {
    expect(percentOff(1999, 999)).toBe(50);
    expect(percentOff(999, 399)).toBe(60);
  });

  it("returns 0 when there is no discount", () => {
    expect(percentOff(999, 999)).toBe(0);
  });

  it("never returns a negative discount", () => {
    expect(percentOff(999, 1999)).toBe(0);
  });
});

describe("pricing", () => {
  it("resolves an amount for every offer code", () => {
    expect(amountFor("main")).toBe(PRICING.main);
    expect(amountFor("exit60")).toBe(PRICING.exit);
    expect(amountFor("mini")).toBe(PRICING.mini);
  });

  it("keeps the advertised discounts truthful", () => {
    expect(percentOff(PRICING.original, PRICING.main)).toBe(50);
    expect(percentOff(PRICING.main, PRICING.exit)).toBe(60);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/lib/format.test.ts`
Expected: FAIL — `Cannot find module '@/lib/format'`.

- [ ] **Step 3: Implement pricing and formatting**

Create `src/config/pricing.ts`:

```ts
export const PRICING = {
  original: 1999,
  main: 999,
  exit: 399,
  mini: 149,
} as const;

export type OfferCode = "main" | "exit60" | "mini";

const AMOUNTS: Record<OfferCode, number> = {
  main: PRICING.main,
  exit60: PRICING.exit,
  mini: PRICING.mini,
};

/**
 * Resolves an offer code to its amount. Plan B's API calls this server-side so
 * a price is never accepted from the client.
 */
export function amountFor(code: OfferCode): number {
  return AMOUNTS[code];
}
```

Create `src/lib/format.ts`:

```ts
import type { Locale } from "@/lib/types";

/**
 * `-u-nu-latn` forces Western digits in Arabic. Egyptian marketing copy uses
 * them, and the design depends on the numeral widths.
 */
const INTL_LOCALE: Record<Locale, string> = {
  ar: "ar-EG-u-nu-latn",
  en: "en-US",
};

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

export function formatMoney(
  value: number,
  locale: Locale,
  currency: string,
): string {
  return `${formatNumber(value, locale)} ${currency}`;
}

export function percentOff(from: number, to: number): number {
  if (from <= 0 || to >= from) return 0;
  return Math.round(((from - to) / from) * 100);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/lib/format.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Write the failing countdown test**

The spec requires an *evergreen* timer: the deadline is fixed on first visit and does not reset on refresh. A visibly resetting timer teaches visitors the urgency is fake.

Create `tests/lib/countdown.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveDeadline, splitRemaining } from "@/lib/countdown";

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

describe("resolveDeadline", () => {
  it("starts a new window when nothing is stored", () => {
    expect(resolveDeadline(NOW, null, 24)).toBe(NOW + 24 * HOUR);
  });

  it("keeps a stored future deadline across refreshes", () => {
    const stored = String(NOW + 5 * HOUR);
    expect(resolveDeadline(NOW, stored, 24)).toBe(NOW + 5 * HOUR);
  });

  it("keeps an expired deadline expired instead of resetting it", () => {
    const stored = String(NOW - HOUR);
    expect(resolveDeadline(NOW, stored, 24)).toBe(NOW - HOUR);
  });

  it("starts a new window when the stored value is not a number", () => {
    expect(resolveDeadline(NOW, "not-a-number", 24)).toBe(NOW + 24 * HOUR);
  });

  it("starts a new window when the stored value is empty", () => {
    expect(resolveDeadline(NOW, "", 24)).toBe(NOW + 24 * HOUR);
  });
});

describe("splitRemaining", () => {
  it("zero-pads each unit to two digits", () => {
    expect(splitRemaining(2 * HOUR + 5 * 60_000 + 9_000)).toEqual({
      hours: "02",
      minutes: "05",
      seconds: "09",
    });
  });

  it("rolls hours beyond 24 rather than wrapping to days", () => {
    expect(splitRemaining(30 * HOUR).hours).toBe("30");
  });

  it("clamps a negative remainder to zero", () => {
    expect(splitRemaining(-5000)).toEqual({
      hours: "00",
      minutes: "00",
      seconds: "00",
    });
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- tests/lib/countdown.test.ts`
Expected: FAIL — `Cannot find module '@/lib/countdown'`.

- [ ] **Step 7: Implement the countdown logic**

Create `src/lib/countdown.ts`:

```ts
export const DEADLINE_STORAGE_KEY = "offer-deadline";

/**
 * Evergreen deadline. The first visit fixes an end time; later visits reuse it,
 * including after it has passed — an expired offer shows an expired state
 * rather than silently restarting, which is what makes the urgency credible.
 */
export function resolveDeadline(
  now: number,
  stored: string | null,
  windowHours: number,
): number {
  if (stored) {
    const parsed = Number(stored);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return now + windowHours * 3_600_000;
}

const pad = (value: number): string => String(value).padStart(2, "0");

export function splitRemaining(ms: number): {
  hours: string;
  minutes: string;
  seconds: string;
} {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);

  return {
    hours: pad(Math.floor(totalSeconds / 3600)),
    minutes: pad(Math.floor((totalSeconds % 3600) / 60)),
    seconds: pad(totalSeconds % 60),
  };
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- tests/lib/countdown.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 9: Run the full suite**

Run: `npm test && npm run lint`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add pricing config, locale-aware formatting, and evergreen countdown logic"
```

---

## Task 4: UI primitives

**Files:**
- Create: `src/components/ui/Button.tsx`, `src/components/ui/Eyebrow.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Chip.tsx`, `src/components/ui/Placeholder.tsx`, `src/components/ui/SectionShell.tsx`, `src/components/ui/Highlight.tsx`
- Test: `tests/ui/primitives.test.tsx`

**Interfaces:**
- Consumes: Task 1 tokens
- Produces:
  - `<Button variant="primary" | "ghost" size="md" | "lg" as="a" | "button" href?>` — clay fill, `shadow-offset`
  - `<Eyebrow>{children}</Eyebrow>` — accent-soft pill
  - `<Card>{children}</Card>` — white, 1.5px ink border, `shadow-card`
  - `<Chip>{children}</Chip>` — bordered white pill
  - `<Placeholder label ratio="16/9" | "9/16" | "1/1" | "4/3" />` — labelled asset slot
  - `<Highlight>{children}</Highlight>` — marker sweep span
  - `<SectionShell id eyebrow heading sub band="base" | "alt" children>` — renders `<section>` with heading block

- [ ] **Step 1: Write the failing primitives test**

Create `tests/ui/primitives.test.tsx`:

```tsx
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

  it("renders an anchor when given href", () => {
    render(
      <Button as="a" href="#order">
        Order
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Order" });
    expect(link).toHaveAttribute("href", "#order");
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/ui/primitives.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the primitives**

Create `src/components/ui/Button.tsx`:

```tsx
import type { ComponentPropsWithoutRef } from "react";

type Variant = "primary" | "ghost";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white border-line-strong hover:brightness-110 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none",
  ghost: "bg-surface text-ink border-line-strong hover:bg-surface-2",
};

const SIZES: Record<Size, string> = {
  md: "text-sm px-5 py-3",
  lg: "text-base px-7 py-4",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control border-[1.5px] font-semibold shadow-offset transition-[filter,transform,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type ButtonProps = { variant?: Variant; size?: Size } & (
  | ({ as?: "button" } & ComponentPropsWithoutRef<"button">)
  | ({ as: "a" } & ComponentPropsWithoutRef<"a">)
);

export function Button({
  variant = "primary",
  size = "lg",
  className = "",
  ...props
}: ButtonProps) {
  const classes = `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  if (props.as === "a") {
    const { as: _as, ...anchorProps } = props;
    return <a className={classes} {...anchorProps} />;
  }

  const { as: _as, ...buttonProps } = props as { as?: "button" } & ComponentPropsWithoutRef<"button">;
  return <button className={classes} {...buttonProps} />;
}
```

Create `src/components/ui/Eyebrow.tsx`:

```tsx
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-control border border-accent-line bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent">
      {children}
    </span>
  );
}
```

Create `src/components/ui/Card.tsx`:

```tsx
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border-[1.5px] border-line-strong bg-surface p-6 shadow-card ${className}`}
    >
      {children}
    </div>
  );
}
```

Create `src/components/ui/Chip.tsx`:

```tsx
export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-2">
      {children}
    </span>
  );
}
```

Create `src/components/ui/Highlight.tsx`:

```tsx
export function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="marker-sweep">{children}</span>;
}
```

Create `src/components/ui/Placeholder.tsx`:

```tsx
const RATIOS = {
  "16/9": "aspect-video",
  "9/16": "aspect-[9/16]",
  "1/1": "aspect-square",
  "4/3": "aspect-[4/3]",
} as const;

export type Ratio = keyof typeof RATIOS;

/**
 * A labelled asset slot. Keeps the layout correctly proportioned before real
 * imagery exists, and states plainly what belongs there.
 */
export function Placeholder({
  label,
  ratio = "16/9",
}: {
  label: string;
  ratio?: Ratio;
}) {
  return (
    <div
      role="img"
      aria-label={`Placeholder: ${label}`}
      className={`${RATIOS[ratio]} flex w-full flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line bg-surface-2 p-4 text-center`}
    >
      <span aria-hidden="true" className="text-2xl opacity-40">
        🖼
      </span>
      <span className="text-xs font-semibold text-ink-3">Replace: {label}</span>
      <span className="text-[10px] uppercase tracking-wider text-ink-3 opacity-70">
        {ratio}
      </span>
    </div>
  );
}
```

Create `src/components/ui/SectionShell.tsx`:

```tsx
import { Eyebrow } from "./Eyebrow";

export function SectionShell({
  id,
  eyebrow,
  heading,
  sub,
  band = "base",
  children,
}: {
  id: string;
  eyebrow?: string;
  heading: React.ReactNode;
  sub?: string;
  band?: "base" | "alt";
  children: React.ReactNode;
}) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={band === "alt" ? "bg-surface-2" : "bg-bg"}
    >
      <div className="mx-auto max-w-page px-5 py-16 md:py-24">
        <header className="mb-10 max-w-3xl">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h2
            id={headingId}
            className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-4xl"
          >
            {heading}
          </h2>
          {sub ? (
            <p className="mt-4 text-base leading-relaxed text-ink-2">{sub}</p>
          ) : null}
        </header>
        {children}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/ui/primitives.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 5: Verify the RTL lint guard still passes**

Run: `npm test && npm run lint`
Expected: all pass, including `tests/lint/logical-properties.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add UI primitives with Warm Studio treatment"
```

---

## Task 5: Layout shell — countdown topbar, locale switcher, footer, sticky CTA

**Files:**
- Create: `src/components/layout/CountdownTopbar.tsx`, `src/components/layout/LocaleSwitcher.tsx`, `src/components/layout/SiteFooter.tsx`, `src/components/layout/StickyMobileCta.tsx`
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `messages/ar.json`, `messages/en.json`
- Test: `tests/layout/countdown-topbar.test.tsx`, `tests/layout/locale-switcher.test.tsx`

**Interfaces:**
- Consumes: `resolveDeadline`, `splitRemaining`, `DEADLINE_STORAGE_KEY` (Task 3); `Button`, `Chip` (Task 4); `usePathname`, `useRouter` (Task 2)
- Produces: `<CountdownTopbar />`, `<LocaleSwitcher />`, `<SiteFooter />`, `<StickyMobileCta />` — all rendered by the locale layout

- [ ] **Step 1: Add the messages both locales need**

Add to `messages/ar.json`:

```json
"topbar": {
  "offer": "خصم {percent}% — {now} بدل {was}",
  "endsIn": "ينتهي خلال",
  "expired": "انتهى العرض",
  "instantDelivery": "تسليم فوري",
  "securePayment": "دفع آمن"
},
"footer": {
  "brand": "Digital Assets",
  "rights": "© {year} Digital Assets. جميع الحقوق محفوظة.",
  "disclaimer": "تسليم السيستم والشروحات ودعم التشغيل يتم بعد تأكيد الطلب."
},
"stickyCta": {
  "label": "ابدأ الآن — {price}"
}
```

Add the matching keys to `messages/en.json`:

```json
"topbar": {
  "offer": "{percent}% off — {now} instead of {was}",
  "endsIn": "Ends in",
  "expired": "Offer ended",
  "instantDelivery": "Instant delivery",
  "securePayment": "Secure payment"
},
"footer": {
  "brand": "Digital Assets",
  "rights": "© {year} Digital Assets. All rights reserved.",
  "disclaimer": "System files, walkthroughs, and setup support are delivered after the order is confirmed."
},
"stickyCta": {
  "label": "Start now — {price}"
}
```

- [ ] **Step 2: Run the parity test**

Run: `npm test -- tests/i18n/message-parity.test.ts`
Expected: PASS — the key trees still match. If it fails, one file is missing a key the other has; fix before continuing.

- [ ] **Step 3: Write the failing countdown topbar test**

Create `tests/layout/countdown-topbar.test.tsx`:

```tsx
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
    vi.useFakeTimers();
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
    const stored = String(Date.now() + 2 * 3_600_000);
    localStorage.setItem(DEADLINE_STORAGE_KEY, stored);

    renderTopbar();

    expect(localStorage.getItem(DEADLINE_STORAGE_KEY)).toBe(stored);
    expect(screen.getByTestId("countdown-hours")).toHaveTextContent("01");
  });

  it("shows an expired state rather than resetting once the deadline passes", () => {
    localStorage.setItem(DEADLINE_STORAGE_KEY, String(Date.now() - 1000));

    renderTopbar();

    expect(screen.getByText(messages.topbar.expired)).toBeInTheDocument();
    expect(screen.queryByTestId("countdown-hours")).not.toBeInTheDocument();
  });
});
```

> Note on the second assertion: with a two-hour window the displayed hours read `01` because one full hour plus 59 minutes remain after the first tick. If your implementation renders `02` before the first interval fires, set the stored deadline to `+2h +1s` and keep the expectation at `02`. Pick one and make the test deterministic.

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- tests/layout/countdown-topbar.test.tsx`
Expected: FAIL — `Cannot find module '@/components/layout/CountdownTopbar'`.

- [ ] **Step 5: Implement the countdown topbar**

Create `src/components/layout/CountdownTopbar.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEADLINE_STORAGE_KEY, resolveDeadline, splitRemaining } from "@/lib/countdown";
import { formatMoney, percentOff } from "@/lib/format";
import { PRICING } from "@/config/pricing";
import type { Locale } from "@/lib/types";

const WINDOW_HOURS = 24;

export function CountdownTopbar() {
  const t = useTranslations("topbar");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;

  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(DEADLINE_STORAGE_KEY);
    const deadline = resolveDeadline(Date.now(), stored, WINDOW_HOURS);
    window.localStorage.setItem(DEADLINE_STORAGE_KEY, String(deadline));

    const tick = () => setRemaining(deadline - Date.now());
    tick();

    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const currency = tc("currency");
  const offer = t("offer", {
    percent: percentOff(PRICING.original, PRICING.main),
    now: formatMoney(PRICING.main, locale, currency),
    was: formatMoney(PRICING.original, locale, currency),
  });

  const expired = remaining !== null && remaining <= 0;
  const parts = remaining !== null ? splitRemaining(remaining) : null;

  return (
    <div className="sticky top-0 z-50 border-b-[1.5px] border-line-strong bg-accent text-white">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-center gap-x-4 gap-y-1 px-5 py-2 text-center text-xs font-semibold md:text-sm">
        <span>🔥 {offer}</span>

        {expired ? (
          <span className="opacity-90">{t("expired")}</span>
        ) : parts ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="opacity-90">{t("endsIn")}</span>
            <span
              dir="ltr"
              className="inline-flex items-center gap-1 font-mono tabular-nums"
            >
              <b data-testid="countdown-hours">{parts.hours}</b>:
              <b data-testid="countdown-minutes">{parts.minutes}</b>:
              <b data-testid="countdown-seconds">{parts.seconds}</b>
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
```

> The timer block is `dir="ltr"` on purpose. Clock values read left-to-right in Arabic too; letting them inherit RTL renders `SS:MM:HH`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- tests/layout/countdown-topbar.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 7: Write the failing locale switcher test**

Create `tests/layout/locale-switcher.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import messages from "../../messages/en.json";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  Link: ({ children, href, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("LocaleSwitcher", () => {
  it("links to the other locale on the same path", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LocaleSwitcher />
      </NextIntlClientProvider>,
    );

    const link = screen.getByRole("link", { name: messages.common.switchTo });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveAttribute("hrefLang", "ar");
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm test -- tests/layout/locale-switcher.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 9: Implement the locale switcher**

Create `src/components/layout/LocaleSwitcher.tsx`:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/lib/types";

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const t = useTranslations("common");

  const other: Locale = locale === "ar" ? "en" : "ar";

  return (
    <Link
      href={pathname}
      locale={other}
      hrefLang={other}
      className="rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2"
    >
      {t("switchTo")}
    </Link>
  );
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm test -- tests/layout/locale-switcher.test.tsx`
Expected: PASS — 1 test.

- [ ] **Step 11: Implement the footer and sticky CTA**

Create `src/components/layout/SiteFooter.tsx`:

```tsx
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t-[1.5px] border-line-strong bg-surface-2">
      <div className="mx-auto flex max-w-page flex-col gap-4 px-5 py-10 text-sm text-ink-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold text-ink">{t("brand")}</p>
          <p className="mt-2">{t("rights", { year: new Date().getFullYear() })}</p>
          <p className="mt-1 max-w-prose text-xs">{t("disclaimer")}</p>
        </div>
        <LocaleSwitcher />
      </div>
    </footer>
  );
}
```

Create `src/components/layout/StickyMobileCta.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";
import { PRICING } from "@/config/pricing";
import type { Locale } from "@/lib/types";

/**
 * Appears on small viewports once the hero has scrolled away, and hides while
 * the order section is on screen so it never covers the form it points at.
 */
export function StickyMobileCta() {
  const t = useTranslations("stickyCta");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const order = document.getElementById("order");
    if (!hero) return;

    let heroGone = false;
    let orderVisible = false;
    const sync = () => setVisible(heroGone && !orderVisible);

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        heroGone = !entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    heroObserver.observe(hero);

    const orderObserver = order
      ? new IntersectionObserver(
          ([entry]) => {
            orderVisible = entry.isIntersecting;
            sync();
          },
          { threshold: 0 },
        )
      : null;
    if (order && orderObserver) orderObserver.observe(order);

    return () => {
      heroObserver.disconnect();
      orderObserver?.disconnect();
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-line-strong bg-surface p-3 md:hidden">
      <Button as="a" href="#order" size="md" className="w-full">
        {t("label", { price: formatMoney(PRICING.main, locale, tc("currency")) })}
      </Button>
    </div>
  );
}
```

- [ ] **Step 12: Mount the shell in the locale layout**

In `src/app/[locale]/layout.tsx`, replace the `<body>` contents:

```tsx
      <body className={`${fontClass} bg-bg text-ink-2 antialiased`}>
        <NextIntlClientProvider>
          <CountdownTopbar />
          {children}
          <SiteFooter />
          <StickyMobileCta />
        </NextIntlClientProvider>
      </body>
```

Add the imports at the top of the file:

```tsx
import { CountdownTopbar } from "@/components/layout/CountdownTopbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { StickyMobileCta } from "@/components/layout/StickyMobileCta";
```

- [ ] **Step 13: Verify in the browser**

Run: `npm run dev`

On `/ar`: the topbar is sticky, the timer counts down, and the clock reads `HH:MM:SS` left-to-right while the rest of the bar is RTL. Refresh and confirm the timer continues from where it was rather than restarting. Switch to `/en` via the footer link and confirm the path is preserved and direction flips.

- [ ] **Step 14: Run the full suite**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: add layout shell with evergreen countdown, locale switcher, footer, sticky CTA"
```

---

## Task 6: Hero and animated stats

**Files:**
- Create: `src/components/sections/Hero.tsx`, `src/components/sections/HeroStats.tsx`, `src/components/ui/StatCounter.tsx`
- Modify: `src/app/[locale]/page.tsx`, `messages/ar.json`, `messages/en.json`
- Test: `tests/sections/hero.test.tsx`, `tests/ui/stat-counter.test.tsx`

**Interfaces:**
- Consumes: `Button`, `Chip`, `Highlight`, `Placeholder` (Task 4); `formatNumber`, `formatMoney` (Task 3)
- Produces:
  - `<Hero />` — renders `<section id="hero">`, required by `StickyMobileCta`
  - `<HeroStats />`
  - `<StatCounter value: number, suffix?: string, prefix?: string, label: string />`

- [ ] **Step 1: Add hero messages**

Add to `messages/ar.json`:

```json
"hero": {
  "pains": ["😩 بتصحى وتنسى تنشر", "📉 صفحتك واقفة من شهور", "🕐 ساعات في فيديو مش مضمون"],
  "kicker": "مش عارف تنشر بانتظام؟ مش لوحدك.",
  "headlineBefore": "نظام AI بينشر",
  "headlineHighlight": "فيديوهات فيرال",
  "headlineAfter": "لوحده كل يوم",
  "sub": "بيكتب الفكرة، يصنع الفيديو، يكتب الكابشن والهاشتاجات، وينشر على السوشيال ميديا — وإنت نايم أو شغال أو مسافر.",
  "chips": ["🎬 5 فيديوهات يومياً", "🤖 أوتوماتيك 100%", "📱 من الموبايل", "💸 بدون تصوير أو ظهور"],
  "cta": "شغّل مصنع الفيديوهات وابدأ اليوم",
  "trust": "تسليم فوري • دفع مرة واحدة • ملكية دائمة",
  "coverAsset": "Hero cover image"
},
"heroStats": {
  "items": [
    { "value": 5, "suffix": "", "label": "فيديوهات يومياً أوتوماتيك" },
    { "value": 30, "suffix": "+", "label": "سيناريو مختلف بدون تكرار" },
    { "value": 1, "suffix": " ساعة", "label": "للإعداد الأول فقط" },
    { "value": 1500, "suffix": "+", "label": "مشتري شغّلوا النظام" }
  ]
}
```

Add the mirrored English to `messages/en.json`:

```json
"hero": {
  "pains": ["😩 You wake up and forget to post", "📉 Your page has been quiet for months", "🕐 Hours per video with no guarantee"],
  "kicker": "Struggling to post consistently? You are not alone.",
  "headlineBefore": "An AI system that posts",
  "headlineHighlight": "viral short videos",
  "headlineAfter": "on its own, every day",
  "sub": "It writes the idea, builds the video, writes the caption and hashtags, and publishes to social — while you sleep, work, or travel.",
  "chips": ["🎬 5 videos a day", "🤖 100% automated", "📱 Runs from your phone", "💸 No filming, no face"],
  "cta": "Start the video factory today",
  "trust": "Instant delivery • One-time payment • Lifetime access",
  "coverAsset": "Hero cover image"
},
"heroStats": {
  "items": [
    { "value": 5, "suffix": "", "label": "videos published daily" },
    { "value": 30, "suffix": "+", "label": "distinct scenarios, no repeats" },
    { "value": 1, "suffix": " hour", "label": "one-time setup" },
    { "value": 1500, "suffix": "+", "label": "buyers running the system" }
  ]
}
```

> The `value` fields are counts, not money, so they legitimately live in messages. Money never does.

- [ ] **Step 2: Run the parity test**

Run: `npm test -- tests/i18n/message-parity.test.ts`
Expected: PASS. Array shapes must match index-for-index — four `chips` in both, four `heroStats.items` in both.

- [ ] **Step 3: Write the failing StatCounter test**

Create `tests/ui/stat-counter.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCounter } from "@/components/ui/StatCounter";

beforeEach(() => {
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
    },
  );
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

describe("StatCounter", () => {
  it("renders the final value immediately under reduced motion", () => {
    render(<StatCounter value={1500} suffix="+" label="buyers" locale="en" />);
    expect(screen.getByText("1,500+")).toBeInTheDocument();
  });

  it("associates the figure with its label", () => {
    render(<StatCounter value={5} label="videos daily" locale="en" />);
    expect(screen.getByText("videos daily")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- tests/ui/stat-counter.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement StatCounter**

Create `src/components/ui/StatCounter.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/types";

const DURATION_MS = 1200;

export function StatCounter({
  value,
  label,
  suffix = "",
  locale,
}: {
  value: number;
  label: string;
  suffix?: string;
  locale: Locale;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(value);
      return;
    }

    const node = ref.current;
    if (!node) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / DURATION_MS);
          // Ease-out cubic: fast start, settled finish.
          const eased = 1 - Math.pow(1 - progress, 3);
          setShown(Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl font-bold tabular-nums text-ink md:text-5xl">
        {formatNumber(shown, locale)}
        {suffix}
      </div>
      <p className="mt-2 text-sm text-ink-3">{label}</p>
    </div>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- tests/ui/stat-counter.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 7: Write the failing hero test**

Create `tests/sections/hero.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Hero } from "@/components/sections/Hero";
import messages from "../../messages/en.json";

function renderHero() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Hero />
    </NextIntlClientProvider>,
  );
}

describe("Hero", () => {
  it("exposes an element with id 'hero' so the sticky CTA can observe it", () => {
    const { container } = renderHero();
    expect(container.querySelector("#hero")).not.toBeNull();
  });

  it("renders the full headline across its three parts", () => {
    renderHero();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(messages.hero.headlineBefore);
    expect(heading).toHaveTextContent(messages.hero.headlineHighlight);
    expect(heading).toHaveTextContent(messages.hero.headlineAfter);
  });

  it("renders every pain point and chip", () => {
    renderHero();
    for (const pain of messages.hero.pains) {
      expect(screen.getByText(pain)).toBeInTheDocument();
    }
    for (const chip of messages.hero.chips) {
      expect(screen.getByText(chip)).toBeInTheDocument();
    }
  });

  it("links its call to action at the order section", () => {
    renderHero();
    expect(
      screen.getByRole("link", { name: new RegExp(messages.hero.cta) }),
    ).toHaveAttribute("href", "#order");
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm test -- tests/sections/hero.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 9: Implement Hero and HeroStats**

Create `src/components/sections/Hero.tsx`:

```tsx
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Highlight } from "@/components/ui/Highlight";
import { Placeholder } from "@/components/ui/Placeholder";

export function Hero() {
  const t = useTranslations("hero");
  const pains = t.raw("pains") as string[];
  const chips = t.raw("chips") as string[];

  return (
    <section id="hero" className="bg-bg">
      <div className="mx-auto grid max-w-page items-center gap-12 px-5 py-14 md:py-20 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <ul className="flex flex-wrap gap-2">
            {pains.map((pain) => (
              <li
                key={pain}
                className="rounded-control border border-line bg-surface px-3 py-1.5 text-xs text-ink-3"
              >
                {pain}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm font-semibold text-accent">{t("kicker")}</p>

          <h1 className="mt-3 text-4xl font-bold leading-[1.25] tracking-tight md:text-5xl">
            {t("headlineBefore")}{" "}
            <Highlight>{t("headlineHighlight")}</Highlight>{" "}
            {t("headlineAfter")}
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2">
            {t("sub")}
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Chip key={chip}>{chip}</Chip>
            ))}
          </div>

          <div className="mt-8">
            <Button as="a" href="#order">
              {t("cta")} <span aria-hidden="true">←</span>
            </Button>
            <p className="mt-3 text-xs text-ink-3">{t("trust")}</p>
          </div>
        </div>

        <Placeholder label={t("coverAsset")} ratio="4/3" />
      </div>
    </section>
  );
}
```

Create `src/components/sections/HeroStats.tsx`:

```tsx
import { useLocale, useTranslations } from "next-intl";
import { StatCounter } from "@/components/ui/StatCounter";
import type { Locale } from "@/lib/types";

type StatItem = { value: number; suffix?: string; label: string };

export function HeroStats() {
  const t = useTranslations("heroStats");
  const locale = useLocale() as Locale;
  const items = t.raw("items") as StatItem[];

  return (
    <section
      id="heroStats"
      aria-label="Key figures"
      className="border-y-[1.5px] border-line-strong bg-surface-2"
    >
      <div className="mx-auto grid max-w-page grid-cols-2 gap-8 px-5 py-12 md:grid-cols-4">
        {items.map((item) => (
          <StatCounter
            key={item.label}
            value={item.value}
            suffix={item.suffix}
            label={item.label}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm test -- tests/sections/hero.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 11: Render both on the page**

Replace `src/app/[locale]/page.tsx`:

```tsx
import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/sections/Hero";
import { HeroStats } from "@/components/sections/HeroStats";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <Hero />
      <HeroStats />
    </main>
  );
}
```

- [ ] **Step 12: Verify in the browser**

Run: `npm run dev`

On `/ar` confirm the hero reads right-to-left with the marker sweep sitting under the highlighted phrase, the stats count up when scrolled into view, and the sticky mobile CTA appears at a narrow viewport once the hero is off screen. Switch to `/en` and confirm the layout mirrors cleanly with nothing clipped.

- [ ] **Step 13: Run the full suite**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: add hero section and animated stat counters"
```

---

## Task 7: CardGrid and MediaGrid primitives

These two primitives cover ten of the page's sections. Building them once is the difference between this plan and twenty near-identical components.

**Files:**
- Create: `src/components/sections/CardGrid.tsx`, `src/components/sections/MediaGrid.tsx`, `src/components/ui/VideoCard.tsx`
- Test: `tests/sections/card-grid.test.tsx`, `tests/sections/media-grid.test.tsx`

**Interfaces:**
- Consumes: `SectionShell`, `Card`, `Placeholder` (Task 4)
- Produces:
  - `type CardItem = { icon?: string; title: string; desc?: string; note?: string }`
  - `type MediaItem = { label: string; ratio?: Ratio; kind?: "image" | "video"; title?: string; caption?: string; badge?: string }`
  - `<CardGrid id namespace columns={2|3|4} band />`
  - `<MediaGrid id namespace columns={2|3} band />`
  - `<VideoCard label title? caption? badge? ratio? />`

Both read `eyebrow`, `heading`, `sub`, and `items` from the message namespace they are given, so a new section is a manifest entry plus a namespace.

- [ ] **Step 1: Write the failing CardGrid test**

Create `tests/sections/card-grid.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { CardGrid } from "@/components/sections/CardGrid";

const messages = {
  painPoints: {
    eyebrow: "The reality",
    heading: "Daily content is draining",
    sub: "Consistency is the hard part.",
    items: [
      { icon: "🧠", title: "Deciding what to post", desc: "Starts from zero every day." },
      { icon: "📱", title: "One quiet day breaks momentum", desc: "The algorithm rewards regularity." },
    ],
  },
};

function renderGrid() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CardGrid id="painPoints" namespace="painPoints" columns={2} />
    </NextIntlClientProvider>,
  );
}

describe("CardGrid", () => {
  it("renders the section heading as a labelled region", () => {
    renderGrid();
    const region = screen.getByRole("region", { name: messages.painPoints.heading });
    expect(region).toHaveAttribute("id", "painPoints");
  });

  it("renders every item's title and description", () => {
    renderGrid();
    for (const item of messages.painPoints.items) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
      expect(screen.getByText(item.desc)).toBeInTheDocument();
    }
  });

  it("hides decorative icons from assistive technology", () => {
    const { container } = renderGrid();
    const icons = container.querySelectorAll("[data-testid='card-icon']");
    expect(icons).toHaveLength(2);
    icons.forEach((icon) => expect(icon).toHaveAttribute("aria-hidden", "true"));
  });

  it("renders the sub-copy", () => {
    renderGrid();
    expect(screen.getByText(messages.painPoints.sub)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/sections/card-grid.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement CardGrid**

Create `src/components/sections/CardGrid.tsx`:

```tsx
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { SectionShell } from "@/components/ui/SectionShell";

export type CardItem = {
  icon?: string;
  title: string;
  desc?: string;
  note?: string;
};

const COLUMNS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function CardGrid({
  id,
  namespace,
  columns = 3,
  band = "base",
}: {
  id: string;
  namespace: string;
  columns?: 2 | 3 | 4;
  band?: "base" | "alt";
}) {
  const t = useTranslations(namespace);
  const items = t.raw("items") as CardItem[];
  const eyebrow = t.has("eyebrow") ? t("eyebrow") : undefined;
  const sub = t.has("sub") ? t("sub") : undefined;

  return (
    <SectionShell
      id={id}
      eyebrow={eyebrow}
      heading={t("heading")}
      sub={sub}
      band={band}
    >
      <ul className={`grid gap-5 ${COLUMNS[columns]}`}>
        {items.map((item) => (
          <li key={item.title}>
            <Card className="h-full">
              {item.icon ? (
                <span
                  data-testid="card-icon"
                  aria-hidden="true"
                  className="block text-2xl"
                >
                  {item.icon}
                </span>
              ) : null}
              <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
              {item.desc ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{item.desc}</p>
              ) : null}
              {item.note ? (
                <p className="mt-3 text-xs font-semibold text-success">{item.note}</p>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/sections/card-grid.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Write the failing MediaGrid test**

Create `tests/sections/media-grid.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { MediaGrid } from "@/components/sections/MediaGrid";

const messages = {
  sampleVideos: {
    eyebrow: "Made with the system",
    heading: "Results from our own channels",
    items: [
      { kind: "video", label: "Horror POV sample", ratio: "9/16", title: "Horror POV", badge: "+3.1M views" },
      { kind: "image", label: "Review screenshot", ratio: "9/16", title: "Buyer review" },
    ],
  },
};

function renderGrid() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MediaGrid id="sampleVideos" namespace="sampleVideos" columns={3} />
    </NextIntlClientProvider>,
  );
}

describe("MediaGrid", () => {
  it("renders a labelled placeholder for every media slot", () => {
    renderGrid();
    expect(screen.getByRole("img", { name: /Horror POV sample/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Review screenshot/ })).toBeInTheDocument();
  });

  it("renders titles and badges", () => {
    renderGrid();
    expect(screen.getByText("Horror POV")).toBeInTheDocument();
    expect(screen.getByText("+3.1M views")).toBeInTheDocument();
  });

  it("renders the section as a labelled region", () => {
    renderGrid();
    expect(
      screen.getByRole("region", { name: messages.sampleVideos.heading }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- tests/sections/media-grid.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement VideoCard and MediaGrid**

Create `src/components/ui/VideoCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Placeholder, type Ratio } from "./Placeholder";

/**
 * Until a real `src` exists this renders the placeholder. When Plan A's assets
 * land, pass `src` and `poster` and the card plays inline on click —
 * `preload="none"` means video bytes are only spent on intent.
 */
export function VideoCard({
  label,
  ratio = "9/16",
  src,
  poster,
}: {
  label: string;
  ratio?: Ratio;
  src?: string;
  poster?: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (!src) return <Placeholder label={label} ratio={ratio} />;

  return (
    <div className="relative overflow-hidden rounded-card border-[1.5px] border-line-strong">
      <video
        className="w-full"
        src={src}
        poster={poster}
        preload="none"
        playsInline
        controls={playing}
        onPlay={() => setPlaying(true)}
      />
      {!playing ? (
        <button
          type="button"
          aria-label={label}
          onClick={(event) => {
            const video = event.currentTarget
              .previousElementSibling as HTMLVideoElement | null;
            video?.play();
          }}
          className="absolute inset-0 grid place-items-center bg-ink/20 text-4xl text-white"
        >
          <span aria-hidden="true">▶</span>
        </button>
      ) : null}
    </div>
  );
}
```

Create `src/components/sections/MediaGrid.tsx`:

```tsx
import { useTranslations } from "next-intl";
import { Placeholder, type Ratio } from "@/components/ui/Placeholder";
import { VideoCard } from "@/components/ui/VideoCard";
import { SectionShell } from "@/components/ui/SectionShell";

export type MediaItem = {
  kind?: "image" | "video";
  label: string;
  ratio?: Ratio;
  title?: string;
  caption?: string;
  badge?: string;
};

const COLUMNS: Record<1 | 2 | 3, string> = {
  1: "max-w-3xl mx-auto",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
};

export function MediaGrid({
  id,
  namespace,
  columns = 3,
  band = "base",
}: {
  id: string;
  namespace: string;
  columns?: 1 | 2 | 3;
  band?: "base" | "alt";
}) {
  const t = useTranslations(namespace);
  const items = t.raw("items") as MediaItem[];
  const eyebrow = t.has("eyebrow") ? t("eyebrow") : undefined;
  const sub = t.has("sub") ? t("sub") : undefined;

  return (
    <SectionShell
      id={id}
      eyebrow={eyebrow}
      heading={t("heading")}
      sub={sub}
      band={band}
    >
      <ul className={`grid gap-5 ${COLUMNS[columns]}`}>
        {items.map((item) => (
          <li key={item.label} className="flex flex-col gap-3">
            {item.kind === "video" ? (
              <VideoCard label={item.label} ratio={item.ratio} />
            ) : (
              <Placeholder label={item.label} ratio={item.ratio} />
            )}

            {item.badge ? (
              <span className="inline-flex w-fit rounded-control bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                {item.badge}
              </span>
            ) : null}
            {item.title ? (
              <h3 className="text-base font-bold">{item.title}</h3>
            ) : null}
            {item.caption ? (
              <p className="text-sm text-ink-2">{item.caption}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- tests/sections/media-grid.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 9: Run the full suite**

Run: `npm test && npm run lint`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add CardGrid and MediaGrid section primitives"
```

---

## Task 8: BeforeAfter comparison

**Files:**
- Create: `src/components/sections/BeforeAfter.tsx`
- Modify: `messages/ar.json`, `messages/en.json`
- Test: `tests/sections/before-after.test.tsx`

**Interfaces:**
- Consumes: `SectionShell` (Task 4)
- Produces: `<BeforeAfter id namespace band />` reading `before.{label,items}` and `after.{label,items}` from its namespace

- [ ] **Step 1: Add the messages**

Add to `messages/ar.json`:

```json
"beforeAfter": {
  "eyebrow": "✨ الحل",
  "heading": "من صفحة واقفة وبتكافح — لصفحة شغالة وإنت نايم",
  "sub": "مش هنقولك اشتغل أكثر — هنديك نظام بيشتغل معاك.",
  "before": {
    "label": "❌ دلوقتي",
    "items": [
      "😩 كل يوم تفكير من الصفر",
      "🕐 ساعات في فيديو واحد",
      "📉 نشر متقطع = خوارزمية ضدك",
      "😴 لو مسافر = توقف تام",
      "💸 طاقة بتتحرق بدون نتيجة"
    ]
  },
  "after": {
    "label": "✅ بعد النظام",
    "items": [
      "⚡ النظام يفكر ويصنع وينشر",
      "⏱️ 5 فيديوهات يومياً أوتوماتيك",
      "📈 نشر يومي = خوارزمية بتدفعك",
      "😴 بيشتغل وإنت نايم أو مسافر",
      "💰 وقتك للربح والتوسع"
    ]
  }
}
```

Add to `messages/en.json`:

```json
"beforeAfter": {
  "eyebrow": "✨ The fix",
  "heading": "From a page that stalls — to one that runs while you sleep",
  "sub": "We are not telling you to work harder. We are giving you a system that works alongside you.",
  "before": {
    "label": "❌ Today",
    "items": [
      "😩 Starting from a blank page every day",
      "🕐 Hours spent on a single video",
      "📉 Irregular posting works against the algorithm",
      "😴 Travelling means posting stops",
      "💸 Energy burned with nothing to show"
    ]
  },
  "after": {
    "label": "✅ With the system",
    "items": [
      "⚡ It generates, builds, and publishes",
      "⏱️ 5 videos a day, automatically",
      "📈 Daily posting works with the algorithm",
      "😴 Keeps running while you sleep or travel",
      "💰 Your time goes to growth and revenue"
    ]
  }
}
```

- [ ] **Step 2: Run the parity test**

Run: `npm test -- tests/i18n/message-parity.test.ts`
Expected: PASS — five items on each side in both locales.

- [ ] **Step 3: Write the failing test**

Create `tests/sections/before-after.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { BeforeAfter } from "@/components/sections/BeforeAfter";
import messages from "../../messages/en.json";

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BeforeAfter id="beforeAfter" namespace="beforeAfter" />
    </NextIntlClientProvider>,
  );
}

describe("BeforeAfter", () => {
  it("renders both columns with their labels", () => {
    renderSection();
    expect(screen.getByText(messages.beforeAfter.before.label)).toBeInTheDocument();
    expect(screen.getByText(messages.beforeAfter.after.label)).toBeInTheDocument();
  });

  it("renders every before item inside the before column", () => {
    renderSection();
    const column = screen.getByTestId("before-column");
    for (const item of messages.beforeAfter.before.items) {
      expect(within(column).getByText(item)).toBeInTheDocument();
    }
  });

  it("renders every after item inside the after column", () => {
    renderSection();
    const column = screen.getByTestId("after-column");
    for (const item of messages.beforeAfter.after.items) {
      expect(within(column).getByText(item)).toBeInTheDocument();
    }
  });

  it("keeps the two columns balanced", () => {
    expect(messages.beforeAfter.before.items).toHaveLength(
      messages.beforeAfter.after.items.length,
    );
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- tests/sections/before-after.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement BeforeAfter**

Create `src/components/sections/BeforeAfter.tsx`:

```tsx
import { useTranslations } from "next-intl";
import { SectionShell } from "@/components/ui/SectionShell";

type Column = { label: string; items: string[] };

export function BeforeAfter({
  id,
  namespace,
  band = "alt",
}: {
  id: string;
  namespace: string;
  band?: "base" | "alt";
}) {
  const t = useTranslations(namespace);
  const before = t.raw("before") as Column;
  const after = t.raw("after") as Column;
  const eyebrow = t.has("eyebrow") ? t("eyebrow") : undefined;
  const sub = t.has("sub") ? t("sub") : undefined;

  return (
    <SectionShell id={id} eyebrow={eyebrow} heading={t("heading")} sub={sub} band={band}>
      <div className="grid items-start gap-5 md:grid-cols-[1fr_auto_1fr]">
        <Column
          testId="before-column"
          label={before.label}
          items={before.items}
          tone="danger"
        />

        {/* Rotates a quarter turn on small screens where the columns stack. */}
        <div
          aria-hidden="true"
          className="mx-auto rotate-90 text-2xl text-ink-3 md:rotate-0 md:self-center rtl:md:-scale-x-100"
        >
          →
        </div>

        <Column
          testId="after-column"
          label={after.label}
          items={after.items}
          tone="success"
        />
      </div>
    </SectionShell>
  );
}

function Column({
  testId,
  label,
  items,
  tone,
}: {
  testId: string;
  label: string;
  items: string[];
  tone: "danger" | "success";
}) {
  const accent =
    tone === "danger"
      ? "border-danger/30 bg-surface"
      : "border-success/30 bg-success-soft";

  return (
    <div
      data-testid={testId}
      className={`rounded-card border-[1.5px] border-line-strong bg-surface p-6 shadow-card`}
    >
      <h3
        className={`mb-4 inline-flex rounded-control border px-3 py-1.5 text-sm font-bold ${accent}`}
      >
        {label}
      </h3>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item}
            className="border-b border-line pb-3 text-sm text-ink-2 last:border-b-0 last:pb-0"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

> `rtl:md:-scale-x-100` flips the arrow for Arabic. The arrow is directional meaning, not decoration, so it must mirror — this is the one case where a transform is the correct tool rather than a logical property.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- tests/sections/before-after.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 7: Run the full suite**

Run: `npm test && npm run lint`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add before/after comparison section"
```

---

## Task 9: Offer stack and price reveal

The commercial heart of the page: thirteen priced line items totalling far more than the asking price, then the reveal.

**Files:**
- Create: `src/components/sections/OfferStack.tsx`
- Modify: `messages/ar.json`, `messages/en.json`
- Test: `tests/sections/offer-stack.test.tsx`

**Interfaces:**
- Consumes: `PRICING`, `percentOff`, `formatMoney`, `formatNumber` (Task 3); `SectionShell`, `Card`, `Button` (Task 4)
- Produces: `<OfferStack id namespace band />`

Message items carry `price` as a **number or `null`** — `null` renders the "ongoing / not priced" label rather than an amount. Never a pre-formatted string.

- [ ] **Step 1: Add the messages**

Add to `messages/ar.json` (thirteen items, prices from the spec):

```json
"offer": {
  "eyebrow": "🔥 العرض الكامل",
  "heading": "كل اللي تحتاجه عشان تبدأ",
  "sub": "ادفع مرة واحدة — استلام فوري — ملكية دائمة — بدون اشتراك شهري.",
  "ongoing": "دائم",
  "totalLabel": "القيمة الإجمالية",
  "wasLabel": "السعر الأصلي",
  "nowLabel": "السعر بعد الخصم",
  "savingsLabel": "خصم {percent}% مفعّل",
  "cta": "ابدأ الآن واستلم السيستم كامل",
  "trust": "تسليم فوري • دفع آمن • ملكية دائمة • بدون اشتراك شهري",
  "items": [
    { "icon": "✅", "title": "النظام الأساسي الأوتوماتيكي", "desc": "يصنع أفكار، يجهز فيديوهات AI، يكتب كابشن وهاشتاجات، وينشر أوتوماتيك.", "price": 1500 },
    { "icon": "▶️", "title": "شرح تشغيل خطوة بخطوة", "desc": "شرح واضح للمبتدئ من أول فتح النظام لحد تشغيل أول فيديوهاتك.", "price": 750 },
    { "icon": "🎁", "title": "AI Page Launch Kit", "desc": "تجهيز صفحة من الصفر: اسم، Bio، صورة بروفايل، وأفكار أول محتوى.", "price": 750 },
    { "icon": "🎁", "title": "Niche Profit Map", "desc": "خريطة اختيار النيتش المناسب واختباره بدل ما تبدأ عشوائي.", "price": 500 },
    { "icon": "🎁", "title": "30-Day Auto Content Plan", "desc": "خطة محتوى 30 يوم عشان تعرف تنشر إيه كل يوم من غير حيرة.", "price": 800 },
    { "icon": "🎁", "title": "Viral Hooks Bank", "desc": "+50 Hook جاهز لبداية الفيديوهات بطريقة تشد المشاهد من أول ثانية.", "price": 400 },
    { "icon": "🎁", "title": "Views to Money Playbook", "desc": "طرق تحويل المشاهدات إلى Affiliate، خدمات، أو منتجات رقمية.", "price": 600 },
    { "icon": "🎁", "title": "Winning Videos Tracker", "desc": "جدول متابعة وتحليل عشان تعرف الفيديوهات الفائزة وتكررها.", "price": 300 },
    { "icon": "🎁", "title": "Quick Start Video + Checklist", "desc": "فيديو تشغيل سريع وقائمة مراجعة عشان تبدأ بدون نسيان خطوات.", "price": 350 },
    { "icon": "🎁", "title": "Troubleshooting Mini Guide", "desc": "حل أشهر مشاكل التشغيل والربط والنشر بدون انتظار.", "price": 250 },
    { "icon": "🎁", "title": "AI Service Resell Guide", "desc": "دليل بيع خدمة فيديوهات AI للشركات برسائل وباقات جاهزة.", "price": 600 },
    { "icon": "👥", "title": "مجتمع صناع المحتوى بالذكاء الاصطناعي", "desc": "أفكار، تحديثات، وتجارب تساعدك تكمل بعد الشراء.", "price": null },
    { "icon": "🛠️", "title": "دعم فني مباشر", "desc": "مساعدة بعد الشراء عشان تفهم النظام وتبدأ بثقة.", "price": null }
  ]
}
```

Add the mirrored English `offer` namespace to `messages/en.json` with the same thirteen items, the same `price` values, and translated `title`/`desc`. Labels:

```json
"ongoing": "Ongoing",
"totalLabel": "Total value",
"wasLabel": "Original price",
"nowLabel": "Price after discount",
"savingsLabel": "{percent}% off applied",
"cta": "Start now and get the full system",
"trust": "Instant delivery • Secure payment • Lifetime access • No subscription"
```

- [ ] **Step 2: Run the parity test**

Run: `npm test -- tests/i18n/message-parity.test.ts`
Expected: PASS — thirteen items in both, `price` present (number or `null`) at every index.

- [ ] **Step 3: Write the failing test**

Create `tests/sections/offer-stack.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { OfferStack } from "@/components/sections/OfferStack";
import { PRICING } from "@/config/pricing";
import { percentOff } from "@/lib/format";
import messages from "../../messages/en.json";

function renderOffer() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OfferStack id="offer" namespace="offer" />
    </NextIntlClientProvider>,
  );
}

describe("OfferStack", () => {
  it("renders every line item", () => {
    renderOffer();
    for (const item of messages.offer.items) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    }
  });

  it("sums only the priced items into the stated total value", () => {
    renderOffer();
    const expected = messages.offer.items.reduce(
      (sum, item) => sum + (item.price ?? 0),
      0,
    );
    expect(screen.getByTestId("offer-total")).toHaveTextContent(
      expected.toLocaleString("en-US"),
    );
  });

  it("labels unpriced items as ongoing rather than showing a zero", () => {
    renderOffer();
    const ongoing = screen.getAllByText(messages.offer.ongoing);
    const unpriced = messages.offer.items.filter((item) => item.price === null);
    expect(ongoing).toHaveLength(unpriced.length);
    expect(screen.queryByText("0 EGP")).not.toBeInTheDocument();
  });

  it("reads the live price from pricing config, not from messages", () => {
    renderOffer();
    expect(screen.getByTestId("offer-now")).toHaveTextContent(
      String(PRICING.main),
    );
    expect(screen.getByTestId("offer-was")).toHaveTextContent(
      PRICING.original.toLocaleString("en-US"),
    );
  });

  it("states a discount that matches the configured prices", () => {
    renderOffer();
    const percent = percentOff(PRICING.original, PRICING.main);
    expect(screen.getByText(new RegExp(`${percent}%`))).toBeInTheDocument();
  });

  it("points its call to action at the order section", () => {
    renderOffer();
    expect(
      screen.getByRole("link", { name: new RegExp(messages.offer.cta) }),
    ).toHaveAttribute("href", "#order");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- tests/sections/offer-stack.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement OfferStack**

Create `src/components/sections/OfferStack.tsx`:

```tsx
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionShell } from "@/components/ui/SectionShell";
import { PRICING } from "@/config/pricing";
import { formatMoney, formatNumber, percentOff } from "@/lib/format";
import type { Locale } from "@/lib/types";

type OfferItem = {
  icon?: string;
  title: string;
  desc?: string;
  price: number | null;
};

export function OfferStack({
  id,
  namespace,
  band = "base",
}: {
  id: string;
  namespace: string;
  band?: "base" | "alt";
}) {
  const t = useTranslations(namespace);
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;

  const items = t.raw("items") as OfferItem[];
  const currency = tc("currency");
  const totalValue = items.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const percent = percentOff(PRICING.original, PRICING.main);

  return (
    <SectionShell
      id={id}
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      sub={t("sub")}
      band={band}
    >
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.title}
              className="flex items-start gap-4 rounded-card border border-line bg-surface p-4"
            >
              {item.icon ? (
                <span aria-hidden="true" className="text-xl">
                  {item.icon}
                </span>
              ) : null}

              <div className="flex-1">
                <h3 className="text-sm font-bold text-ink">{item.title}</h3>
                {item.desc ? (
                  <p className="mt-1 text-xs leading-relaxed text-ink-2">{item.desc}</p>
                ) : null}
              </div>

              <span className="whitespace-nowrap text-xs font-bold text-ink-3">
                {item.price === null
                  ? t("ongoing")
                  : formatMoney(item.price, locale, currency)}
              </span>
            </li>
          ))}
        </ul>

        <Card className="lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            {t("totalLabel")}
          </p>
          <p data-testid="offer-total" className="text-xl font-bold text-ink-3 line-through">
            {formatMoney(totalValue, locale, currency)}
          </p>

          <hr className="my-4 border-line" />

          <p className="text-xs text-ink-3">
            {t("wasLabel")}:{" "}
            <span data-testid="offer-was" className="line-through">
              {formatNumber(PRICING.original, locale)}
            </span>
          </p>

          <p className="mt-1 text-xs font-semibold text-ink-2">{t("nowLabel")}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span data-testid="offer-now" className="text-5xl font-bold tracking-tight text-ink">
              {formatNumber(PRICING.main, locale)}
            </span>
            <span className="text-base font-semibold text-ink-2">{currency}</span>
          </p>

          <span className="mt-3 inline-flex rounded-control border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
            {t("savingsLabel", { percent })}
          </span>

          <Button as="a" href="#order" className="mt-6 w-full">
            {t("cta")} <span aria-hidden="true">←</span>
          </Button>

          <p className="mt-3 text-center text-[11px] text-ink-3">{t("trust")}</p>
        </Card>
      </div>
    </SectionShell>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- tests/sections/offer-stack.test.tsx`
Expected: PASS — 6 tests.

- [ ] **Step 7: Prove the single source of truth holds**

Temporarily change `PRICING.main` to `899` in `src/config/pricing.ts`, then run:

```bash
npm test -- tests/sections/offer-stack.test.tsx
```

Expected: still PASS — the tests read from config, and the discount assertion recomputes. Confirm in the browser that the topbar, offer card, and sticky CTA all show `899`. Then revert to `999`.

- [ ] **Step 8: Run the full suite**

Run: `npm test && npm run lint`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add offer stack with config-driven price reveal"
```

---

## Task 10: FAQ accordion

**Files:**
- Create: `src/components/sections/Faq.tsx`
- Modify: `messages/ar.json`, `messages/en.json`
- Test: `tests/sections/faq.test.tsx`

**Interfaces:**
- Consumes: `SectionShell` (Task 4)
- Produces: `<Faq id namespace band />` reading `items: { q: string; a: string }[]`

Built on native `<details>`/`<summary>`: keyboard-accessible for free, and it still opens with JavaScript disabled.

- [ ] **Step 1: Add the messages**

Add to `messages/ar.json` — all fourteen questions:

```json
"faq": {
  "eyebrow": "❓ أسئلة مهمة",
  "heading": "قبل ما تسأل… الإجابة هنا",
  "sub": "جاوبنا هنا على أغلب الأسئلة اللي ممكن توقفك قبل الطلب.",
  "items": [
    { "q": "أنا بالظبط هشتري إيه؟", "a": "هتستلم نظام AI Automation يساعدك على صناعة فيديوهات قصيرة ونشرها بانتظام، مع شرح تشغيل وبونصات تساعدك تبدأ." },
    { "q": "السيستم بيعمل إيه لوحده؟", "a": "بيساعد في توليد الفكرة، تجهيز محتوى الفيديو، كتابة العنوان والكابشن والهاشتاجات، وتنظيم عملية النشر حسب الإعدادات." },
    { "q": "هل الفيديوهات بتطلع جاهزة للنشر؟", "a": "نعم، الهدف إنك تطلع فيديوهات قصيرة قابلة للنشر على TikTok وReels وShorts، مع إمكانية مراجعتها أو تعديلها." },
    { "q": "هل ينفع أستخدمه من الموبايل؟", "a": "أيوه. النظام شغال على السحابة، وموبايلك يكفي للتشغيل والمتابعة." },
    { "q": "هل محتاج جهاز قوي؟", "a": "لا، المعالجة الأساسية مش معتمدة على قوة جهازك. مش محتاج جهاز غالي أو كارت شاشة." },
    { "q": "هل محتاج خبرة في AI أو مونتاج؟", "a": "لا. الشرح معمول للمبتدئ خطوة بخطوة، والهدف إنك تبدأ بدون خبرة تقنية." },
    { "q": "هل لازم أظهر بوشي أو أصور بنفسي؟", "a": "لا. السيستم مناسب للمحتوى Faceless، يعني بدون تصوير شخصي وبدون ظهور." },
    { "q": "هل ينفع أشتغل على أكثر من منصة؟", "a": "أيوه، المحتوى القصير ممكن تستخدمه على TikTok وInstagram Reels وYouTube Shorts حسب خطتك." },
    { "q": "هل الأرباح مضمونة؟", "a": "لا. النتائج تعتمد على الاستمرارية والنيتش وطريقة الاستخدام، ومفيش ضمان لأي دخل." },
    { "q": "طيب لو أنا مبتدئ تمامًا؟", "a": "مناسب لك، لأن معاه شرح تشغيل، Quick Start، وخطة محتوى تساعدك تبدأ من الصفر." },
    { "q": "هل فيه اشتراك شهري؟", "a": "لا، السعر دفع مرة واحدة فقط، بدون اشتراك شهري." },
    { "q": "هل فيه دعم بعد الشراء؟", "a": "نعم، يوجد دعم فني مباشر لمساعدتك في فهم التشغيل وحل المشاكل الأساسية." },
    { "q": "إيه الفرق بين السيستم وإني أعمل فيديوهات يدوي؟", "a": "الطريقة اليدوية بتاخد وقت ومجهود كل يوم. السيستم بيختصر خطوات التفكير والتجهيز والنشر." },
    { "q": "هل فيه خطة أبدأ بيها بعد الشراء؟", "a": "نعم، ضمن البونصات هتلاقي 30-Day Auto Content Plan وAI Page Launch Kit عشان تبدأ بخطوات واضحة." }
  ]
}
```

Add the mirrored English `faq` namespace with fourteen items in the same order.

> The earnings answer is deliberately phrased as *no guarantee* in both locales. That is the honest answer and the one that keeps the page on the right side of consumer-protection rules.

- [ ] **Step 2: Run the parity test**

Run: `npm test -- tests/i18n/message-parity.test.ts`
Expected: PASS — fourteen `{q,a}` pairs in both files.

- [ ] **Step 3: Write the failing test**

Create `tests/sections/faq.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { Faq } from "@/components/sections/Faq";
import messages from "../../messages/en.json";

function renderFaq() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Faq id="faq" namespace="faq" />
    </NextIntlClientProvider>,
  );
}

describe("Faq", () => {
  it("renders every question", () => {
    renderFaq();
    for (const item of messages.faq.items) {
      expect(screen.getByText(item.q)).toBeInTheDocument();
    }
  });

  it("starts with every answer collapsed", () => {
    const { container } = renderFaq();
    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(messages.faq.items.length);
    details.forEach((node) => expect(node).not.toHaveAttribute("open"));
  });

  it("opens an answer when its question is activated", async () => {
    const user = userEvent.setup();
    const { container } = renderFaq();

    await user.click(screen.getByText(messages.faq.items[0].q));

    expect(container.querySelector("details")).toHaveAttribute("open");
  });

  it("renders answers as text in the document so they are indexable", () => {
    renderFaq();
    expect(screen.getByText(messages.faq.items[0].a)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- tests/sections/faq.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement Faq**

Create `src/components/sections/Faq.tsx`:

```tsx
import { useTranslations } from "next-intl";
import { SectionShell } from "@/components/ui/SectionShell";

type FaqItem = { q: string; a: string };

export function Faq({
  id,
  namespace,
  band = "alt",
}: {
  id: string;
  namespace: string;
  band?: "base" | "alt";
}) {
  const t = useTranslations(namespace);
  const items = t.raw("items") as FaqItem[];

  return (
    <SectionShell
      id={id}
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      sub={t("sub")}
      band={band}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {items.map((item) => (
          <details
            key={item.q}
            className="group rounded-card border-[1.5px] border-line-strong bg-surface px-5 shadow-card"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-bold text-ink marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              {item.q}
              <span
                aria-hidden="true"
                className="shrink-0 text-lg text-accent transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="border-t border-line py-4 text-sm leading-relaxed text-ink-2">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- tests/sections/faq.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add FAQ accordion built on native details/summary"
```

---

## Task 11: Final CTA and the two-stage exit-intent popup

**Files:**
- Create: `src/components/sections/FinalCta.tsx`, `src/components/layout/ExitIntent.tsx`, `src/lib/exit-intent.ts`
- Modify: `src/app/[locale]/layout.tsx`, `messages/ar.json`, `messages/en.json`
- Test: `tests/lib/exit-intent.test.ts`, `tests/layout/exit-intent.test.tsx`

**Interfaces:**
- Consumes: `Button`, `Card` (Task 4); `PRICING`, `formatMoney`, `percentOff` (Task 3)
- Produces:
  - `EXIT_STORAGE_KEY: string`, `nextStage(seen: string | null): 0 | 1 | null` from `src/lib/exit-intent.ts`
  - `<FinalCta />`, `<ExitIntent />`

`nextStage` is extracted as a pure function so the two-stage sequencing is unit-testable without simulating mouse departure.

- [ ] **Step 1: Add the messages**

Add to `messages/ar.json`:

```json
"finalCta": {
  "heading": "كل يوم تأخير = فيديوهات ومشاهدات وفرص بتضيع",
  "sub": "ابدأ بسيستم جاهز يختصر عليك التفكير والتصميم والمونتاج والنشر — وخلي تركيزك على النمو.",
  "cta": "شغّل مصنع الفيديوهات الآن — {price}",
  "trust": "تسليم فوري • ملكية دائمة • دعم مباشر"
},
"exitIntent": {
  "stages": [
    {
      "eyebrow": "⚡ عرض خاص لهذه الجلسة",
      "heading": "اشتري السيستم بخصم {percent}%",
      "sub": "العرض متاح طول ما الصفحة مفتوحة فقط.",
      "cta": "اشتري دلوقتي بـ {price}",
      "dismiss": "لأ، هسيب الفرصة"
    },
    {
      "eyebrow": "⚡ لحظة قبل ما تمشي",
      "heading": "لسه متردد؟ جرّب السيستم الأول",
      "sub": "خد نسخة Mini مصغّرة وجرب الفكرة بنفسك قبل النسخة الكاملة.",
      "cta": "جرّب النسخة Mini بـ {price}",
      "dismiss": "لأ، هكمل بعدين"
    }
  ],
  "close": "إغلاق"
}
```

Add the mirrored English namespaces to `messages/en.json` with two stages in the same order.

- [ ] **Step 2: Run the parity test**

Run: `npm test -- tests/i18n/message-parity.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing stage-sequencing test**

Create `tests/lib/exit-intent.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextStage } from "@/lib/exit-intent";

describe("nextStage", () => {
  it("offers the discount first when nothing has been seen", () => {
    expect(nextStage(null)).toBe(0);
  });

  it("offers the Mini version after the discount was dismissed", () => {
    expect(nextStage("0")).toBe(1);
  });

  it("stops offering once both stages have been seen", () => {
    expect(nextStage("1")).toBeNull();
  });

  it("starts over when the stored value is not a stage index", () => {
    expect(nextStage("garbage")).toBe(0);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- tests/lib/exit-intent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement the stage logic**

Create `src/lib/exit-intent.ts`:

```ts
export const EXIT_STORAGE_KEY = "exit-intent-stage";

export const STAGE_COUNT = 2;

/**
 * Returns the index of the stage to show next, or null once the visitor has
 * seen them all. Stored per session, so a returning visitor is not harassed.
 */
export function nextStage(seen: string | null): 0 | 1 | null {
  if (seen === null) return 0;

  const parsed = Number(seen);
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  if (parsed >= STAGE_COUNT - 1) return null;

  return (parsed + 1) as 1;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- tests/lib/exit-intent.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 7: Write the failing component test**

Create `tests/layout/exit-intent.test.tsx`:

```tsx
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

/** Simulates the cursor leaving through the top of the viewport. */
function leaveViewport() {
  fireEvent.mouseOut(document, { clientY: -5, relatedTarget: null });
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
      screen.getByText(new RegExp(messages.exitIntent.stages[0].sub)),
    ).toBeInTheDocument();
  });

  it("records the stage so it is not shown twice in one session", async () => {
    const user = userEvent.setup();
    renderExitIntent();
    leaveViewport();

    await user.click(
      screen.getByRole("button", { name: messages.exitIntent.stages[0].dismiss }),
    );

    expect(sessionStorage.getItem(EXIT_STORAGE_KEY)).toBe("0");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the Mini stage on the next exit attempt", async () => {
    const user = userEvent.setup();
    renderExitIntent();

    leaveViewport();
    await user.click(
      screen.getByRole("button", { name: messages.exitIntent.stages[0].dismiss }),
    );
    leaveViewport();

    expect(
      screen.getByText(new RegExp(messages.exitIntent.stages[1].sub)),
    ).toBeInTheDocument();
  });

  it("stops appearing once both stages are spent", async () => {
    const user = userEvent.setup();
    renderExitIntent();

    leaveViewport();
    await user.click(
      screen.getByRole("button", { name: messages.exitIntent.stages[0].dismiss }),
    );
    leaveViewport();
    await user.click(
      screen.getByRole("button", { name: messages.exitIntent.stages[1].dismiss }),
    );
    leaveViewport();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm test -- tests/layout/exit-intent.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 9: Implement FinalCta and ExitIntent**

Create `src/components/sections/FinalCta.tsx`:

```tsx
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { PRICING } from "@/config/pricing";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/types";

export function FinalCta() {
  const t = useTranslations("finalCta");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;

  return (
    <section id="finalCta" aria-labelledby="finalCta-heading" className="bg-bg">
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2
          id="finalCta-heading"
          className="text-3xl font-bold leading-tight tracking-tight md:text-4xl"
        >
          {t("heading")}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-ink-2">{t("sub")}</p>
        <Button as="a" href="#order" className="mt-8">
          {t("cta", { price: formatMoney(PRICING.main, locale, tc("currency")) })}{" "}
          <span aria-hidden="true">←</span>
        </Button>
        <p className="mt-3 text-xs text-ink-3">{t("trust")}</p>
      </div>
    </section>
  );
}
```

Create `src/components/layout/ExitIntent.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { PRICING } from "@/config/pricing";
import { formatMoney, percentOff } from "@/lib/format";
import { EXIT_STORAGE_KEY, nextStage } from "@/lib/exit-intent";
import type { Locale } from "@/lib/types";

type Stage = {
  eyebrow: string;
  heading: string;
  sub: string;
  cta: string;
  dismiss: string;
};

const STAGE_PRICE = [PRICING.exit, PRICING.mini];

export function ExitIntent() {
  const t = useTranslations("exitIntent");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const stages = t.raw("stages") as Stage[];

  const [active, setActive] = useState<0 | 1 | null>(null);

  const tryOpen = useCallback(() => {
    setActive((current) => {
      if (current !== null) return current;
      return nextStage(window.sessionStorage.getItem(EXIT_STORAGE_KEY));
    });
  }, []);

  useEffect(() => {
    const onMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget === null && event.clientY <= 0) tryOpen();
    };

    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [tryOpen]);

  const dismiss = () => {
    if (active === null) return;
    window.sessionStorage.setItem(EXIT_STORAGE_KEY, String(active));
    setActive(null);
  };

  if (active === null) return null;

  const stage = stages[active];
  const currency = tc("currency");
  const price = formatMoney(STAGE_PRICE[active], locale, currency);
  const percent = percentOff(PRICING.main, PRICING.exit);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/50 p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-heading"
        className="w-full max-w-md rounded-card border-[1.5px] border-line-strong bg-surface p-7 text-center shadow-card"
      >
        <span className="inline-flex rounded-control border border-accent-line bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent">
          {stage.eyebrow}
        </span>

        <h2 id="exit-heading" className="mt-4 text-2xl font-bold leading-snug">
          {t(`stages.${active}.heading`, { percent })}
        </h2>
        <p className="mt-3 text-sm text-ink-2">{stage.sub}</p>

        <p className="mt-5 text-4xl font-bold tracking-tight text-ink">{price}</p>

        <Button as="a" href="#order" className="mt-6 w-full" onClick={dismiss}>
          {t(`stages.${active}.cta`, { price })}
        </Button>

        <button
          type="button"
          onClick={dismiss}
          className="mt-3 w-full text-xs font-semibold text-ink-3 underline"
        >
          {stage.dismiss}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm test -- tests/layout/exit-intent.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 11: Mount ExitIntent in the layout**

In `src/app/[locale]/layout.tsx`, add the import and render it after `<StickyMobileCta />`:

```tsx
import { ExitIntent } from "@/components/layout/ExitIntent";
```

```tsx
          <StickyMobileCta />
          <ExitIntent />
```

- [ ] **Step 12: Run the full suite**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add final CTA and two-stage exit-intent offer"
```

---

## Task 12: Section manifest and full page assembly

This is where the page becomes the page. Every remaining section is a manifest entry plus a message namespace — no new components.

**Files:**
- Create: `src/config/sections.ts`, `src/components/sections/OrderSection.tsx`, `src/components/sections/SectionRenderer.tsx`
- Modify: `src/app/[locale]/page.tsx`, `messages/ar.json`, `messages/en.json`
- Test: `tests/config/sections.test.ts`, `tests/sections/page-assembly.test.tsx`

**Interfaces:**
- Consumes: every section component built so far
- Produces: `SECTIONS: SectionEntry[]` where `SectionEntry = { id: string; kind: "custom" | "cardGrid" | "mediaGrid" | "beforeAfter" | "offerStack" | "faq"; namespace?: string; columns?: number; band?: "base" | "alt" }`

`OrderSection` is a placeholder in this plan — Plan B replaces its body with the real form. It must render `<section id="order">` because `StickyMobileCta`, the hero CTA, the offer CTA, and the exit popup all target `#order`.

- [ ] **Step 1: Add the remaining message namespaces**

Add these namespaces to **both** `messages/ar.json` and `messages/en.json`, each with `eyebrow`, `heading`, optional `sub`, and `items`:

| Namespace | Shape | Item count |
|---|---|---|
| `proofResults` | `MediaItem[]` | 3 |
| `proofPlatforms` | `MediaItem[]` | 3 |
| `painPoints` | `CardItem[]` | 4 |
| `demo` | `MediaItem[]` | 1 (`kind: "video"`, `ratio: "16/9"`) |
| `howItWorks` | `CardItem[]` | 6 |
| `sampleVideos` | `MediaItem[]` | 3 (`kind: "video"`, `ratio: "9/16"`) |
| `objections` | `CardItem[]` | 3 |
| `reviews` | `MediaItem[]` | 3 |
| `proofTikTok` | `CardItem[]` | 3 |
| `proofViews` | `CardItem[]` | 3 |
| `proofAffiliate` | `CardItem[]` | 2 |
| `order` | `{ eyebrow, heading, sub, placeholder }` | — |

Use the reference structure for the copy — for example `howItWorks` items are the six steps (generates the idea / builds the video / writes the title / writes the caption / generates hashtags / publishes on schedule), and `objections` is the three cards (works from a phone / no powerful computer needed / no AI experience needed).

For every media/proof namespace, `label` describes the asset to supply, e.g. `"TikTok Creator Rewards screenshot"`. Do **not** invent view counts, earnings figures, or buyer numbers in `badge` or `desc` — leave those as bracketed slots such as `"[your figure]"` so the owner supplies verifiable numbers.

- [ ] **Step 2: Run the parity test**

Run: `npm test -- tests/i18n/message-parity.test.ts`
Expected: PASS — identical key trees, identical array lengths.

- [ ] **Step 3: Write the failing manifest test**

Create `tests/config/sections.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SECTIONS } from "@/config/sections";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

describe("section manifest", () => {
  it("gives every section a unique id", () => {
    const ids = SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the order section every call to action targets", () => {
    expect(SECTIONS.some((section) => section.id === "order")).toBe(true);
  });

  it("points every namespaced section at a namespace that exists in both locales", () => {
    for (const section of SECTIONS) {
      if (!section.namespace) continue;
      expect(ar, `ar.json is missing "${section.namespace}"`).toHaveProperty(
        section.namespace,
      );
      expect(en, `en.json is missing "${section.namespace}"`).toHaveProperty(
        section.namespace,
      );
    }
  });

  it("alternates bands so no two adjacent sections share a background", () => {
    const bands = SECTIONS.map((section) => section.band ?? "base");
    const adjacentDuplicates = bands.filter(
      (band, i) => i > 0 && band === bands[i - 1],
    );
    expect(adjacentDuplicates).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- tests/config/sections.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Write the manifest and the order placeholder**

Create `src/config/sections.ts`:

```ts
export type SectionKind =
  | "hero"
  | "heroStats"
  | "cardGrid"
  | "mediaGrid"
  | "beforeAfter"
  | "offerStack"
  | "order"
  | "faq"
  | "finalCta";

export type SectionEntry = {
  id: string;
  kind: SectionKind;
  namespace?: string;
  columns?: 1 | 2 | 3 | 4;
  band?: "base" | "alt";
};

/**
 * The page, in order. Reordering, removing, or duplicating a section is an edit
 * to this array — no component changes.
 */
export const SECTIONS: SectionEntry[] = [
  { id: "hero", kind: "hero", band: "base" },
  { id: "heroStats", kind: "heroStats", band: "alt" },
  { id: "proofResults", kind: "mediaGrid", namespace: "proofResults", columns: 3, band: "base" },
  { id: "proofPlatforms", kind: "mediaGrid", namespace: "proofPlatforms", columns: 3, band: "alt" },
  { id: "painPoints", kind: "cardGrid", namespace: "painPoints", columns: 4, band: "base" },
  { id: "beforeAfter", kind: "beforeAfter", namespace: "beforeAfter", band: "alt" },
  { id: "demo", kind: "mediaGrid", namespace: "demo", columns: 1, band: "base" },
  { id: "howItWorks", kind: "cardGrid", namespace: "howItWorks", columns: 3, band: "alt" },
  { id: "sampleVideos", kind: "mediaGrid", namespace: "sampleVideos", columns: 3, band: "base" },
  { id: "objections", kind: "cardGrid", namespace: "objections", columns: 3, band: "alt" },
  { id: "reviews", kind: "mediaGrid", namespace: "reviews", columns: 3, band: "base" },
  { id: "proofTikTok", kind: "cardGrid", namespace: "proofTikTok", columns: 3, band: "alt" },
  { id: "proofViews", kind: "cardGrid", namespace: "proofViews", columns: 3, band: "base" },
  { id: "proofAffiliate", kind: "cardGrid", namespace: "proofAffiliate", columns: 2, band: "alt" },
  { id: "offer", kind: "offerStack", namespace: "offer", band: "base" },
  { id: "order", kind: "order", namespace: "order", band: "alt" },
  { id: "faq", kind: "faq", namespace: "faq", band: "base" },
  { id: "finalCta", kind: "finalCta", band: "alt" },
];
```

> The `band` values alternate deliberately — the manifest test enforces it, so inserting a section means picking the band that keeps the alternation intact.

Create `src/components/sections/OrderSection.tsx`:

```tsx
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { SectionShell } from "@/components/ui/SectionShell";

/**
 * Placeholder. Plan B (order intake) replaces the card body with the real
 * form. The `id="order"` anchor is load-bearing: the hero CTA, offer CTA,
 * sticky mobile bar, and exit popup all target it.
 */
export function OrderSection({
  id,
  namespace,
  band = "alt",
}: {
  id: string;
  namespace: string;
  band?: "base" | "alt";
}) {
  const t = useTranslations(namespace);

  return (
    <SectionShell
      id={id}
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      sub={t("sub")}
      band={band}
    >
      <Card className="mx-auto max-w-xl text-center">
        <p className="text-sm text-ink-3">{t("placeholder")}</p>
      </Card>
    </SectionShell>
  );
}
```

Add to both message files under `order`:

```json
"order": {
  "eyebrow": "🧾 اطلب دلوقتي",
  "heading": "استلم السيستم وابدأ اليوم",
  "sub": "بعد تأكيد الدفع بتستلم كل حاجة فوراً على Google Drive.",
  "placeholder": "نموذج الطلب قيد التجهيز."
}
```

English:

```json
"order": {
  "eyebrow": "🧾 Order now",
  "heading": "Get the system and start today",
  "sub": "Once your payment is confirmed, everything is delivered instantly via Google Drive.",
  "placeholder": "The order form is being set up."
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- tests/config/sections.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 7: Write the failing page assembly test**

Create `tests/sections/page-assembly.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { SECTIONS } from "@/config/sections";
import messages from "../../messages/en.json";

describe("page assembly", () => {
  it("renders an element for every section in the manifest", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SectionRenderer />
      </NextIntlClientProvider>,
    );

    for (const section of SECTIONS) {
      expect(
        container.querySelector(`#${section.id}`),
        `No element rendered with id "${section.id}"`,
      ).not.toBeNull();
    }
  });

  it("renders the sections in manifest order", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SectionRenderer />
      </NextIntlClientProvider>,
    );

    const rendered = Array.from(container.querySelectorAll("section[id]")).map(
      (node) => node.id,
    );
    const expected = SECTIONS.map((section) => section.id);

    expect(rendered).toEqual(expected);
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm test -- tests/sections/page-assembly.test.tsx`
Expected: FAIL — `Cannot find module '@/components/sections/SectionRenderer'`.

- [ ] **Step 9: Implement the renderer**

Create `src/components/sections/SectionRenderer.tsx`:

```tsx
import { SECTIONS, type SectionEntry } from "@/config/sections";
import { BeforeAfter } from "./BeforeAfter";
import { CardGrid } from "./CardGrid";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Hero } from "./Hero";
import { HeroStats } from "./HeroStats";
import { MediaGrid } from "./MediaGrid";
import { OfferStack } from "./OfferStack";
import { OrderSection } from "./OrderSection";

function renderSection(section: SectionEntry) {
  const { id, kind, namespace, columns, band } = section;

  switch (kind) {
    case "hero":
      return <Hero key={id} />;
    case "heroStats":
      return <HeroStats key={id} />;
    case "cardGrid":
      return (
        <CardGrid
          key={id}
          id={id}
          namespace={namespace!}
          columns={(columns ?? 3) as 2 | 3 | 4}
          band={band}
        />
      );
    case "mediaGrid":
      return (
        <MediaGrid
          key={id}
          id={id}
          namespace={namespace!}
          columns={(columns ?? 3) as 1 | 2 | 3}
          band={band}
        />
      );
    case "beforeAfter":
      return <BeforeAfter key={id} id={id} namespace={namespace!} band={band} />;
    case "offerStack":
      return <OfferStack key={id} id={id} namespace={namespace!} band={band} />;
    case "order":
      return <OrderSection key={id} id={id} namespace={namespace!} band={band} />;
    case "faq":
      return <Faq key={id} id={id} namespace={namespace!} band={band} />;
    case "finalCta":
      return <FinalCta key={id} />;
  }
}

export function SectionRenderer() {
  return <>{SECTIONS.map(renderSection)}</>;
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npm test -- tests/sections/page-assembly.test.tsx`
Expected: PASS — 2 tests. If the order assertion fails, the manifest and the rendered DOM disagree — fix the manifest, not the test.

- [ ] **Step 11: Wire the page**

Replace `src/app/[locale]/page.tsx`:

```tsx
import { setRequestLocale } from "next-intl/server";
import { SectionRenderer } from "@/components/sections/SectionRenderer";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <SectionRenderer />
    </main>
  );
}
```

- [ ] **Step 12: Review the whole page in both locales**

Run: `npm run dev`

Walk `/ar` top to bottom at 375px, 768px, and 1440px. Then walk `/en` at the same widths. Check specifically:
- No horizontal scrollbar at any width in either locale.
- Section bands alternate; no two adjacent sections share a background.
- Every placeholder states what asset belongs there.
- Every CTA scrolls to the order section.
- Arabic text is right-aligned throughout; English is left-aligned; nothing is clipped at the inline edges.

- [ ] **Step 13: Run the full suite**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: assemble full landing page from section manifest"
```

---

## Task 13: SEO — metadata, hreflang, sitemap, robots, OG images

Two locales without `hreflang` alternates compete with each other in search results, so this is foundation, not polish.

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/[locale]/opengraph-image.tsx`
- Create: `src/lib/site.ts`
- Modify: `src/app/[locale]/layout.tsx`, `messages/ar.json`, `messages/en.json`
- Create: `.env.example`
- Test: `tests/seo/metadata.test.ts`

**Interfaces:**
- Consumes: `routing` (Task 2)
- Produces: `SITE_URL: string`, `absoluteUrl(path: string): string`, `alternatesFor(path: string): { canonical: string; languages: Record<string, string> }` from `src/lib/site.ts`

- [ ] **Step 1: Write the failing SEO test**

Create `tests/seo/metadata.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { absoluteUrl, alternatesFor, SITE_URL } from "@/lib/site";
import { routing } from "@/i18n/routing";

describe("site URLs", () => {
  it("builds absolute URLs without doubling slashes", () => {
    expect(absoluteUrl("/ar")).toBe(`${SITE_URL}/ar`);
    expect(absoluteUrl("ar")).toBe(`${SITE_URL}/ar`);
  });

  it("never ends the base URL with a trailing slash", () => {
    expect(SITE_URL.endsWith("/")).toBe(false);
  });
});

describe("alternatesFor", () => {
  it("declares an alternate for every supported locale", () => {
    const { languages } = alternatesFor("/");
    for (const locale of routing.locales) {
      expect(languages).toHaveProperty(locale);
    }
  });

  it("points x-default at the default locale", () => {
    const { languages } = alternatesFor("/");
    expect(languages["x-default"]).toBe(absoluteUrl(`/${routing.defaultLocale}`));
  });

  it("self-references the canonical for the given locale path", () => {
    expect(alternatesFor("/", "en").canonical).toBe(absoluteUrl("/en"));
    expect(alternatesFor("/", "ar").canonical).toBe(absoluteUrl("/ar"));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/seo/metadata.test.ts`
Expected: FAIL — `Cannot find module '@/lib/site'`.

- [ ] **Step 3: Implement the URL helpers**

Create `src/lib/site.ts`:

```ts
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/types";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export function absoluteUrl(path: string): string {
  return `${SITE_URL}/${path.replace(/^\/+/, "")}`;
}

/**
 * Canonical plus hreflang alternates. Without these two locales are read as
 * duplicate content and compete with each other.
 */
export function alternatesFor(
  path = "/",
  locale: Locale = routing.defaultLocale,
): { canonical: string; languages: Record<string, string> } {
  const suffix = path === "/" ? "" : `/${path.replace(/^\/+/, "")}`;

  const languages: Record<string, string> = {};
  for (const supported of routing.locales) {
    languages[supported] = absoluteUrl(`/${supported}${suffix}`);
  }
  languages["x-default"] = absoluteUrl(`/${routing.defaultLocale}${suffix}`);

  return {
    canonical: absoluteUrl(`/${locale}${suffix}`),
    languages,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/seo/metadata.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Wire metadata into the locale layout**

Replace `generateMetadata` in `src/app/[locale]/layout.tsx`:

```tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const typed = locale as Locale;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL(SITE_URL),
    title: t("title"),
    description: t("description"),
    alternates: alternatesFor("/", typed),
    openGraph: {
      type: "website",
      locale: typed === "ar" ? "ar_EG" : "en_US",
      url: absoluteUrl(`/${typed}`),
      title: t("title"),
      description: t("description"),
      siteName: t("siteName"),
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
  };
}
```

Add the imports:

```tsx
import { absoluteUrl, alternatesFor, SITE_URL } from "@/lib/site";
```

Add `siteName` to the `meta` namespace in both message files — `"Digital Assets"` in each.

- [ ] **Step 6: Add sitemap and robots**

Create `src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { absoluteUrl, alternatesFor } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const { languages } = alternatesFor("/");

  return routing.locales.map((locale) => ({
    url: absoluteUrl(`/${locale}`),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: locale === routing.defaultLocale ? 1 : 0.9,
    alternates: { languages },
  }));
}
```

Create `src/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The admin surface (Plan B) is an operator tool, never an index target.
      disallow: ["/admin", "/api"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
```

- [ ] **Step 7: Add the per-locale OG image**

Create `src/app/[locale]/opengraph-image.tsx`:

```tsx
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function OpengraphImage({
  params,
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale: params.locale, namespace: "meta" });
  const isArabic = params.locale === "ar";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#FBF8F3",
          color: "#1C1917",
          direction: isArabic ? "rtl" : "ltr",
          textAlign: isArabic ? "right" : "left",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#DC4A1E", fontWeight: 700 }}>
          {t("siteName")}
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.2, marginTop: 24 }}>
          {t("title")}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#57534E", marginTop: 24 }}>
          {t("description")}
        </div>
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 8: Document the environment**

Create `.env.example`:

```bash
# Public base URL, no trailing slash. Used for canonical URLs, hreflang
# alternates, the sitemap, and Open Graph tags.
NEXT_PUBLIC_SITE_URL=https://example.com
```

Create `.env.local` with the same key set to `http://localhost:3000`. It is gitignored.

- [ ] **Step 9: Verify the output**

```bash
npm run build && npm run start
```

Then check:

```bash
curl -s http://localhost:3000/sitemap.xml | head -30
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/ar | grep -o '<link rel="alternate"[^>]*>'
```

Expected: the sitemap lists `/ar` and `/en`; robots disallows `/admin` and `/api`; the Arabic page emits alternates for `ar`, `en`, and `x-default`, plus a canonical pointing at `/ar`.

Open `http://localhost:3000/ar/opengraph-image` and `/en/opengraph-image` and confirm both render with correct direction and no missing glyphs.

- [ ] **Step 10: Run the full suite**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add per-locale metadata, hreflang alternates, sitemap, robots, OG images"
```

---

## Task 14: End-to-end tests and the final quality pass

**Files:**
- Create: `playwright.config.ts`, `e2e/landing.spec.ts`, `e2e/rtl.spec.ts`
- Test: the specs above

**Interfaces:**
- Consumes: the assembled site from Tasks 1–13
- Produces: `npm run e2e` passing against a production build

- [ ] **Step 1: Configure Playwright**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

- [ ] **Step 2: Write the failing RTL/LTR spec**

Create `e2e/rtl.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe("bilingual delivery", () => {
  test("redirects the bare root to the default locale", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/ar$/);
  });

  test("serves Arabic right-to-left", async ({ page }) => {
    await page.goto("/ar");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", "ar");
    await expect(html).toHaveAttribute("dir", "rtl");
  });

  test("serves English left-to-right", async ({ page }) => {
    await page.goto("/en");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", "en");
    await expect(html).toHaveAttribute("dir", "ltr");
  });

  test("switches locale without leaving the page", async ({ page }) => {
    await page.goto("/ar");
    await page.getByRole("link", { name: "English" }).first().click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("never scrolls horizontally in either locale", async ({ page }) => {
    for (const locale of ["ar", "en"]) {
      await page.goto(`/${locale}`);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflows, `${locale} overflows horizontally`).toBe(false);
    }
  });

  test("declares hreflang alternates for both locales", async ({ page }) => {
    await page.goto("/ar");
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
    await expect(
      page.locator('link[rel="alternate"][hreflang="x-default"]'),
    ).toHaveCount(1);
  });
});
```

- [ ] **Step 3: Write the failing landing spec**

Create `e2e/landing.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { SECTIONS } from "../src/config/sections";

test.describe("landing page", () => {
  test("renders every section in the manifest", async ({ page }) => {
    await page.goto("/ar");
    for (const section of SECTIONS) {
      await expect(
        page.locator(`#${section.id}`),
        `Section "${section.id}" is missing`,
      ).toHaveCount(1);
    }
  });

  test("every call to action reaches the order section", async ({ page }) => {
    await page.goto("/en");
    const ctas = page.locator('a[href="#order"]');
    expect(await ctas.count()).toBeGreaterThan(1);

    await ctas.first().click();
    await expect(page).toHaveURL(/#order$/);
    await expect(page.locator("#order")).toBeInViewport();
  });

  test("the countdown survives a reload instead of restarting", async ({ page }) => {
    await page.goto("/en");
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("offer-deadline"),
    );
    expect(stored).not.toBeNull();

    await page.reload();
    const after = await page.evaluate(() =>
      window.localStorage.getItem("offer-deadline"),
    );
    expect(after).toBe(stored);
  });

  test("opens an FAQ answer on click", async ({ page }) => {
    await page.goto("/en");
    const first = page.locator("#faq details").first();
    await expect(first).not.toHaveAttribute("open", "");
    await first.locator("summary").click();
    await expect(first).toHaveAttribute("open", "");
  });

  test("shows the sticky CTA on mobile after the hero scrolls away", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only behaviour");

    await page.goto("/en");
    await page.locator("#offer").scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: /Start now/ })).toBeVisible();
  });

  test("has exactly one h1 per locale", async ({ page }) => {
    for (const locale of ["ar", "en"]) {
      await page.goto(`/${locale}`);
      await expect(page.locator("h1")).toHaveCount(1);
    }
  });
});
```

- [ ] **Step 4: Run the specs to verify they fail or pass honestly**

Run: `npm run e2e`

Expected: most pass against the site built in Tasks 1–13. Any failure is a real defect — fix the site, not the assertion. Common genuine catches at this stage: a section id in the manifest that no component renders, a placeholder overflowing at mobile width, or the locale switcher losing the path.

- [ ] **Step 5: Fix whatever the specs surface**

Work through failures one at a time. After each fix, re-run only the failing spec:

```bash
npm run e2e -- --grep "name of the failing test"
```

- [ ] **Step 6: Run Lighthouse on both locales**

```bash
npm run build && npm run start
npx lighthouse http://localhost:3000/ar --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless" --output=json --output-path=./lighthouse-ar.json
npx lighthouse http://localhost:3000/en --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless" --output=json --output-path=./lighthouse-en.json
```

Expected: every category ≥ 90 on both. If accessibility falls short, the usual causes are insufficient contrast on `--color-ink-3` over `--color-surface-2`, or a placeholder without an accessible name. Fix the site.

Add `lighthouse-*.json` to `.gitignore`.

- [ ] **Step 7: Keyboard-only pass**

With `npm run start` running, traverse `/ar` and `/en` using only Tab, Shift+Tab, and Enter. Confirm: every CTA is reachable, focus is always visible against the light background, each FAQ `<summary>` opens with Enter, and the exit popup's dismiss control is reachable once the dialog opens.

- [ ] **Step 8: Run everything**

Run: `npm test && npm run lint && npm run build && npm run e2e`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "test: add Playwright coverage for bilingual delivery and landing flow"
```

---

## Definition of done

- [ ] `/ar` and `/en` both render all eighteen manifest sections, correctly directioned
- [ ] `npm test` green, including the message-parity and logical-property guards
- [ ] `npm run e2e` green on desktop and mobile projects
- [ ] Lighthouse ≥ 90 in all four categories on both locales
- [ ] No horizontal scroll at 375 / 768 / 1440 in either locale
- [ ] Changing `PRICING.main` updates every displayed price
- [ ] Every image and video slot names the asset that belongs there
- [ ] No view count, earnings figure, or buyer count is asserted as fact — all are owner-supplied slots
- [ ] `#order` renders and every CTA reaches it, ready for Plan B to fill

---

## Plan self-review

Checked against the spec with fresh eyes.

**Spec coverage.** §3 visual identity → Tasks 1, 4. §4 architecture/routes → Task 2 (`/admin` and `/api` are Plan B; the middleware matcher already excludes them). §5 content model → Tasks 2, 3, 12; the five content rules map to the parity test, `pricing.ts`, `format.ts`, the lint guard, and `Placeholder`. §6 sections → Tasks 6–12. §7 order submission and §8 admin → Plan B, with the `#order` anchor stubbed here. §9 SEO → Task 13. §10 testing → distributed across every task plus Task 14.

**Gaps found and closed while reviewing:**

1. `SectionRenderer.tsx` was written in Task 12's steps but missing from its **Files** list. Added.
2. `tests/config/sections.test.ts` asserts alternating bands, so the manifest in Step 5 was written with bands that actually alternate — checked entry by entry.
3. `StickyMobileCta` observes `#hero` and `#order`. Both exist by Task 12; before that the sticky bar simply never shows, which is correct rather than broken.
4. The `heroStats` message items carry numeric `value` fields, which brushes against "money is never a string in messages." Clarified inline: these are counts, not money. Money stays in `config/pricing.ts`.
5. The countdown test's hour assertion is genuinely sensitive to when the first interval fires, so Step 3 of Task 5 names the ambiguity and tells the implementer to pin it deterministically rather than leaving a flaky test.

**Type consistency.** `Locale` (Task 2) is consumed unchanged by `format.ts`, `StatCounter`, `OfferStack`, `FinalCta`, `ExitIntent`, and `site.ts`. `Ratio` (Task 4) is re-exported through `Placeholder` and consumed by `VideoCard` and `MediaItem`. `CardItem` and `MediaItem` (Task 7) match the message shapes Task 12 specifies. `SectionEntry.columns` is typed `1 | 2 | 3 | 4` in the manifest and narrowed at each call site in `SectionRenderer`, because `CardGrid` accepts `2 | 3 | 4` and `MediaGrid` accepts `1 | 2 | 3`.

**One deliberate deviation from the spec**, recorded here so it is not mistaken for drift: the spec's §6 table lists twenty-one rows including `topbar`, `footer`, and `exitIntent`. Those three are layout-level overlays rather than page sections, so the manifest holds eighteen entries and the layout renders the other three. The Definition of Done says eighteen for that reason.

