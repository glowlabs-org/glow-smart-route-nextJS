import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_PONDER_URL =
  "https://glow-ponder-listener-2-production.up.railway.app";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

function getPonderUrl(): string {
  // Prefer env, but keep a sane production default so local env misconfig
  // doesn't break the internal dashboard.
  return process.env.NEXT_PUBLIC_POSITIONS_API_BASE || DEFAULT_PONDER_URL;
}

export async function GET() {
  try {
    const target = `${getPonderUrl()}/pol/summary`;
    const response = await fetch(target, { next: { revalidate: 60 } });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Ponder error ${response.status}: ${text}` },
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

