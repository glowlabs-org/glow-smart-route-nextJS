import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

// GET /api/impact/leaderboard?sort=&dir=&limit=&offset=&regionId=
// Public leaderboard; short shared cache. `regionId` (optional) scopes the
// ranking to one region and enables the `policyCredits` sort.
export async function GET(request: NextRequest) {
  return proxyCrmGet(request, "impact-v2/leaderboard", {
    cacheControl: "public, s-maxage=60, stale-while-revalidate=120",
  });
}
