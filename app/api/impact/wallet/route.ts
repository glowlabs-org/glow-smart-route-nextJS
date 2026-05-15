import { NextResponse, type NextRequest } from "next/server";
import { proxyCrmGet } from "@/app/api/_shared/crm-proxy";

const WALLET_REGEX = /^0x[0-9a-fA-F]{40}$/;

// GET /api/impact/wallet?wallet=0x...
// The CRM route is path-param-shaped (`/impact-v2/wallet/:wallet`); this
// wrapper takes the wallet as a query param to match the frontend's
// other `?wallet=` routes. Per-wallet; never cached.
export async function GET(request: NextRequest) {
  const wallet = new URL(request.url).searchParams.get("wallet")?.trim();
  if (!wallet || !WALLET_REGEX.test(wallet)) {
    return NextResponse.json(
      { error: "wallet query param is required (0x-prefixed 40-hex)" },
      { status: 400 },
    );
  }
  return proxyCrmGet(request, `impact-v2/wallet/${wallet}`);
}
