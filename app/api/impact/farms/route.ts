import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

// GET /api/impact/farms?sort=&dir=&limit=
// Protocol-wide impact per farm: every funded farm with its full total watts +
// carbon credits. Public, network-wide; short shared cache.
export async function GET(request: NextRequest) {
  return proxyCrmGet(request, "impact-v2/farms", {
    cacheControl: "public, s-maxage=120, stale-while-revalidate=300",
  });
}
