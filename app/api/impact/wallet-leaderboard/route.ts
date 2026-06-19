import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

// GET /api/impact/wallet-leaderboard?sort=&limit=&startWeek=&endWeek=
// Unified wallet leaderboard: ranks by vaultedGlw (default), watts, or
// carbonCredits, unioning delegators with V2 impact-earning wallets. Public;
// short shared cache.
export async function GET(request: NextRequest) {
  return proxyCrmGet(request, "impact/wallet-leaderboard", {
    cacheControl: "public, s-maxage=60, stale-while-revalidate=120",
  });
}
