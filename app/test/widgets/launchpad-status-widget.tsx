"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  ShoppingCart,
  ArrowUpRight,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Info,
  HelpCircle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AnimatedCountdownDhms,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import { useLaunchpadStatus } from "@/hooks/useLaunchpadStatus";
import { filterPublicLaunchpadApplications } from "@/utils/launchpad";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import { normalizeMinerWeeksRemainingDisplay } from "@/lib/mining-score";
import {
  useGlowLaunchpad,
  useMiningCenter,
  useRewardScore,
  useMiningScore,
  getRewardScoreForApplication,
  getMiningScoreForApplication,
  isFractionOpenForMarketplace,
  type AuctionApplication,
} from "@/hooks";
import { getLaunchpadNowMs } from "@/utils/launchpad-now";
import {
  calculateLaunchpadPerShareRewards,
  parseDelegationStepAmount,
} from "@/utils/launchpad-rewards";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { SponsoredFarmsActivity } from "@/app/marketplace/sponsored-farms-activity";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { trackEvent } from "@/lib/telemetry";
import { useAccount } from "wagmi";
import Link from "next/link";
import { CashMinerIcon, DelegationIcon } from "@/components/impact-icons";
import type {
  LaunchpadRewardScore,
  MiningCenterScore,
} from "@/app/marketplace/deposit-dialog";
import { LaunchpadView } from "@/app/marketplace/launchpad-view";
import type { TaggedAuctionApplication } from "@/app/marketplace/launchpad-view";
import { GlowSymbol } from "@/components/glow-symbol";
import { FallbackImage } from "@/components/ui/fallback-image";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { formatUnits } from "viem";
import { LaunchpadStatsDialog } from "@/app/marketplace/launchpad-stats-dialog";
import { MiningStatsDialog } from "@/app/marketplace/mining-stats-dialog";
import { getListingVisibleStartAtMs } from "@/utils/launchpad";

const DEFINED_POOL_ACTIVITY_URL =
  "https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";
const ONE_HOUR_MS = 60 * 60 * 1000;

function formatUsdPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$—";
  const decimals = value < 1 ? 3 : 2;
  return `$${value.toFixed(decimals)}`;
}

function formatSignedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function countAvailableApplications(
  applications: Array<{
    activeFraction: AuctionApplication["activeFraction"];
  }>,
) {
  return applications.reduce((count, app) => {
    const hasAvailability = isFractionOpenForMarketplace(app.activeFraction);
    return hasAvailability ? count + 1 : count;
  }, 0);
}

// Helper: Get availability info for an application
function getActiveFractionAvailability(application: AuctionApplication) {
  const fraction = application.activeFraction;
  if (!fraction) {
    return { remaining: 0, total: 0, isSoldOut: true, percentFilled: 100 };
  }
  const total = fraction.totalSteps ?? 0;
  const remaining = fraction.remainingSteps ?? 0;
  const isSoldOut = !isFractionOpenForMarketplace(fraction);
  const filled = total - remaining;
  const percentFilled = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { remaining, total, isSoldOut, percentFilled };
}

function getDelegationPaymentCurrency(
  application: AuctionApplication,
): "SGCTL" | "GLW" {
  const asset = application.activeFraction?.delegationAsset;
  if (asset === "SGCTL" || asset === "GLW") return asset;
  if (application.paymentCurrency === "SGCTL") return "SGCTL";
  return "GLW";
}

function getPaymentCurrencyDecimals(
  currency: "USDC" | "GLW" | "SGCTL",
): number {
  if (currency === "SGCTL") return DECIMALS_BY_TOKEN.GCTL;
  return DECIMALS_BY_TOKEN[currency];
}

// Helper: Format number with appropriate precision
function formatNumber(value: number, decimals: number = 2): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Helper: Format time to sell out
function formatTimeToSellOut(
  startAt: number | string | null,
  filledTimestamp: string | null,
): string {
  if (!startAt || !filledTimestamp) return "—";
  try {
    const published =
      typeof startAt === "number" ? startAt : new Date(startAt).getTime();
    const filled = new Date(filledTimestamp).getTime();
    if (!Number.isFinite(published) || !Number.isFinite(filled)) return "—";
    const durationMs = filled - published;
    if (durationMs <= 0) return "—";
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  } catch {
    return "—";
  }
}

function formatMinerWeeksLabel(weeks?: number | null): string {
  if (typeof weeks !== "number" || !Number.isFinite(weeks) || weeks <= 0) {
    return "99 weeks";
  }

  const roundedWeeks = Math.floor(weeks);
  return `${roundedWeeks} week${roundedWeeks === 1 ? "" : "s"}`;
}

function getMinerWeeksRemaining(
  scoreData: LaunchpadRewardScore | MiningCenterScore | null,
): number | null {
  if (!scoreData || "userWeeklyGlwRewards" in scoreData) {
    return null;
  }

  return normalizeMinerWeeksRemainingDisplay(
    scoreData.weeksOfMinerLifeRemaining,
  );
}

function formatEtDateTime(value: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(value);
}

// Extended type for applications with type tagging
type LocalTaggedApplication = AuctionApplication & {
  _type: "miners" | "delegations";
};

// Row data structure for the grid
interface ListingRow {
  application: LocalTaggedApplication;
  availability: ReturnType<typeof getActiveFractionAvailability>;
  score: number;
  scoreData: LaunchpadRewardScore | MiningCenterScore | null;
  cost: number;
  weeklyYield: number;
  weeklyPdYield: number;
  weeklyYieldUsd: number;
  totalAmountNeeded: number;
  rewardScore: number | null;
}

// ============================================================================
// Full Row Launchpad Grid Component - exactly.ai inspired design
// ============================================================================

interface FullRowLaunchpadGridProps {
  onPayDeposit?: (
    application: TaggedAuctionApplication,
    scoreData?: LaunchpadRewardScore | MiningCenterScore | null,
  ) => void;
}

