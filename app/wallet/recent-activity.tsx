"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Gift,
  Clock,
  ExternalLink,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import {
  useWallets,
  type MintedEvent,
  type StakedEvent,
  type SplitActivity,
} from "@/hooks";
import { formatUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import type { SwapActivity } from "@/hooks/useRecentActivityFeed";
import { useWalletRewardClaims } from "@/hooks/useWalletRewardClaims";
import type { WalletRewardClaimRow } from "@/lib/api/wallet-reward-claims-index";
import { SDKAddresses } from "@/web3/constants/addresses";
import { nonceToWeek } from "@/hooks/useMerkleProofs";

type ActivityKind =
  | "mint"
  | "stake"
  | "unstake"
  | "fraction-purchase"
  | "swap"
  | "claim";

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
  swapsActivity?: SwapActivity[];
  isSplitsActivityLoading?: boolean;
  isSwapsActivityLoading?: boolean;
  hideIfEmpty?: boolean;
  headerRight?: React.ReactNode;
  headerVariant?: "default" | "small";
  showHeader?: boolean;
  className?: string;
  maxItems?: number;
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

function normalizeTimestampMs(timestamp: number) {
  if (!Number.isFinite(timestamp)) return null;
  // API may return seconds or milliseconds; normalize.
  return timestamp > 100_000_000_000 ? timestamp : timestamp * 1000;
}

function shortHex(value: string) {
  if (!value) return value;
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function getTokenSymbol(tokenAddress: `0x${string}`) {
  const tokenLower = tokenAddress.toLowerCase();
  const sdk = SDKAddresses as unknown as Record<string, string | undefined>;

  const candidates: Array<[string, string | undefined]> = [
    ["GLW", sdk.GLW_UNISWAP ?? sdk.GLW],
    ["USDG", sdk.USDG_UNISWAP ?? sdk.USDG],
    ["USDC", sdk.USDC],
  ];

  for (const [symbol, address] of candidates) {
    if (!address) continue;
    if (address.toLowerCase() === tokenLower) return symbol;
  }

  return shortHex(tokenAddress);
}

function buildClaimActivity(rows: WalletRewardClaimRow[]): ActivityItem | null {
  const first = rows[0];
  if (!first) return null;

  const timestampMs = normalizeTimestampMs(first.timestamp);
  if (!timestampMs) return null;

  const tokenTotals = new Map<string, number>();
  for (const row of rows) {
    const symbol = getTokenSymbol(row.token);
    const decimals =
      DECIMALS_BY_TOKEN[symbol as keyof typeof DECIMALS_BY_TOKEN] ?? 18;
    const amount = safeFormatUnits(row.amount, decimals);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    tokenTotals.set(symbol, (tokenTotals.get(symbol) ?? 0) + amount);
  }

  const tokenEntries = Array.from(tokenTotals.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  const primary = tokenEntries[0] ?? null;

  const isProtocol = first.source === "rewardsKernel";
  const weekLabel = (() => {
    if (!isProtocol) return null;
    const nonceStr = first.nonce;
    if (!nonceStr) return null;
    try {
      return `Week ${nonceToWeek(BigInt(nonceStr))}`;
    } catch {
      return null;
    }
  })();

  const title =
    primary && tokenEntries.length === 1
      ? `Claimed ${formatCompactNumber(primary[1], 2)} ${primary[0]}`
      : "Claimed rewards";

  const subtitleParts: string[] = [];
  if (weekLabel) subtitleParts.push(weekLabel);
  if (tokenEntries.length > 1) {
    subtitleParts.push(
      tokenEntries
        .slice(0, 3)
        .map(
          ([symbol, amount]) => `${formatCompactNumber(amount, 2)} ${symbol}`
        )
        .join(" · ")
    );
  }
  const subtitle = subtitleParts.length ? subtitleParts.join(" — ") : undefined;

  return {
    id: `claim-${first.txHash}-${first.logIndex}`,
    kind: "claim",
    timestampMs,
    txHash: first.txHash,
    title,
    subtitle,
    pill: isProtocol ? "PD" : "Emissions",
    icon: <Gift className="h-4 w-4" />,
    iconClassName: isProtocol
      ? "text-[#C084FC] bg-[#C084FC]/10"
      : "text-emerald-400 bg-emerald-500/10",
  };
}

function buildMintActivity(event: MintedEvent): ActivityItem | null {
  const timestampMs = new Date(event.ts).getTime();
  if (!Number.isFinite(timestampMs)) return null;

  const gctl = safeFormatUnits(event.gctlMinted, DECIMALS_BY_TOKEN.GCTL);
  const originalDecimals = event.currency === "USDG" ? 6 : 18;
  const original = safeFormatUnits(event.amountRaw, originalDecimals);

  const title = `Minted ${formatCompactNumber(gctl, 2)} GCTL`;
  const subtitle = `From ${formatCompactNumber(original, 2)} ${
    event.currency === "USDG" ? "USDC" : event.currency
  }`;

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
    iconClassName: "text-[#22D3EE] bg-[#22D3EE]/10",
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
        ? "text-[#22D3EE] bg-[#22D3EE]/10"
        : "text-zinc-400 bg-zinc-900/40",
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
    iconClassName: isMiningCenter
      ? "text-[color:var(--color-miner-yellow-contrast)] bg-[color:var(--color-miner-yellow)]/10"
      : "text-[#C084FC] bg-[#C084FC]/10",
  };
}

function buildSwapActivity(swap: SwapActivity): ActivityItem | null {
  const timestampMs = swap.timestampMs;
  if (!Number.isFinite(timestampMs)) return null;

  const glwIn = swap.glwIn ?? 0;
  const glwOut = swap.glwOut ?? 0;
  const usdgIn = swap.usdgIn ?? 0;
  const usdgOut = swap.usdgOut ?? 0;

  const isSellingGlw = glwIn > 0 && usdgOut > 0;
  const title = isSellingGlw
    ? `Swapped ${formatCompactNumber(glwIn, 2)} GLW → ${formatCompactNumber(
        usdgOut,
        2
      )} USDG`
    : usdgIn > 0 && glwOut > 0
    ? `Swapped ${formatCompactNumber(usdgIn, 2)} USDG → ${formatCompactNumber(
        glwOut,
        2
      )} GLW`
    : "Swap";

  const subtitle = "GLW/USDG pool";

  return {
    id: swap.txHash ? `swap-${swap.txHash}` : `swap-${timestampMs}`,
    kind: "swap",
    timestampMs,
    txHash: swap.txHash,
    title,
    subtitle,
    pill: isSellingGlw ? "Sell" : "Buy",
    icon: isSellingGlw ? (
      <TrendingDown className="h-4 w-4" />
    ) : (
      <TrendingUp className="h-4 w-4" />
    ),
    iconClassName: isSellingGlw
      ? "text-red-400 bg-red-500/10"
      : "text-emerald-400 bg-emerald-500/10",
  };
}

export function RecentActivity({
  walletAddress,
  splitsActivity,
  swapsActivity = [],
  isSplitsActivityLoading = false,
  isSwapsActivityLoading = false,
  hideIfEmpty = false,
  headerRight,
  headerVariant = "default",
  showHeader = true,
  className,
  maxItems,
}: RecentActivityProps) {
  const { isConnecting, isReconnecting } = useAccount();
  const isWalletConnecting =
    (isConnecting || isReconnecting) && !Boolean(walletAddress);

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

  const { claims, isLoading: isClaimsLoading } = useWalletRewardClaims(
    walletAddress,
    {
      enabled: Boolean(walletAddress),
      // This endpoint returns per-token rows; keep a modest cap.
      limit: 400,
      query: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    }
  );

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

    swapsActivity.forEach((swap) => {
      const item = buildSwapActivity(swap);
      if (item) all.push(item);
    });

    const claimsByTx = new Map<string, WalletRewardClaimRow[]>();
    claims.forEach((row) => {
      const txHash = row.txHash;
      const existing = claimsByTx.get(txHash) ?? [];
      existing.push(row);
      claimsByTx.set(txHash, existing);
    });

    for (const rows of claimsByTx.values()) {
      rows.sort((a, b) => a.subIndex - b.subIndex);
      const item = buildClaimActivity(rows);
      if (item) all.push(item);
    }

    return all.sort((a, b) => {
      const timeDiff = b.timestampMs - a.timestampMs;
      if (timeDiff !== 0) return timeDiff;

      // Tie-breaker: if timestamps are identical, mint is "older" than stake
      // (appears lower in a latest-to-oldest list)
      if (a.kind === "mint" && b.kind === "stake") return 1;
      if (a.kind === "stake" && b.kind === "mint") return -1;

      return 0;
    });
  }, [claims, mintedEvents, stakeEvents, splitsActivity, swapsActivity]);

  const isLoading =
    isMintedEventsLoading ||
    isStakeEventsLoading ||
    isSplitsActivityLoading ||
    isSwapsActivityLoading ||
    isClaimsLoading ||
    isWalletConnecting;

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

  if (hideIfEmpty && !isLoading && activities.length === 0) return null;

  const displayedActivities = maxItems
    ? activities.slice(0, maxItems)
    : activities;

  return (
    <Card
      className={cn(
        "h-full lg:max-h-[380px] overflow-hidden flex flex-col gap-4",
        className
      )}
    >
      {showHeader ? (
        <CardHeader
          className={cn(headerVariant === "small" ? "pb-0 pt-4" : "py-0")}
        >
          <div className="flex items-center justify-between gap-3">
            <CardTitle
              className={cn(
                headerVariant === "small" &&
                  "text-lg font-semibold tracking-tight text-foreground",
                headerVariant !== "small" && "tracking-tight"
              )}
            >
              Recent Activity
            </CardTitle>
            {headerRight ?? (
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Live
              </span>
            )}
          </div>
        </CardHeader>
      ) : null}

      <CardContent className="min-h-0 flex-1 p-4 py-0">
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
            {maxItems ? (
              <div className="space-y-2 pb-2">
                {displayedActivities.map((activity) => (
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
                        "h-9 w-9 rounded-xl border border-border bg-background/60 flex items-center justify-center flex-shrink-0",
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
            ) : (
              <ScrollArea className="h-full pr-2 -mr-2">
                <div className="space-y-2 pb-2">
                  {displayedActivities.map((activity) => (
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
                        "h-9 w-9 rounded-xl border border-border bg-background/60 flex items-center justify-center flex-shrink-0",
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
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
