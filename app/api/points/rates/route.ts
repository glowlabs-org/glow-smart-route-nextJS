import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

// GET /api/points/rates
// Shared config; rates only change via an admin script. Cache 5 minutes.
export async function GET(request: NextRequest) {
  return proxyCrmGet(request, "points/rates", {
    cacheControl: "public, s-maxage=300, stale-while-revalidate=600",
  });
}
