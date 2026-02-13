import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=0, s-maxage=120, stale-while-revalidate=300",
};

function getHubUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  }
  return value;
}

function parseWeekParam(value: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
    return null;
  }
  return num;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const startWeek = parseWeekParam(url.searchParams.get("startWeek"));
    const endWeek = parseWeekParam(url.searchParams.get("endWeek"));

    const params = new URLSearchParams();
    if (startWeek !== null) params.set("startWeek", String(startWeek));
    if (endWeek !== null) params.set("endWeek", String(endWeek));

    const query = params.toString();
    const target = query
      ? `${getHubUrl()}/fractions/actively-delegated-by-week?${query}`
      : `${getHubUrl()}/fractions/actively-delegated-by-week`;

    const response = await fetch(target, { next: { revalidate: 120 } });
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Hub error ${response.status}: ${text}` },
        { status: response.status, headers: CACHE_HEADERS }
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
