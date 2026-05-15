"use client";

import React from "react";
import { useInView } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Gift,
  Clock,
  Coins,
  ExternalLink,
} from "lucide-react";
import { CashMinerIcon, DelegationIcon } from "@/components/impact-icons";
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
import {
  useV2PointsLedger,
  POINTS_EVENT_LABELS,
  type V2PointsLedgerRow,
} from "@/hooks/v2-points";
import { useWalletRewardClaims } from "@/hooks/useWalletRewardClaims";
import { useWalletSgctlClaimSettlements } from "@/hooks/useWalletSgctlClaimSettlements";
import { SDKAddresses } from "@/web3/constants/addresses";
import { nonceToWeek } from "@/hooks/useMerkleProofs";
import { resolveDelegationCurrencyFromSplitActivity } from "@/utils/launchpad-rewards";
import {
  buildSgctlClaimActivityEntries,
  groupClaimActivityEntries,
  normalizeClaimActivityKey,
  type ClaimActivityEntry,
  type ClaimActivityGroup,
} from "@/app/wallet/activity-feed-claim-utils";
import { useLang, type Strings } from "@/lib/i18n";

type RecentActivityLabels = Strings["widgets"]["recentActivity"];

type ActivityKind =
  | "mint"
  | "stake"
  | "unstake"
  | "fraction-purchase"
  | "swap"
  | "claim"
  | "points";

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
  showKpis?: boolean;
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

function getRewardTokenDecimals(symbol: string) {
  if (symbol === "SGCTL") return DECIMALS_BY_TOKEN.GCTL;
  return DECIMALS_BY_TOKEN[symbol as keyof typeof DECIMALS_BY_TOKEN] ?? 18;
}

function getRewardTokenLabel(symbol: string) {
  return symbol === "SGCTL" ? "sGCTL" : symbol;
}

function buildClaimActivity(
  group: ClaimActivityGroup,
  labels: RecentActivityLabels,
): ActivityItem | null {
  if (!group.tokenEntries.length) return null;

  const primary = group.tokenEntries[0] ?? null;

  const isProtocol = group.source === "rewardsKernel";
  const weekLabel = (() => {
    if (!isProtocol) return null;
    const nonceStr = group.nonce;
    if (!nonceStr) return null;
    try {
      return labels.weekN(Number(nonceToWeek(BigInt(nonceStr))));
    } catch {
      return null;
    }
  })();

  const title =
    primary && group.tokenEntries.length === 1
      ? labels.claimedTitleSingle(
          formatCompactNumber(primary[1], 2),
          getRewardTokenLabel(primary[0]),
        )
      : labels.claimedTitleMulti;

  const subtitleParts: string[] = [];
  if (weekLabel) subtitleParts.push(weekLabel);
  if (group.tokenEntries.length > 1) {
    subtitleParts.push(
      group.tokenEntries
        .slice(0, 3)
        .map(
          ([symbol, amount]) =>
            `${formatCompactNumber(amount, 2)} ${getRewardTokenLabel(symbol)}`
        )
        .join(" · ")
    );
  }
  const subtitle = subtitleParts.length ? subtitleParts.join(" — ") : undefined;

  return {
    id: group.id,
    kind: "claim",
    timestampMs: group.timestampMs,
    txHash: group.txHash,
    title,
    subtitle,
    pill: isProtocol ? labels.pillPd : labels.pillEmissions,
    icon: <Gift className="h-5 w-5" />,
    iconClassName: isProtocol
      ? "text-delegation-purple bg-delegation-purple/10"
      : "text-[color:var(--color-miner-contrast)] bg-[color:var(--color-miner)]/10",
  };
}

