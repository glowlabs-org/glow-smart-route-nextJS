import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120",
};

function getHubUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  }
  return value;
}

function parseBooleanFlag(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === "true" || normalized === "1";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const includeApy = parseBooleanFlag(url.searchParams.get("includeApy"));

    const params = new URLSearchParams();
    if (includeApy) {
      params.set("includeApy", "true");
    }

    const query = params.toString();
    const target = query
      ? `${getHubUrl()}/fractions/total-actively-delegated?${query}`
      : `${getHubUrl()}/fractions/total-actively-delegated`;

    const response = await fetch(target, { next: { revalidate: 60 } });
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Hub error ${response.status}: ${text}` },
        { status: response.status, headers: CACHE_HEADERS }
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
