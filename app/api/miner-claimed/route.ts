import { NextResponse } from "next/server";

const PONDER_URL = "https://glow-ponder-listener-2-production.up.railway.app/";
const TOTAL_GLOW_PAYOUTS_PATH = "/rewards/total-glow-payouts";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

export async function GET() {
  try {
    const url = new URL(TOTAL_GLOW_PAYOUTS_PATH, PONDER_URL);
    const response = await fetch(url, { next: { revalidate: 60 } });

    if (!response.ok) {
      const text = await response.text();
      const headers =
        response.status === 503
          ? { "Cache-Control": "no-store" }
          : CACHE_HEADERS;
      return NextResponse.json(
        { error: `Ponder error ${response.status}: ${text}` },
        { status: response.status, headers }
      );
    }

    const payload = (await response.json()) as {
      totalGlowPayouts?: string;
      indexingComplete?: boolean;
      error?: string;
    };

    if (!payload.indexingComplete) {
      return NextResponse.json(
        { error: payload.error ?? "Ponder is still indexing" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        data: {
          totalGlowPayouts: {
            totalGlowPayouts: payload.totalGlowPayouts ?? "0",
          },
        },
      },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
