import { NextResponse } from "next/server";
import type { FarmImagesBatchQuery, FarmImagesBatchResponse } from "@glowlabs-org/utils/browser";
import { getControlApiUrl } from "@/lib/server/control-read";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FarmImagesBatchQuery;
    const farmIds = Array.isArray(body?.farmIds)
      ? body.farmIds.filter((farmId): farmId is string => typeof farmId === "string")
      : [];

    if (farmIds.length === 0) {
      return NextResponse.json({ results: {} } satisfies FarmImagesBatchResponse, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const response = await fetch(`${getControlApiUrl()}/farms/images/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ farmIds }),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: text || `Control error ${response.status}` },
        { status: response.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    const payload = (await response.json()) as FarmImagesBatchResponse;
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
