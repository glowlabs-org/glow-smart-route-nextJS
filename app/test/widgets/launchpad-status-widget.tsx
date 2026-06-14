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
import { getNextTuesdayAt9amET } from "@/utils/nextTuesdayET";
import {
  calculateLaunchpadPerShareRewards,
  parseDelegationStepAmount,
  resolveLaunchpadDelegationShareCount,
  resolveLaunchpadDelegationUnitCount,
} from "@/utils/launchpad-rewards";
import {
  getLaunchpadAvailability,
  getLaunchpadLegAvailability,
} from "@/utils/launchpad-availability";
import {
  expandLaunchpadCardEntries,
  hasBuyableSgctlLeg,
  type LaunchpadCardLeg,
} from "@/utils/launchpad-card-legs";
import { useSgctlEligibility } from "@/hooks/use-sgctl-eligibility";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { SponsoredFarmsActivity } from "@/app/marketplace/sponsored-farms-activity";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { trackEvent } from "@/lib/telemetry";
import { useAccount } from "wagmi";
import Link from "next/link";
import {
  CashMinerIcon,
  DelegationIcon,
  PointsIcon,
  PointsShopIcon,
} from "@/components/impact-icons";
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
import { useLang } from "@/lib/i18n";
import { useV2EarlyAccess } from "@/hooks/v2-points-shop";
import { useV2PointsBalance } from "@/hooks/v2-points";
import { useMinerEarlyAccessSignature } from "@/hooks/v2-early-access";

const DEFINED_POOL_ACTIVITY_URL =
  "https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";
const ONE_HOUR_MS = 60 * 60 * 1000;
// After the countdown hits 0, the server can take a few seconds to publish the
// new batch of listings (cron lag, cache warm-up). Keep polling within this
// window instead of immediately advancing the countdown to next week.
const LAUNCHPAD_PUBLISHING_GRACE_MS = 5 * 60 * 1000;
const LAUNCHPAD_PUBLISHING_POLL_MS = 10 * 1000;

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

