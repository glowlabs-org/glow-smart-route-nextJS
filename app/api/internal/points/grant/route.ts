/**
 * Proxy for the internal points-grant mutation.
 *
 * Re-checks the internal-dashboard password cookie (so only an authenticated
 * dashboard session can reach it) and forwards to the CRM backend
 * `POST /admin/points/grant`, injecting `x-api-key` server-side so the key
 * never reaches the browser. Authorization of the actual grant is the
 * backend's job (EIP-712 signature + operator allowlist).
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  isReferralDashboardRequestAuthorized,
  createReferralDashboardUnauthorizedResponse,
} from "@/lib/referral-dashboard-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isReferralDashboardRequestAuthorized(request)) {
    return createReferralDashboardUnauthorizedResponse();
  }

  const base = process.env.NEXT_PUBLIC_HUB_URL?.replace(/\/+$/, "");
  if (!base) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_HUB_URL is not set" },
      { status: 500 },
    );
  }

  const apiKey = process.env.GUARDED_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GUARDED_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Could not read request body" },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${base}/admin/points/grant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: rawBody,
      cache: "no-store",
    });
    const text = await upstream.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        { error: `Upstream returned non-JSON (status ${upstream.status})` },
        { status: 502 },
      );
    }
    return NextResponse.json(body, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Proxy request failed",
      },
      { status: 502 },
    );
  }
}
