import { NextRequest, NextResponse } from "next/server";
import { getFinalizedReportWeek } from "@/utils/getFinalizedReportWeek";

export const dynamic = "force-dynamic";

interface CacheEntry {
  data: any;
  rolloverWeek: number;
  params: string;
}

const cache = new Map<string, CacheEntry>();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const farmId = searchParams.get("farmId");
    const startWeek = searchParams.get("startWeek");
    const endWeek = searchParams.get("endWeek");

    const cacheKey =
      [farmId, startWeek, endWeek].filter(Boolean).join("-") || "all";
    const explicitEndWeek = endWeek ? Number.parseInt(endWeek, 10) : null;
    const rolloverWeek =
      explicitEndWeek !== null && Number.isFinite(explicitEndWeek)
        ? explicitEndWeek
        : getFinalizedReportWeek();

    const cached = cache.get(cacheKey);
    if (cached && cached.rolloverWeek === rolloverWeek) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": "public, max-age=3600",
          "X-Cache": "HIT",
        },
      });
    }

    const hubSearchParams = new URLSearchParams();
    if (farmId) hubSearchParams.append("farmId", farmId);
    if (startWeek) hubSearchParams.append("startWeek", startWeek);
    if (endWeek) hubSearchParams.append("endWeek", endWeek);

    const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;
    if (!HUB_URL) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_HUB_URL is not set" },
        { status: 500 }
      );
    }

    const url = `${HUB_URL}/fractions/farms-per-piece-stats?${hubSearchParams.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch data: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    cache.set(cacheKey, {
      data,
      rolloverWeek,
      params: cacheKey,
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Error fetching farms per-piece stats:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