function FullRowLaunchpadGrid({ onPayDeposit }: FullRowLaunchpadGridProps) {
  const { address, isConnected } = useAccount();
  const walletAddress = address?.toLowerCase() ?? null;
  const source = "launchpad_status_widget_fullrow";
  const { spotPriceUsd: glwSpotPrice } = useGlowSpotPriceSummary();
  const isMobile = useIsMobile();

  // Tab filter state
  type TabFilter = "all" | "delegations" | "miners";
  const [activeTab, setActiveTab] = React.useState<TabFilter>("all");
  const [pageIndex, setPageIndex] = React.useState(0);

  // Stats dialog state
  const [statsDialogOpen, setStatsDialogOpen] = React.useState(false);
  const [selectedApplicationForStats, setSelectedApplicationForStats] =
    React.useState<LocalTaggedApplication | null>(null);
  const [selectedScoreDataForStats, setSelectedScoreDataForStats] =
    React.useState<LaunchpadRewardScore | MiningCenterScore | null>(null);

  // Fetch delegations
  const {
    applications: delegationApplications,
    isLoading: isDelegationsLoading,
  } = useGlowLaunchpad({
    filters: { includeFilled: true },
  });

  // Fetch miners
  const { applications: minerApplications, isLoading: isMinersLoading } =
    useMiningCenter({
      filters: { paymentCurrency: "USDC", includeFilled: true },
    });

  // Tag applications with their type
  const taggedDelegations = React.useMemo<LocalTaggedApplication[]>(
    () =>
      filterPublicLaunchpadApplications(delegationApplications).map((app) => ({
        ...app,
        _type: "delegations" as const,
      })),
    [delegationApplications],
  );

  const taggedMiners = React.useMemo<LocalTaggedApplication[]>(
    () =>
      minerApplications.map((app) => ({ ...app, _type: "miners" as const })),
    [minerApplications],
  );

  const activeDelegationsForScores = React.useMemo(
    () =>
      taggedDelegations.filter((app) => {
        const availability = getActiveFractionAvailability(app);
        return !availability.isSoldOut;
      }),
    [taggedDelegations],
  );

  const activeMinersForScores = React.useMemo(
    () =>
      taggedMiners.filter((app) => {
        const availability = getActiveFractionAvailability(app);
        return !availability.isSoldOut;
      }),
    [taggedMiners],
  );

  // Fetch scores
  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications: activeDelegationsForScores,
    paymentCurrency: "GLW",
    enabled: activeDelegationsForScores.length > 0,
    walletAddress: address || null,
  });

  const { miningScoreMap, isLoading: isMiningScoresLoading } = useMiningScore({
    applications: activeMinersForScores,
    extraLiveApplications: taggedDelegations,
    enabled: activeMinersForScores.length > 0,
  });

  // Count available listings per type
  const delegationsAvailableCount = React.useMemo(
    () => countAvailableApplications(taggedDelegations),
    [taggedDelegations],
  );
  const minersAvailableCount = React.useMemo(
    () => countAvailableApplications(minerApplications),
    [minerApplications],
  );

  // Build rows with metrics
  const allRows = React.useMemo(() => {
    const allApplications = [...taggedDelegations, ...taggedMiners];

    return allApplications.map((application) => {
      const availability = getActiveFractionAvailability(application);
      const delegationCurrency =
        application._type === "delegations"
          ? getDelegationPaymentCurrency(application)
          : null;

      const reward = getRewardScoreForApplication(
        rewardScoreMap,
        application.id,
      );
      const mining = getMiningScoreForApplication(
        miningScoreMap,
        application.id,
      );

      const score =
        application._type === "delegations"
          ? (reward?.rewardScore ?? 0)
          : (mining?.miningScore ?? 0);

      const scoreData: LaunchpadRewardScore | MiningCenterScore | null =
        application._type === "delegations"
          ? reward
            ? {
                userWeeklyGlwRewards: reward.userWeeklyGlwRewards,
                userWeeklyPdRewards: reward.userWeeklyPdRewards,
              }
            : null
          : mining
            ? {
                miningScore: mining.miningScore,
                weeklyGlwRewards: mining.weeklyGlwRewards,
                weeklyGlwRewardsUsd: mining.weeklyGlwRewardsUsd,
                weeksOfMinerLifeRemaining: mining.weeksOfMinerLifeRemaining,
              }
            : null;

      const cost = (() => {
        try {
          if (!application.activeFraction) return 0;
          if (application._type === "miners") {
            return parseFloat(
              formatUnits(
                BigInt(application.activeFraction.stepPrice || "0"),
                DECIMALS_BY_TOKEN.USDC,
              ),
            );
          }
          return parseDelegationStepAmount(application);
        } catch {
          return 0;
        }
      })();

      const weeklyYield = (() => {
        try {
          if (application._type === "miners") {
            if (!mining?.weeklyGlwRewards) return 0;
            return parseFloat(
              formatUnits(
                BigInt(mining.weeklyGlwRewards),
                DECIMALS_BY_TOKEN.GLW,
              ),
            );
          }
          const totalShares = application.activeFraction?.totalSteps || 0;
          if (!reward || !totalShares) return 0;
          return calculateLaunchpadPerShareRewards({
            reward,
            totalShares,
            delegationCurrency: delegationCurrency || "GLW",
            glwSpotPrice: glwSpotPrice || 0,
          }).totalGlwPerShare;
        } catch {
          return 0;
        }
      })();
      const weeklyPdYield = (() => {
        try {
          if (application._type === "miners") return 0;
          const totalShares = application.activeFraction?.totalSteps || 0;
          if (!reward || !totalShares) return 0;
          const pdRewards = parseFloat(
            formatUnits(
              BigInt(reward.userWeeklyPdRewards || "0"),
              getPaymentCurrencyDecimals(delegationCurrency || "GLW"),
            ),
          );
          return pdRewards / totalShares;
        } catch {
          return 0;
        }
      })();

      const totalAmountNeeded = (() => {
        if (!application.activeFraction) return 0;
        if (application._type === "delegations") {
          const totalSteps = application.activeFraction.totalSteps ?? 0;
          if (!Number.isFinite(cost) || cost <= 0 || totalSteps <= 0) return 0;
          return cost * totalSteps;
        }
        if (!application.activeFraction.totalAmountNeeded) return 0;
        return parseFloat(
          formatUnits(
            BigInt(application.activeFraction.totalAmountNeeded),
            DECIMALS_BY_TOKEN.USDC,
          ),
        );
      })();

      // Calculate USD value per delegation, including PD recovery USD for SGCTL phase.
      const weeklyYieldUsd = (() => {
        if (application._type === "miners") {
          return weeklyYield * (glwSpotPrice || 0);
        }
        const totalShares = application.activeFraction?.totalSteps || 0;
        if (!reward || totalShares <= 0) {
          return weeklyYield * (glwSpotPrice || 0);
        }
        return calculateLaunchpadPerShareRewards({
          reward,
          totalShares,
          delegationCurrency: delegationCurrency || "GLW",
          glwSpotPrice: glwSpotPrice || 0,
        }).totalUsdPerShare;
      })();

      // Get reward score for delegations
      const rewardScore =
        application._type === "delegations"
          ? (reward?.rewardScore ?? null)
          : null;

      return {
        application,
        availability,
        score,
        scoreData,
        cost,
        weeklyYield,
        weeklyPdYield,
        weeklyYieldUsd,
        totalAmountNeeded,
        rewardScore,
      };
    });
  }, [
    taggedDelegations,
    taggedMiners,
    rewardScoreMap,
    miningScoreMap,
    glwSpotPrice,
  ]);

  // Filter and sort rows based on active tab
  const filteredRows = React.useMemo(() => {
    let filtered = allRows;

    // Filter by type
    if (activeTab === "delegations") {
      filtered = allRows.filter((r) => r.application._type === "delegations");
    } else if (activeTab === "miners") {
      filtered = allRows.filter((r) => r.application._type === "miners");
    }

    // Partition into active and sold out
    const activeRows = filtered.filter((r) => !r.availability.isSoldOut);
    const soldOutRows = filtered
      .filter((r) => r.availability.isSoldOut)
      .sort((a, b) => {
        const aTime = new Date(
          a.application.activeFraction?.filledAt ||
            a.application.activeFraction?.createdAt ||
            0,
        ).getTime();
        const bTime = new Date(
          b.application.activeFraction?.filledAt ||
            b.application.activeFraction?.createdAt ||
            0,
        ).getTime();
        return bTime - aTime;
      });

    // Sort active rows
    if (activeTab === "all") {
      // In "all" tab: delegations first, then miners, sorted by score within each group
      activeRows.sort((a, b) => {
        if (a.application._type !== b.application._type) {
          return a.application._type === "delegations" ? -1 : 1;
        }
        return (b.score ?? 0) - (a.score ?? 0);
      });
    } else if (activeTab === "delegations") {
      activeRows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }

    // Combine: active first, then sold out to fill minimum of 2
    let finalRows = [...activeRows];
    if (finalRows.length < 2) {
      const needed = 2 - finalRows.length;
      finalRows = [...finalRows, ...soldOutRows.slice(0, needed)];
    }

    return finalRows;
  }, [allRows, activeTab]);

  const cardsPerPage = isMobile ? 1 : 2;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / cardsPerPage));
  const pagedRows = React.useMemo(() => {
    const start = pageIndex * cardsPerPage;
    return filteredRows.slice(start, start + cardsPerPage);
  }, [cardsPerPage, filteredRows, pageIndex]);

  React.useEffect(() => {
    setPageIndex(0);
  }, [activeTab, cardsPerPage]);

  React.useEffect(() => {
    setPageIndex((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const isLoading = isDelegationsLoading || isMinersLoading;

  // Determine which tabs to show (hide if no listings of that type)
  const showDelegationsTab = taggedDelegations.length > 0;
  const showMinersTab = minerApplications.length > 0;
  const showAllTab = showDelegationsTab || showMinersTab;

  // Handle card click
  const handleCardClick = React.useCallback(
    (row: ListingRow) => {
      if (row.availability.isSoldOut || !row.scoreData) return;
      trackEvent("dashboard_launchpad_card_click", {
        source,
        wallet_connected: isConnected,
        wallet_address: walletAddress,
        application_id: row.application.id,
        listing_type: row.application._type,
      });
      onPayDeposit?.(
        row.application as TaggedAuctionApplication,
        row.scoreData,
      );
    },
    [isConnected, walletAddress, onPayDeposit],
  );

  // Render a single listing card - image-at-top, content-below design
  const renderListingCard = (row: ListingRow, index: number) => {
    const {
      application,
      availability,
      cost,
      weeklyYield,
      weeklyPdYield,
      weeklyYieldUsd,
      totalAmountNeeded,
      rewardScore,
    } = row;
    const isMiner = application._type === "miners";
    const isRowScoreLoading = isMiner
      ? isMiningScoresLoading
      : isRewardScoresLoading;
    const currency = isMiner
      ? "USDC"
      : getDelegationPaymentCurrency(application);
    const delegationCurrency = currency === "SGCTL" ? "SGCTL" : "GLW";
    const imageUrl = application.afterInstallPictures?.[0]?.url;
    // Some datasets include the same application id for both listing types.
    // Include type + fraction identity to prevent React key collisions.
    const cardKey = `${application._type}:${application.id}:${
      application.activeFraction?.id ??
      application.activeFraction?.nonce ??
      index
    }`;

    return (
      <div
        key={cardKey}
        onClick={() => handleCardClick(row)}
        className={cn(
          "group overflow-hidden rounded-2xl cursor-pointer flex flex-col",
          "bg-card dark:bg-card border border-border/20 dark:border-border/40",
          "transition-all duration-300",
          availability.isSoldOut
            ? "opacity-60 cursor-default"
            : "hover:ring-2 hover:ring-border/40 dark:hover:ring-border/60 hover:-translate-y-0.5",
        )}
      >
        {/* Image Section */}
        <div className="relative aspect-[5/3] md:aspect-[2/1] m-2.5 sm:m-3 mb-0 rounded-xl overflow-hidden">
          {imageUrl ? (
            <FallbackImage
              src={imageUrl}
              widthForProxy={800}
              quality={85}
              alt={application.farmName || "Farm"}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-muted/30 dark:bg-muted/50" />
          )}
          {/* Light gradient for badge visibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent rounded-xl" />

          {/* Top Left: Category Badge */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
            <div
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold backdrop-blur-xl shadow-sm",
                isMiner
                  ? "bg-white/90 dark:bg-black/60 text-foreground dark:text-white border border-[color:var(--color-miner)]/50"
                  : "bg-white/90 dark:bg-black/60 text-foreground dark:text-white border border-purple-400/50",
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isMiner ? "bg-[color:var(--color-miner)]" : "bg-purple-400",
                )}
              />
              {isMiner ? "Miner" : "Delegation"}
            </div>
          </div>

          {/* Top Right: Stats Button or Sold Out Badge */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
            {availability.isSoldOut ? (
              <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold bg-white/90 dark:bg-black/60 text-foreground dark:text-white backdrop-blur-xl border border-border/20 dark:border-white/20 shadow-sm">
                Sold Out
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  trackEvent("dashboard_launchpad_stats_click", {
                    source,
                    wallet_connected: isConnected,
                    wallet_address: walletAddress,
                    application_id: application.id,
                    listing_type: application._type,
                  });
                  setSelectedApplicationForStats(application);
                  setSelectedScoreDataForStats(row.scoreData);
                  setStatsDialogOpen(true);
                }}
                className="backdrop-blur-xl bg-white/90 dark:bg-black/60 hover:bg-white dark:hover:bg-black/70 border border-border/20 dark:border-white/20 text-foreground dark:text-white rounded-full px-2.5 sm:px-3 h-7 sm:h-8 text-[10px] sm:text-xs font-semibold transition-all shadow-sm"
              >
                <span className="hidden sm:inline">Advanced Stats</span>
                <span className="sm:hidden">Stats</span>
                <ArrowUpRight className="ml-1 w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex flex-col flex-1 p-4 sm:p-5 md:p-6">
          {/* Title and Location */}
          <div className="mb-3 sm:mb-4">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-tight line-clamp-1">
              {application.farmName || "Unnamed Farm"}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5 text-muted-foreground text-xs sm:text-sm">
              <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{application.zone?.name || "Unknown Region"}</span>
            </div>
          </div>

          {/* Stats Grid - responsive: 2 cols on mobile, 3 on desktop for delegations */}
          <div
            className={cn(
              "grid gap-1.5 sm:gap-2 mt-auto",
              isMiner ? "grid-cols-2" : "grid-cols-3",
            )}
          >
            {/* Column 1: Price/Amount */}
            <div className="flex flex-col p-2 sm:p-3 rounded-lg bg-muted/30 dark:bg-muted/50">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 sm:mb-1">
                {availability.isSoldOut
                  ? isMiner
                    ? "Total"
                    : "Delegated"
                  : isMiner
                    ? "Price"
                    : "Amount"}
              </span>
              <div className="flex items-baseline gap-0.5 sm:gap-1">
                <span className="text-base sm:text-lg font-bold text-foreground font-mono tabular-nums leading-tight">
                  {availability.isSoldOut ? (
                    <>
                      {isMiner && "$"}
                      {Math.round(totalAmountNeeded).toLocaleString()}
                    </>
                  ) : cost > 0 ? (
                    <>
                      {isMiner && "$"}
                      {Math.round(cost).toLocaleString()}
                    </>
                  ) : (
                    "Free"
                  )}
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                  {currency}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                {availability.isSoldOut
                  ? "filled"
                  : `${availability.remaining}/${availability.total} left`}
              </span>
            </div>

            {/* Column 2: Weekly Rewards or Time to Sell */}
            {availability.isSoldOut ? (
              <div className="flex flex-col p-2 sm:p-3 rounded-lg bg-muted/30 dark:bg-muted/50">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 sm:mb-1">
                  Sold In
                </span>
                <span className="text-base sm:text-lg font-bold text-foreground leading-tight">
                  {formatTimeToSellOut(
                    getListingVisibleStartAtMs(application),
                    application.activeFraction?.filledAt || null,
                  )}
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                  to fill
                </span>
              </div>
            ) : isRowScoreLoading ? (
              <div className="flex flex-col p-2 sm:p-3 rounded-lg bg-muted/30 dark:bg-muted/50">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 sm:mb-1">
                  Est. Weekly
                </span>
                <Skeleton className="h-5 w-16 sm:w-20 mb-1" />
                <Skeleton className="h-3 w-12 sm:w-16" />
              </div>
            ) : weeklyYield > 0 ||
              (!isMiner &&
                delegationCurrency === "SGCTL" &&
                weeklyPdYield > 0) ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col p-2 sm:p-3 rounded-lg bg-muted/30 dark:bg-muted/50 cursor-help">
                    <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Est. Weekly
                      </span>
                      <HelpCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-muted-foreground/60" />
                    </div>
                    <div className="flex items-baseline gap-0.5 sm:gap-1 flex-wrap">
                      {isMiner || delegationCurrency !== "SGCTL" ? (
                        <>
                          <span className="text-base sm:text-lg font-bold text-foreground font-mono tabular-nums leading-tight">
                            +{formatNumber(weeklyYield, 1)}
                          </span>
                          <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                            GLW
                            {weeklyYieldUsd > 0 &&
                              ` · $${formatNumber(weeklyYieldUsd, 2)}`}
                          </span>
                        </>
                      ) : (
                        <span className="text-base font-bold text-foreground font-mono tabular-nums leading-tight">
                          +{formatNumber(weeklyYield, 1)} GLW +{" "}
                          {formatNumber(weeklyPdYield, 1)} SGCTL
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                      {isMiner
                        ? `for ${formatMinerWeeksLabel(
                            getMinerWeeksRemaining(row.scoreData),
                          )}`
                        : "for 100 weeks"}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {isMiner ? (
                    <p className="text-xs">
                      {`Estimated weekly rewards per miner, paid for ${formatMinerWeeksLabel(
                        getMinerWeeksRemaining(row.scoreData),
                      )}. May decrease as new farms join.`}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Weekly reward breakdown (per delegation). Estimates
                        update weekly as new farms and regions join the
                        protocol.
                      </p>
                      {row.scoreData &&
                      "userWeeklyGlwRewards" in row.scoreData &&
                      application.activeFraction?.totalSteps
                        ? (() => {
                            const totalShares =
                              application.activeFraction?.totalSteps || 0;
                            const glwRewards = parseFloat(
                              formatUnits(
                                BigInt(
                                  row.scoreData.userWeeklyGlwRewards || "0",
                                ),
                                DECIMALS_BY_TOKEN.GLW,
                              ),
                            );
                            const pdRewards = parseFloat(
                              formatUnits(
                                BigInt(
                                  row.scoreData.userWeeklyPdRewards || "0",
                                ),
                                getPaymentCurrencyDecimals(delegationCurrency),
                              ),
                            );
                            const glwPerShare =
                              totalShares > 0 ? glwRewards / totalShares : 0;
                            const pdPerShare =
                              totalShares > 0 ? pdRewards / totalShares : 0;

                            return (
                              <div className="space-y-1.5 pt-2 border-t border-border/20 dark:border-border/40">
                                <div className="flex justify-between gap-4 text-xs">
                                  <span className="text-muted-foreground">
                                    Emissions
                                  </span>
                                  <span className="font-mono font-medium">
                                    +
                                    {glwPerShare.toLocaleString(undefined, {
                                      maximumFractionDigits: 1,
                                    })}{" "}
                                    GLW
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4 text-xs">
                                  <span className="text-muted-foreground">
                                    PD Recovery
                                  </span>
                                  <span className="font-mono font-medium">
                                    +
                                    {pdPerShare.toLocaleString(undefined, {
                                      maximumFractionDigits: 1,
                                    })}{" "}
                                    {delegationCurrency}
                                  </span>
                                </div>
                              </div>
                            );
                          })()
                        : null}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex flex-col p-2 sm:p-3 rounded-lg bg-muted/30 dark:bg-muted/50">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 sm:mb-1">
                  Est. Weekly
                </span>
                <span className="text-base sm:text-lg font-bold text-muted-foreground leading-tight">
                  —
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                  unavailable
                </span>
              </div>
            )}

            {/* Column 3: Reward Score (delegations only) */}
            {!isMiner &&
              (isRowScoreLoading ? (
                <div className="flex flex-col p-2 sm:p-3 rounded-lg bg-muted/30 dark:bg-muted/50">
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 sm:mb-1">
                    Score
                  </span>
                  <Skeleton className="h-5 w-10 sm:w-12 mb-1" />
                  <Skeleton className="h-3 w-16 sm:w-20" />
                </div>
              ) : rewardScore !== null ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col p-2 sm:p-3 rounded-lg bg-muted/30 dark:bg-muted/50 cursor-help">
                      <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Score
                        </span>
                        <Info className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-muted-foreground/60" />
                      </div>
                      <span className="text-base sm:text-lg font-bold text-foreground font-mono tabular-nums leading-tight">
                        {Math.round(rewardScore)}
                      </span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                        Reward Score
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Combines deposit recovery and GLW emissions into expected
                      rewards per dollar. Higher is better.
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex flex-col p-2 sm:p-3 rounded-lg bg-muted/30 dark:bg-muted/50" />
              ))}
          </div>

          {/* Action Button Row */}
          <div className="mt-3 sm:mt-4">
            {availability.isSoldOut ? (
              <Button
                variant="outline"
                className={cn(
                  "w-full rounded-xl h-11",

                  "transition-all duration-200",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(
                    `https://glow.org/audits/${application.id}`,
                    "_blank",
                  );
                }}
              >
                View Audit <ArrowUpRight className="ml-1.5 w-4 h-4" />
              </Button>
            ) : isMiner ? (
              <div className="flex justify-end">
                <Button
                  className={cn(
                    "w-full",

                    "transition-all duration-200",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(row);
                  }}
                >
                  Purchase Miner <ArrowUpRight className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Button
                className={cn(
                  "w-full ",

                  "transition-all duration-200",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick(row);
                }}
              >
                {`Delegate ${currency}`}{" "}
                <ArrowUpRight className="ml-1.5 w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Tabs skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-20 rounded-full" />
        </div>
        {/* Cards skeleton - matching new card structure */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/20 dark:border-border/40 overflow-hidden"
            >
              <div className="p-3 pb-0">
                <Skeleton className="aspect-[5/3] md:aspect-[2/1] w-full rounded-xl" />
              </div>
              <div className="p-4 sm:p-5 md:p-6 space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  <Skeleton className="h-16 sm:h-20 rounded-lg" />
                  <Skeleton className="h-16 sm:h-20 rounded-lg" />
                  <Skeleton className="h-16 sm:h-20 rounded-lg hidden sm:block" />
                </div>
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No listings state
  if (filteredRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <GlowSymbol className="h-12 w-12 mb-4 opacity-50" />
        <div className="text-sm text-muted-foreground">
          No listings available at this time.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-card dark:bg-card border border-border/20 p-4 sm:p-6 lg:p-8 space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {showAllTab && (
          <button
            onClick={() => {
              trackEvent("dashboard_launchpad_tab_change", {
                source,
                wallet_connected: isConnected,
                wallet_address: walletAddress,
                tab: "all",
              });
              setActiveTab("all");
            }}
            className={cn(
              "px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === "all"
                ? "bg-foreground text-background"
                : "bg-muted/30 dark:bg-muted/50 text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted/70",
            )}
          >
            All{" "}
            <span className="ml-0.5 sm:ml-1 font-mono tabular-nums text-[10px] sm:text-xs opacity-70">
              {delegationsAvailableCount + minersAvailableCount}
            </span>
          </button>
        )}
        {showDelegationsTab && (
          <button
            onClick={() => {
              trackEvent("dashboard_launchpad_tab_change", {
                source,
                wallet_connected: isConnected,
                wallet_address: walletAddress,
                tab: "delegations",
              });
              setActiveTab("delegations");
            }}
            className={cn(
              "px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 sm:gap-2",
              activeTab === "delegations"
                ? "bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                : "bg-muted/30 dark:bg-muted/50 text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted/70",
            )}
          >
            <DelegationIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Delegations</span>
            <span className="sm:hidden">Deleg.</span>{" "}
            <span className="font-mono tabular-nums text-[10px] sm:text-xs opacity-70">
              {delegationsAvailableCount}
            </span>
          </button>
        )}
        {showMinersTab && (
          <button
            onClick={() => {
              trackEvent("dashboard_launchpad_tab_change", {
                source,
                wallet_connected: isConnected,
                wallet_address: walletAddress,
                tab: "miners",
              });
              setActiveTab("miners");
            }}
            className={cn(
              "px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 sm:gap-2",
              activeTab === "miners"
                ? "bg-[color:var(--color-miner)]/20 text-[color:var(--color-miner-contrast)] border border-[color:var(--color-miner)]/30"
                : "bg-muted/30 dark:bg-muted/50 text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted/70",
            )}
          >
            <CashMinerIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Miners{" "}
            <span className="font-mono tabular-nums text-[10px] sm:text-xs opacity-70">
              {minersAvailableCount}
            </span>
          </button>
        )}
      </div>

      {/* Cards Grid - Always 2 columns on desktop */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pagedRows.map((row, index) =>
            renderListingCard(row, pageIndex * cardsPerPage + index),
          )}
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              {pageIndex + 1} / {pageCount}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  trackEvent("dashboard_launchpad_carousel_click", {
                    source,
                    wallet_connected: isConnected,
                    wallet_address: walletAddress,
                    direction: "previous",
                    tab: activeTab,
                    page: pageIndex,
                  });
                  setPageIndex((current) => Math.max(0, current - 1));
                }}
                disabled={pageIndex === 0}
                className="h-9 w-9 rounded-full border border-border/20"
                aria-label="Previous listings"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  trackEvent("dashboard_launchpad_carousel_click", {
                    source,
                    wallet_connected: isConnected,
                    wallet_address: walletAddress,
                    direction: "next",
                    tab: activeTab,
                    page: pageIndex,
                  });
                  setPageIndex((current) =>
                    Math.min(pageCount - 1, current + 1),
                  );
                }}
                disabled={pageIndex >= pageCount - 1}
                className="h-9 w-9 rounded-full border border-border/20"
                aria-label="Next listings"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Stats Dialogs */}
      {selectedApplicationForStats?._type === "miners" ? (
        <MiningStatsDialog
          open={statsDialogOpen}
          onOpenChange={setStatsDialogOpen}
          application={selectedApplicationForStats as TaggedAuctionApplication}
          miningScoreData={
            selectedScoreDataForStats as {
              miningScore: number;
              weeklyGlwRewards?: string;
              weeklyGlwRewardsUsd?: string;
            } | null
          }
        />
      ) : (
        <LaunchpadStatsDialog
          open={statsDialogOpen}
          onOpenChange={setStatsDialogOpen}
          application={selectedApplicationForStats as TaggedAuctionApplication}
          rewardScore={
            selectedScoreDataForStats as {
              userWeeklyGlwRewards: string;
              userWeeklyPdRewards: string;
            } | null
          }
        />
      )}
    </div>
  );
}

interface LaunchpadStatusWidgetProps {
  className?: string;
  forcedType?: "delegations" | "miners";
  variant?: "card" | "full-row" | "flow" | "minimal";
  isApproaching?: boolean;
  onPayDeposit?: (
    application: TaggedAuctionApplication,
    scoreData?: LaunchpadRewardScore | MiningCenterScore | null,
  ) => void;
}

export default function LaunchpadStatusWidget({
  className,
  forcedType,
  variant = "card",
  isApproaching = false,
  onPayDeposit,
}: LaunchpadStatusWidgetProps) {
  const { address, isConnected } = useAccount();
  const walletAddress = address?.toLowerCase() ?? null;
  const source = "launchpad_status_widget";
  const queryClient = useQueryClient();
  const {
    isLive,
    nextBatchAtMs,
    nextMinerBatchAtMs,
    nextDelegationBatchAtMs,
    refreshNextBatchAtMs,
    isLoading,
    isError,
  } = useLaunchpadStatus();
  const { spotPriceUsd } = useGlowSpotPriceSummary();
  const { usdcBalance } = useWalletTokenBalances(address);
  const isMobile = useIsMobile();
  const isFullRow = variant === "full-row";
  const isFlow = variant === "flow";
  const isMinimal = variant === "minimal";

  const internalIsApproaching = React.useMemo(() => {
    if (isLive) return false;
    const now = getLaunchpadNowMs();
    const timeUntilLive = nextBatchAtMs - now;
    return timeUntilLive > 0 && timeUntilLive <= ONE_HOUR_MS;
  }, [isLive, nextBatchAtMs]);

  const effectiveIsApproaching = isApproaching || internalIsApproaching;
  const hasSplitBatchSchedule =
    nextMinerBatchAtMs !== nextDelegationBatchAtMs &&
    nextMinerBatchAtMs < nextDelegationBatchAtMs;
  const splitDelegationLaunchLabel = React.useMemo(() => {
    if (!hasSplitBatchSchedule) return null;
    return formatEtDateTime(nextDelegationBatchAtMs);
  }, [hasSplitBatchSchedule, nextDelegationBatchAtMs]);

  type ListTypeFilter = "all" | "delegations" | "miners" | "activity";
  const [liveTypeFilter, setLiveTypeFilter] = React.useState<ListTypeFilter>(
    () => "all",
  );

  const shouldForceType = forcedType != null;
  const delegationsEnabled =
    isLive && (!shouldForceType || forcedType === "delegations");
  const minersEnabled = isLive && (!shouldForceType || forcedType === "miners");

  const {
    applications: delegationApplications,
    isLoading: isDelegationsLoading,
  } = useGlowLaunchpad({
    filters: { includeFilled: true },
    enabled: delegationsEnabled,
  });
  const { applications: minerApplications, isLoading: isMinersLoading } =
    useMiningCenter({
      filters: { paymentCurrency: "USDC", includeFilled: true },
      enabled: minersEnabled,
    });

  const publicDelegationApplications = React.useMemo(
    () => filterPublicLaunchpadApplications(delegationApplications),
    [delegationApplications],
  );

  const delegationsAvailableCount = React.useMemo(
    () => countAvailableApplications(publicDelegationApplications),
    [publicDelegationApplications],
  );
  const minersAvailableCount = React.useMemo(
    () => countAvailableApplications(minerApplications),
    [minerApplications],
  );
  const hasDelegationsAvailable = delegationsAvailableCount > 0;
  const hasMinersAvailable = minersAvailableCount > 0;
  const totalAvailable = delegationsAvailableCount + minersAvailableCount;
  const hasAnyListings = totalAvailable > 0;
  const hasMinerLeadWindow =
    hasSplitBatchSchedule &&
    hasMinersAvailable &&
    !hasDelegationsAvailable &&
    getLaunchpadNowMs() < nextDelegationBatchAtMs;

  const resolvedTab = React.useMemo((): ListTypeFilter => {
    if (!isLive) return liveTypeFilter;
    if (liveTypeFilter === "activity") return "activity";
    if (shouldForceType) return forcedType!;
    // Always allow the selected tab - don't auto-switch
    return liveTypeFilter;
  }, [forcedType, isLive, liveTypeFilter, shouldForceType]);

  const launchpadTypeFilter = React.useMemo(():
    | "all"
    | "delegations"
    | "miners" => {
    if (resolvedTab === "activity")
      return hasDelegationsAvailable ? "delegations" : "miners";
    return resolvedTab;
  }, [hasDelegationsAvailable, resolvedTab]);

  const [buyGlowOpen, setBuyGlowOpen] = React.useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = React.useState(false);

  const handleCountdownComplete = React.useCallback(() => {
    refreshNextBatchAtMs();
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "sponsor-listings",
    });
  }, [queryClient, refreshNextBatchAtMs]);

  const remainingMs = useCountdownTo({
    targetAtMs: nextBatchAtMs,
    onComplete: handleCountdownComplete,
  });

  const priceLabel = React.useMemo(
    () => formatUsdPrice(spotPriceUsd),
    [spotPriceUsd],
  );

  const handlePayDeposit = React.useCallback(
    (
      application: TaggedAuctionApplication,
      scoreData?: LaunchpadRewardScore | MiningCenterScore | null,
    ) => {
      onPayDeposit?.(application, scoreData);
    },
    [onPayDeposit],
  );

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden min-w-0 gap-2 py-0 w-full",
        isMinimal
          ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl h-full"
          : isFlow
            ? "bg-card/30 border-foreground/5 min-h-[380px]"
            : isFullRow
              ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl"
              : cn(
                  "bg-card dark:bg-muted/20 border-foreground/5 dark:border-border",
                  isMobile ? "min-h-[620px]" : "h-full",
                ),
        className,
      )}
    >
      {/* Hide header for full-row live state (tabs are in the grid) */}
      {!(isLive && isFullRow) && !(effectiveIsApproaching && isFullRow) && (
        <CardHeader
          className={cn("pb-0", isFullRow ? "px-3 pt-3 pb-0" : "pt-4")}
        >
          <div
            className={cn(
              "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
              !isLive ? "items-center" : "items-start",
              isFullRow ? "min-h-0" : null,
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <CardTitle
                className={cn(
                  "tracking-tight text-foreground",
                  isFullRow
                    ? "text-xl font-semibold"
                    : "text-lg font-semibold tracking-tight text-foreground",
                )}
              >
                {isLive
                  ? "Glow Launchpad"
                  : effectiveIsApproaching
                    ? hasSplitBatchSchedule
                      ? "New miners in..."
                      : "Get ready"
                    : hasSplitBatchSchedule
                      ? "New Mining Center Listing In..."
                      : "New Solar Farm Listing In..."}
              </CardTitle>
            </div>

            {isLive && variant === "full-row" ? (
              <Link
                href="/marketplace"
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  "bg-muted/30 dark:bg-muted/50 text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted/70",
                  "border border-border/20 dark:border-border/40",
                )}
              >
                View Marketplace
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  trackEvent("launchpad_widget_buy_glw_click", {
                    source,
                    wallet_connected: isConnected,
                    wallet_address: walletAddress,
                  });
                  setBuyGlowOpen(true);
                }}
                className={cn(
                  "shrink-0 rounded-full border-border ",
                  "h-9 px-4 text-sm",
                )}
              >
                <ShoppingCart
                  className={cn("mr-1.5", isFullRow ? "h-3 w-3" : "h-4 w-4")}
                />
                Buy GLW
              </Button>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent
        className={cn(
          "min-h-0 min-w-0 w-full flex-1 flex flex-col overflow-hidden",
          variant === "full-row" ? "p-0" : "p-0",
        )}
      >
        {isLoading ? (
          <div
            className={cn(
              "flex-1 flex flex-col gap-6",
              variant === "full-row" ? "p-0 py-8 px-6" : "px-5 pb-5",
            )}
          >
            {/* Countdown skeleton */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-32 rounded" />
              <div className="flex items-center gap-2 sm:gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <Skeleton className="h-14 sm:h-20 w-14 sm:w-20 rounded-xl" />
                    <Skeleton className="h-3 w-10 rounded" />
                  </div>
                ))}
              </div>
            </div>
            {/* Prep section skeleton */}
            {variant !== "full-row" && (
              <div className="mt-auto rounded-xl border border-border/20 dark:border-border/40 p-4 flex gap-4 flex-col sm:flex-row">
                <Skeleton className="h-20 w-24 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-5/6 rounded" />
                </div>
              </div>
            )}
          </div>
        ) : isError ? (
          <div
            className={cn(
              "flex flex-1 flex-col items-center justify-center text-center gap-2",
              variant === "full-row" ? "p-0" : "px-5 pb-5",
            )}
          >
            <div className="text-sm text-muted-foreground">
              Status currently unavailable.
            </div>
          </div>
        ) : isLive ? (
          // --- LIVE STATE ---
          resolvedTab === "activity" ? (
            <div
              className={cn(
                "min-h-0 flex-1 flex flex-col gap-4",
                variant === "full-row" ? "px-4 pt-3 pb-4" : "px-5 pb-5 pt-4",
              )}
            >
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <SponsoredFarmsActivity
                  variant="widget"
                  maxRows={5}
                  showViewAll={false}
                  showKpis={true}
                  className="h-full flex flex-col !p-0"
                  constrainHeight={false}
                />
              </div>

              <div className="shrink-0 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    trackEvent("launchpad_widget_activity_see_all_click", {
                      source,
                      wallet_connected: isConnected,
                      wallet_address: walletAddress,
                    });
                    setActivityDialogOpen(true);
                  }}
                  className="w-full h-12 font-mono font-bold text-base"
                >
                  See All Activity
                </Button>
              </div>
            </div>
          ) : variant === "full-row" ? (
            <div className="min-h-0 flex-1">
              <div className="min-h-0 flex h-full flex-col">
                {hasMinerLeadWindow && splitDelegationLaunchLabel ? (
                  <div className="px-4 pt-3">
                    <div className="rounded-2xl border border-border/30 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                      Miners are live now. Delegations open at{" "}
                      <span className="font-medium text-foreground">
                        {splitDelegationLaunchLabel}
                      </span>
                      .
                    </div>
                  </div>
                ) : null}
                <div className="min-h-0 flex-1">
                  <FullRowLaunchpadGrid onPayDeposit={handlePayDeposit} />
                </div>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "min-h-0 flex-1 flex flex-col",
                isMobile ? "px-4 pb-6" : "px-5 pb-5",
              )}
            >
              <div className="flex flex-col gap-3 h-full">
                <Link
                  href="https://glow.org/blog/guide-to-delegating-glow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-delegation-purple/50 flex-1 flex flex-col justify-center"
                  onClick={() => {
                    trackEvent("dashboard_education_click", {
                      source,
                      wallet_connected: isConnected,
                      wallet_address: walletAddress,
                      topic: "delegation",
                      url: "https://glow.org/blog/guide-to-delegating-glow",
                    });
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/50 transition-colors group-hover:border-delegation-purple/30">
                      <DelegationIcon className="h-6 w-6 text-foreground group-hover:text-delegation-purple transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold text-foreground transition-colors group-hover:text-delegation-purple">
                        Guide to Delegation
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        Delegate your GLW to fund solar farms. Earn GLW
                        emissions and gradually recover your delegated tokens
                        over 100 weeks based on farm efficiency.
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-delegation-purple/80 transition-colors flex items-center gap-1">
                        Learn more <span aria-hidden="true">→</span>
                      </div>
                    </div>
                  </div>
                </Link>

                <Link
                  href="https://glow.org/blog/guide-to-glow-mining"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-[color:var(--color-miner)]/50 flex-1 flex flex-col justify-center"
                  onClick={() => {
                    trackEvent("dashboard_education_click", {
                      source,
                      wallet_connected: isConnected,
                      wallet_address: walletAddress,
                      topic: "mining",
                      url: "https://glow.org/blog/guide-to-glow-mining",
                    });
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/50 transition-colors group-hover:border-[color:var(--color-miner)]/30">
                      <CashMinerIcon className="h-6 w-6 text-foreground group-hover:text-[color:var(--color-miner)] transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold text-foreground transition-colors group-hover:text-[color:var(--color-miner-contrast)]">
                        How Miners Work
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        Buy "Solar Miners" with USDC. They earn GLW emissions
                        tokens over the farm's remaining reward schedule based on real-world electricity
                        generation.
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-[color:var(--color-miner-contrast)]/80 transition-colors flex items-center gap-1">
                        Learn more <span aria-hidden="true">→</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          )
        ) : effectiveIsApproaching ? (
          // --- APPROACHING STATE (within 1h of launch) ---
          variant === "full-row" ? (
            // Full-row: show countdown hero
            <div className="flex-1 flex flex-col items-center justify-center py-8 px-6">
              <div className="flex flex-col items-center justify-center gap-4 py-8 px-10  w-full max-w-lg">
                <GlowSymbol className="h-12 w-12" />
                <div className="text-lg md:text-xl font-medium text-muted-foreground uppercase tracking-wider">
                  New listings in
                </div>
                <div className="font-mono font-bold tracking-tighter tabular-nums text-foreground">
                  <div className="sm:hidden">
                    <AnimatedCountdownDhms
                      remainingMs={remainingMs}
                      size="lg"
                      showLabels
                    />
                  </div>
                  <div className="hidden sm:block">
                    <AnimatedCountdownDhms
                      remainingMs={remainingMs}
                      size="xl"
                      showLabels
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Non-full-row: show educational explainer cards
            <div
              className={cn(
                "min-h-0 flex-1 flex flex-col",
                isMobile ? "px-4 pb-6" : "px-5 pb-5",
              )}
            >
              <div className="flex flex-col gap-4 h-full">
                <Link
                  href="https://glow.org/blog/guide-to-delegating-glow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-muted/10 p-5 text-left transition-colors hover:bg-muted/20 hover:border-delegation-purple/50 flex-1 flex flex-col justify-center"
                  onClick={() => {
                    trackEvent("dashboard_education_click", {
                      source,
                      wallet_connected: isConnected,
                      wallet_address: walletAddress,
                      topic: "delegation",
                      url: "https://glow.org/blog/guide-to-delegating-glow",
                    });
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/50 transition-colors group-hover:border-delegation-purple/30">
                      <DelegationIcon className="h-6 w-6 text-foreground group-hover:text-delegation-purple transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold text-foreground transition-colors group-hover:text-delegation-purple">
                        Guide to Delegation
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        Delegate your GLW to fund solar farms. Earn GLW
                        emissions and gradually recover your delegated tokens
                        over 100 weeks based on farm efficiency.
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-delegation-purple/80 transition-colors flex items-center gap-1">
                        Learn more <span aria-hidden="true">→</span>
                      </div>
                    </div>
                  </div>
                </Link>

                <Link
                  href="https://glow.org/blog/guide-to-glow-mining"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border bg-muted/10 p-5 text-left transition-colors hover:bg-muted/20 hover:border-[color:var(--color-miner)]/50 flex-1 flex flex-col justify-center"
                  onClick={() => {
                    trackEvent("dashboard_education_click", {
                      source,
                      wallet_connected: isConnected,
                      wallet_address: walletAddress,
                      topic: "mining",
                      url: "https://glow.org/blog/guide-to-glow-mining",
                    });
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/50 transition-colors group-hover:border-[color:var(--color-miner)]/30">
                      <CashMinerIcon className="h-6 w-6 text-foreground group-hover:text-[color:var(--color-miner)] transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-semibold text-foreground transition-colors group-hover:text-[color:var(--color-miner-contrast)]">
                        How Miners Work
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        Buy "Solar Miners" with USDC. They earn GLW emissions
                        tokens over the farm's remaining reward schedule based on real-world electricity
                        generation.
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-[color:var(--color-miner-contrast)]/80 transition-colors flex items-center gap-1">
                        Learn more <span aria-hidden="true">→</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          )
        ) : (
          // --- COUNTDOWN STATE (not approaching, more than 1h away) ---
          <div
            className={cn(
              "flex-1 flex flex-col gap-6",
              variant === "full-row" ? "p-0" : "px-5 pb-5",
            )}
          >
            {/* Big Countdown Hero */}
            <div className="flex-1 flex flex-col items-center justify-center py-2 gap-6">
              <div className="font-mono font-bold tracking-tighter tabular-nums text-foreground">
                <div className="sm:hidden">
                  <AnimatedCountdownDhms
                    remainingMs={remainingMs}
                    size="lg"
                    showLabels
                  />
                </div>
                <div className="hidden sm:block">
                  <AnimatedCountdownDhms
                    remainingMs={remainingMs}
                    size="xl"
                    showLabels
                  />
                </div>
              </div>
            </div>

            {/* Prep Section */}
            <div className="mt-auto space-y-4">
              <div className="bg-muted/20 rounded-xl p-4 flex gap-4 border border-border/50 flex-col sm:flex-row text-center sm:text-left">
                {/* GLW Price - links to Defined pool activity */}
                <a
                  href={DEFINED_POOL_ACTIVITY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 flex flex-col items-center justify-center p-3 rounded-xl bg-card border border-border/60 min-w-[100px] gap-0.5 hover:bg-muted/50 hover:border-border transition-colors group"
                >
                  <span className="text-[10px] translate-x-2 font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    GLW
                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                  <span className="text-xl font-mono font-bold text-foreground tabular-nums tracking-tight">
                    {priceLabel}
                  </span>
                  <span className="text-xs text-muted-foreground leading-relaxed underline">
                    defined.fi
                  </span>
                </a>

                <div className="flex-1 space-y-1 py-0.5">
                  <p className="text-base font-semibold text-foreground">
                    Have your GLW ready to delegate on Tuesday.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Every Tuesday at 1:00 PM ET, Glow opens new launchpad
                    delegations. Keep GLW ready so you can participate as soon
                    as the next listing goes live.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <BuyGlowDialog
          open={buyGlowOpen}
          onOpenChange={setBuyGlowOpen}
          usdcBalance={usdcBalance ?? null}
          glowSpotPrice={spotPriceUsd}
          source="launchpad_status_widget"
          onSuccess={() => {
            void (async () => {
              try {
                await queryClient.refetchQueries({
                  queryKey: ["sponsor-listings"],
                });
              } catch {}
            })();
          }}
        />

        <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
            <DialogHeader className="p-6 pb-4 border-b">
              <DialogTitle>Recent Activity</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6">
              <SponsoredFarmsActivity
                variant="full"
                constrainHeight={false}
                showKpis={true}
              />
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
