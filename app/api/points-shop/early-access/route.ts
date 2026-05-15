import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

// GET /api/points-shop/early-access?wallet=0x...&includeExpired=
// Per-wallet entitlements; never cached.
export async function GET(request: NextRequest) {
  return proxyCrmGet(request, "points-shop/early-access");
}
