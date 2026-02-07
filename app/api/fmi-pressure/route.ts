import { NextResponse } from "next/server";

export const runtime = "nodejs";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;
const DEFAULT_PONDER_URL =
  "https://glow-ponder-listener-2-production.up.railway.app";
const DEFAULT_ADDRESS = "0x0b650820dde452b204de44885fc0fbb788fc5e37";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

function getPonderUrl(): string {
  return process.env.NEXT_PUBLIC_POSITIONS_API_BASE || DEFAULT_PONDER_URL;
}

// CRM FMI endpoints should be treated as USD "micro" units (1e6) for
// consistency with Ponder's existing buy/sell pressure payloads.
function parseUsdMicrosOptional(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return BigInt(Math.round(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // If backend accidentally returns a decimal, still treat it as micros.
    if (trimmed.includes(".")) {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return null;
      return BigInt(Math.round(n));
    }
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }

  return null;
}

function parseUsdMicros(value: unknown): bigint {
  return parseUsdMicrosOptional(value) ?? 0n;
}

async function fetchDexBuyForWeek(
  week: number
): Promise<{ buyMicros: bigint; buySwaps: number } | null> {
  if (!Number.isFinite(week) || week <= 0) return null;
  try {
    const target = `${getPonderUrl()}/fmi/sell-pressure?range=12w`;
    const res = await fetch(target, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const payload = await res.json();
    const series = Array.isArray(payload?.series) ? payload.series : [];
    const match = series.find((row: any) => Number(row?.week) === week);
    if (!match) return null;
    const buyMicros = parseUsdMicros(match?.buy?.usdg);
    const buySwapsRaw = Number(match?.buy?.swaps ?? 0);
    const buySwaps = Number.isFinite(buySwapsRaw) ? buySwapsRaw : 0;
    return { buyMicros, buySwaps };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "7d";
    const address = (url.searchParams.get("address") || DEFAULT_ADDRESS).trim();

    // Spec source: CRM `/fmi/pressure` (latest week).
    // We keep a fallback to the old Ponder buy/sell pressure while backend
    // deployments catch up, so the dashboard continues to render.
    if (HUB_URL) {
      const hubTarget = `${HUB_URL}/fmi/pressure`;
      const hubRes = await fetch(hubTarget, { next: { revalidate: 60 } });
      if (hubRes.ok) {
        const payload = await hubRes.json();
        // CRM shape (expected):
        // - miner_sales_weekly_usd
        // - gctl_mints_weekly_usd
        // - pol_yield_weekly_usd
        // - dex_sell_pressure_weekly_usd
        // If the backend already returns the legacy structure, pass through.
        const maybeLegacy = payload?.buySellPressure ?? payload ?? null;
        const hasLegacyBuckets =
          maybeLegacy &&
          typeof maybeLegacy === "object" &&
          "buy" in maybeLegacy &&
          "sell" in maybeLegacy;

        if (hasLegacyBuckets) {
          return NextResponse.json(
            { buySellPressure: maybeLegacy },
            { headers: CACHE_HEADERS }
          );
        }

        const dexSellMicros = parseUsdMicros(
          payload?.dex_sell_pressure_weekly_usd
        );

        // For now, buy pressure is DEX buys only (USDG -> GLW swaps).
        const weekRaw = Number(payload?.week);
        const dexBuy =
          Number.isFinite(weekRaw) && weekRaw > 0
            ? await fetchDexBuyForWeek(weekRaw)
            : null;
        const buyMicros = dexBuy?.buyMicros ?? 0n;
        const buySwaps = dexBuy?.buySwaps ?? 0;
        const sellMicros = dexSellMicros > 0n ? dexSellMicros : 0n;
        const netMicros = buyMicros - sellMicros;

        const buySellPressure = {
          range: "week",
          seconds: 7 * 24 * 60 * 60,
          buy: { glw: "0", usdg: buyMicros.toString(), swaps: buySwaps },
          sell: { glw: "0", usdg: sellMicros.toString(), swaps: 0 },
          net: { glw: "0", usdg: netMicros.toString() },
        };
        return NextResponse.json(
          { buySellPressure },
          { headers: CACHE_HEADERS }
        );
      }
      // If hub is present but failing, fall through to ponder.
    }

    const target = `${getPonderUrl()}/get-liquidity-positions/${address}?pressureRange=${encodeURIComponent(
      range
    )}`;

    const response = await fetch(target, { next: { revalidate: 60 } });
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Ponder error ${response.status}: ${text}` },
        { status: response.status, headers: CACHE_HEADERS }
      );
    }

    const payload = await response.json();
    return NextResponse.json(
      { buySellPressure: payload?.buySellPressure ?? null },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
