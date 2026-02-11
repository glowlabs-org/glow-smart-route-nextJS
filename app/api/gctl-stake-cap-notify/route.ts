import { NextRequest, NextResponse } from "next/server";
import {
  isValidWalletAddress,
  parseStakeCapContact,
} from "@/lib/stake-cap-notify";

const DISCORD_GLOW_ALERT_WEBHOOK_URL =
  process.env.DISCORD_GLOW_ALERT_WEBHOOK_URL;

const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 5;

function getRateLimitKey(ip: string): string {
  return `gctl-stake-cap:${ip}`;
}

function checkRateLimit(ip: string): boolean {
  const key = getRateLimitKey(ip);
  const now = Date.now();
  const record = rateLimit.get(key);

  if (!record || now > record.resetTime) {
    rateLimit.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimit.entries()) {
    if (now > record.resetTime) {
      rateLimit.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

async function fetchStakeCapRemaining(regionId: number): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL;
  if (!baseUrl) return null;
  try {
    const response = await fetch(`${baseUrl}/regions/stake-cap/${regionId}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data?.remaining === "string" ? data.remaining : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const contactRaw = String(body?.contact ?? "");
    const contact = parseStakeCapContact(contactRaw);
    if (!contact) {
      return NextResponse.json(
        { error: "Contact must be a valid email or Telegram handle." },
        { status: 400 }
      );
    }

    const wallet = body?.wallet ? String(body.wallet) : "";
    if (wallet && !isValidWalletAddress(wallet)) {
      return NextResponse.json(
        { error: "Invalid wallet address." },
        { status: 400 }
      );
    }

    const regionId = Number(body?.regionId);
    if (!Number.isFinite(regionId) || regionId <= 0) {
      return NextResponse.json({ error: "Invalid region." }, { status: 400 });
    }

    const attemptedAmountGctl = String(body?.attemptedAmountGctl ?? "");
    const regionName = String(body?.regionName ?? "");
    const ensName = body?.ensName ? String(body.ensName) : "";
    const remainingCapGctl = body?.remainingCapGctl
      ? String(body.remainingCapGctl)
      : null;

    if (!DISCORD_GLOW_ALERT_WEBHOOK_URL) {
      console.error("Missing DISCORD_GLOW_ALERT_WEBHOOK_URL configuration");
      return NextResponse.json(
        { error: "Notification service is not configured." },
        { status: 500 }
      );
    }

    const remainingAtomic = await fetchStakeCapRemaining(regionId);
    const remainingGctl = remainingAtomic
      ? (Number(remainingAtomic) / 1_000_000).toFixed(6)
      : remainingCapGctl || "unknown";

    const walletLabel = ensName
      ? `${ensName} (${wallet || "unknown"})`
      : wallet || "unknown";
    const regionLabel = regionName
      ? `${regionName} (#${regionId})`
      : `Region ${regionId}`;

    const payload = {
      content: "GCTL stake cap reached",
      allowed_mentions: { parse: [] as string[] },
      embeds: [
        {
          title: "Stake Cap Notification",
          color: 0xffb472,
          fields: [
            { name: "Wallet", value: walletLabel, inline: false },
            {
              name: "Contact",
              value: contact.value,
              inline: false,
            },
            { name: "Region", value: regionLabel, inline: false },
            {
              name: "Attempted Amount (GCTL)",
              value: attemptedAmountGctl || "unknown",
              inline: true,
            },
            {
              name: "Remaining Cap (GCTL)",
              value: remainingGctl,
              inline: true,
            },
            {
              name: "Date",
              value: new Date().toISOString(),
              inline: false,
            },
          ],
        },
      ],
    };

    const response = await fetch(DISCORD_GLOW_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        "Discord webhook failed:",
        response.status,
        response.statusText
      );
      return NextResponse.json(
        { error: "Failed to send notification." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Stake cap notify error:", error);
    return NextResponse.json(
      { error: "Unexpected error. Please try again." },
      { status: 500 }
    );
  }
}
