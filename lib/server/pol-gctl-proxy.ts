import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import {
  createReferralDashboardUnauthorizedResponse,
  isReferralDashboardRequestAuthorized,
} from "@/lib/referral-dashboard-auth";

export type PolGctlProxyAction = "preview" | "mint";

export async function proxyPolGctlRequest(
  request: NextRequest,
  action: PolGctlProxyAction,
): Promise<NextResponse> {
  if (!isReferralDashboardRequestAuthorized(request)) {
    return createReferralDashboardUnauthorizedResponse();
  }

  const base = process.env.NEXT_PUBLIC_CONTROL_API_URL?.replace(/\/+$/, "");
  if (!base) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_CONTROL_API_URL is not configured" },
      { status: 500 },
    );
  }
  const apiKey = process.env.GUARDED_API_KEY?.trim();
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
    const upstream = await fetch(`${base}/internal/pol-gctl/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: rawBody,
      cache: "no-store",
    });
    const text = await upstream.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        { error: `Control returned non-JSON (status ${upstream.status})` },
        { status: 502 },
      );
    }
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Control request failed",
      },
      { status: 502 },
    );
  }
}
