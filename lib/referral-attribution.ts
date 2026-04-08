export const REFERRAL_ATTRIBUTION_COOKIE = "glow_referral_attribution" as const;
export const REFERRAL_AUTO_LINK_EVENT = "glow:referral-auto-linked" as const;

const REFERRAL_ATTRIBUTION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export type StoredReferralAttribution = {
  referralCode: string;
  capturedAt: string;
  source: "landing_page";
};

function getSecureCookieSuffix() {
  if (typeof window === "undefined") return "";
  return window.location.protocol === "https:" ? "; Secure" : "";
}

function readCookieValue(cookieName: string): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${cookieName}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;
    return trimmed.slice(prefix.length);
  }

  return null;
}

export function parseStoredReferralAttribution(
  rawCookie: string | null | undefined
): StoredReferralAttribution | null {
  if (!rawCookie) return null;

  try {
    const parsed = JSON.parse(
      decodeURIComponent(rawCookie)
    ) as Partial<StoredReferralAttribution>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.referralCode || typeof parsed.referralCode !== "string") return null;
    if (!parsed.capturedAt || typeof parsed.capturedAt !== "string") return null;

    return {
      referralCode: parsed.referralCode,
      capturedAt: parsed.capturedAt,
      source: "landing_page",
    };
  } catch {
    return null;
  }
}

export function getStoredReferralAttribution():
  | StoredReferralAttribution
  | null {
  return parseStoredReferralAttribution(
    readCookieValue(REFERRAL_ATTRIBUTION_COOKIE)
  );
}

export function storeReferralAttribution(referralCode: string) {
  if (typeof document === "undefined") return;

  const payload: StoredReferralAttribution = {
    referralCode,
    capturedAt: new Date().toISOString(),
    source: "landing_page",
  };

  document.cookie = `${REFERRAL_ATTRIBUTION_COOKIE}=${encodeURIComponent(
    JSON.stringify(payload)
  )}; Path=/; Max-Age=${REFERRAL_ATTRIBUTION_MAX_AGE_SECONDS}; SameSite=Lax${getSecureCookieSuffix()}`;
}

export function clearStoredReferralAttribution() {
  if (typeof document === "undefined") return;
  document.cookie = `${REFERRAL_ATTRIBUTION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${getSecureCookieSuffix()}`;
}
