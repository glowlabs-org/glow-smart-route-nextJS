import { NextResponse } from "next/server";

export const runtime = "nodejs";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  try {
    if (!HUB_URL) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_HUB_URL is not set" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const target = `${HUB_URL}/glw/vesting-schedule`;
    const response = await fetch(target, { next: { revalidate: 300 } });
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Hub error ${response.status}: ${text}` },
        { status: response.status, headers: CACHE_HEADERS }
      );
    }

    // Endpoint may return CSV or JSON; we forward as both a text blob and best-effort JSON.
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await response.json();
      return NextResponse.json(
        { type: "json", json, csv: null as string | null },
        { headers: CACHE_HEADERS }
      );
    }

    const csv = await response.text();
    return NextResponse.json(
      { type: "csv", json: null as unknown | null, csv },
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

