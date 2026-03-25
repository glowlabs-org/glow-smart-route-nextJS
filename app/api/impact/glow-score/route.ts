import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getHubUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  }
  return value;
}

function buildCacheHeaders(params: {
  hasWalletAddress: boolean;
  includeWeekly: boolean;
  includeProjection: boolean;
  summaryOnly: boolean;
}) {
  if (!params.hasWalletAddress) {
    return {
      "Cache-Control":
        "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    };
  }

  if (params.summaryOnly) {
    return {
      "Cache-Control":
        "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
    };
  }

  if (params.includeProjection) {
    return {
      "Cache-Control":
        "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
    };
  }

  if (params.includeWeekly) {
    return {
      "Cache-Control":
        "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    };
  }

  return {
    "Cache-Control":
      "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get("walletAddress");
    const includeWeekly = ["1", "true"].includes(
      (url.searchParams.get("includeWeekly") || "").toLowerCase()
    );
    const includeProjection = !["0", "false"].includes(
      (url.searchParams.get("includeProjection") || "1").toLowerCase()
    );
    const summaryOnly = ["1", "true"].includes(
      (url.searchParams.get("summaryOnly") || "").toLowerCase()
    );

    const forward = new URL(`${getHubUrl()}/impact/glow-score`);
    const allowedParams = [
      "walletAddress",
      "startWeek",
      "endWeek",
      "limit",
      "includeWeekly",
      "includeProjection",
      "includeReferral",
      "summaryOnly",
      "sort",
      "dir",
    ] as const;

    for (const key of allowedParams) {
      const value = url.searchParams.get(key);
      if (value == null || value === "") continue;
      forward.searchParams.set(key, value);
    }

    const headers = buildCacheHeaders({
      hasWalletAddress: Boolean(walletAddress),
      includeWeekly,
      includeProjection,
      summaryOnly,
    });
    const revalidateSeconds = walletAddress
      ? summaryOnly || includeProjection
        ? 30
        : includeWeekly
        ? 300
        : 300
      : 60;

    const response = await fetch(forward.toString(), {
      next: { revalidate: revalidateSeconds },
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: text || `Hub error ${response.status}` },
        { status: response.status, headers }
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
