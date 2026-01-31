import { NextResponse } from "next/server";

const PONDER_URL = "https://glow-ponder-listener-2-production.up.railway.app";
const DEFAULT_ADDRESS = "0x0b650820dde452b204de44885fc0fbb788fc5e37";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "7d";
    const address = (url.searchParams.get("address") || DEFAULT_ADDRESS).trim();

    const target = `${PONDER_URL}/get-liquidity-positions/${address}?pressureRange=${encodeURIComponent(
      range
    )}`;

    const response = await fetch(target, { next: { revalidate: 60 } });
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Ponder error ${response.status}: ${text}` },
        { status: response.status, headers: CACHE_HEADERS }
      );
    }

    const payload = await response.json();
    return NextResponse.json(
      { buySellPressure: payload?.buySellPressure ?? null },
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
