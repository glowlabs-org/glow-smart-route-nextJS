import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
};

function getHubUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  }
  return value;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const forward = new URL(`${getHubUrl()}/impact/new-wallets-by-week`);
    const allowedParams = ["startWeek", "endWeek"] as const;

    for (const key of allowedParams) {
      const value = url.searchParams.get(key);
      if (value == null || value === "") continue;
      forward.searchParams.set(key, value);
    }

    const response = await fetch(forward.toString(), {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: text || `Hub error ${response.status}` },
        { status: response.status, headers: CACHE_HEADERS }
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
