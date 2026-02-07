import { NextResponse } from "next/server";

export const runtime = "nodejs";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

export async function GET() {
  try {
    if (!HUB_URL) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_HUB_URL is not set" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const target = `${HUB_URL}/pol/revenue/farms?range=90d`;
    const response = await fetch(target, { next: { revalidate: 60 } });
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Hub error ${response.status}: ${text}` },
        { status: response.status, headers: CACHE_HEADERS }
      );
    }

    const payload = await response.json();
    // Normalize array responses into an object so the frontend can rely on a stable shape.
    const normalized = Array.isArray(payload) ? { farms: payload } : payload;
    return NextResponse.json(normalized, { headers: CACHE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
