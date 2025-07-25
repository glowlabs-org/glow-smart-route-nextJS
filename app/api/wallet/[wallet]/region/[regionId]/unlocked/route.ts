import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://glow-impact-backend-staging.up.railway.app";

export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string; regionId: string } }
) {
  try {
    const { wallet, regionId } = params;

    const response = await fetch(
      `${BASE_URL}/wallet/${wallet}/region/${regionId}/unlocked`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store", // Disable caching for dynamic data
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch wallet region unlocked" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Wallet region unlocked API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
