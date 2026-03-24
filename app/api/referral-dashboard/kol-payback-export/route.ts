import { NextRequest, NextResponse } from "next/server";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

if (!HUB_URL) {
  throw new Error("NEXT_PUBLIC_HUB_URL is not set");
}

const ALLOWED_QUERY_KEYS = ["rangePreset", "startWeek", "endWeek"] as const;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${HUB_URL}/fractions/mining-center-kol-payback-export`);

    for (const key of ALLOWED_QUERY_KEYS) {
      const value = request.nextUrl.searchParams.get(key);
      if (value) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      cache: "no-store",
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
    console.error("Error fetching referral dashboard KoL payback export:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
