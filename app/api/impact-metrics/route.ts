import { NextResponse } from "next/server";
import {
  secondsUntilNextSundayUtc,
  STALE_WHILE_REVALIDATE_SECONDS,
} from "@/lib/time/sunday-cache";

export async function GET() {
  try {
    const sMaxAge = secondsUntilNextSundayUtc();
    const res = await fetch("https://glow.org/api/impact-metrics", {
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
