import { NextResponse } from "next/server";

export const runtime = "nodejs";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
};

interface RevenueFarmRow {
  farm_id?: string;
  farmId?: string;
  id?: string;
  name?: string;
  farm_name?: string;
  zone_id?: number | string | null;
  zoneId?: number | string | null;
  panels?: number | string | null;
}

interface CompletedFarmRow {
  farm?: {
    id?: string | null;
    name?: string | null;
  } | null;
  lat?: number | string | null;
  lng?: number | string | null;
  zone?: {
    id?: number | string | null;
    name?: string | null;
  } | null;
  installFinishedDate?: string | null;
  revisedInstallFinishedDate?: string | null;
  gcaAcceptanceTimestamp?: string | null;
  createdAt?: string | null;
}

interface LatestLocation {
  lat: number;
  lng: number;
  zoneId: number | null;
  zoneName: string | null;
  timestamp: number;
}

function toFiniteNumber(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function toFiniteInteger(value: unknown): number | null {
  const n = toFiniteNumber(value);
  if (n === null) return null;
  return Math.trunc(n);
}

function parseTimestamp(value: unknown): number {
  if (typeof value !== "string" || !value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getBestTimestamp(row: CompletedFarmRow): number {
  return Math.max(
    parseTimestamp(row.installFinishedDate),
    parseTimestamp(row.revisedInstallFinishedDate),
    parseTimestamp(row.gcaAcceptanceTimestamp),
    parseTimestamp(row.createdAt)
  );
}

function buildLatestLocationByFarm(completedRows: CompletedFarmRow[]) {
  const byFarm = new Map<string, LatestLocation>();

  for (const row of completedRows) {
    const farmId = row.farm?.id ? String(row.farm.id) : null;
    if (!farmId) continue;

    const lat = toFiniteNumber(row.lat);
    const lng = toFiniteNumber(row.lng);
    if (lat === null || lng === null) continue;

    const timestamp = getBestTimestamp(row);
    const zoneId = toFiniteInteger(row.zone?.id);
    const zoneName =
      typeof row.zone?.name === "string" && row.zone.name.trim().length > 0
        ? row.zone.name.trim()
        : null;
    const existing = byFarm.get(farmId);

    if (!existing || timestamp >= existing.timestamp) {
      byFarm.set(farmId, {
        lat,
        lng,
        zoneId,
        zoneName,
        timestamp,
      });
    }
  }

  return byFarm;
}

export async function GET() {
  try {
    if (!HUB_URL) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_HUB_URL is not set" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const farmsTarget = `${HUB_URL}/pol/revenue/farms?range=90d`;
    const completedTarget = `${HUB_URL}/applications/completed`;

    const [farmsRes, completedRes] = await Promise.all([
      fetch(farmsTarget, { next: { revalidate: 300 } }),
      fetch(completedTarget, { next: { revalidate: 300 } }),
    ]);

    if (!farmsRes.ok) {
      const text = await farmsRes.text();
      return NextResponse.json(
        { error: `Hub error ${farmsRes.status}: ${text}` },
        { status: farmsRes.status, headers: CACHE_HEADERS }
      );
    }

    const farmsPayload = await farmsRes.json();
    const farms: RevenueFarmRow[] = Array.isArray(farmsPayload)
      ? farmsPayload
      : Array.isArray(farmsPayload?.farms)
      ? farmsPayload.farms
      : [];

    const completedPayload = completedRes.ok ? await completedRes.json() : [];
    const completedRows: CompletedFarmRow[] = Array.isArray(completedPayload)
      ? completedPayload
      : [];
    const latestLocationByFarm = buildLatestLocationByFarm(completedRows);

    const enriched = farms
      .map((farm, index) => {
        const farmId = farm.farm_id ?? farm.farmId ?? farm.id ?? null;
        if (!farmId) return null;

        const key = String(farmId);
        const location = latestLocationByFarm.get(key);

        return {
          farmId: key,
          name: farm.name ?? farm.farm_name ?? `Farm ${index + 1}`,
          zoneId:
            toFiniteInteger(farm.zone_id ?? farm.zoneId) ??
            location?.zoneId ??
            null,
          zoneName: location?.zoneName ?? null,
          panels: Math.max(0, toFiniteInteger(farm.panels) ?? 0),
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => b.panels - a.panels);

    const mappedFarms = enriched.filter(
      (farm) => farm.lat !== null && farm.lng !== null
    );
    const uniqueZones = new Set(
      mappedFarms
        .map((farm) => farm.zoneId)
        .filter((zoneId): zoneId is number => typeof zoneId === "number")
    ).size;
    const zoneSummaryById = new Map<
      number,
      { zoneId: number; zoneName: string; farmCount: number; panelCount: number }
    >();

    for (const farm of enriched) {
      if (farm.zoneId === null) continue;

      const zoneId = farm.zoneId;
      const zoneName =
        farm.zoneName ??
        (zoneId === 1
          ? "Clean Grid Project"
          : zoneId === 2
          ? "Golden Colorado"
          : zoneId === 3
          ? "Noble Oklahoma"
          : zoneId === 4
          ? "Rising Utah"
          : zoneId === 5
          ? "Shining Missouri"
          : `Zone ${zoneId}`);
      const existing = zoneSummaryById.get(zoneId);

      if (!existing) {
        zoneSummaryById.set(zoneId, {
          zoneId,
          zoneName,
          farmCount: 1,
          panelCount: farm.panels,
        });
        continue;
      }

      existing.farmCount += 1;
      existing.panelCount += farm.panels;
    }

    const zones = Array.from(zoneSummaryById.values()).sort(
      (a, b) => b.farmCount - a.farmCount
    );

    return NextResponse.json(
      {
        farms: enriched,
        summary: {
          farmCount: enriched.length,
          mappedFarmCount: mappedFarms.length,
          uniqueZones,
          zones,
        },
      },
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
