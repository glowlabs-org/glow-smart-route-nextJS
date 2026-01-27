import { NextResponse } from "next/server";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

if (!HUB_URL) {
  throw new Error("NEXT_PUBLIC_HUB_URL is not set");
}

export async function GET() {
  try {
    const url = `${HUB_URL}/referral/internal/dashboard`;
    const response = await fetch(url, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch data: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("Error fetching referral dashboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
