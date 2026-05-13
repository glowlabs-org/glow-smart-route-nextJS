"use client";

import Script from "next/script";
import * as React from "react";
import { useAccount } from "wagmi";
import {
  useReplycorp,
  type ReplycorpConnectedEventDetail,
} from "@/hooks/use-replycorp";
import { trackEvent } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

const PIXEL_SCRIPT_SRC = "https://cdn.replycorp.io/pixel.js";
const BRAND_ID = process.env.NEXT_PUBLIC_REPLYCORP_BRAND_ID || "glow";
// pixel.js otherwise queries the wrong host for /api/v1/pixel/config.
const API_BASE =
  process.env.NEXT_PUBLIC_REPLYCORP_API_BASE || "https://prod.api.replycorp.io";
export interface XConnectProps {
  /** Tailwind class string applied to the outer wrapper. */
  className?: string;
  /**
   * Small uppercase section label rendered above the widget, matching the
   * dialog's "SELECT CURRENCY" / "EST. WEEKLY REWARDS" header style.
   * Defaults to "Bonus offer". Pass `null` to hide the label and divider.
   */
  label?: string | null;
  /** Compact mode: pill-only, no label or divider (for dashboard chips). */
  compact?: boolean;
}

const DEFAULT_LABEL = "Bonus offer";

/**
 * ReplyCorp Connect on X widget. Lazy-loads pixel.js, renders the widget
 * target div, listens for `replycorp:connected` on `window`, and persists
 * the wallet ↔ Twitter ID mapping on gca-crm-backend via POST /replycorp/link.
 *
 * Safe to render multiple times on the same page; the script loads once and
 * the event listener is wired/cleaned with the component lifecycle.
 */
export function XConnect({
  className,
  label = DEFAULT_LABEL,
  compact = false,
}: XConnectProps) {
  const { address } = useAccount();
  const { status, linkMutation } = useReplycorp();
  // Keep a ref to the latest mutate fn so the listener (registered once)
  // always calls the current mutation without re-binding on every render.
  const mutateRef = React.useRef(linkMutation.mutate);
  React.useEffect(() => {
    mutateRef.current = linkMutation.mutate;
  }, [linkMutation.mutate]);

  // Pixel.js documentation says the event fires on `window`, but observed
  // behaviour suggests it may fire on `document` (or neither, when state is
  // restored from cache). Register on both surfaces and dedupe by twitterId
  // so we always catch it without firing two signature prompts.
  const lastSeenTwitterIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    function onConnected(event: Event) {
      const detail = (event as CustomEvent<ReplycorpConnectedEventDetail>)
        .detail;
      const twitterId = detail?.twitterId;
      if (!twitterId) return;
      if (lastSeenTwitterIdRef.current === twitterId) return;
      lastSeenTwitterIdRef.current = twitterId;
      trackEvent("replycorp_connected_event", {
        twitterId,
        handle: detail.handle,
        surface: event.currentTarget === window ? "window" : "document",
      });
      mutateRef.current({
        twitterId,
        twitterHandle: detail.handle,
        displayName: detail.name,
        avatarUrl: detail.avatarUrl,
      });
    }
    window.addEventListener("replycorp:connected", onConnected);
    document.addEventListener("replycorp:connected", onConnected);
    return () => {
      window.removeEventListener("replycorp:connected", onConnected);
      document.removeEventListener("replycorp:connected", onConnected);
    };
  }, []);

  // Don't render anything until the wallet is connected — the link only
  // makes sense once we have a wallet address to bind the Twitter ID to.
  if (!address) return null;

  if (status?.linked) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 text-sm text-muted-foreground",
          className,
        )}
        data-testid="replycorp-x-connect-linked"
      >
        {status.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={status.avatarUrl}
            alt={`@${status.twitterHandle}`}
            className="h-5 w-5 rounded-full"
          />
        ) : null}
        <span>
          X linked: <span className="font-medium">@{status.twitterHandle}</span>
        </span>
      </div>
    );
  }

  return (
    <>
      <Script
        src={PIXEL_SCRIPT_SRC}
        strategy="afterInteractive"
        data-brand-id={BRAND_ID}
        data-api-base={API_BASE}
        onLoad={() => trackEvent("replycorp_widget_loaded", { brand: BRAND_ID })}
      />
      <div
        className={cn(
          compact ? "" : "flex flex-col gap-2 border-t border-border/40 pt-3",
          className,
        )}
        data-testid="replycorp-x-connect-target"
      >
        {!compact && label ? (
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        ) : null}
        <div data-replycorp-connect />
      </div>
    </>
  );
}
