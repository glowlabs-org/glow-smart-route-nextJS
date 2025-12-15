"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Clock,
  ExternalLink,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useWallets,
  type MintedEvent,
  type StakedEvent,
} from "@/hooks/useWallets";
import { formatUnits } from "viem";
import type { SplitActivity } from "@/hooks/useGlowLaunchpad";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";

type ActivityKind = "mint" | "stake" | "unstake" | "fraction-purchase";

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  timestampMs: number;
  txHash?: string;
  title: string;
  subtitle?: string;
  pill?: string;
  icon: React.ReactNode;
  iconClassName: string;
}

interface RecentActivityProps {
  walletAddress?: string;
  splitsActivity: SplitActivity[];
  isSplitsActivityLoading?: boolean;
}

function formatCompactNumber(value: number, maximumFractionDigits: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", {
    maximumFractionDigits,
  });
}

function formatDateTime(timestampMs: number) {
  return new Date(timestampMs).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getExplorerUrl(txHash: string) {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID;
  const isSepolia = chainId === "11155111";
  return isSepolia
    ? `https://sepolia.etherscan.io/tx/${txHash}`
    : `https://etherscan.io/tx/${txHash}`;
}

function safeFormatUnits(value: string, decimals: number) {
  try {
    return Number(formatUnits(BigInt(value), decimals));
  } catch {
    return 0;
  }
}

function buildMintActivity(event: MintedEvent): ActivityItem | null {
  const timestampMs = new Date(event.ts).getTime();
  if (!Number.isFinite(timestampMs)) return null;

  const gctl = safeFormatUnits(event.gctlMinted, DECIMALS_BY_TOKEN.GCTL);
  const originalDecimals = event.currency === "USDG" ? 6 : 18;
  const original = safeFormatUnits(event.amountRaw, originalDecimals);

  const title = `Minted ${formatCompactNumber(gctl, 2)} GCTL`;
  const subtitle = `From ${formatCompactNumber(original, 2)} ${event.currency}`;

  return {
    id: event.txId
      ? `mint-${event.txId}`
      : `mint-${timestampMs}-${event.epoch}`,
    kind: "mint",
    timestampMs,
    txHash: event.txId,
    title,
    subtitle,
    pill: event.epoch ? `Epoch ${event.epoch}` : undefined,
    icon: <Sparkles className="h-4 w-4" />,
    iconClassName: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20",
  };
}

function buildStakeActivity(event: StakedEvent): ActivityItem | null {
  const timestampMs = new Date(event.ts).getTime();
  if (!Number.isFinite(timestampMs)) return null;

  const gctl = safeFormatUnits(event.amount, DECIMALS_BY_TOKEN.GCTL);
  const direction: ActivityKind =
    event.direction === "stake" ? "stake" : "unstake";
  const regionLabel =
    event.regionName ||
    (event.regionId ? `Region ${event.regionId}` : "Region");

  const title =
    direction === "stake"
      ? `Staked ${formatCompactNumber(gctl, 0)} GCTL`
      : `Unstaking ${formatCompactNumber(gctl, 0)} GCTL`;

  return {
    id: `stake-${event.epoch}-${timestampMs}-${event.regionId}-${event.direction}`,
    kind: direction,
    timestampMs,
    title,
    subtitle:
      direction === "stake" ? `In ${regionLabel}` : `From ${regionLabel}`,
    pill: event.epoch ? `Epoch ${event.epoch}` : undefined,
    icon:
      direction === "stake" ? (
        <TrendingUp className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      ),
    iconClassName:
      direction === "stake"
        ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
        : "text-orange-600 bg-orange-50 dark:bg-orange-950/20",
  };
}

function buildSplitActivity(split: SplitActivity): ActivityItem | null {
  const timestampMs = split.timestamp * 1000;
  if (!Number.isFinite(timestampMs)) return null;

  const decimals =
    DECIMALS_BY_TOKEN[split.currency as keyof typeof DECIMALS_BY_TOKEN] ?? 18;
  const amount = safeFormatUnits(split.amount, decimals);

  const isMiningCenter = split.fractionType === "mining-center";
  const title = isMiningCenter
    ? `Purchased ${split.stepsPurchased ?? 0} miners`
    : `Delegated ${formatCompactNumber(amount, 0)} ${split.currency}`;

  const subtitle = isMiningCenter
    ? `${formatCompactNumber(amount, 0)} ${split.currency}`
    : undefined;

  const pill =
    typeof split.progressPercent === "number"
      ? `${Math.round(split.progressPercent)}% filled`
      : undefined;

  return {
    id: split.transactionHash
      ? `split-${split.transactionHash}`
      : `split-${timestampMs}-${split.applicationId}-${split.fractionId}`,
    kind: "fraction-purchase",
    timestampMs,
    txHash: split.transactionHash,
    title,
    subtitle,
    pill,
    icon: <ShoppingCart className="h-4 w-4" />,
    iconClassName: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20",
  };
}

export function RecentActivity({
  walletAddress,
  splitsActivity,
  isSplitsActivityLoading = false,
}: RecentActivityProps) {
  // Fetch wallet events data
  const {
    mintedEvents,
    stakeEvents,
    isMintedEventsLoading,
    isStakeEventsLoading,
  } = useWallets({
    walletAddress,
    enabled: Boolean(walletAddress),
    limit: 20, // Limit to recent 20 events
  });

  // Combine and format all activities
  const activities = React.useMemo(() => {
    const all: ActivityItem[] = [];

    mintedEvents.forEach((evt) => {
      const item = buildMintActivity(evt);
      if (item) all.push(item);
    });

    stakeEvents.forEach((evt) => {
      const item = buildStakeActivity(evt);
      if (item) all.push(item);
    });

    splitsActivity.forEach((split) => {
      const item = buildSplitActivity(split);
      if (item) all.push(item);
    });

    return all.sort((a, b) => b.timestampMs - a.timestampMs);
  }, [mintedEvents, stakeEvents, splitsActivity]);

  const isLoading =
    isMintedEventsLoading || isStakeEventsLoading || isSplitsActivityLoading;

  const handleViewTransaction = React.useCallback((activity: ActivityItem) => {
    if (!activity.txHash) {
      toast.info("Transaction hash not available for this activity.");
      return;
    }
    window.open(
      getExplorerUrl(activity.txHash),
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

  return (
    <Card className="h-full max-h-[360px] overflow-hidden flex flex-col">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="tracking-tight">Recent Activity</CardTitle>
          <span className="text-[10px] font-mono uppercase text-muted-foreground">
            Live
          </span>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 p-4 pt-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 animate-pulse"
              >
                <div className="h-9 w-9 rounded-xl bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="h-full min-h-0 flex items-center justify-center text-center text-muted-foreground px-6">
            <div>
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <div className="text-sm font-medium text-foreground/80">
                No recent activity
              </div>
              <div className="text-xs mt-1">
                Your transactions will appear here.
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-0">
            <ScrollArea className="h-full pr-2 -mr-2">
              <div className="space-y-2 pb-2">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="group flex items-start gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 hover:bg-muted/20 transition-colors"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleViewTransaction(activity)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      handleViewTransaction(activity);
                    }}
                  >
                    <div
                      className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0",
                        activity.iconClassName
                      )}
                    >
                      {activity.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold tracking-tight text-foreground truncate">
                            {activity.title}
                          </div>
                          <div className="mt-1 text-[11px] font-mono text-muted-foreground flex items-center gap-2">
                            <span className="tabular-nums">
                              {formatDateTime(activity.timestampMs)}
                            </span>
                            {activity.subtitle ? (
                              <span className="truncate">
                                {activity.subtitle}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {activity.pill ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-mono uppercase"
                            >
                              {activity.pill}
                            </Badge>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity",
                              !activity.txHash && "pointer-events-none"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewTransaction(activity);
                            }}
                            aria-label="View transaction"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
