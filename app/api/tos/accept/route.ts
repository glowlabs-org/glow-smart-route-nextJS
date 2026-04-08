import { NextRequest, NextResponse } from "next/server";
import {
  REFERRAL_ATTRIBUTION_COOKIE,
  parseStoredReferralAttribution,
} from "@/lib/referral-attribution";

type AcceptTosBody = {
  wallet?: string;
  signature?: string;
  nonce?: string;
  tosVersion?: string;
  tosHash?: string;
  message?: string;
  deadline?: string;
};

type AutoLinkResult = {
  attempted: boolean;
  linked: boolean;
  referralCode?: string;
  error?: string;
  responseStatus?: number;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function readErrorMessage(response: Response) {
  const text = await response.text();
  if (!text) {
    return `Request failed with status ${response.status}`;
  }

  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === "string" && parsed.error.length > 0) {
      return parsed.error;
    }
    if (typeof parsed.message === "string" && parsed.message.length > 0) {
      return parsed.message;
    }
  } catch {
    // Ignore JSON parse errors and fall back to the raw response text.
  }
  return text;
}

async function attemptAutoLink(
  wallet: string,
  request: NextRequest
): Promise<AutoLinkResult> {
  const hubUrl = getRequiredEnv("NEXT_PUBLIC_HUB_URL");
  const autoLinkSecret = getRequiredEnv("REFERRAL_AUTO_LINK_SECRET");
  if (!hubUrl || !autoLinkSecret) {
    return { attempted: false, linked: false, error: "Auto-link not configured" };
  }

  const attribution = parseStoredReferralAttribution(
    request.cookies.get(REFERRAL_ATTRIBUTION_COOKIE)?.value
  );
  if (!attribution?.referralCode) {
    return { attempted: false, linked: false };
  }

  const autoLinkResponse = await fetch(
    new URL("/referral/auto-link", hubUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-referral-auto-link-secret": autoLinkSecret,
      },
      body: JSON.stringify({
        wallet,
        referralCode: attribution.referralCode,
      }),
      cache: "no-store",
    }
  );

  if (autoLinkResponse.ok) {
    return {
      attempted: true,
      linked: true,
      referralCode: attribution.referralCode,
    };
  }

  return {
    attempted: true,
    linked: false,
    referralCode: attribution.referralCode,
    error: await readErrorMessage(autoLinkResponse),
    responseStatus: autoLinkResponse.status,
  };
}

function shouldClearReferralAttribution(autoLink: AutoLinkResult) {
  if (!autoLink.attempted) return false;
  if (autoLink.linked) return true;
  if (autoLink.responseStatus === 404 || autoLink.responseStatus === 409) {
    return true;
  }

  if (autoLink.responseStatus !== 400) return false;

  const error = autoLink.error?.toLowerCase() ?? "";
  return (
    error.includes("self-referral") ||
    error.includes("refer yourself") ||
    error.includes("invalid referral code")
  );
}

export async function POST(request: NextRequest) {
  try {
    const controlApiUrl = getRequiredEnv("NEXT_PUBLIC_CONTROL_API_URL");
    if (!controlApiUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_CONTROL_API_URL configuration" },
        { status: 503 }
      );
    }

    const body = (await request.json()) as AcceptTosBody;
    const wallet = body.wallet?.trim();
    if (!wallet) {
      return NextResponse.json({ error: "Wallet is required" }, { status: 400 });
    }

    const controlResponse = await fetch(
      new URL(`/wallets/address/${encodeURIComponent(wallet)}/tos/accept`, controlApiUrl),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signature: body.signature,
          nonce: body.nonce,
          tosVersion: body.tosVersion,
          tosHash: body.tosHash,
          message: body.message,
          deadline: body.deadline,
        }),
        cache: "no-store",
      }
    );

    if (!controlResponse.ok) {
      return NextResponse.json(
        { error: await readErrorMessage(controlResponse) },
        { status: controlResponse.status }
      );
    }

    const controlPayload = await controlResponse.json();
    const autoLink = await attemptAutoLink(wallet, request);
    const response = NextResponse.json({
      ...controlPayload,
      autoLink,
    });

    if (shouldClearReferralAttribution(autoLink)) {
      response.cookies.set({
        name: REFERRAL_ATTRIBUTION_COOKIE,
        value: "",
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
    }

    return response;
  } catch (error) {
    console.error("Error accepting ToS via app route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
