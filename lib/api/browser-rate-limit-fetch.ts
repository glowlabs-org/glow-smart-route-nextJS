import * as Sentry from "@sentry/nextjs";
import { HUB_RATE_LIMIT_EVENT, type HubRateLimitEventDetail } from "./hub-client";

const DEFAULT_RETRY_AFTER_MS = 1_500;
const MAX_RETRY_AFTER_MS = 30_000;
const MIN_RETRY_AFTER_MS = 250;
const RATE_LIMIT_REPORT_WINDOW_MS = 20_000;
const INSTALL_KEY = "__glowRateLimitFetchInterceptor";

type RateLimitAwareRequestInit = RequestInit & {
  __skipRateLimitHandling?: boolean;
};

const rateLimitReportCache = new Map<string, number>();

function clampRetryAfterMs(ms: number): number {
  return Math.max(MIN_RETRY_AFTER_MS, Math.min(MAX_RETRY_AFTER_MS, Math.round(ms)));
}

function parseRetryAfterMs(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) return null;

  const numericSeconds = Number(retryAfterHeader);
  if (Number.isFinite(numericSeconds) && numericSeconds > 0) {
    return numericSeconds * 1000;
  }

  const parsedDateMs = Date.parse(retryAfterHeader);
  if (!Number.isNaN(parsedDateMs)) {
    const deltaMs = parsedDateMs - Date.now();
    return deltaMs > 0 ? deltaMs : MIN_RETRY_AFTER_MS;
  }

  return null;
}

function parseResetHeaderMs(resetHeader: string | null): number | null {
  if (!resetHeader) return null;
  const value = Number(resetHeader);
  if (!Number.isFinite(value) || value <= 0) return null;

  if (value > 1_000_000_000_000) {
    return Math.max(MIN_RETRY_AFTER_MS, value - Date.now());
  }
  if (value > 1_000_000_000) {
    return Math.max(MIN_RETRY_AFTER_MS, value * 1000 - Date.now());
  }

  return value * 1000;
}

function resolveRetryAfterMs(headers: Headers): number {
  const retryAfterMs = parseRetryAfterMs(headers.get("retry-after"));
  if (retryAfterMs !== null) return clampRetryAfterMs(retryAfterMs);

  const resetMs =
    parseResetHeaderMs(headers.get("ratelimit-reset")) ??
    parseResetHeaderMs(headers.get("x-ratelimit-reset"));
  if (resetMs !== null) return clampRetryAfterMs(resetMs);

  return DEFAULT_RETRY_AFTER_MS;
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getRequestMethod(
  input: RequestInfo | URL,
  init?: RequestInit
): "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

function resolveApiOrigins(): string[] {
  const candidates = [
    process.env.NEXT_PUBLIC_HUB_URL,
    process.env.NEXT_PUBLIC_CONTROL_API_URL,
    process.env.NEXT_PUBLIC_POSITIONS_API_BASE,
  ].filter(Boolean) as string[];

  const origins = new Set<string>();
  for (const candidate of candidates) {
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      // Ignore malformed env values.
    }
  }
  return [...origins];
}

function shouldHandleRateLimitForUrl(rawUrl: string): boolean {
  if (typeof window === "undefined") return false;
  if (rawUrl.startsWith("/api/")) return true;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl, window.location.origin);
  } catch {
    return false;
  }

  if (
    parsedUrl.origin === window.location.origin &&
    parsedUrl.pathname.startsWith("/api/")
  ) {
    return true;
  }

  return resolveApiOrigins().includes(parsedUrl.origin);
}

function shouldReportRateLimit(method: string, path: string): boolean {
  const now = Date.now();
  const key = `${method}:${path}`;
  const lastReportedAt = rateLimitReportCache.get(key);
  if (lastReportedAt && now - lastReportedAt < RATE_LIMIT_REPORT_WINDOW_MS) {
    return false;
  }

  rateLimitReportCache.set(key, now);
  if (rateLimitReportCache.size > 200) {
    for (const [cacheKey, timestamp] of rateLimitReportCache.entries()) {
      if (now - timestamp > RATE_LIMIT_REPORT_WINDOW_MS * 2) {
        rateLimitReportCache.delete(cacheKey);
      }
    }
  }

  return true;
}

function dispatchRateLimitEvent(detail: HubRateLimitEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<HubRateLimitEventDetail>(HUB_RATE_LIMIT_EVENT, { detail })
  );
}

function reportRateLimitToSentry(detail: HubRateLimitEventDetail): void {
  if (!shouldReportRateLimit(detail.method, detail.path)) return;

  Sentry.withScope(scope => {
    scope.setLevel("warning");
    scope.setTag("kind", "frontend_fetch_rate_limit");
    scope.setTag("endpoint", detail.path);
    scope.setTag("method", detail.method);
    scope.setExtra("retryAfterMs", detail.retryAfterMs);
    scope.setExtra("attempt", detail.attempt);
    Sentry.captureMessage("Frontend fetch request rate-limited");
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export function installBrowserRateLimitFetchInterceptor(options?: {
  maxRetries?: number;
}): () => void {
  if (typeof window === "undefined") return () => {};

  const w = window as Window & {
    [INSTALL_KEY]?: { originalFetch: typeof fetch };
  };
  if (w[INSTALL_KEY]) return () => {};

  const maxRetries = options?.maxRetries ?? 1;
  const baseFetch = window.fetch ?? globalThis.fetch;
  if (!baseFetch) return () => {};
  const originalFetch = baseFetch.bind(window);

  const wrappedFetch: typeof fetch = async (input, init) => {
    const requestInit = init as RateLimitAwareRequestInit | undefined;
    if (requestInit?.__skipRateLimitHandling) {
      return originalFetch(input, init);
    }

    const rawUrl = getRequestUrl(input);
    if (!shouldHandleRateLimitForUrl(rawUrl)) {
      return originalFetch(input, init);
    }

    const method = getRequestMethod(input, init);
    const isIdempotentRead = method === "GET" || method === "HEAD";
    let attempt = 0;

    for (;;) {
      const response = await originalFetch(input, init);
      if (response.status !== 429) return response;

      const retryAfterMs = resolveRetryAfterMs(response.headers);
      const path = (() => {
        try {
          return new URL(rawUrl, window.location.origin).pathname;
        } catch {
          return rawUrl;
        }
      })();
      const detail: HubRateLimitEventDetail = {
        path,
        method: method as HubRateLimitEventDetail["method"],
        retryAfterMs,
        attempt,
      };

      dispatchRateLimitEvent(detail);

      if (!isIdempotentRead || attempt >= maxRetries) {
        reportRateLimitToSentry(detail);
        return response;
      }

      attempt += 1;
      const jitterMs = Math.floor(Math.random() * 200);
      await sleep(retryAfterMs + jitterMs);
    }
  };

  window.fetch = wrappedFetch;
  globalThis.fetch = wrappedFetch;
  w[INSTALL_KEY] = { originalFetch };

  return () => {
    const installed = w[INSTALL_KEY];
    if (!installed) return;
    window.fetch = installed.originalFetch;
    globalThis.fetch = installed.originalFetch;
    delete w[INSTALL_KEY];
  };
}
