import { NextRequest, NextResponse } from "next/server";
import type { MiningScoreParams } from "@glowlabs-org/utils/browser";
import { getCachedMiningScoresBatch } from "@/lib/server/mining-scores";
import type { ExtraLiveFarmInput } from "@/lib/mining-score";

export const runtime = "nodejs";

interface MiningScoresBatchRequestBody {
  farms: MiningScoreParams[];
  extraLiveFarms?: ExtraLiveFarmInput[];
}

function parseRequestBody(body: unknown): MiningScoresBatchRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const maybeFarms = (body as { farms?: unknown }).farms;
  const maybeExtraLiveFarms = (body as { extraLiveFarms?: unknown }).extraLiveFarms;
  if (!Array.isArray(maybeFarms)) return null;
  return {
    farms: maybeFarms as MiningScoreParams[],
    extraLiveFarms: Array.isArray(maybeExtraLiveFarms)
      ? (maybeExtraLiveFarms as ExtraLiveFarmInput[])
      : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = parseRequestBody(await request.json());
    if (!requestBody || requestBody.farms.length === 0) {
      return NextResponse.json(
        { error: "Invalid request body. Expected { farms: MiningScoreParams[] }." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = await getCachedMiningScoresBatch(
      requestBody.farms,
      requestBody.extraLiveFarms ?? []
    );

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load mining scores batch",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
