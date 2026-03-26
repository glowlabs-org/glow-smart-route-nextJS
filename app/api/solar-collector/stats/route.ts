import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getHubUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  }
  return value;
}

function buildCacheHeaders(includeCurrentWeekPower: boolean) {
  if (includeCurrentWeekPower) {
    return {
      "Cache-Control":
        "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
    };
  }

  return {
    "Cache-Control":
      "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const includeCurrentWeekPower = ["1", "true"].includes(
      (url.searchParams.get("includeCurrentWeekPower") || "").toLowerCase()
    );

    const forward = new URL(`${getHubUrl()}/solar-collector/stats`);
    const allowedParams = ["walletAddress", "includeCurrentWeekPower"] as const;

    for (const key of allowedParams) {
      const value = url.searchParams.get(key);
      if (!value) continue;
      forward.searchParams.set(key, value);
    }

    const headers = buildCacheHeaders(includeCurrentWeekPower);
    const response = await fetch(forward.toString(), {
      next: { revalidate: includeCurrentWeekPower ? 30 : 300 },
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: text || `Hub error ${response.status}` },
        { status: response.status, headers }
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
