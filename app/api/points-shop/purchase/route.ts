import type { NextRequest } from "next/server";
import { proxyCrmPost } from "@/app/api/_shared/crm-proxy";

// POST /api/points-shop/purchase
// Forwards the EIP-712-signed purchase body. Never cached. Upstream
// status (200 / 401 / 404 / 409) is passed through so the client can
// surface typed errors.
export async function POST(request: NextRequest) {
  return proxyCrmPost(request, "points-shop/purchase");
}
