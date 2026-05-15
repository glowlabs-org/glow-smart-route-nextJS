import type { NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

// GET /api/points/ledger?wallet=0x...&limit=&cursor=&eventType=&since=
// Per-wallet; never cached.
export async function GET(request: NextRequest) {
  return proxyCrmGet(request, "points/ledger");
}
