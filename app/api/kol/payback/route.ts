import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { isKolWallet } from "@/lib/kol";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

if (!HUB_URL) {
  throw new Error("NEXT_PUBLIC_HUB_URL is not set");
}

const ALLOWED_QUERY_KEYS = ["startWeek", "endWeek"] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, signature, message } = body as {
      walletAddress?: string;
      signature?: string;
      message?: string;
    };

    if (!walletAddress || !signature || !message) {
      return NextResponse.json(
        { error: "walletAddress, signature, and message are required" },
        { status: 400 }
      );
    }

    const normalized = walletAddress.toLowerCase();

    if (!isKolWallet(normalized)) {
      return NextResponse.json(
        { error: "Wallet is not an approved KoL" },
        { status: 403 }
      );
    }

    // Verify the signature proves wallet ownership
    try {
      const valid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
      if (!valid) throw new Error("Invalid signature");
    } catch {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Build the backend URL
    const backendUrl = new URL(
      `${HUB_URL}/fractions/mining-center-kol-payback-export`
    );

    // Forward allowed query params from the URL
    const reqUrl = new URL(request.url);
    for (const key of ALLOWED_QUERY_KEYS) {
      const value = reqUrl.searchParams.get(key);
      if (value) {
        backendUrl.searchParams.set(key, value);
      }
    }

    // Also check body for range params
    if (body.startWeek) backendUrl.searchParams.set("startWeek", String(body.startWeek));
    if (body.endWeek) backendUrl.searchParams.set("endWeek", String(body.endWeek));
    if (!backendUrl.searchParams.has("startWeek")) {
      backendUrl.searchParams.set("rangePreset", body.rangePreset || "all_time");
    }

    const response = await fetch(backendUrl.toString(), { cache: "no-store" });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Backend error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Filter to only this KoL's data
    const kolData = data.kols?.find(
      (k: { kolWallet: string }) => k.kolWallet.toLowerCase() === normalized
    );

    return NextResponse.json({
      range: data.range,
      program: data.program,
      summary: data.summary,
      kol: kolData || null,
    });
  } catch (error) {
    console.error("KoL payback API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
