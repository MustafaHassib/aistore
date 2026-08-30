import "@testing-library/jest-dom/vitest";

/**
 * jsdom implements neither of these, but both exist in every browser the site
 * targets. Stubbing them here keeps component tests from having to re-stub the
 * environment; tests that care about the behaviour still override them locally.
 *
 * Defaults chosen so components render their non-animated state: motion is
 * "not reduced", and nothing is reported as intersecting unless a test says so.
 */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  } as unknown as typeof window.IntersectionObserver;
}
