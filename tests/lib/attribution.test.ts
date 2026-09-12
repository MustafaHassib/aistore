import { beforeEach, describe, expect, it } from "vitest";
import { captureAttribution, readAttribution } from "@/lib/attribution";

beforeEach(() => sessionStorage.clear());

describe("attribution", () => {
  it("captures UTM parameters from the URL", () => {
    captureAttribution("https://x.test/ar?utm_source=tiktok&utm_campaign=launch", "");
    expect(readAttribution()).toMatchObject({
      utmSource: "tiktok",
      utmCampaign: "launch",
    });
  });

  it("keeps the first touch rather than overwriting it", () => {
    captureAttribution("https://x.test/ar?utm_source=tiktok", "");
    captureAttribution("https://x.test/ar?utm_source=facebook", "");
    expect(readAttribution().utmSource).toBe("tiktok");
  });

  it("records the referrer and landing page", () => {
    captureAttribution("https://x.test/ar?x=1", "https://t.co/abc");
    const data = readAttribution();
    expect(data.referrer).toBe("https://t.co/abc");
    expect(data.landingPage).toBe("https://x.test/ar?x=1");
  });

  it("returns an empty object before anything is captured", () => {
    expect(readAttribution()).toEqual({});
  });

  it("omits parameters that are absent", () => {
    captureAttribution("https://x.test/ar", "");
    expect(readAttribution().utmSource).toBeUndefined();
  });

  it("truncates an overlong value to the column limit", () => {
    captureAttribution(`https://x.test/ar?utm_source=${"a".repeat(500)}`, "");
    expect(readAttribution().utmSource).toHaveLength(120);
  });

  it("survives corrupted storage", () => {
    sessionStorage.setItem("attribution", "{not json");
    expect(readAttribution()).toEqual({});
  });
});
