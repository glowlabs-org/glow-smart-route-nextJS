import { NextResponse, type NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

// GET /api/impact/estimate-allocation?fractionId=0x...&quantity=2
// Proxies to the CRM `GET /impact-v2/estimate-allocation` (pre-purchase
// watts-per-unit estimate). Per-purchase; never cached.
export async function GET(request: NextRequest) {
  const fractionId = new URL(request.url).searchParams
    .get("fractionId")
    ?.trim();
  if (!fractionId) {
    return NextResponse.json(
      { error: "fractionId query param is required" },
      { status: 400 },
    );
  }
  return proxyCrmGet(request, "impact-v2/estimate-allocation");
}