// Helper: Get availability info for an application.
function getActiveFractionAvailability(application: AuctionApplication) {
  const { remaining, total, isSoldOut, progressFilledPct, showTotal } =
    getLaunchpadAvailability(application);
  return {
    remaining,
    total,
    isSoldOut,
    percentFilled: Math.round(progressFilledPct),
    showTotal,
  };
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

function formatRewardAmount(value: number): string {
  const decimals = Math.abs(value) < 1 ? 2 : 1;
  return formatNumber(value, decimals);
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

// Extended type for applications with type tagging
type LocalTaggedApplication = AuctionApplication & {
  _type: "miners" | "delegations";
};

// Row data structure for the grid
interface ListingRow {
  application: LocalTaggedApplication;
  /** Which tile this row is: "GLW"/"SGCTL" for delegations, null for miners. */
  leg: LaunchpadCardLeg;
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
    selectedCurrency?: "GLW" | "SGCTL" | "USDC",
  ) => void;
}

function FullRowLaunchpadGrid({ onPayDeposit }: FullRowLaunchpadGridProps) {
  const { t } = useLang();
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

  // V2 miner early access: an entitled wallet that signs (opt-in) sees
  // mining-center listings up to its window before public visibility.
  const earlyAccessQuery = useV2EarlyAccess(address);
  const minerEarlyAccess = useMinerEarlyAccessSignature();
  const activeMinerEntitlement = React.useMemo(
    () =>
      (earlyAccessQuery.data?.entitlements ?? []).find(
        (e) => e.active && e.scope === "miner",
      ) ?? null,
    [earlyAccessQuery.data],
  );
  const earlyAccessMinutes = activeMinerEntitlement?.earlyAccessMinutes ?? 15;

  // Fetch miners
  const { applications: minerApplications, isLoading: isMinersLoading } =
    useMiningCenter({
      filters: { paymentCurrency: "USDC", includeFilled: true },
      earlyAccessHeader: minerEarlyAccess.header,
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

  // sGCTL eligibility (spec §1.4): drives which farms get a second (sGCTL) tile.
  const { isSgctlEligible } = useSgctlEligibility({
    applications: taggedDelegations,
    walletAddress: address,
  });

  // Two-tile model: fetch a FORCED-GLW score map (the GLW tile's score, no
  // bonus) and a FORCED-SGCTL score map (the sGCTL tile's score, with the
  // solved n). The sGCTL map only covers farms with a buyable sGCTL leg.
  const sgctlLegDelegationsForScores = React.useMemo(
    () => activeDelegationsForScores.filter(hasBuyableSgctlLeg),
    [activeDelegationsForScores],
  );

  // Fetch scores
  const { rewardScoreMap: glwRewardScoreMap, isLoading: isRewardScoresLoading } =
    useRewardScore({
      applications: activeDelegationsForScores,
      paymentCurrency: "GLW",
      forceCurrency: "GLW",
      enabled: activeDelegationsForScores.length > 0,
      walletAddress: address || null,
    });

  const {
    rewardScoreMap: sgctlRewardScoreMap,
    isLoading: isSgctlRewardScoresLoading,
  } = useRewardScore({
    applications: sgctlLegDelegationsForScores,
    paymentCurrency: "SGCTL",
    forceCurrency: "SGCTL",
    enabled: sgctlLegDelegationsForScores.length > 0,
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
    // Expand into per-leg tiles: a GLW-only tile always, plus a separate
    // sGCTL-only tile when the farm has a buyable sGCTL leg AND the wallet is
    // eligible. Miners stay single tiles (leg = null).
    const entries = expandLaunchpadCardEntries({
      applications: [...taggedDelegations, ...taggedMiners],
      isSgctlEligible,
      isDelegation: (app) => app._type === "delegations",
    });

    return entries.map((entry) => {
      const application = entry.application;
      const leg = entry.leg;
      // The GLW (no-bonus) estimate is the base for BOTH tiles' score: the sGCTL
      // tile's reward score is pinned frontend-side to (GLW score + 10) below.
      // The sGCTL (+n) estimate is used only for the sGCTL tile's weekly-reward
      // AMOUNTS (it reflects the bonus emission). Pinning here — rather than
      // trusting control's per-call pin — guarantees the two tiles ALWAYS differ
      // by exactly 10, since the two estimate calls use different deposit
      // contexts (GLW wei vs GCTL atomic) and can't otherwise be kept in lockstep.
      const glwReward = getRewardScoreForApplication(
        glwRewardScoreMap,
        application.id,
      );
      const reward =
        leg === "SGCTL"
          ? getRewardScoreForApplication(sgctlRewardScoreMap, application.id)
          : glwReward;
      // Per-leg availability/sold-out for delegation tiles; miners use the
      // combined fraction availability. Normalize the per-leg result to the
      // same shape getActiveFractionAvailability returns (percentFilled).
      const availability =
        leg === null
          ? getActiveFractionAvailability(application)
          : (() => {
              const legAvailability = getLaunchpadLegAvailability(
                application,
                leg,
              );
              return {
                remaining: legAvailability.remaining,
                total: legAvailability.total,
                isSoldOut: legAvailability.isSoldOut,
                percentFilled: Math.round(legAvailability.progressFilledPct),
                showTotal: legAvailability.showTotal,
              };
            })();
      // The tile's asset is its leg ("GLW"/"SGCTL"); null for miners.
      const delegationCurrency: LaunchpadCardLeg = leg;

      const mining = getMiningScoreForApplication(
        miningScoreMap,
        application.id,
      );

      // Reward score per tile: GLW tile = GLW score; sGCTL tile = GLW score + 10
      // (pinned product promise). null when the GLW score isn't loaded yet.
      const delegationRewardScore: number | null =
        application._type !== "delegations"
          ? null
          : glwReward?.rewardScore != null
            ? leg === "SGCTL"
              ? glwReward.rewardScore + 10
              : glwReward.rewardScore
            : null;

      const score =
        application._type === "delegations"
          ? (delegationRewardScore ?? 0)
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
          const totalShares = resolveLaunchpadDelegationUnitCount(application);
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
          const totalShares = resolveLaunchpadDelegationUnitCount(application);
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
          const totalSteps = resolveLaunchpadDelegationUnitCount(application);
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
        const totalShares = resolveLaunchpadDelegationUnitCount(application);
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

      // Get reward score for delegations (sGCTL tile pinned to GLW + 10).
      const rewardScore = delegationRewardScore;

      return {
        application,
        leg,
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
    isSgctlEligible,
    glwRewardScoreMap,
    sgctlRewardScoreMap,
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

    // Only surface sold-out listings that sold out during the current
    // launchpad week. Last week's sold-out farms roll off so the section
    // never shows stale listings as filler. The week boundary is the most
    // recent Tuesday 9 AM ET (the consolidated weekly batch release), computed
    // against the launchpad clock so it respects LAUNCHPAD_TIME_OVERRIDE_ISO.
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const launchpadNowMs = getLaunchpadNowMs();
    const nextWeekStartMs = getNextTuesdayAt9amET(
      new Date(launchpadNowMs),
    ).getTime();
    const currentWeekStartMs =
      nextWeekStartMs <= launchpadNowMs
        ? nextWeekStartMs
        : nextWeekStartMs - WEEK_MS;

    const soldOutRows = filtered
      .filter((r) => r.availability.isSoldOut)
      .filter((r) => {
        const fraction = r.application.activeFraction;
        const soldOutAtRaw = fraction?.filledAt ?? fraction?.createdAt;
        if (!soldOutAtRaw) return false;
        const soldOutAtMs = new Date(soldOutAtRaw).getTime();
        return (
          Number.isFinite(soldOutAtMs) && soldOutAtMs >= currentWeekStartMs
        );
      })
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
      // In "all" tab: delegations first (by score), then miners (by price desc)
      activeRows.sort((a, b) => {
        if (a.application._type !== b.application._type) {
          return a.application._type === "delegations" ? -1 : 1;
        }
        if (a.application._type === "miners") {
          return (b.cost ?? 0) - (a.cost ?? 0);
        }
        return (b.score ?? 0) - (a.score ?? 0);
      });
    } else if (activeTab === "delegations") {
      activeRows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    } else if (activeTab === "miners") {
      activeRows.sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));
    }

    // Combine: active first, then sold out to fill minimum of 3
    let finalRows = [...activeRows];
    if (finalRows.length < 3) {
      const needed = 3 - finalRows.length;
      finalRows = [...finalRows, ...soldOutRows.slice(0, needed)];
    }

    return finalRows;
  }, [allRows, activeTab]);

  const cardsPerPage = isMobile ? 1 : 3;
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
        // The tile's leg decides which deposit dialog opens. Miners (leg null)
        // open the USDC/miner dialog (the opener also routes by _type).
        row.leg ?? "USDC",
      );
    },
    [isConnected, walletAddress, onPayDeposit],
  );

  // Render a single listing card - image-at-top, content-below design
  const renderListingCard = (row: ListingRow, index: number) => {
    const {
      application,
      leg,
      availability,
      cost,
      weeklyYield,
      weeklyPdYield,
      weeklyYieldUsd,
      totalAmountNeeded,
      rewardScore,
    } = row;
    const isMiner = application._type === "miners";
    // V2 early access: a miner listing whose public visible-at is still in
    // the future was revealed early for this (entitled, signed) wallet.
    const minerVisibleAtMs = isMiner
      ? Date.parse(application.activeFraction?.marketplaceVisibleAt ?? "")
      : NaN;
    const isEarlyAccessReveal =
      isMiner &&
      Number.isFinite(minerVisibleAtMs) &&
      getLaunchpadNowMs() < minerVisibleAtMs;
    // Leg-aware score loading: the sGCTL tile waits on the sGCTL score map.
    const isRowScoreLoading = isMiner
      ? isMiningScoresLoading
      : leg === "SGCTL"
        ? isSgctlRewardScoresLoading
        : isRewardScoresLoading;
    // This tile is single-asset: GLW tile -> GLW, sGCTL tile -> SGCTL.
    const delegationCurrency: "GLW" | "SGCTL" = leg === "SGCTL" ? "SGCTL" : "GLW";
    const currency = isMiner ? "USDC" : delegationCurrency;
    const imageUrl = application.afterInstallPictures?.[0]?.url;
    // Two tiles can share one farm id (GLW + sGCTL), so the key includes the
    // leg as well as type + fraction identity to prevent React key collisions.
    const cardKey = `${application._type}:${leg ?? "MINER"}:${application.id}:${
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
        <div className="relative aspect-[3/2] sm:aspect-[16/9] lg:aspect-[5/2] m-3 mb-0 rounded-xl overflow-hidden">
          {imageUrl ? (
            <FallbackImage
              src={imageUrl}
              widthForProxy={800}
              quality={85}
              alt={application.farmName || t.widgets.launchpadStatus.unnamedFarm}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-muted/30 dark:bg-muted/50" />
          )}
          {/* Light gradient for badge visibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent rounded-xl" />

          {/* Top Left: Category Badge (+ early-access pill) */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex items-center gap-2">
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
              {isMiner ? t.widgets.launchpadStatus.miner : t.widgets.launchpadStatus.delegation}
            </div>
            {isEarlyAccessReveal ? (
              <div className="flex items-center gap-1 rounded-full border border-white/20 bg-[color:var(--color-miner)]/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-xl sm:text-xs">
                <Sparkles className="h-3 w-3" />
                {t.widgets.launchpadStatus.earlyAccessBadge}
              </div>
            ) : null}
          </div>

          {/* Top Right: Stats Button or Sold Out Badge */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
            {availability.isSoldOut ? (
              <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold bg-white/90 dark:bg-black/60 text-foreground dark:text-white backdrop-blur-xl border border-border/20 dark:border-white/20 shadow-sm">
                {t.widgets.launchpadStatus.soldOut}
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
                <span className="hidden sm:inline">{t.widgets.launchpadStatus.advancedStats}</span>
                <span className="sm:hidden">{t.widgets.launchpadStatus.statsShort}</span>
                <ArrowUpRight className="ml-1 w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex flex-col flex-1 px-4 pt-4 pb-5 sm:p-5 md:p-6 lg:p-4 xl:p-5">
          {/* Title, Location, and Score */}
          <div className="mb-3 lg:mb-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl md:text-2xl lg:text-lg xl:text-xl font-bold text-foreground tracking-tight line-clamp-1">
                {application.farmName || t.widgets.launchpadStatus.unnamedFarm}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5 text-muted-foreground text-xs sm:text-sm">
                <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">{application.zone?.name || t.widgets.launchpadStatus.unknownRegion}</span>
              </div>
            </div>
            {!isMiner && !availability.isSoldOut && (
              isRowScoreLoading ? (
                <div className="shrink-0 flex flex-col items-end">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                    {t.widgets.launchpadStatus.score}
                  </span>
                  <Skeleton className="h-6 w-10" />
                </div>
              ) : rewardScore !== null ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="shrink-0 flex flex-col items-end cursor-help">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
                          {t.widgets.launchpadStatus.score}
                        </span>
                        <Info className="w-2.5 h-2.5 text-muted-foreground/60" />
                      </div>
                      <span className="text-2xl lg:text-xl font-bold text-foreground font-mono tabular-nums leading-tight">
                        {Math.round(rewardScore)}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      {t.widgets.launchpadStatus.rewardScoreTooltip}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : null
            )}
          </div>

          {/* Stats Grid - always 2 cols (price + weekly/sold-in) */}
          <div className="grid grid-cols-2 gap-2 mt-auto auto-rows-fr">
            {/* Column 1: Price/Amount */}
            <div className="flex min-w-0 flex-col p-3 lg:px-2.5 lg:py-2 rounded-lg bg-muted/30 dark:bg-muted/50">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                {availability.isSoldOut
                  ? isMiner
                    ? t.widgets.launchpadStatus.total
                    : t.widgets.launchpadStatus.delegated
                  : isMiner
                    ? t.widgets.launchpadStatus.price
                    : t.widgets.launchpadStatus.amount}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <span className="text-xl lg:text-base xl:text-lg font-bold text-foreground font-mono tabular-nums leading-tight">
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
                    t.widgets.launchpadStatus.free
                  )}
                </span>
                <span className="text-sm text-muted-foreground font-medium">
                  {currency}
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {availability.isSoldOut
                  ? t.widgets.launchpadStatus.filled
                  : availability.showTotal
                    ? t.widgets.launchpadStatus.leftCount(
                        availability.remaining,
                        availability.total,
                      )
                    : t.widgets.launchpadStatus.leftSingleCount(
                        availability.remaining,
                      )}
              </span>
            </div>

            {/* Column 2: Weekly Rewards or Time to Sell */}
            {availability.isSoldOut ? (
              <div className="flex min-w-0 flex-col p-3 lg:px-2.5 lg:py-2 rounded-lg bg-muted/30 dark:bg-muted/50">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  {t.widgets.launchpadStatus.soldIn}
                </span>
                <span className="text-base sm:text-lg font-bold text-foreground leading-tight">
                  {formatTimeToSellOut(
                    getListingVisibleStartAtMs(application),
                    application.activeFraction?.filledAt || null,
                  )}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {t.widgets.launchpadStatus.toFill}
                </span>
              </div>
            ) : isRowScoreLoading ? (
              <div className="flex min-w-0 flex-col p-3 lg:px-2.5 lg:py-2 rounded-lg bg-muted/30 dark:bg-muted/50">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  {t.widgets.launchpadStatus.estWeekly}
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
                  <div className="flex min-w-0 flex-col p-3 lg:px-2.5 lg:py-2 rounded-lg bg-muted/30 dark:bg-muted/50 cursor-help">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        {t.widgets.launchpadStatus.estWeekly}
                      </span>
                      <HelpCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-muted-foreground/60" />
                    </div>
                    {isMiner || delegationCurrency !== "SGCTL" ? (
                      <>
                        <div className="flex items-baseline gap-1 flex-wrap">
                          <span className="text-xl lg:text-base xl:text-lg font-bold text-foreground font-mono tabular-nums leading-tight">
                            +{formatRewardAmount(weeklyYield)}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            GLW
                            {weeklyYieldUsd > 0 &&
                              ` · $${formatNumber(weeklyYieldUsd, 2)}`}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          {isMiner
                            ? t.widgets.launchpadStatus.forMinerWeeks(
                                formatMinerWeeksLabel(
                                  getMinerWeeksRemaining(row.scoreData),
                                ),
                              )
                            : t.widgets.launchpadStatus.for100Weeks}
                        </span>
                      </>
                    ) : (
                      // sGCTL tile: mirror the GLW tile's layout exactly (one big
                      // value row + one sub-line) so both tiles are the SAME
                      // height. The GLW emission is the headline; the SGCTL PD
                      // recovery rides on the sub-line.
                      <>
                        <div className="flex items-baseline gap-1 flex-wrap">
                          <span className="text-xl lg:text-base xl:text-lg font-bold text-foreground font-mono tabular-nums leading-tight">
                            +{formatRewardAmount(weeklyYield)}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            GLW
                            {weeklyYieldUsd > 0 &&
                              ` · $${formatNumber(weeklyYieldUsd, 2)}`}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          {weeklyPdYield > 0 &&
                            `+${formatRewardAmount(weeklyPdYield)} SGCTL · `}
                          {t.widgets.launchpadStatus.for100Weeks}
                        </span>
                      </>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {isMiner ? (
                    <p className="text-xs">
                      {t.widgets.launchpadStatus.tooltipMinerWeekly(
                        formatMinerWeeksLabel(
                          getMinerWeeksRemaining(row.scoreData),
                        ),
                      )}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {t.widgets.launchpadStatus.tooltipDelegationWeekly}
                      </p>
                      {row.scoreData &&
                      "userWeeklyGlwRewards" in row.scoreData &&
                      resolveLaunchpadDelegationShareCount(application) > 0
                        ? (() => {
                            const totalShares =
                              resolveLaunchpadDelegationUnitCount(application);
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
                                    {t.widgets.launchpadStatus.pdRecovery}
                                  </span>
                                  <span className="font-mono font-medium">
                                    +
                                    {pdPerShare.toLocaleString(undefined, {
                                      minimumFractionDigits:
                                        Math.abs(pdPerShare) < 1 ? 2 : 1,
                                      maximumFractionDigits:
                                        Math.abs(pdPerShare) < 1 ? 2 : 1,
                                    })}{" "}
                                    {delegationCurrency}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4 text-xs">
                                  <span className="text-muted-foreground">
                                    {t.widgets.launchpadStatus.emissions}
                                  </span>
                                  <span className="font-mono font-medium">
                                    +
                                    {glwPerShare.toLocaleString(undefined, {
                                      minimumFractionDigits:
                                        Math.abs(glwPerShare) < 1 ? 2 : 1,
                                      maximumFractionDigits:
                                        Math.abs(glwPerShare) < 1 ? 2 : 1,
                                    })}{" "}
                                    GLW
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
              <div className="flex min-w-0 flex-col p-3 lg:px-2.5 lg:py-2 rounded-lg bg-muted/30 dark:bg-muted/50">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  {t.widgets.launchpadStatus.estWeekly}
                </span>
                <span className="text-base sm:text-lg font-bold text-muted-foreground leading-tight">
                  —
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  unavailable
                </span>
              </div>
            )}

          </div>

          {/* Action Button Row */}
          <div className="mt-4 sm:mt-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/10">
            {availability.isSoldOut ? (
              <Button
                variant="outline"
                className={cn(
                  "w-full rounded-xl h-12 lg:h-10 text-sm font-semibold",

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
                {t.widgets.launchpadStatus.viewAudit} <ArrowUpRight className="ml-1.5 w-4 h-4" />
              </Button>
            ) : isMiner ? (
              <div className="flex justify-end">
                <Button
                  className={cn(
                    "w-full h-12 text-sm font-semibold rounded-xl",

                    "transition-all duration-200",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(row);
                  }}
                >
                  {t.widgets.launchpadStatus.purchaseMiner} <ArrowUpRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            ) : (
              <Button
                className={cn(
                  "w-full h-12 lg:h-10 text-sm font-semibold rounded-xl",

                  "transition-all duration-200",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick(row);
                }}
              >
                {t.widgets.launchpadStatus.delegate(currency)}{" "}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "rounded-2xl border border-border/20 dark:border-border/40 overflow-hidden",
                i === 2 && "hidden lg:block",
              )}
            >
              <div className="p-3 pb-0">
                <Skeleton className="aspect-[3/2] sm:aspect-[16/9] lg:aspect-[5/2] w-full rounded-xl" />
              </div>
              <div className="p-4 sm:p-5 md:p-6 lg:p-4 xl:p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                  <Skeleton className="h-10 w-12 shrink-0" />
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <Skeleton className="h-16 sm:h-20 rounded-lg" />
                  <Skeleton className="h-16 sm:h-20 rounded-lg" />
                </div>
                <Skeleton className="h-11 lg:h-10 w-full rounded-xl" />
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
          {t.widgets.launchpadStatus.noListings}
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
            {t.widgets.launchpadStatus.tabAll}{" "}
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
            <span className="hidden sm:inline">{t.widgets.launchpadStatus.tabDelegations}</span>
            <span className="sm:hidden">{t.widgets.launchpadStatus.tabDelegationsShort}</span>{" "}
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
            {t.widgets.launchpadStatus.tabMiners}{" "}
            <span className="font-mono tabular-nums text-[10px] sm:text-xs opacity-70">
              {minersAvailableCount}
            </span>
          </button>
        )}
      </div>

      {/* V2 miner early access: opt-in unlock banner for entitled wallets */}
      {activeMinerEntitlement ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-miner)]/30 bg-[color:var(--color-miner)]/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 shrink-0 text-[color:var(--color-miner-contrast)]" />
            <span className="text-sm text-foreground">
              {minerEarlyAccess.isUnlocked
                ? t.widgets.launchpadStatus.earlyAccessActive(earlyAccessMinutes)
                : t.widgets.launchpadStatus.earlyAccessAvailable(
                    earlyAccessMinutes,
                  )}
            </span>
          </div>
          {!minerEarlyAccess.isUnlocked ? (
            <Button
              type="button"
              size="sm"
              disabled={minerEarlyAccess.isSigning}
              onClick={async () => {
                const ok = await minerEarlyAccess.unlock();
                if (ok) {
                  trackEvent("early_access_used", {
                    source,
                    wallet_connected: isConnected,
                    wallet_address: walletAddress,
                    early_access_minutes: earlyAccessMinutes,
                  });
                }
              }}
            >
              {minerEarlyAccess.isSigning
                ? t.widgets.launchpadStatus.earlyAccessUnlocking
                : t.widgets.launchpadStatus.earlyAccessUnlock}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Cards Grid - up to 3 columns on desktop. With only two cards on the
          page, drop to two columns so they span the full width instead of
          leaving an empty third slot. */}
      <div className="space-y-4">
        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-2 gap-4",
            pagedRows.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3",
          )}
        >
          {pagedRows.map((row, index) =>
            renderListingCard(row, pageIndex * cardsPerPage + index),
          )}
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-4 pt-1">
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
              className="h-10 w-10 rounded-full border border-border/20"
              aria-label={t.widgets.launchpadStatus.previousListings}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="text-xs font-mono tabular-nums text-muted-foreground">
              {pageIndex + 1} / {pageCount}
            </div>

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
              className="h-10 w-10 rounded-full border border-border/20"
              aria-label={t.widgets.launchpadStatus.nextListings}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
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
  const { t } = useLang();
  const { address, isConnected } = useAccount();
  const walletAddress = address?.toLowerCase() ?? null;
  const source = "launchpad_status_widget";
  const queryClient = useQueryClient();
  const {
    isLive,
    nextBatchAtMs,
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

  // Points live with the launchpad (where they're earned), shown inside the
  // full-row card. Only fetch for full-row; render nothing until the wallet
  // actually has a positive balance.
  const { data: pointsBalanceData } = useV2PointsBalance(
    isFullRow ? walletAddress : null,
  );
  const availablePoints = pointsBalanceData?.availablePoints;
  const pointsHeaderValue =
    typeof availablePoints === "number" && availablePoints > 0
      ? availablePoints.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : null;
  const showPointsHeader = isFullRow && pointsHeaderValue !== null;

  const internalIsApproaching = React.useMemo(() => {
    if (isLive) return false;
    const now = getLaunchpadNowMs();
    const timeUntilLive = nextBatchAtMs - now;
    // Stay in the approaching state within 1h of launch AND through the
    // publishing grace window so the UI keeps showing the countdown (at
    // 00:00:00) instead of flashing educational explainers while we wait
    // for the backend to publish the new batch.
    return (
      timeUntilLive <= ONE_HOUR_MS &&
      timeUntilLive > -LAUNCHPAD_PUBLISHING_GRACE_MS
    );
  }, [isLive, nextBatchAtMs]);

  const effectiveIsApproaching = isApproaching || internalIsApproaching;
  // Consolidated launch window: miners and delegations now share one Tuesday
  // 9 AM ET batch, so there is no longer a miner lead window or split schedule.
  const hasSplitBatchSchedule = false;

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
  const totalAvailable = delegationsAvailableCount + minersAvailableCount;
  const hasAnyListings = totalAvailable > 0;
  // Only present the live listings UI when the window is open AND there is
  // something to show; otherwise fall back to the countdown variant.
  const showLiveListings = isLive && hasAnyListings;
  // Countdown variant: no live listings, not within the approaching window. In
  // this state the Buy GLW CTA lives at the bottom of the prep section instead
  // of the header.
  const isCountdownState =
    !isLoading && !isError && !showLiveListings && !effectiveIsApproaching;

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

  const invalidateSponsorListings = React.useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "sponsor-listings",
    });
  }, [queryClient]);

  const handleCountdownComplete = React.useCallback(() => {
    // Kick off the first refetch immediately. DO NOT advance nextBatchAtMs
    // yet — the publishing-grace effect below rolls it forward only after
    // listings actually appear (or after the grace window expires).
    invalidateSponsorListings();
  }, [invalidateSponsorListings]);

  const remainingMs = useCountdownTo({
    targetAtMs: nextBatchAtMs,
    onComplete: handleCountdownComplete,
  });

  // Publishing-grace loop: after the countdown hits zero, poll every
  // LAUNCHPAD_PUBLISHING_POLL_MS until listings appear or the grace window
  // expires. Then advance the countdown to the following week. Fixes the
  // "stops at 00:00:00, nothing happens until you reload" bug.
  React.useEffect(() => {
    const now = getLaunchpadNowMs();
    const graceEndsAt = nextBatchAtMs + LAUNCHPAD_PUBLISHING_GRACE_MS;

    if (now < nextBatchAtMs) return; // still before launch
    if (isLive) {
      refreshNextBatchAtMs();
      return;
    }
    if (now >= graceEndsAt) {
      refreshNextBatchAtMs();
      return;
    }

    const pollId = window.setInterval(
      invalidateSponsorListings,
      LAUNCHPAD_PUBLISHING_POLL_MS,
    );
    const expireId = window.setTimeout(
      refreshNextBatchAtMs,
      graceEndsAt - now,
    );
    return () => {
      window.clearInterval(pollId);
      window.clearTimeout(expireId);
    };
  }, [
    isLive,
    nextBatchAtMs,
    invalidateSponsorListings,
    refreshNextBatchAtMs,
  ]);

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
              ? "bg-transparent border-0"
              : cn(
                  "bg-card dark:bg-muted/20 border-foreground/5 dark:border-border",
                  isMobile ? "min-h-[620px]" : "h-full",
                ),
        className,
      )}
    >
      {/* Hide header for full-row live state (tabs are in the grid) */}
      {!(showLiveListings && isFullRow) && !(effectiveIsApproaching && isFullRow) && !(isCountdownState && isFullRow) && (
        <CardHeader
          className={cn("pb-0", isFullRow ? "px-3 pt-3 pb-0" : "pt-4")}
        >
          <div
            className={cn(
              "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
              !showLiveListings ? "items-center" : "items-start",
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
                {showLiveListings
                  ? t.widgets.launchpadStatus.launchpadTitle
                  : effectiveIsApproaching
                    ? hasSplitBatchSchedule
                      ? t.widgets.launchpadStatus.newMinersIn
                      : t.widgets.launchpadStatus.getReady
                    : hasSplitBatchSchedule
                      ? t.widgets.launchpadStatus.newMiningCenterListingIn
                      : t.widgets.launchpadStatus.newSolarFarmListingIn}
              </CardTitle>
            </div>

            {showLiveListings && variant === "full-row" ? (
              <Link
                href="/marketplace"
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  "bg-muted/30 dark:bg-muted/50 text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted/70",
                  "border border-border/20 dark:border-border/40",
                )}
              >
                {t.widgets.launchpadStatus.viewMarketplace}
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            ) : isCountdownState ? null : (
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
                {t.widgets.launchpadStatus.buyGlw}
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
        {showPointsHeader && (
          <div className="flex items-center justify-between gap-4 border-b border-border/15 px-4 pt-4 pb-4 sm:px-5 dark:border-white/10">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                {t.home.topPoints.label}
              </span>
              <span className="flex items-baseline gap-1.5">
                <PointsIcon className="h-5 w-5 shrink-0 self-center text-amber-500" />
                <span className="font-mono text-2xl font-bold leading-none tabular-nums text-foreground sm:text-3xl">
                  {pointsHeaderValue}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  {t.home.topPoints.unit}
                </span>
              </span>
            </div>
            <Link
              href="/shop"
              onClick={() =>
                trackEvent("dashboard_points_shop_cta_click", {
                  source,
                  wallet_address: walletAddress,
                })
              }
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
            >
              <PointsShopIcon className="h-4 w-4" />
              {t.home.topPoints.shopCta}
            </Link>
          </div>
        )}
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
              {t.widgets.launchpadStatus.statusUnavailable}
            </div>
          </div>
        ) : showLiveListings ? (
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
                  {t.widgets.launchpadStatus.seeAllActivity}
                </Button>
              </div>
            </div>
          ) : variant === "full-row" ? (
            <div className="min-h-0 flex-1">
              <div className="min-h-0 flex h-full flex-col">
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
                        {t.widgets.launchpadStatus.guideToDelegationTitle}
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        {t.widgets.launchpadStatus.guideToDelegationBody}
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-delegation-purple/80 transition-colors flex items-center gap-1">
                        {t.widgets.launchpadStatus.learnMore} <span aria-hidden="true">→</span>
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
                        {t.widgets.launchpadStatus.howMinersWorkTitle}
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        {t.widgets.launchpadStatus.howMinersWorkBody}
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-[color:var(--color-miner-contrast)]/80 transition-colors flex items-center gap-1">
                        {t.widgets.launchpadStatus.learnMore} <span aria-hidden="true">→</span>
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
                  {t.widgets.launchpadStatus.newListingsIn}
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
                        {t.widgets.launchpadStatus.guideToDelegationTitle}
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        {t.widgets.launchpadStatus.guideToDelegationBody}
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-delegation-purple/80 transition-colors flex items-center gap-1">
                        {t.widgets.launchpadStatus.learnMore} <span aria-hidden="true">→</span>
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
                        {t.widgets.launchpadStatus.howMinersWorkTitle}
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        {t.widgets.launchpadStatus.howMinersWorkBody}
                      </div>
                      <div className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-[color:var(--color-miner-contrast)]/80 transition-colors flex items-center gap-1">
                        {t.widgets.launchpadStatus.learnMore} <span aria-hidden="true">→</span>
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
              variant === "full-row"
                ? "px-3 pb-4 lg:grid lg:grid-cols-3 lg:items-center lg:gap-6"
                : "px-5 pb-5",
            )}
          >
            {/* Big Countdown Hero */}
            <div
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 gap-6",
                isFullRow && "lg:col-span-2",
              )}
            >
              {isFullRow ? (
                <CardTitle className="text-xl font-semibold tracking-tight text-foreground text-center">
                  {hasSplitBatchSchedule
                    ? t.widgets.launchpadStatus.newMiningCenterListingIn
                    : t.widgets.launchpadStatus.newSolarFarmListingIn}
                </CardTitle>
              ) : null}
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

            {/* Prep Section — aligned sibling blocks (price, copy, CTA) */}
            <div
              className={cn(
                "mt-auto flex flex-col gap-3",
                isFullRow && "lg:mt-0 lg:col-span-1",
              )}
            >
              {/* GLW Price - links to Defined pool activity */}
              <a
                href={DEFINED_POOL_ACTIVITY_URL}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-card border border-border/60 gap-0.5 hover:bg-muted/50 hover:border-border transition-colors group"
              >
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
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

              <div className="text-center space-y-1 px-1">
                <p className="text-base font-semibold text-foreground">
                  {t.widgets.launchpadStatus.beReadyTitle}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t.widgets.launchpadStatus.beReadyBody}
                </p>
              </div>

              <Button
                className="w-full font-medium"
                onClick={() => {
                  trackEvent("launchpad_widget_buy_glw_click", {
                    source,
                    wallet_connected: isConnected,
                    wallet_address: walletAddress,
                  });
                  setBuyGlowOpen(true);
                }}
              >
                <ShoppingCart className="mr-1.5 h-4 w-4" />
                {t.widgets.launchpadStatus.buyGlw}
              </Button>
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
