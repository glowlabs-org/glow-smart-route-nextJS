import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";
import { secondsUntilNextShopRestock } from "@/lib/time/shop-restock";

// GET /api/points-shop/current
// Public weekly inventory. Cached until the next Tuesday 9 AM ET restock,
// with a stale-while-revalidate tail so the swap is seamless.
export async function GET(request: NextRequest) {
  // Cap inventory freshness at 60s: the weekly catalog rarely changes, but
  // inventoryRemaining decrements per sale, so caching for the full restock
  // window (up to ~7 days) would keep showing sold-out items as available
  // (user signs, then hits a 409). The SWR tail still hides revalidation
  // latency.
  const sMaxAge = Math.min(secondsUntilNextShopRestock(), 60);
  return proxyCrmGet(request, "points-shop/current", {
    cacheControl: `public, s-maxage=${sMaxAge}, stale-while-revalidate=300`,
  });
}
