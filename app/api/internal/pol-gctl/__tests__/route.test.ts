// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as previewPost } from "../preview/route";
import { POST as mintPost } from "../mint/route";
import {
  REFERRAL_DASHBOARD_AUTH_COOKIE,
  createReferralDashboardAuthCookieValue,
} from "@/lib/referral-dashboard-auth";

const CONTROL_URL = "https://control.example";
const API_KEY = "test-guarded-key";
const DASHBOARD_PASSWORD = "test-dashboard-password";
const TX_HASH = `0x${"12".repeat(32)}`;
const BODY = JSON.stringify({ txHash: TX_HASH });

function makeRequest(
  action: "preview" | "mint",
  { withCookie = true, body = BODY } = {},
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (withCookie) {
    const cookieValue = createReferralDashboardAuthCookieValue();
    headers.set(
      "cookie",
      `${REFERRAL_DASHBOARD_AUTH_COOKIE}=${cookieValue}`,
    );
  }
  return new NextRequest(
    `http://localhost:3000/api/internal/pol-gctl/${action}`,
    {
      method: "POST",
      headers,
      body,
    },
  );
}

describe("POL GCTL Control proxy routes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("REFERRAL_DASHBOARD_PASSWORD", DASHBOARD_PASSWORD);
    vi.stubEnv("NEXT_PUBLIC_CONTROL_API_URL", `${CONTROL_URL}/`);
    vi.stubEnv("GUARDED_API_KEY", API_KEY);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("rejects requests without the internal-dashboard auth cookie", async () => {
    const response = await previewPost(
      makeRequest("preview", { withCookie: false }),
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the Control URL or guarded key is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTROL_API_URL", "");
    const missingUrl = await previewPost(makeRequest("preview"));
    expect(missingUrl.status).toBe(500);
    expect((await missingUrl.json()).error).toBe(
      "NEXT_PUBLIC_CONTROL_API_URL is not configured",
    );

    vi.stubEnv("NEXT_PUBLIC_CONTROL_API_URL", CONTROL_URL);
    vi.stubEnv("GUARDED_API_KEY", "");
    const missingKey = await mintPost(makeRequest("mint"));
    expect(missingKey.status).toBe(500);
    expect((await missingKey.json()).error).toBe(
      "GUARDED_API_KEY is not configured on the server",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["preview", previewPost],
    ["mint", mintPost],
  ] as const)(
    "forwards the %s body and injects the API key server-side",
    async (action, handler) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ txHash: TX_HASH, ready: true }), {
          status: 200,
        }),
      );

      const response = await handler(makeRequest(action));
      const payload = await response.json();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${CONTROL_URL}/internal/pol-gctl/${action}`);
      expect(init).toMatchObject({
        method: "POST",
        body: BODY,
        cache: "no-store",
      });
      expect(init.headers["x-api-key"]).toBe(API_KEY);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(payload).toEqual({ txHash: TX_HASH, ready: true });
    },
  );

  it("preserves confirmation-pending responses from Control", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Waiting for 12 confirmations before minting",
          code: "PENDING_CONFIRMATIONS",
          confirmations: 3,
          requiredConfirmations: 12,
        }),
        { status: 425 },
      ),
    );

    const response = await mintPost(makeRequest("mint"));
    const payload = await response.json();

    expect(response.status).toBe(425);
    expect(payload).toMatchObject({
      code: "PENDING_CONFIRMATIONS",
      confirmations: 3,
      requiredConfirmations: 12,
    });
  });

  it("returns 502 for non-JSON and failed upstream responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>Bad Gateway</html>", { status: 502 }),
    );
    const nonJson = await previewPost(makeRequest("preview"));
    expect(nonJson.status).toBe(502);
    expect((await nonJson.json()).error).toContain(
      "Control returned non-JSON",
    );

    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const failedFetch = await mintPost(makeRequest("mint"));
    expect(failedFetch.status).toBe(502);
    expect((await failedFetch.json()).error).toBe("ECONNREFUSED");
  });
});