function buildMintActivity(
  event: MintedEvent,
  labels: RecentActivityLabels,
): ActivityItem | null {
  const timestampMs = new Date(event.ts).getTime();
  if (!Number.isFinite(timestampMs)) return null;

  const gctl = safeFormatUnits(event.gctlMinted, DECIMALS_BY_TOKEN.GCTL);
  const originalDecimals = event.currency === "USDG" ? 6 : 18;
  const original = safeFormatUnits(event.amountRaw, originalDecimals);

  const title = labels.mintedTitle(formatCompactNumber(gctl, 2));
  const subtitle = labels.mintedSubtitle(
    formatCompactNumber(original, 2),
    event.currency === "USDG" ? "USDC" : event.currency,
  );

  return {
    id: event.txId
      ? `mint-${event.txId}`
      : `mint-${timestampMs}-${event.epoch}`,
    kind: "mint",
    timestampMs,
    txHash: event.txId,
    title,
    subtitle,
    pill: event.epoch ? labels.epochBadge(event.epoch) : undefined,
    icon: <Sparkles className="h-4 w-4" />,
    iconClassName: "text-[#22D3EE] bg-[#22D3EE]/10",
  };
}

function buildStakeActivity(
  event: StakedEvent,
  labels: RecentActivityLabels,
): ActivityItem | null {
  const timestampMs = new Date(event.ts).getTime();
  if (!Number.isFinite(timestampMs)) return null;

  const gctl = safeFormatUnits(event.amount, DECIMALS_BY_TOKEN.GCTL);
  const direction: ActivityKind =
    event.direction === "stake" ? "stake" : "unstake";
  const regionLabel =
    event.regionName ||
    (event.regionId
      ? labels.regionFallback(event.regionId)
      : labels.regionGeneric);

  const title =
    direction === "stake"
      ? labels.stakedTitle(formatCompactNumber(gctl, 0))
      : labels.unstakingTitle(formatCompactNumber(gctl, 0));

  return {
    id: `stake-${event.epoch}-${timestampMs}-${event.regionId}-${event.direction}`,
    kind: direction,
    timestampMs,
    title,
    subtitle:
      direction === "stake"
        ? labels.stakedSubtitle(regionLabel)
        : labels.unstakingSubtitle(regionLabel),
    pill: event.epoch ? labels.epochBadge(event.epoch) : undefined,
    icon:
      direction === "stake" ? (
        <TrendingUp className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      ),
    iconClassName:
      direction === "stake"
        ? "text-[#22D3EE] bg-[#22D3EE]/10"
        : "text-muted-foreground bg-muted/50",
  };
}

function buildSplitActivity(
  split: SplitActivity,
  labels: RecentActivityLabels,
): ActivityItem | null {
  const timestampMs = split.timestamp * 1000;
  if (!Number.isFinite(timestampMs)) return null;

  const launchpadCurrency =
    split.fractionType === "launchpad"
      ? resolveDelegationCurrencyFromSplitActivity({
          currency: split.currency,
          amount: split.amount,
          stepPrice: split.stepPrice,
          transactionHash: split.transactionHash,
        })
      : split.currency;
  const decimals =
    split.currencyDecimals ??
    (DECIMALS_BY_TOKEN[launchpadCurrency as keyof typeof DECIMALS_BY_TOKEN] ??
      18);
  const amount = safeFormatUnits(split.amount, decimals);

  const isMiningCenter = split.fractionType === "mining-center";
  const title = isMiningCenter
    ? labels.purchasedMinersTitle(split.stepsPurchased ?? 0)
    : labels.delegatedTitle(formatCompactNumber(amount, 0), launchpadCurrency);

  const subtitle = isMiningCenter
    ? labels.purchasedMinersSubtitle(
        formatCompactNumber(amount, 0),
        split.currency,
      )
    : undefined;

  const pill = (() => {
    if (split.isFilled) return labels.pillFilled;
    if (typeof split.progressPercent !== "number") return undefined;
    // Launchpad fractions that mix SGCTL + GLW accounting can report
    // splitsSold > totalSteps, producing nonsensical >100% values. Trust
    // isFilled as the source of truth; suppress the pill when the numbers
    // disagree rather than invent a state.
    if (split.progressPercent > 100 || split.progressPercent < 0)
      return undefined;
    return labels.pillPctFilled(Math.round(split.progressPercent));
  })();

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
    icon: isMiningCenter ? (
      <CashMinerIcon className="w-5 h-5" />
    ) : (
      <DelegationIcon className="w-5 h-5" />
    ),
    iconClassName: isMiningCenter
      ? "text-[color:var(--color-miner-contrast)] bg-[color:var(--color-miner)]/10"
      : "text-delegation-purple bg-delegation-purple/10",
  };
}

