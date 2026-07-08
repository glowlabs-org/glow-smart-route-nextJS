import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 31536000; // weekly reports are immutable once posted

// Cloudflare R2 public bucket holding the immutable weekly merkle-proof reports.
// We fetch it SERVER-SIDE here so the browser only ever talks to app.glow.org.
// The public `*.r2.dev` domain is network-blocked by some ISPs / regions (e.g.
// Greece), which otherwise leaves the claims panel stuck forever on
// "Loading proof…" and fires the "no claimable proofs" toast — even though the
// user's proof exists and is valid on-chain. Overridable via env if the bucket
// ever moves or gets a branded custom domain.
const R2_BASE =
  process.env.MERKLE_PROOF_R2_BASE_URL ??
  "https://pub-311748c72106476cbeabe0a22a59217d.r2.dev";

const CACHE_HEADERS = {
  // Immutable per week: cache hard at the edge, allow the browser a short TTL.
  "Cache-Control": "public, max-age=3600, s-maxage=31536000, immutable",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ week: string }> }
) {
  const { week } = await params;

  if (!/^\d+$/.test(week) || Number(week) > 100_000) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const upstream = await fetch(
      `${R2_BASE}/weekly-report-week-${week}.json`,
      { signal: controller.signal, next: { revalidate } }
    ).finally(() => clearTimeout(timeout));

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Weekly report for week ${week} not found` },
        {
          status: upstream.status === 404 ? 404 : 502,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // Pass the JSON straight through (do not re-parse: these payloads are ~1MB).
    const body = await upstream.text();
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json", ...CACHE_HEADERS },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upstream proxy error" },
      { status: 504, headers: { "Cache-Control": "no-store" } }
    );
  }
}
