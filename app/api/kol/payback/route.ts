import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { isKolWallet } from "@/lib/kol";
import { isValidReferralDashboardPassword } from "@/lib/referral-dashboard-auth";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

if (!HUB_URL) {
  throw new Error("NEXT_PUBLIC_HUB_URL is not set");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, signature, message, adminPassword } = body as {
      walletAddress?: string;
      signature?: string;
      message?: string;
      adminPassword?: string;
    };

    if (!walletAddress) {
      return NextResponse.json(
        { error: "walletAddress is required" },
        { status: 400 }
      );
    }

    const normalized = walletAddress.toLowerCase();

    if (!isKolWallet(normalized)) {
      return NextResponse.json(
        { error: "Wallet is not an approved ambassador" },
        { status: 403 }
      );
    }

    // Auth: either admin password OR valid wallet signature
    const isAdmin = adminPassword && isValidReferralDashboardPassword(adminPassword);

    if (!isAdmin) {
      if (!signature || !message) {
        return NextResponse.json(
          { error: "signature and message are required" },
          { status: 400 }
        );
      }

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
    }

    // Build the backend URL
    const backendUrl = new URL(
      `${HUB_URL}/fractions/mining-center-kol-payback-export`
    );

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

    // Filter to ONLY this KoL's data (never expose other KoLs)
    const kolData = data.kols?.find(
      (k: { kolWallet: string }) => k.kolWallet.toLowerCase() === normalized
    );

    // Strip sensitive fields: don't expose other KoL wallets or aggregate totals.
    // For the master-referrer program, surface only program-level parameters
    // (percent, start date, rule). The `assignments` list is admin-only and
    // omitted here since it names other KoL wallets.
    const safeProgram = {
      paybackPercent: data.program.paybackPercent,
      baseCommissionPercent: data.program.baseCommissionPercent,
      maxEcosystemBonusPercent: data.program.maxEcosystemBonusPercent,
      rollingDelegationWindowDays: data.program.rollingDelegationWindowDays,
      ecosystemBonusFormula: data.program.ecosystemBonusFormula,
      ecosystemBonusAssets: data.program.ecosystemBonusAssets ?? null,
      startedAt: data.program.startedAt,
      eligibilityRule: data.program.eligibilityRule,
      masterReferrer: data.program.masterReferrer
        ? {
            overridePercent: data.program.masterReferrer.overridePercent,
            startedAt: data.program.masterReferrer.startedAt,
            startedAtWeek: data.program.masterReferrer.startedAtWeek,
            rule: data.program.masterReferrer.rule,
          }
        : null,
    };

    return NextResponse.json({
      range: data.range,
      program: safeProgram,
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
