const STORAGE_KEY = "attribution";

const UTM_KEYS = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_term: "utmTerm",
} as const;

export type Attribution = Partial<
  Record<
    (typeof UTM_KEYS)[keyof typeof UTM_KEYS] | "referrer" | "landingPage",
    string
  >
>;

/**
 * First-touch attribution: the campaign that brought someone in is the one
 * that earned the order, so a later visit must not overwrite it.
 */
export function captureAttribution(href: string, referrer: string): void {
  if (sessionStorage.getItem(STORAGE_KEY)) return;

  const url = new URL(href);
  const data: Attribution = {};

  for (const [param, field] of Object.entries(UTM_KEYS)) {
    const value = url.searchParams.get(param);
    if (value) data[field as keyof Attribution] = value.slice(0, 120);
  }

  if (referrer) data.referrer = referrer.slice(0, 500);
  data.landingPage = href.slice(0, 500);

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function readAttribution(): Attribution {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
