"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { Check, Loader2, MessageCircle, PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConnectButton } from "@/components/connect-button";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";
import {
  useReplycorp,
  type ReplycorpConnectedEventDetail,
} from "@/hooks/use-replycorp";
import { ReplycorpLogo } from "./replycorp-logo";

const PIXEL_SCRIPT_SRC = "https://cdn.replycorp.io/pixel.js";
const BRAND_ID = process.env.NEXT_PUBLIC_REPLYCORP_BRAND_ID || "glow";
// Pixel.js otherwise queries the wrong host for /api/v1/pixel/config.
const API_BASE =
  process.env.NEXT_PUBLIC_REPLYCORP_API_BASE || "https://prod.api.replycorp.io";

type StepId = "connect-x" | "sign" | "done";

export interface ReplycorpLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Stepped wizard for linking a wallet to an X account via ReplyCorp:
 *
 *   1. Connect X         — pixel.js widget renders here, user OAuths.
 *   2. Sign to confirm   — wallet signs an EIP-712 `LinkTwitter` message
 *                          so gca-crm-backend can persist the mapping.
 *   3. Done              — confirmation, the buyer is set up for bonus
 *                          Influence Points on their next mining-center
 *                          purchase.
 *
 * Reusable outside the deposit flow. Mounts pixel.js only while open so
 * we don't compete with other widget instances on the page.
 */
