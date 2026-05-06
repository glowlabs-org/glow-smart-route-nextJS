import { NextRequest, NextResponse } from "next/server";
import {
  createReferralDashboardUnauthorizedResponse,
  isReferralDashboardRequestAuthorized,
} from "@/lib/referral-dashboard-auth";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;
const HUB_API_KEY = process.env.GUARDED_API_KEY;

if (!HUB_URL) {
  throw new Error("NEXT_PUBLIC_HUB_URL is not set");
}

export async function GET(request: NextRequest) {
  try {
    if (!isReferralDashboardRequestAuthorized(request)) {
      return createReferralDashboardUnauthorizedResponse();
    }

    if (!HUB_API_KEY) {
      return NextResponse.json(
        { error: "Server misconfigured: GUARDED_API_KEY not set" },
        { status: 500 }
      );
    }

    const url = `${HUB_URL}/referral/internal/dashboard`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "x-api-key": HUB_API_KEY },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch data: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching referral dashboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
