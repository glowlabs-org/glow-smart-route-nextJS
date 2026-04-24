import { NextRequest } from "next/server";
import { getGeoContextFromRequest as getGeoContext } from "@/lib/geo-context";

export interface TelemetryData {
  [key: string]: string | number | boolean | null;
}

// Self-hosted Umami target. Override via env if the instance moves (custom
// domain, staging, etc). The website ID must match the one in app/layout.tsx.
const UMAMI_URL =
  process.env.UMAMI_URL ?? "https://umami-production-c5d3.up.railway.app";
const UMAMI_WEBSITE_ID =
  process.env.UMAMI_WEBSITE_ID ?? "80e6d736-7ef9-4ae8-9db0-b47cf730702d";

// Umami's tracker runs `isbot` on inbound User-Agent and silently drops
// anything bot-ish (returns `{"beep":"boop"}`). Even a trailing token like
// "GlowServerSync" trips it. Use a pure Chrome UA; server identity is
// encoded in event `url` (e.g. /server) and `hostname` (app.glow.org).
const SERVER_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function truncateString(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen);
}

function isAllowedPrimitive(
  value: unknown,
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

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// Umami payload limits: 50 props, strings <= 500 chars, 4-decimal numbers.
function sanitizeEventName(name: string): string {
  return truncateString(String(name || ""), 255);
}

function sanitizeKey(key: string): string {
  return truncateString(String(key || ""), 255);
}

function sanitizeValue(
  value: string | number | boolean | null,
): string | number | boolean | null {
  if (typeof value === "string") return truncateString(value, 500);
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

function sanitizeData(
  data?: Record<string, unknown>,
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

interface SendEventOptions {
  hostname?: string;
  url?: string;
  referrer?: string;
  userAgent?: string;
}

export async function trackServerEvent(
  name: string,
  data?: Record<string, unknown>,
  options?: SendEventOptions,
) {
  if (process.env.NEXT_PUBLIC_CHAIN_ID === "11155111") return; // Skip on Sepolia
  try {
    const eventName = sanitizeEventName(name);
    if (!eventName) return;
    const sanitized = sanitizeData(data);

    const payload: Record<string, unknown> = {
      website: UMAMI_WEBSITE_ID,
      // Must match a website-allowed domain or events are silently dropped.
      hostname: options?.hostname ?? "app.glow.org",
      name: eventName,
      url: options?.url ?? "/server",
      referrer: options?.referrer ?? "",
    };
    if (sanitized && Object.keys(sanitized).length > 0) {
      payload.data = sanitized;
    }

    await fetch(`${UMAMI_URL}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": options?.userAgent ?? SERVER_USER_AGENT,
      },
      body: JSON.stringify({ type: "event", payload }),
      // Fire-and-forget: don't block the API response on the telemetry POST.
      // If Umami is down, keepalive lets the browser/node finalize cleanly.
      keepalive: true,
    });
  } catch {
    // Telemetry must never impact API behavior.
  }
}

export function getGeoContextFromRequest(request: NextRequest) {
  return getGeoContext(request);
}
