import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function getHubUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  }
  return value;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const forward = new URL(`${getHubUrl()}/fractions/splits-activity`);
    const allowedParams = ["limit", "walletAddress"] as const;

    for (const key of allowedParams) {
      const value = url.searchParams.get(key);
      if (!value) continue;
      forward.searchParams.set(key, value);
    }

    const response = await fetch(forward.toString(), {
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: text || `Hub error ${response.status}` },
        { status: response.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    const payload = await response.json();
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
