import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

// GET /api/impact/leaderboard?sort=&dir=&limit=&region=
// Public leaderboard; short shared cache.
export async function GET(request: NextRequest) {
  return proxyCrmGet(request, "impact-v2/leaderboard", {
    cacheControl: "public, s-maxage=60, stale-while-revalidate=120",
  });
}
