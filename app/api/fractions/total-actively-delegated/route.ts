import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

export const runtime = "nodejs";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

function getHubUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  }
  return value;
}

async function fetchTotalActivelyDelegated(includeApy: boolean) {
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
    throw new Error(`Hub error ${response.status}: ${text}`);
  }

  return response.json();
}

const getCachedTotalActivelyDelegated = unstable_cache(
  async (includeApy: boolean) => fetchTotalActivelyDelegated(includeApy),
  ["total-actively-delegated"],
  { revalidate: 60, tags: ["total-actively-delegated"] }
);

const getCachedTotalActivelyDelegatedWithApy = unstable_cache(
  async (includeApy: boolean) => fetchTotalActivelyDelegated(includeApy),
  ["total-actively-delegated-with-apy"],
  { revalidate: 60, tags: ["total-actively-delegated"] }
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const includeApyRaw = url.searchParams.get("includeApy");
    const includeApy =
      includeApyRaw !== null &&
      (includeApyRaw.toLowerCase() === "true" || includeApyRaw === "1");

    const payload = includeApy
      ? await getCachedTotalActivelyDelegatedWithApy(true)
      : await getCachedTotalActivelyDelegated(false);

    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
