import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  REFERRAL_ATTRIBUTION_COOKIE,
  clearStoredReferralAttribution,
  getStoredReferralAttribution,
  parseStoredReferralAttribution,
  storeReferralAttribution,
} from "../referral-attribution";

describe("referral attribution helpers", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: { location: { protocol: "https:" } },
      configurable: true,
    });

    let cookieValue = "";
    Object.defineProperty(globalThis, "document", {
      value: {
        get cookie() {
          return cookieValue;
        },
        set cookie(value: string) {
          cookieValue = value;
        },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error cleanup for test globals
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    }

    if (originalDocument === undefined) {
      // @ts-expect-error cleanup for test globals
      delete globalThis.document;
    } else {
      Object.defineProperty(globalThis, "document", {
        value: originalDocument,
        configurable: true,
      });
    }
  });

  it("parses a valid stored attribution payload", () => {
    const payload = encodeURIComponent(
      JSON.stringify({
        referralCode: "jazz",
        capturedAt: "2026-04-08T10:00:00.000Z",
        source: "landing_page",
      })
    );

    expect(parseStoredReferralAttribution(payload)).toEqual({
      referralCode: "jazz",
      capturedAt: "2026-04-08T10:00:00.000Z",
      source: "landing_page",
    });
  });

  it("returns null for malformed attribution payloads", () => {
    expect(parseStoredReferralAttribution("not-json")).toBeNull();
    expect(
      parseStoredReferralAttribution(
        encodeURIComponent(JSON.stringify({ referralCode: "jazz" }))
      )
    ).toBeNull();
  });

  it("stores and reads the referral attribution cookie", () => {
    storeReferralAttribution("jazz");

    expect(document.cookie).toContain(`${REFERRAL_ATTRIBUTION_COOKIE}=`);
    expect(document.cookie).toContain("SameSite=Lax");
    expect(document.cookie).toContain("Secure");

    const stored = getStoredReferralAttribution();
    expect(stored?.referralCode).toBe("jazz");
    expect(stored?.source).toBe("landing_page");
  });

  it("clears the referral attribution cookie", () => {
    clearStoredReferralAttribution();
    expect(document.cookie).toContain(`${REFERRAL_ATTRIBUTION_COOKIE}=`);
    expect(document.cookie).toContain("Max-Age=0");
  });
});
