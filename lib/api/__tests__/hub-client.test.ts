import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HubRateLimitError,
  getHubRateLimitDelayMs,
  hubGet,
  hubPost,
  isHubRateLimitError,
} from "../hub-client";

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

describe("hub-client rate limit handling", () => {
  const originalHubUrl = process.env.NEXT_PUBLIC_HUB_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_HUB_URL = "https://hub.example";
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    if (originalHubUrl) process.env.NEXT_PUBLIC_HUB_URL = originalHubUrl;
    else delete process.env.NEXT_PUBLIC_HUB_URL;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("retries GET requests on 429 using Retry-After", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createMockResponse({
          status: 429,
          body: { error: "rate limited" },
          headers: { "retry-after": "1" },
        })
      )
      .mockResolvedValueOnce(
        createMockResponse({
          status: 200,
          body: { ok: true },
          headers: { "content-type": "application/json" },
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const requestPromise = hubGet<{ ok: boolean }>("/fractions/summary");
    await vi.advanceTimersByTimeAsync(1000);

    await expect(requestPromise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws HubRateLimitError when GET exceeds retry budget", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createMockResponse({
          status: 429,
          body: { error: "still limited" },
          headers: { "retry-after": "1" },
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const requestPromise = hubGet("/impact/glow-score", {
      maxRateLimitRetries: 1,
    });
    const rejectionExpectation = expect(requestPromise).rejects.toBeInstanceOf(
      HubRateLimitError
    );

    await vi.advanceTimersByTimeAsync(2000);

    await rejectionExpectation;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry POST on 429 and exposes delay metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createMockResponse({
        status: 429,
        body: { error: "rate limited" },
        headers: { "retry-after": "2" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    let thrownError: unknown;
    try {
      await hubPost("/referral/link", { code: "abc123" });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(HubRateLimitError);
    expect(isHubRateLimitError(thrownError)).toBe(true);
    if (isHubRateLimitError(thrownError)) {
      expect(thrownError.retryAfterMs).toBe(2000);
      expect(thrownError.method).toBe("POST");
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("getHubRateLimitDelayMs extracts delay only from HubRateLimitError", () => {
    const error = new HubRateLimitError({
      path: "/referral/code",
      method: "GET",
      retryAfterMs: 1500,
      responseText: "limited",
    });

    expect(getHubRateLimitDelayMs(error)).toBe(1500);
    expect(getHubRateLimitDelayMs(new Error("other"))).toBeUndefined();
  });
});
