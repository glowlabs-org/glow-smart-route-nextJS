import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HUB_RATE_LIMIT_EVENT,
  type HubRateLimitEventDetail,
} from "../hub-client";
import { installBrowserRateLimitFetchInterceptor } from "../browser-rate-limit-fetch";

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  withScope: (callback: (scope: any) => void) =>
    callback({
      setLevel: vi.fn(),
      setTag: vi.fn(),
      setExtra: vi.fn(),
    }),
}));

type MockResponseInput = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

function createMockResponse(input: MockResponseInput): Response {
  const { status, body, headers } = input;
  const textBody =
    typeof body === "string" ? body : body === undefined ? "" : JSON.stringify(body);

  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    text: async () => textBody,
    json: async () => (textBody ? JSON.parse(textBody) : null),
  } as unknown as Response;
}

function createMockWindow(origin = "https://app.glow.org"): Window {
  const listeners = new Map<string, Set<(event: Event) => void>>();

  const mockWindow = {
    location: { origin },
    addEventListener(type: string, listener: (event: Event) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event) {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event);
      }
      return true;
    },
  };

  return mockWindow as unknown as Window;
}

describe("browser rate-limit fetch interceptor", () => {
  const originalControlApiUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL;
  const originalHubUrl = process.env.NEXT_PUBLIC_HUB_URL;
  const originalPositionsApiBase = process.env.NEXT_PUBLIC_POSITIONS_API_BASE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CONTROL_API_URL = "https://control.example";
    process.env.NEXT_PUBLIC_HUB_URL = "https://hub.example";
    process.env.NEXT_PUBLIC_POSITIONS_API_BASE = "https://positions.example";
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("window", createMockWindow());
    vi.stubGlobal(
      "CustomEvent",
      class<T> extends Event {
        detail: T;
        constructor(type: string, init?: CustomEventInit<T>) {
          super(type);
          this.detail = init?.detail as T;
        }
      }
    );
  });

  afterEach(() => {
    if (originalControlApiUrl) {
      process.env.NEXT_PUBLIC_CONTROL_API_URL = originalControlApiUrl;
    } else {
      delete process.env.NEXT_PUBLIC_CONTROL_API_URL;
    }
    if (originalHubUrl) process.env.NEXT_PUBLIC_HUB_URL = originalHubUrl;
    else delete process.env.NEXT_PUBLIC_HUB_URL;
    if (originalPositionsApiBase) {
      process.env.NEXT_PUBLIC_POSITIONS_API_BASE = originalPositionsApiBase;
    } else {
      delete process.env.NEXT_PUBLIC_POSITIONS_API_BASE;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("retries allowed GET requests once on 429", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createMockResponse({
          status: 429,
          body: { error: "rate limited" },
          headers: { "retry-after": "1" },
        })
      )
      .mockResolvedValueOnce(createMockResponse({ status: 200, body: { ok: true } }));

    vi.stubGlobal("fetch", fetchMock);
    window.fetch = fetchMock as typeof fetch;

    const events: HubRateLimitEventDetail[] = [];
    window.addEventListener(HUB_RATE_LIMIT_EVENT, event => {
      const customEvent = event as CustomEvent<HubRateLimitEventDetail>;
      events.push(customEvent.detail);
    });

    const teardown = installBrowserRateLimitFetchInterceptor({ maxRetries: 1 });

    const promise = fetch("https://control.example/impact/glow-score");
    await vi.advanceTimersByTimeAsync(1000);
    const response = await promise;
    teardown();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(1);
    expect(events[0]?.retryAfterMs).toBe(1000);
  });

  it("does not retry when request opts out of global handling", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createMockResponse({ status: 429, body: { error: "limited" } }));

    vi.stubGlobal("fetch", fetchMock);
    window.fetch = fetchMock as typeof fetch;

    const teardown = installBrowserRateLimitFetchInterceptor({ maxRetries: 1 });

    const response = await fetch("https://control.example/farms/activity", {
      __skipRateLimitHandling: true,
    } as RequestInit);
    teardown();

    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-allowlisted origins", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createMockResponse({ status: 429, body: { error: "limited" } }));

    vi.stubGlobal("fetch", fetchMock);
    window.fetch = fetchMock as typeof fetch;

    const teardown = installBrowserRateLimitFetchInterceptor({ maxRetries: 1 });

    const response = await fetch("https://example.org/other-service");
    teardown();

    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-idempotent methods", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createMockResponse({ status: 429, body: { error: "limited" } }));

    vi.stubGlobal("fetch", fetchMock);
    window.fetch = fetchMock as typeof fetch;

    const teardown = installBrowserRateLimitFetchInterceptor({ maxRetries: 1 });

    const response = await fetch("https://control.example/referral/link", {
      method: "POST",
      body: JSON.stringify({ code: "abc123" }),
      headers: { "content-type": "application/json" },
    });
    teardown();

    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
