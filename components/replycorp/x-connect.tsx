"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { Sparkles, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReplycorp } from "@/hooks/use-replycorp";
import { ReplycorpLinkDialog } from "./x-connect-dialog";

export interface XConnectProps {
  /** Tailwind class string applied to the outer wrapper. */
  className?: string;
  /**
   * Small uppercase section label rendered above the button, matching the
   * dialog's "SELECT CURRENCY" / "EST. WEEKLY REWARDS" header style.
   * Defaults to "Bonus offer". Pass `null` to hide the label and divider.
   */
  label?: string | null;
  /** Compact mode: pill-only, no label or divider (for dashboard chips). */
  compact?: boolean;
}

const DEFAULT_LABEL = "Bonus offer";

/**
 * Trigger surface for the ReplyCorp Connect-on-X flow. Renders:
 *
 *   - Nothing, when the wallet isn't connected (the link only makes sense
 *     once a wallet is bound).
 *   - A linked-state chip (handle + check), when the wallet already has a
 *     `twitter_links` row on the backend.
 *   - A "Link X for $5 free credits" button that opens
 *     {@link ReplycorpLinkDialog}, otherwise.
 *
 * The actual pixel.js widget and EIP-712 signing flow live inside the
 * dialog; this component is intentionally just the trigger so multiple
 * placements (mining-center surface, deposit dialog, dashboard chip)
 * don't double-mount the widget.
 */
export function XConnect({
  className,
  label = DEFAULT_LABEL,
  compact = false,
}: XConnectProps) {
  const { address } = useAccount();
  const { status, isStatusLoading } = useReplycorp();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  if (!address) return null;

  if (compact) {
    if (status?.linked) {
      return (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors",
            className,
          )}
          data-testid="replycorp-x-connect-linked-compact"
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
            X: <span className="font-medium">@{status.twitterHandle}</span>
          </span>
          <ReplycorpLinkDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
          />
        </button>
      );
    }
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={className}
          onClick={() => setDialogOpen(true)}
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Link X
        </Button>
        <ReplycorpLinkDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-border/20 dark:border-border/40 pt-3",
        className,
      )}
      data-testid="replycorp-x-connect-trigger"
    >
      {label ? (
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      ) : null}
      {status?.linked ? (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="w-full flex items-center gap-3 rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60 p-3 text-left transition-colors"
        >
          {status.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={status.avatarUrl}
              alt={`@${status.twitterHandle}`}
              className="h-9 w-9 rounded-full shrink-0"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">
              X linked
            </div>
            <div className="text-xs text-muted-foreground truncate">
              @{status.twitterHandle} earning bonus rewards
            </div>
          </div>
          <Check className="w-4 h-4 text-[#4ADE80] shrink-0" />
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start h-12"
          onClick={() => setDialogOpen(true)}
          disabled={isStatusLoading}
        >
          <Sparkles className="w-4 h-4 mr-2 text-[color:var(--color-glow-orange)]" />
          <span className="text-sm font-medium">
            Link X to earn $5 in bonus credits
          </span>
        </Button>
      )}
      <ReplycorpLinkDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
