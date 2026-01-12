import { NextResponse } from "next/server";
import { getCachedHeadlineStats } from "@/lib/server/headline-stats";

export const runtime = "nodejs";

export async function GET() {
  try {
    const stats = await getCachedHeadlineStats();

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load headline stats",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


