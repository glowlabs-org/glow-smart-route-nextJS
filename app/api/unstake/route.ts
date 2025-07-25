import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://glow-impact-backend-staging.up.railway.app";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${BASE_URL}/unstake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData?.error || "Failed to unstake" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Unstake API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
