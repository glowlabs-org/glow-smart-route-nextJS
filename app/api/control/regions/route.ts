import { NextResponse } from "next/server";
import type { RegionWithMetadata } from "@glowlabs-org/utils/browser";
import { fetchControlJson } from "@/lib/server/control-read";

export const runtime = "nodejs";

const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const isActive = url.searchParams.get("isActive");
    const search = new URLSearchParams();
    if (isActive === "true" || isActive === "false") {
      search.set("isActive", isActive);
    }

    const path = search.size > 0 ? `/regions/all?${search.toString()}` : "/regions/all";
    const payload = await fetchControlJson<{ regions: RegionWithMetadata[] }>(path, {
      revalidate: 300,
    });

    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
