import { NextRequest, NextResponse } from "next/server";
import { buildForwardHeaders } from "@/app/api/_shared/forward-headers";
import {
  createReferralDashboardUnauthorizedResponse,
  isReferralDashboardRequestAuthorized,
} from "@/lib/referral-dashboard-auth";
import type { MarketingMinerApplication } from "@/lib/internal/marketing-launchpad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getHubUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  return value;
}

export async function GET(request: NextRequest) {
  if (!isReferralDashboardRequestAuthorized(request)) {
    return createReferralDashboardUnauthorizedResponse();
  }

  try {
    const url = `${getHubUrl()}/applications/marketing-miners`;
    const response = await fetch(url, {
      headers: buildForwardHeaders(request),
      next: { revalidate: 300, tags: ["marketing-miners:list"] },
    });

    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json(
        { error: `hub responded ${response.status}: ${body}` },
        { status: response.status },
      );
    }

    const applications = (await response.json()) as MarketingMinerApplication[];
    return NextResponse.json(applications, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load miner-eligible applications",
      },
      { status: 500 },
    );
  }
}
