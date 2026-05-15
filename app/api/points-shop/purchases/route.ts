import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

// GET /api/points-shop/purchases?wallet=0x...&limit=
// Per-wallet purchase history; never cached.
export async function GET(request: NextRequest) {
  return proxyCrmGet(request, "points-shop/purchases");
}
