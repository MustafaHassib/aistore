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
 *
 * Bands alternate strictly; a test enforces it, so inserting a section means
 * picking the band that keeps the alternation intact.
 */
export const SECTIONS: SectionEntry[] = [
  { id: "hero", kind: "hero", band: "base" },
  { id: "heroStats", kind: "heroStats", band: "alt" },
  {
    id: "proofResults",
    kind: "mediaGrid",
    namespace: "proofResults",
    columns: 3,
    band: "base",
  },
  {
    id: "proofPlatforms",
    kind: "mediaGrid",
    namespace: "proofPlatforms",
    columns: 3,
    band: "alt",
  },
  {
    id: "painPoints",
    kind: "cardGrid",
    namespace: "painPoints",
    columns: 4,
    band: "base",
  },
  {
    id: "beforeAfter",
    kind: "beforeAfter",
    namespace: "beforeAfter",
    band: "alt",
  },
  { id: "demo", kind: "mediaGrid", namespace: "demo", columns: 1, band: "base" },
  {
    id: "howItWorks",
    kind: "cardGrid",
    namespace: "howItWorks",
    columns: 3,
    band: "alt",
  },
  {
    id: "sampleVideos",
    kind: "mediaGrid",
    namespace: "sampleVideos",
    columns: 3,
    band: "base",
  },
  {
    id: "objections",
    kind: "cardGrid",
    namespace: "objections",
    columns: 3,
    band: "alt",
  },
  {
    id: "reviews",
    kind: "mediaGrid",
    namespace: "reviews",
    columns: 3,
    band: "base",
  },
  {
    id: "proofTikTok",
    kind: "cardGrid",
    namespace: "proofTikTok",
    columns: 3,
    band: "alt",
  },
  {
    id: "proofViews",
    kind: "cardGrid",
    namespace: "proofViews",
    columns: 3,
    band: "base",
  },
  {
    id: "proofAffiliate",
    kind: "cardGrid",
    namespace: "proofAffiliate",
    columns: 2,
    band: "alt",
  },
  { id: "offer", kind: "offerStack", namespace: "offer", band: "base" },
  { id: "order", kind: "order", namespace: "order", band: "alt" },
  { id: "faq", kind: "faq", namespace: "faq", band: "base" },
  { id: "finalCta", kind: "finalCta", band: "alt" },
];
