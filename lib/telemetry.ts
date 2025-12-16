import { track } from "@vercel/analytics";

export interface TelemetryData {
  [key: string]: string | number | boolean | null;
}

function truncateString(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen);
}

function isAllowedPrimitive(value: unknown): value is string | number | boolean | null {
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

function sanitizeValue(value: string | number | boolean | null): string | number | boolean | null {
  if (typeof value === "string") return truncateString(value, 255);
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

function sanitizeData(data?: Record<string, unknown>): TelemetryData | undefined {
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
  try {
    const eventName = sanitizeEventName(name);
    if (!eventName) return;
    const sanitized = sanitizeData(data);
    if (sanitized && Object.keys(sanitized).length > 0) {
      track(eventName, sanitized);
      return;
    }
    track(eventName);
  } catch {
    // Telemetry must never impact UX.
  }
}


