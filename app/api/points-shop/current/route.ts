import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";
import { secondsUntilNextShopRestock } from "@/lib/time/shop-restock";

// GET /api/points-shop/current
// Public weekly inventory. Cached until the next Tuesday 1 PM ET restock,
// with a stale-while-revalidate tail so the swap is seamless.
export async function GET(request: NextRequest) {
  const sMaxAge = secondsUntilNextShopRestock();
  return proxyCrmGet(request, "points-shop/current", {
    cacheControl: `public, s-maxage=${sMaxAge}, stale-while-revalidate=300`,
  });
}
