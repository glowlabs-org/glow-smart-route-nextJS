import { NextResponse } from "next/server";

const PONDER_URL = "https://glow-ponder-listener-2-production.up.railway.app/";

const QUERY = `{
  totalGlowPayouts(id: "1") {
    totalGlowPayouts
  }
}`;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

export async function GET() {
  try {
    const response = await fetch(PONDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: QUERY }),
      next: { revalidate: 60 },
    });

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
