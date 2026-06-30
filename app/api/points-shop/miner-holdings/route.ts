import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

// GET /api/points-shop/miner-holdings?wallet=0x...
// The wallet's points-shop miner holdings aggregated per source farm, with the
// weekly GLW reward computed server-side from the un-redacted grant split (the
// split itself is never returned — PB-1). Per-wallet; never cached.
export async function GET(request: NextRequest) {
  return proxyCrmGet(request, "points-shop/miner-holdings");
}