function buildSwapActivity(
  swap: SwapActivity,
  labels: RecentActivityLabels,
): ActivityItem | null {
  const timestampMs = swap.timestampMs;
  if (!Number.isFinite(timestampMs)) return null;

  const glwIn = swap.glwIn ?? 0;
  const glwOut = swap.glwOut ?? 0;
  const usdgIn = swap.usdgIn ?? 0;
  const usdgOut = swap.usdgOut ?? 0;

  const isSellingGlw = glwIn > 0 && usdgOut > 0;
  const title = isSellingGlw
    ? labels.swappedGlwToUsdg(
        formatCompactNumber(glwIn, 2),
        formatCompactNumber(usdgOut, 2),
      )
    : usdgIn > 0 && glwOut > 0
    ? labels.swappedUsdgToGlw(
        formatCompactNumber(usdgIn, 2),
        formatCompactNumber(glwOut, 2),
      )
    : labels.swap;

  const subtitle = labels.glwUsdgPool;

  return {
    id: swap.txHash ? `swap-${swap.txHash}` : `swap-${timestampMs}`,
    kind: "swap",
    timestampMs,
    txHash: swap.txHash,
    title,
    subtitle,
    pill: isSellingGlw ? labels.pillSell : labels.pillBuy,
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

function buildPointsActivity(row: V2PointsLedgerRow): ActivityItem | null {
  const timestampMs = new Date(row.createdAt).getTime();
  if (!Number.isFinite(timestampMs)) return null;

  const delta = Number(row.pointsDelta);
  const isCredit = Number.isFinite(delta) ? delta >= 0 : true;
  const magnitude = Number.isFinite(delta) ? Math.abs(delta) : 0;
  const label = POINTS_EVENT_LABELS[row.eventType] ?? row.eventType;

  return {
    id: `points-${row.id}`,
    kind: "points",
    timestampMs,
    title: `${isCredit ? "+" : "-"}${formatCompactNumber(magnitude, 2)} points`,
    subtitle: label,
    icon: <Coins className="w-5 h-5" />,
    iconClassName: isCredit
      ? "text-emerald-400 bg-emerald-500/10"
      : "text-amber-400 bg-amber-500/10",
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
  showKpis = true,
}: RecentActivityProps) {
  const { t } = useLang();
  const { isConnecting, isReconnecting } = useAccount();
  const isWalletConnecting =
    (isConnecting || isReconnecting) && !Boolean(walletAddress);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const isCardInView = useInView(cardRef, {
    once: true,
    margin: "200px 0px",
  });
  const shouldFetchWalletActivity = Boolean(walletAddress) && isCardInView;

  // Fetch wallet events data
  const {
    mintedEvents,
    stakeEvents,
    isMintedEventsLoading,
    isStakeEventsLoading,
  } = useWallets({
    walletAddress,
    enabled: shouldFetchWalletActivity,
    limit: 20, // Limit to recent 20 events
    includeWalletDetails: false,
    includeMigrationAmount: false,
  });

  // V2 point-ledger activity (earnings + spends) folded into the feed.
  const { data: pointsLedger } = useV2PointsLedger(
    shouldFetchWalletActivity ? walletAddress : null,
    { limit: 50 },
  );

  const { claims, isLoading: isClaimsLoading } = useWalletRewardClaims(
    walletAddress,
    {
      enabled: shouldFetchWalletActivity,
      // This endpoint returns per-token rows; keep a modest cap.
      limit: 400,
      query: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    }
  );

  const {
    settlements: sgctlClaimSettlements,
    isLoading: isSgctlClaimSettlementsLoading,
  } = useWalletSgctlClaimSettlements(walletAddress, {
    enabled: shouldFetchWalletActivity,
    limit: 200,
  });

  const claimActivityGroups = React.useMemo(() => {
    const claimEntryCandidates: Array<ClaimActivityEntry | null> = claims.map(
      (row) => {
        const timestampMs = normalizeTimestampMs(row.timestamp);
        if (!timestampMs) return null;

        const symbol = getTokenSymbol(row.token);
        const decimals = getRewardTokenDecimals(symbol);
        const amount = safeFormatUnits(row.amount, decimals);
        if (!Number.isFinite(amount) || amount <= 0) return null;

        return {
          groupKey: normalizeClaimActivityKey(row.txHash, row.logIndex),
          txHash: row.txHash,
          logIndex: row.logIndex,
          timestampMs,
          source: row.source,
          nonce: row.nonce,
          subIndex: row.subIndex,
          tokenSymbol: symbol,
          amount,
        } satisfies ClaimActivityEntry;
      }
    );

    const claimEntries = claimEntryCandidates.filter(
      (entry): entry is ClaimActivityEntry => entry !== null
    );

    const sgctlEntries = buildSgctlClaimActivityEntries(
      sgctlClaimSettlements,
      (rawAmount) => safeFormatUnits(rawAmount, DECIMALS_BY_TOKEN.GCTL)
    );

    return groupClaimActivityEntries([...claimEntries, ...sgctlEntries]);
  }, [claims, sgctlClaimSettlements]);

  // Calculate KPIs from activities
  const kpis = React.useMemo(() => {
    let totalTransactions = 0;
    let delegationsCount = 0;
    let minersCount = 0;
    let totalClaimed = 0;

    splitsActivity.forEach((split) => {
      totalTransactions++;
      if (split.fractionType === "mining-center") {
        minersCount += split.stepsPurchased ?? 0;
      } else {
        delegationsCount++;
      }
    });

    claimActivityGroups.forEach((group) => {
      group.tokenEntries.forEach(([, amount]) => {
        totalClaimed += amount;
      });
    });

    totalTransactions += mintedEvents.length;
    totalTransactions += stakeEvents.length;
    totalTransactions += swapsActivity.length;
    totalTransactions += claimActivityGroups.length;

    return {
      totalTransactions,
      delegationsCount,
      minersCount,
      totalClaimed,
    };
  }, [claimActivityGroups, mintedEvents, stakeEvents, splitsActivity, swapsActivity]);

  // Combine and format all activities
  const labels = t.widgets.recentActivity;
  const activities = React.useMemo(() => {
    const all: ActivityItem[] = [];

    mintedEvents.forEach((evt) => {
      const item = buildMintActivity(evt, labels);
      if (item) all.push(item);
    });

    stakeEvents.forEach((evt) => {
      const item = buildStakeActivity(evt, labels);
      if (item) all.push(item);
    });

    splitsActivity.forEach((split) => {
      const item = buildSplitActivity(split, labels);
      if (item) all.push(item);
    });

    swapsActivity.forEach((swap) => {
      const item = buildSwapActivity(swap, labels);
      if (item) all.push(item);
    });

    claimActivityGroups.forEach((group) => {
      const item = buildClaimActivity(group, labels);
      if (item) all.push(item);
    });

    (pointsLedger?.rows ?? []).forEach((row) => {
      const item = buildPointsActivity(row);
      if (item) all.push(item);
    });

    return all.sort((a, b) => {
      const timeDiff = b.timestampMs - a.timestampMs;
      if (timeDiff !== 0) return timeDiff;

      // Tie-breaker: if timestamps are identical, mint is "older" than stake
      // (appears lower in a latest-to-oldest list)
      if (a.kind === "mint" && b.kind === "stake") return 1;
      if (a.kind === "stake" && b.kind === "mint") return -1;

      return 0;
    });
  }, [
    claimActivityGroups,
    labels,
    mintedEvents,
    stakeEvents,
    splitsActivity,
    swapsActivity,
    pointsLedger,
  ]);

  const isLoading =
    (Boolean(walletAddress) && !isCardInView) ||
    isMintedEventsLoading ||
    isStakeEventsLoading ||
    isSplitsActivityLoading ||
    isSwapsActivityLoading ||
    isClaimsLoading ||
    isSgctlClaimSettlementsLoading ||
    isWalletConnecting;

  const handleViewTransaction = React.useCallback((activity: ActivityItem) => {
    if (!activity.txHash) {
      toast.info(labels.toastTxUnavailable);
      return;
    }
    window.open(
      getExplorerUrl(activity.txHash),
      "_blank",
      "noopener,noreferrer"
    );
  }, [labels]);

  if (hideIfEmpty && !isLoading && activities.length === 0) return null;

  const displayedActivities = maxItems
    ? activities.slice(0, maxItems)
    : activities;

  return (
    <div ref={cardRef}>
      <Card
        className={cn(
          "h-full lg:max-h-[380px] overflow-hidden flex flex-col gap-4 pt-6 pb-0",
          className
        )}
      >
      {showHeader ? (
        <CardHeader className="py-0 px-6">
          <div className="flex items-center justify-between gap-3">
            <CardTitle
              className={cn(
                headerVariant === "small" &&
                  "text-lg font-semibold tracking-tight text-foreground",
                headerVariant !== "small" && "tracking-tight"
              )}
            >
              {t.widgets.recentActivity.title}
            </CardTitle>
            {headerRight ?? (
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {t.widgets.recentActivity.live}
              </span>
            )}
          </div>
        </CardHeader>
      ) : null}

      {showKpis && !isLoading && activities.length > 0 && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {labels.kpiTotal}
              </div>
              <div className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {kpis.totalTransactions}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/60 dark:text-muted-foreground/80">
                {labels.kpiTransactions}
              </div>
            </div>
            <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {labels.kpiDelegations}
              </div>
              <div className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {kpis.delegationsCount}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/60 dark:text-muted-foreground/80">
                {labels.kpiDelegationsSub}
              </div>
            </div>
            <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {labels.kpiMiners}
              </div>
              <div className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {kpis.minersCount}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/60 dark:text-muted-foreground/80">
                {labels.kpiMinersSub}
              </div>
            </div>
            <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {labels.kpiClaimed}
              </div>
              <div className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {formatCompactNumber(kpis.totalClaimed, 0)}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/60 dark:text-muted-foreground/80">
                {labels.kpiClaimedSub}
              </div>
            </div>
          </div>
        </div>
      )}

      <CardContent className="min-h-0 flex-1 px-6 pb-6">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3 animate-pulse"
              >
                <div className="h-9 w-9 rounded-lg bg-muted/50 dark:bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted/50 dark:bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted/50 dark:bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="h-full min-h-0 flex items-center justify-center text-center text-muted-foreground px-6">
            <div>
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <div className="text-sm font-medium text-foreground/80">
                {labels.emptyTitle}
              </div>
              <div className="text-xs mt-1">
                {labels.emptyBody}
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
                    className="group flex items-start gap-3 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3 hover:bg-muted/50 dark:hover:bg-muted/70 transition-colors"
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
                        "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                        activity.iconClassName
                      )}
                    >
                      {activity.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tracking-tight text-foreground truncate">
                              {activity.title}
                            </span>
                            {activity.pill ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-mono uppercase flex-shrink-0"
                              >
                                {activity.pill}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 text-[11px] font-mono text-muted-foreground">
                            <span className="tabular-nums whitespace-nowrap">
                              {formatDateTime(activity.timestampMs)}
                            </span>
                            {activity.subtitle ? (
                              <span className="hidden sm:inline ml-2 truncate">
                                {activity.subtitle}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-8 w-8 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex",
                            !activity.txHash && "pointer-events-none"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewTransaction(activity);
                          }}
                          aria-label={labels.ariaViewTx}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
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
                      className="group flex items-start gap-3 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3 hover:bg-muted/50 dark:hover:bg-muted/70 transition-colors"
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
                          "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                          activity.iconClassName
                        )}
                      >
                        {activity.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold tracking-tight text-foreground truncate">
                                {activity.title}
                              </span>
                              {activity.pill ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] font-mono uppercase flex-shrink-0"
                                >
                                  {activity.pill}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 text-[11px] font-mono text-muted-foreground">
                              <span className="tabular-nums whitespace-nowrap">
                                {formatDateTime(activity.timestampMs)}
                              </span>
                              {activity.subtitle ? (
                                <span className="hidden sm:inline ml-2 truncate">
                                  {activity.subtitle}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-8 w-8 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex",
                              !activity.txHash && "pointer-events-none"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewTransaction(activity);
                            }}
                            aria-label={labels.ariaViewTx}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}
