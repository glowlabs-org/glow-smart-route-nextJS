export interface TelemetryData {
  [key: string]: string | number | boolean | null;
}

// Umami global exposed by the tracker script in app/layout.tsx (production only).
// Safe to call on the server or in dev; window.umami will be undefined and we
// silently skip. Payload limits: 50 props, strings <=500 chars, 4-decimal nums.
interface UmamiGlobal {
  track: {
    (): void;
    (event: string, data?: Record<string, string | number | boolean | null>): void;
  };
  identify: {
    (id: string, data?: Record<string, string | number | boolean | null>): void;
    (data: Record<string, string | number | boolean | null>): void;
  };
}

declare global {
  interface Window {
    umami?: UmamiGlobal;
  }
}

function umamiTrack(name: string, data?: TelemetryData): void {
  if (typeof window === "undefined") return;
  const umami = window.umami;
  if (!umami) return;
  try {
    if (data) umami.track(name, data);
    else umami.track(name);
  } catch {
    // Telemetry must never impact UX.
  }
}

function readCookieValue(cookieName: string): string | null {
  try {
    if (typeof document === "undefined") return null;
    const prefix = `${cookieName}=`;
    const parts = document.cookie.split(";");
    for (const part of parts) {
      const trimmed = part.trimStart();
      if (!trimmed.startsWith(prefix)) continue;
      const raw = trimmed.slice(prefix.length);
      return decodeURIComponent(raw);
    }
    return null;
  } catch {
    return null;
  }
}

function getGeoContextFromCookies(): Record<string, unknown> | undefined {
  const country = readCookieValue("geo_country");
  const region = readCookieValue("geo_region");
  if (!country && !region) return undefined;
  return {
    geo_country: country || null,
    geo_region: region || null,
  };
}

// Active UI language (en | ko, etc.). Set by lib/i18n/provider.tsx on mount
// and on user language switch. Stamped on every event so funnels, cohorts,
// and breakdowns can be filtered by language without per-call instrumentation.
function getLangFromCookies(): Record<string, unknown> | undefined {
  const lang = readCookieValue("glow_lang");
  if (!lang) return undefined;
  return { lang };
}

function truncateString(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen);
}

function isAllowedPrimitive(
  value: unknown
): value is string | number | boolean | null {
  if (value === null) return true;
  const t = typeof value;
  return t === "string" || t === "number" || t === "boolean";
}

function toAllowedPrimitive(value: unknown): string | number | boolean | null {
  if (value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (isAllowedPrimitive(value)) return value;

  // Avoid nested objects/arrays per Vercel custom events limitations.
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sanitizeEventName(name: string): string {
  return truncateString(String(name || ""), 255);
}

function sanitizeKey(key: string): string {
  return truncateString(String(key || ""), 255);
}

function sanitizeValue(
  value: string | number | boolean | null
): string | number | boolean | null {
  if (typeof value === "string") return truncateString(value, 255);
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

function sanitizeData(
  data?: Record<string, unknown>
): TelemetryData | undefined {
  if (!data) return undefined;
  const out: TelemetryData = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    const key = sanitizeKey(k);
    const primitive = toAllowedPrimitive(v);
    out[key] = sanitizeValue(primitive);
  }
  return out;
}

export function trackEvent(name: string, data?: Record<string, unknown>) {
  if (process.env.NEXT_PUBLIC_CHAIN_ID === "11155111") return; // Skip on Sepolia
  try {
    const eventName = sanitizeEventName(name);
    if (!eventName) return;
    const geo = getGeoContextFromCookies();
    const lang = getLangFromCookies();
    const merged = { ...(geo || {}), ...(lang || {}), ...(data || {}) };
    const sanitized = sanitizeData(merged);
    if (sanitized && Object.keys(sanitized).length > 0) {
      umamiTrack(eventName, sanitized);
      return;
    }
    umamiTrack(eventName);
  } catch {
    // Telemetry must never impact UX.
  }
}

// Associate the connected wallet with the Umami session so backend joins can
// attribute events to an address. Wallet addresses are not PII, but do NOT
// pass emails / IPs / keys. Safe no-op if the tracker isn't loaded.
export function identifyWallet(
  walletAddress: string,
  extra?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  const umami = window.umami;
  if (!umami) return;
  try {
    const sanitized = sanitizeData(extra);
    if (sanitized && Object.keys(sanitized).length > 0) {
      umami.identify(walletAddress.toLowerCase(), sanitized);
    } else {
      umami.identify(walletAddress.toLowerCase());
    }
  } catch {
    // swallow
  }
}
