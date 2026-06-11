// @vitest-environment node
/**
 * Tests for the /api/internal/points/grant proxy route.
 *
 * Covers the misconfiguration that surfaced in the dashboard as
 * "GUARDED_API_KEY is not configured on the server" (the key was commented
 * out in .env.local): the route must fail closed with that exact error and
 * never call upstream, and when configured it must inject the key
 * server-side and pass the body/status through untouched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import {
  REFERRAL_DASHBOARD_AUTH_COOKIE,
  createReferralDashboardAuthCookieValue,
} from "@/lib/referral-dashboard-auth";

const HUB_URL = "https://hub.example";
const API_KEY = "test-guarded-key";
const DASHBOARD_PASSWORD = "test-dashboard-password";

const GRANT_BODY = JSON.stringify({
  signer: "0x5e230FED487c86B90f6508104149F087d9B1B0A7",
  recipients: ["0xA9A58D16F454A4FA5F7f00Bbe583A86F2C5446dd"],
  amounts: ["1000000000"],
  reason: "Discord Games",
  idempotencyKey: "test-key",
  deadline: "9999999999",
  signature: "0xabcdef",
  chainId: 11155111,
});

function makeRequest({ withCookie = true, body = GRANT_BODY } = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (withCookie) {
    const cookieValue = createReferralDashboardAuthCookieValue();
    headers.set(
      "cookie",
      `${REFERRAL_DASHBOARD_AUTH_COOKIE}=${cookieValue}`,
    );
  }
  return new NextRequest("http://localhost:3000/api/internal/points/grant", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/internal/points/grant (proxy)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("REFERRAL_DASHBOARD_PASSWORD", DASHBOARD_PASSWORD);
    // Trailing slash on purpose: the route must strip it before joining.
    vi.stubEnv("NEXT_PUBLIC_HUB_URL", `${HUB_URL}/`);
    vi.stubEnv("GUARDED_API_KEY", API_KEY);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("rejects requests without the dashboard auth cookie", async () => {
    const response = await POST(makeRequest({ withCookie: false }));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 500 when NEXT_PUBLIC_HUB_URL is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_HUB_URL", "");

    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("NEXT_PUBLIC_HUB_URL is not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed with the exact error when GUARDED_API_KEY is missing (regression)", async () => {
    vi.stubEnv("GUARDED_API_KEY", "");

    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe(
      "GUARDED_API_KEY is not configured on the server",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the body upstream with the server-injected x-api-key", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, grants: [] }), { status: 200 }),
    );

    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${HUB_URL}/admin/points/grant`);
    expect(init.method).toBe("POST");
    expect(init.headers["x-api-key"]).toBe(API_KEY);
    expect(init.body).toBe(GRANT_BODY);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toEqual({ ok: true, grants: [] });
  });

  it("passes upstream error statuses and bodies through untouched", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: "unauthorized", code: "INVALID_API_KEY" }),
        { status: 401 },
      ),
    );

    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.code).toBe("INVALID_API_KEY");
  });

  it("returns 502 when upstream responds with non-JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>Bad Gateway</html>", { status: 502 }),
    );

    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toContain("Upstream returned non-JSON");
  });

  it("returns 502 when the upstream fetch itself fails", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toBe("ECONNREFUSED");
  });
});