export function ReplycorpLinkDialog({
  open,
  onOpenChange,
}: ReplycorpLinkDialogProps) {
  const { address, isConnected } = useAccount();
  const { status, linkMutation } = useReplycorp();

  // Captured the most recent payload from pixel.js's replycorp:connected
  // event. Held in dialog state so we can drive step 2 even after the
  // widget has visually moved on.
  const [pendingTwitter, setPendingTwitter] =
    React.useState<ReplycorpConnectedEventDetail | null>(null);

  // Reset transient state when the dialog closes so a re-open starts clean.
  React.useEffect(() => {
    if (!open) {
      setPendingTwitter(null);
      linkMutation.reset();
    }
    // We only want this on `open` flipping; mutation identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // pixel.js's init code only runs once per page (browser caches by src).
  // next/script honors that cache, which means a connect div mounted later
  // in the page lifecycle isn't picked up. We sidestep that by manually
  // re-injecting the script every time the dialog opens, after clearing the
  // prior render. Costs one extra cdn fetch per open, which is negligible.
  React.useEffect(() => {
    if (!open) return;

    document.querySelectorAll("script[data-glow-replycorp-pixel]").forEach((s) =>
      s.remove(),
    );
    document
      .querySelectorAll("[data-replycorp-connect]")
      .forEach((el) => ((el as HTMLElement).innerHTML = ""));

    const script = document.createElement("script");
    script.src = PIXEL_SCRIPT_SRC;
    script.async = true;
    script.dataset.brandId = BRAND_ID;
    script.dataset.apiBase = API_BASE;
    script.setAttribute("data-glow-replycorp-pixel", "");
    script.onload = () =>
      trackEvent("replycorp_widget_loaded", { brand: BRAND_ID });
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [open]);

  // Listen on both window and document — pixel.js's docs say `window` but
  // observed behaviour suggests it can vary, so we hedge to be safe and
  // dedupe by twitterId.
  React.useEffect(() => {
    if (!open) return;
    function onConnected(event: Event) {
      const detail = (event as CustomEvent<ReplycorpConnectedEventDetail>)
        .detail;
      if (!detail?.twitterId) return;
      trackEvent("replycorp_connected_event", {
        twitterId: detail.twitterId,
        handle: detail.handle,
        surface: event.currentTarget === window ? "window" : "document",
      });
      setPendingTwitter((prev) =>
        prev?.twitterId === detail.twitterId ? prev : detail,
      );
    }
    window.addEventListener("replycorp:connected", onConnected);
    document.addEventListener("replycorp:connected", onConnected);
    return () => {
      window.removeEventListener("replycorp:connected", onConnected);
      document.removeEventListener("replycorp:connected", onConnected);
    };
  }, [open]);

  const currentStep: StepId = status?.linked
    ? "done"
    : pendingTwitter
      ? "sign"
      : "connect-x";

  const handleSign = React.useCallback(() => {
    if (!pendingTwitter) return;
    linkMutation.mutate({
      twitterId: pendingTwitter.twitterId,
      twitterHandle: pendingTwitter.handle,
      displayName: pendingTwitter.name,
      avatarUrl: pendingTwitter.avatarUrl,
    });
  }, [pendingTwitter, linkMutation]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40">
        {/* Header */}
        <div className="border-b border-border/20 dark:border-border/40 px-6 pt-8 pb-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <ReplycorpLogo size={48} className="rounded-xl" />
            <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              Link to earn with ReplyCorp
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground max-w-sm">
              Earn bonus credits (redeemable for gift cards) on your
              mining-center purchases when you link your X account.
            </DialogDescription>
          </div>
        </div>

        {/* Step list */}
        <div className="px-6 py-6 space-y-3">
          <StepRow
            stepNumber={1}
            title="Connect on X"
            description="OAuth handshake with ReplyCorp."
            state={
              currentStep === "connect-x"
                ? "active"
                : "done"
            }
          />
          <StepRow
            stepNumber={2}
            title="Sign to link your wallet"
            description="Proves you own this wallet so we can credit you."
            state={
              currentStep === "sign"
                ? "active"
                : currentStep === "done"
                  ? "done"
                  : "pending"
            }
          />
          <StepRow
            stepNumber={3}
            title="You're set"
            description="Purchase a miner and earn bonus ReplyCorp credits."
            state={currentStep === "done" ? "done" : "pending"}
          />
        </div>

        {/* Active step content */}
        <div className="px-6 pb-6">
          {!isConnected ? (
            <ActionPanel
              title="Connect your wallet first"
              description="We bind your X account to your connected wallet so future purchases attribute to you."
            >
              <ConnectButton size="medium" variant="default" />
            </ActionPanel>
          ) : currentStep === "connect-x" ? (
            <ActionPanel
              title="Step 1 of 2: Connect on X"
              description="Use the ReplyCorp widget below. After signing in to X, you'll be sent back here to confirm."
            >
              <div className="flex justify-center pt-1">
                <div data-replycorp-connect />
              </div>
              <p className="text-xs text-muted-foreground/70 dark:text-muted-foreground/80 text-center pt-2">
                Already connected on X? Click <span className="font-medium">Logout</span> in
                the widget, then reconnect to relink with this wallet.
              </p>
            </ActionPanel>
          ) : currentStep === "sign" ? (
            <ActionPanel
              title="Step 2 of 2: Sign to link your wallet"
              description={
                pendingTwitter
                  ? `Connected as @${pendingTwitter.handle}. Sign in your wallet to bind the link to ${shortenAddress(address ?? "")}.`
                  : "Sign in your wallet to bind the link."
              }
            >
              {pendingTwitter ? (
                <div className="flex items-center gap-3 rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-3">
                  {pendingTwitter.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pendingTwitter.avatarUrl}
                      alt={`@${pendingTwitter.handle}`}
                      className="h-9 w-9 rounded-full"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {pendingTwitter.name || pendingTwitter.handle}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      @{pendingTwitter.handle}
                    </div>
                  </div>
                </div>
              ) : null}
              <Button
                className="w-full h-11"
                onClick={handleSign}
                disabled={linkMutation.isPending || !pendingTwitter}
              >
                {linkMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Waiting for signature…
                  </>
                ) : (
                  <>
                    <PenLine className="mr-2 h-4 w-4" />
                    Sign to confirm link
                  </>
                )}
              </Button>
            </ActionPanel>
          ) : (
            <ActionPanel
              title="All set"
              description={
                status?.twitterHandle
                  ? `@${status.twitterHandle} is linked to ${shortenAddress(address ?? "")}. Buy a miner and you'll earn bonus ReplyCorp credits on top of your Glow rewards.`
                  : `Your wallet is linked. Buy a miner and you'll earn bonus ReplyCorp credits on top of your Glow rewards.`
              }
            >
              <div className="flex items-center gap-3 rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-3">
                {status?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={status.avatarUrl}
                    alt={`@${status.twitterHandle}`}
                    className="h-9 w-9 rounded-full"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    @{status?.twitterHandle ?? "linked"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {shortenAddress(address ?? "")}
                  </div>
                </div>
                <Check className="w-5 h-5 text-[#4ADE80]" />
              </div>
              <Button
                className="w-full h-11"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </ActionPanel>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Step row
// ============================================

type StepState = "active" | "done" | "pending";

function StepRow({
  stepNumber,
  title,
  description,
  state,
}: {
  stepNumber: number;
  title: string;
  description: string;
  state: StepState;
}) {
  const isDone = state === "done";
  const isActive = state === "active";

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        state === "pending" && "opacity-60",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-full shrink-0 text-xs font-mono",
          isDone &&
            "bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/30",
          isActive &&
            "bg-[color:var(--color-glow-orange)]/10 text-[color:var(--color-glow-orange)] border border-[color:var(--color-glow-orange)]/30",
          !isDone && !isActive &&
            "bg-muted/50 text-muted-foreground border border-border/30",
        )}
      >
        {isDone ? <Check className="w-3.5 h-3.5" /> : stepNumber}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div
          className={cn(
            "text-sm",
            isActive ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {title}
        </div>
        <div className="text-xs text-muted-foreground/70 dark:text-muted-foreground/80">
          {description}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Action panel (heading + content)
// ============================================

function ActionPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 space-y-3">
      <div className="space-y-1">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
          {title}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
