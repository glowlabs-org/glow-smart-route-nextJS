import { NextResponse } from "next/server";
import { fetchControlJson } from "@/lib/server/control-read";

export const runtime = "nodejs";

const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
};

export async function GET() {
  try {
    const payload = await fetchControlJson<{ holders: number }>("/holders/count", {
      revalidate: 60,
    });

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
