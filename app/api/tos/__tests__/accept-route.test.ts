import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../accept/route";
import { REFERRAL_ATTRIBUTION_COOKIE } from "@/lib/referral-attribution";

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

function createRequest(params?: {
  body?: Record<string, unknown>;
  cookieValue?: string | null;
}) {
  return {
    json: async () => params?.body ?? {},
    cookies: {
      get: (name: string) => {
        if (name !== REFERRAL_ATTRIBUTION_COOKIE || !params?.cookieValue) {
          return undefined;
        }

        return { value: params.cookieValue };
      },
    },
  } as any;
}

describe("POST /api/tos/accept", () => {
  const originalControlApiUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL;
  const originalHubUrl = process.env.NEXT_PUBLIC_HUB_URL;
  const originalAutoLinkSecret = process.env.REFERRAL_AUTO_LINK_SECRET;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CONTROL_API_URL = "https://control.example";
    process.env.NEXT_PUBLIC_HUB_URL = "https://hub.example";
    process.env.REFERRAL_AUTO_LINK_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

    if (originalControlApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_CONTROL_API_URL;
    } else {
      process.env.NEXT_PUBLIC_CONTROL_API_URL = originalControlApiUrl;
    }

    if (originalHubUrl === undefined) {
      delete process.env.NEXT_PUBLIC_HUB_URL;
    } else {
      process.env.NEXT_PUBLIC_HUB_URL = originalHubUrl;
    }

    if (originalAutoLinkSecret === undefined) {
      delete process.env.REFERRAL_AUTO_LINK_SECRET;
    } else {
      process.env.REFERRAL_AUTO_LINK_SECRET = originalAutoLinkSecret;
    }
  });

  it("returns the control API error and skips auto-link when ToS acceptance fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createMockResponse({ status: 401, body: { error: "bad sig" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      createRequest({
        body: { wallet: "0xabc", signature: "0x1" },
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "bad sig" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain(
      "/wallets/address/0xabc/tos/accept"
    );
  });

  it("auto-links a stored attribution after successful ToS acceptance and clears the cookie", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createMockResponse({ status: 200, body: { ok: true } }))
      .mockResolvedValueOnce(
        createMockResponse({
          status: 200,
          body: { success: true, autoLinked: true },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      createRequest({
        body: { wallet: "0xabc", signature: "0x1" },
        cookieValue: encodeURIComponent(
          JSON.stringify({
            referralCode: "jazz",
            capturedAt: "2026-04-08T10:00:00.000Z",
            source: "landing_page",
          })
        ),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      autoLink: {
        attempted: true,
        linked: true,
        referralCode: "jazz",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0].toString()).toContain("/referral/auto-link");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "x-referral-auto-link-secret": "test-secret",
      }),
    });
    expect(response.headers.get("set-cookie")).toContain(
      `${REFERRAL_ATTRIBUTION_COOKIE}=`
    );
  });

  it("keeps the attribution cookie on transient auto-link failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createMockResponse({ status: 200, body: { ok: true } }))
      .mockResolvedValueOnce(
        createMockResponse({
          status: 500,
          body: { error: "hub down" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      createRequest({
        body: { wallet: "0xabc", signature: "0x1" },
        cookieValue: encodeURIComponent(
          JSON.stringify({
            referralCode: "jazz",
            capturedAt: "2026-04-08T10:00:00.000Z",
            source: "landing_page",
          })
        ),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      autoLink: {
        attempted: true,
        linked: false,
        referralCode: "jazz",
        error: "hub down",
        responseStatus: 500,
      },
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
