import { NextResponse } from "next/server";
import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";

export async function GET() {
  const ethPriceUsd = await getEthPriceInUSD();

  const headers = {
    // Let the platform cache it briefly and serve stale values while revalidating.
    "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
  };

  if (!ethPriceUsd) {
    return NextResponse.json({ ethPriceUsd: null }, { status: 503, headers });
  }

  return NextResponse.json({ ethPriceUsd }, { status: 200, headers });
}

