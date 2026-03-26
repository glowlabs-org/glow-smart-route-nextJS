import { NextResponse } from "next/server";
import { getCompletedApplications } from "@/lib/server/completed-applications";

export const runtime = "nodejs";

const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  try {
    const payload = await getCompletedApplications();
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
