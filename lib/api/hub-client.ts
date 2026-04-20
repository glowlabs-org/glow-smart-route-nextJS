import * as Sentry from "@sentry/nextjs";

const DEFAULT_RETRY_AFTER_MS = 1_500;
const MAX_RETRY_AFTER_MS = 30_000;
const MIN_RETRY_AFTER_MS = 250;
const RATE_LIMIT_REPORT_WINDOW_MS = 20_000;

export const HUB_RATE_LIMIT_EVENT = "hub:rate-limited" as const;

const rateLimitReportCache = new Map<string, number>();

type HubMethod = "GET" | "POST" | "PUT";
type InternalRequestInit = RequestInit & {
  __skipRateLimitHandling?: boolean;
};

export interface HubRateLimitEventDetail {
  path: string;
  method: HubMethod;
  retryAfterMs: number;
  attempt: number;
}

export class HubRateLimitError extends Error {
  readonly status = 429;
  readonly path: string;
  readonly method: HubMethod;
  readonly retryAfterMs: number;
  readonly responseText: string;

  constructor(params: {
    path: string;
    method: HubMethod;
    retryAfterMs: number;
    responseText: string;
  }) {
    super(
      `Hub ${params.method} ${params.path} rate-limited (429). Retry in ${params.retryAfterMs}ms.`
    );
    this.name = "HubRateLimitError";
    this.path = params.path;
    this.method = params.method;
    this.retryAfterMs = params.retryAfterMs;
    this.responseText = params.responseText;
  }
}

export function isHubRateLimitError(error: unknown): error is HubRateLimitError {
  return error instanceof HubRateLimitError;
}

export function getHubRateLimitDelayMs(error: unknown): number | undefined {
  if (!isHubRateLimitError(error)) return undefined;
  return error.retryAfterMs;
}

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

  // Unix ms timestamp.
  if (value > 1_000_000_000_000) {
    return Math.max(MIN_RETRY_AFTER_MS, value - Date.now());
  }

  // Unix seconds timestamp.
  if (value > 1_000_000_000) {
    return Math.max(MIN_RETRY_AFTER_MS, value * 1000 - Date.now());
  }

  // Delta seconds.
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

function shouldReportRateLimit(method: HubMethod, path: string): boolean {
  const now = Date.now();
  const key = `${method}:${path}`;
  const lastReportedAt = rateLimitReportCache.get(key);
  if (lastReportedAt && now - lastReportedAt < RATE_LIMIT_REPORT_WINDOW_MS) {
    return false;
  }

  rateLimitReportCache.set(key, now);

  // Opportunistically prune stale keys.
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
    new CustomEvent<HubRateLimitEventDetail>(HUB_RATE_LIMIT_EVENT, {
      detail,
    })
  );
}

function reportRateLimitToSentry(
  detail: HubRateLimitEventDetail,
  responseText: string
): void {
  if (!shouldReportRateLimit(detail.method, detail.path)) return;

  Sentry.withScope(scope => {
    scope.setLevel("warning");
    scope.setTag("kind", "hub_rate_limit");
    scope.setTag("endpoint", detail.path);
    scope.setTag("method", detail.method);
    scope.setExtra("retryAfterMs", detail.retryAfterMs);
    scope.setExtra("attempt", detail.attempt);
    if (responseText) scope.setExtra("responseText", responseText.slice(0, 300));
    Sentry.captureMessage("Hub API request rate-limited");
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

function getHubUrl(): string {
  // IMPORTANT: use direct access so Next can inline NEXT_PUBLIC_* on the client.
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value)
    throw new Error("Environment variable NEXT_PUBLIC_HUB_URL is not set");
  return value;
}

export interface HubGetOptions<T> {
  params?: Record<string, string | number | boolean | null | undefined>;
  notFound?: T;
  init?: RequestInit;
  maxRateLimitRetries?: number;
}

function buildHubUrl(
  path: string,
  params?: HubGetOptions<unknown>["params"]
): string {
  const base = getHubUrl();
  const url = new URL(path, base);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export async function hubGet<T>(
  path: string,
  options: HubGetOptions<T> = {}
): Promise<T> {
  const url = buildHubUrl(path, options.params);
  const maxRateLimitRetries = options.maxRateLimitRetries ?? 2;

  try {
    for (let attempt = 0; ; attempt += 1) {
      const requestInit: InternalRequestInit = {
        ...(options.init ?? {}),
        __skipRateLimitHandling: true,
      };
      const res = await fetch(url, requestInit);

      if (res.status === 404 && "notFound" in options)
        return options.notFound as T;

      if (res.status === 429) {
        const responseText = await res.text();
        const retryAfterMs = resolveRetryAfterMs(res.headers);
        const detail: HubRateLimitEventDetail = {
          path,
          method: "GET",
          retryAfterMs,
          attempt,
        };

        dispatchRateLimitEvent(detail);

        if (attempt < maxRateLimitRetries) {
          const jitterMs = Math.floor(Math.random() * 200);
          await sleep(retryAfterMs + jitterMs);
          continue;
        }

        reportRateLimitToSentry(detail, responseText);
        throw new HubRateLimitError({
          path,
          method: "GET",
          retryAfterMs,
          responseText,
        });
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Hub GET ${path} failed: ${res.status} - ${text}`);
      }

      return (await res.json()) as T;
    }
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

export async function hubPost<T>(
  path: string,
  body: unknown,
  options: HubGetOptions<T> = {}
): Promise<T> {
  const url = buildHubUrl(path, options.params);

  try {
    const requestInit: InternalRequestInit = {
      ...(options.init ?? {}),
      __skipRateLimitHandling: true,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.init?.headers,
      },
      body: JSON.stringify(body),
    };
    const res = await fetch(url, {
      ...requestInit,
    });

    if (res.status === 429) {
      const responseText = await res.text();
      const retryAfterMs = resolveRetryAfterMs(res.headers);
      const detail: HubRateLimitEventDetail = {
        path,
        method: "POST",
        retryAfterMs,
        attempt: 0,
      };
      dispatchRateLimitEvent(detail);
      reportRateLimitToSentry(detail, responseText);
      throw new HubRateLimitError({
        path,
        method: "POST",
        retryAfterMs,
        responseText,
      });
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hub POST ${path} failed: ${res.status} - ${text}`);
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

export async function hubPut<T>(
  path: string,
  body: unknown,
  options: HubGetOptions<T> = {}
): Promise<T> {
  const url = buildHubUrl(path, options.params);

  try {
    const requestInit: InternalRequestInit = {
      ...(options.init ?? {}),
      __skipRateLimitHandling: true,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...options.init?.headers,
      },
      body: JSON.stringify(body),
    };
    const res = await fetch(url, {
      ...requestInit,
    });

    if (res.status === 429) {
      const responseText = await res.text();
      const retryAfterMs = resolveRetryAfterMs(res.headers);
      const detail: HubRateLimitEventDetail = {
        path,
        method: "PUT",
        retryAfterMs,
        attempt: 0,
      };
      dispatchRateLimitEvent(detail);
      reportRateLimitToSentry(detail, responseText);
      throw new HubRateLimitError({
        path,
        method: "PUT",
        retryAfterMs,
        responseText,
      });
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hub PUT ${path} failed: ${res.status} - ${text}`);
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}
