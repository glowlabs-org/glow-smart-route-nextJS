import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

// GET /api/points/balance?wallet=0x...
// Per-wallet; never cached.
export async function GET(request: NextRequest) {
  return proxyCrmGet(request, "points/balance");
}
