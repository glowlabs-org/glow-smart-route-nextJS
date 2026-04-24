"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { hubPost } from "@/lib/api/hub-client";
import { getStoredReferralAttribution } from "@/lib/referral-attribution";
import { identifyWallet, trackEvent } from "@/lib/telemetry";

/**
 * Passive demand telemetry: logs a single event each time a wallet connects,
 * switches address, or switches chain. Written to gca-crm-backend's
 * wallet_session_events table and consumed by the demand-forecasting back-test
 * at `gca-crm-backend/scripts/backtest-usdc-demand-signal.ts`.
 *
 * No UX. No CTA. No authentication. The write path is best-effort and
 * silently swallows errors.
 */

const SESSION_ID_KEY = "glow:wallet-session-id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(SESSION_ID_KEY, generated);
    return generated;
  } catch {
    return `s${Date.now().toString(36)}`;
  }
}

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trimStart();
    if (!trimmed.startsWith(prefix)) continue;
    try {
      return decodeURIComponent(trimmed.slice(prefix.length));
    } catch {
      return trimmed.slice(prefix.length);
    }
  }
  return null;
}

interface WalletSessionEventPayload {
  walletAddress: string;
  sessionId: string;
  eventType: "connect" | "address_change" | "chain_change";
  pathname: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referralCode: string | null;
  geoCountry: string | null;
  geoRegion: string | null;
  chainId: number | null;
  clientTimestamp: number;
}

function buildPayload(params: {
  walletAddress: string;
  eventType: WalletSessionEventPayload["eventType"];
  chainId: number | null;
}): WalletSessionEventPayload | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const search = url.searchParams;
  const referralAttribution = getStoredReferralAttribution();

  return {
    walletAddress: params.walletAddress.toLowerCase(),
    sessionId: getOrCreateSessionId(),
    eventType: params.eventType,
    pathname: `${url.pathname}${url.search || ""}`.slice(0, 2048),
    referrer: typeof document !== "undefined" && document.referrer
      ? document.referrer.slice(0, 2048)
      : null,
    utmSource: search.get("utm_source"),
    utmMedium: search.get("utm_medium"),
    utmCampaign: search.get("utm_campaign"),
    referralCode: referralAttribution?.referralCode ?? null,
    geoCountry: readCookieValue("geo_country"),
    geoRegion: readCookieValue("geo_region"),
    chainId: params.chainId,
    clientTimestamp: Math.floor(Date.now() / 1000),
  };
}

async function sendEvent(payload: WalletSessionEventPayload): Promise<void> {
  try {
    await hubPost("/telemetry/wallet-session", payload);
  } catch {
    // Never surface telemetry failures to the user.
  }
}

/**
 * Install at the root of the app (inside WagmiProvider + QueryClientProvider).
 * Runs once per page tree. Fires exactly one POST per wallet-state transition:
 *   - disconnected → connected             → "connect"
 *   - connected, address changed           → "address_change"
 *   - connected, chain changed             → "chain_change"
 */
export function useWalletSessionLogger(): void {
  const { address, isConnected, chainId } = useAccount();
  const lastAddressRef = useRef<string | null>(null);
  const lastChainIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_CHAIN_ID === "11155111") return; // skip on sepolia
    if (!isConnected || !address) {
      // Transition back to disconnected; reset memory so a reconnect fires fresh.
      if (lastAddressRef.current !== null) {
        lastAddressRef.current = null;
        lastChainIdRef.current = null;
      }
      return;
    }

    const canonicalAddress = address.toLowerCase();
    const previousAddress = lastAddressRef.current;
    const previousChainId = lastChainIdRef.current;
    const nextChainId = typeof chainId === "number" ? chainId : null;

    let eventType: WalletSessionEventPayload["eventType"] | null = null;
    if (previousAddress === null) {
      eventType = "connect";
    } else if (previousAddress !== canonicalAddress) {
      eventType = "address_change";
    } else if (previousChainId !== nextChainId) {
      eventType = "chain_change";
    }

    lastAddressRef.current = canonicalAddress;
    lastChainIdRef.current = nextChainId;

    if (!eventType) return;

    // Attribute all future Umami events to this wallet. Fires on every
    // connect / address_change so the session always reflects the active address.
    identifyWallet(canonicalAddress, { chain_id: nextChainId });

    if (eventType === "connect") {
      trackEvent("wallet_connected", { chain_id: nextChainId });
    }

    const payload = buildPayload({
      walletAddress: canonicalAddress,
      eventType,
      chainId: nextChainId,
    });
    if (!payload) return;

    void sendEvent(payload);
  }, [address, isConnected, chainId]);
}
