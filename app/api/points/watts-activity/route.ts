import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

// GET /api/points/watts-activity?wallet=0x...&limit=
// Per-wallet; never cached.
export async function GET(request: NextRequest) {
  return proxyCrmGet(request, "points/watts-activity");
}
