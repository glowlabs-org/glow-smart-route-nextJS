"use client";
import React from "react";
import Link from "next/link";
import {
  ArrowUp,
  ArrowDown,
  Search,
  HelpCircle,
  Clock,
  TrendingUp,
  Users,
  Building,
  DollarSign,
  Coins,
  Activity,
  Zap,
  ExternalLink,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type ChartConfig } from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { SponsoredFarmsActivity } from "../marketplace/sponsored-farms-activity";
import { getCurrentEpoch } from "@/utils/getCurrentEpoch";
import { getNextTuesdayAt1pmET } from "@/utils/nextTuesdayET";
import {
  formatNumber,
  formatPercent,
  formatToken,
  formatUsd,
} from "@/utils/format";
import { MarketTickers } from "./market-tickers";
import { ProtocolActivity } from "./protocol-activity";
import { LifetimeFarms } from "./lifetime-farms";
import { EconomyOverview } from "./economy-overview";
import { RegionsStaking } from "./regions-staking";
import { useGlowPrices } from "@/hooks/useGlowPrices";
import { useFractionsSummary } from "@/hooks/useFractionsSummary";
import { useFractionsAvailability } from "@/hooks/useFractionsAvailability";
import { useSplitsActivity } from "@/hooks/useGlowLaunchpad";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";
import { usePoolInfo } from "@/hooks/useLiquidityPositionsOptimized";
import { useGctlHoldersCount } from "@/hooks/useGctlHoldersCount";
import {
  useCompletedFarms,
  type CompletedApplication,
} from "@/hooks/useCompletedFarms";
import { useToast } from "@/hooks/use-toast";
import {
  parseFractionsSummary,
  parseFractionsAvailability,
  formatRemainingInventory,
  type InventoryItem,
  formatDelegationEvents,
  formatMinerEvents,
} from "@/lib/fractions";
import { PaymentCurrency } from "@glowlabs-org/utils/browser";
import { useActiveRegionsSummary } from "@/hooks/useActiveRegionsSummary";

import { useGctlApi } from "@/hooks/useGctlApi";

// ============================================================================
// TYPES
// ============================================================================

interface CompletedFarmRow {
  id: string;
  name: string;
  zoneName: string;
  netCCProduction?: string;
  paymentAmount?: string;
  paymentCurrency?: PaymentCurrency;
  solarPanelsQuantity?: number;
  status: string;
  timestampMs: number;
  timestampLabel: string;
  auditUrl?: string;
}

interface AvailableFarm {
  id: string;
  name: string;
  region: string;
  estGlwPerWeek: number;
  minGlw: number;
}

interface AvailableMiner {
  id: string;
  name: string;
  weeks: number;
  pricePerSplit: number;
  remainingPercent: number;
}

// Removed mock delegation/miner generators; live data now powers protocol activity.

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string;
  secondary?: string;
  description?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

function MetricCard({
  title,
  value,
  secondary,
  description,
  icon,
  isLoading,
}: MetricCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground">
            {title}
          </div>
          {icon ? <div className="text-muted-foreground">{icon}</div> : null}
        </div>
        {isLoading ? (
          <Skeleton className="h-9 w-36" />
        ) : (
          <div className="text-3xl font-bold tracking-tight">{value}</div>
        )}
        {secondary && !isLoading ? (
          <div className="text-xs font-semibold text-muted-foreground">
            {secondary}
          </div>
        ) : null}
        {description ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StatsView() {
  const [activeTab, setActiveTab] = React.useState("t0");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState(new Date());
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isDelegationDialogOpen, setIsDelegationDialogOpen] =
    React.useState(false);
  const [isMinerDialogOpen, setIsMinerDialogOpen] = React.useState(false);

  const { toast } = useToast();

  // Simulate refresh mechanism
  const handleRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsRefreshing(false);
    }, 1000);
  }, []);

  // Auto-refresh every 30 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  // Real data hooks
  const {
    spotPrice,
    spotPriceLoading,
    edgapPrice,
    edgapPriceLoading,
    gctlMintPrice,
    spotSparkline,
    spotDelta,
    spotDeltaPercent,
    edgapSparkline,
    edgapDelta,
    edgapDeltaPercent,
    gctlMintSparkline,
    gctlMintDelta,
    gctlMintDeltaPercent,
    poolActivityLoading,
    isLoading: isPricesLoading,
  } = useGlowPrices();

  const {
    summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useFractionsSummary();

  const {
    data: availability,
    isLoading: availabilityLoading,
    isError: availabilityError,
  } = useFractionsAvailability();

  const {
    farms: completedFarms,
    isLoading: completedLoading,
    isError: completedError,
  } = useCompletedFarms();

  const {
    data: activeSummary,
    isLoading: activeSummaryLoading,
    isError: activeSummaryError,
  } = useActiveRegionsSummary();

  const {
    gctlPriceNumber,
    gctlCirculatingSupplyNumber,
    glwPriceNumber,
    isGctlPriceLoading,
    isGctlCirculatingSupplyLoading,
    isGlwPriceLoading,
  } = useGctlApi();

  const totalStakedAcrossRegions = activeSummary?.totalGctlStaked ?? 0;

  // Get GCTL holders count
  const { holdersCount: gctlHoldersCount, isLoading: isGctlHoldersLoading } =
    useGctlHoldersCount();

  React.useEffect(() => {
    if (summaryError) {
      toast({
        title: "Failed to load fractions summary",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  }, [summaryError, toast]);

  React.useEffect(() => {
    if (availabilityError) {
      toast({
        title: "Failed to load availability",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  }, [availabilityError, toast]);

  React.useEffect(() => {
    if (completedError) {
      toast({
        title: "Failed to load completed farms",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  }, [completedError, toast]);

  React.useEffect(() => {
    if (activeSummaryError) {
      toast({
        title: "Failed to load region summary",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  }, [activeSummaryError, toast]);

  const { launchpad, miningCenter } = React.useMemo(
    () => parseFractionsAvailability(availability),
    [availability]
  );

  const { launchpadInventory, miningCenterInventory } = React.useMemo(() => {
    const launchpadInventory = formatRemainingInventory(launchpad);
    const miningCenterInventory = formatRemainingInventory(miningCenter);
    return { launchpadInventory, miningCenterInventory };
  }, [launchpad, miningCenter]);

  const { activity: allSplitsActivity, isLoading: allSplitsLoading } =
    useSplitsActivity();
  const {
    activity: launchpadSplitsActivity,
    isLoading: launchpadSplitsLoading,
  } = useSplitsActivity({ limit: 10, fractionType: "launchpad" });
  const { activity: miningSplitsActivity, isLoading: miningSplitsLoading } =
    useSplitsActivity({ limit: 10, fractionType: "mining-center" });

  const delegationEvents = React.useMemo(
    () => formatDelegationEvents(allSplitsActivity),
    [allSplitsActivity]
  );
  const minerEvents = React.useMemo(
    () => formatMinerEvents(allSplitsActivity),
    [allSplitsActivity]
  );
  const delegationPreviewEvents = React.useMemo(
    () => formatDelegationEvents(launchpadSplitsActivity),
    [launchpadSplitsActivity]
  );
  const minerPreviewEvents = React.useMemo(
    () => formatMinerEvents(miningSplitsActivity),
    [miningSplitsActivity]
  );
  const hasDelegationPreview = delegationPreviewEvents.length > 0;
  const hasMinerPreview = minerPreviewEvents.length > 0;
  const shouldShowDelegationSeeAll =
    !allSplitsLoading &&
    delegationEvents.length > delegationPreviewEvents.length;
  const shouldShowMinerSeeAll =
    !allSplitsLoading && minerEvents.length > minerPreviewEvents.length;

  const {
    totalDelegatedGlw,
    totalMiningCenterValue,
    launchpadContributors,
    miningCenterContributors,
  } = React.useMemo(() => parseFractionsSummary(summary), [summary]);

  const totalMinersSold = totalMiningCenterValue || 0;
  const activeDelegators = launchpadContributors || 0;

  // Get GLW circulating supply and pool info
  const {
    circulatingSupply,
    marketCap,
    isLoading: isCirculatingSupplyLoading,
  } = useGlowCirculatingSupply();
  const { poolReserves, isLoading: isPoolLoading } = usePoolInfo();

  // Calculate real % of GLW Delegated
  const percentGlwDelegated = React.useMemo(() => {
    if (!circulatingSupply || circulatingSupply === 0) return 0;
    return (totalDelegatedGlw / circulatingSupply) * 100;
  }, [totalDelegatedGlw, circulatingSupply]);

  // USDC Liquidity is the USDG amount in the pool (USDG is pegged to USDC)
  const usdcLiquidity = poolReserves.usdg || 0;

  const availableFarms: InventoryItem[] = React.useMemo(
    () => launchpadInventory,
    [launchpadInventory]
  );
  const availableMiners: InventoryItem[] = React.useMemo(
    () => miningCenterInventory,
    [miningCenterInventory]
  );

  const completedRows = React.useMemo(() => {
    const rows = (completedFarms || []).filter(
      (farm): farm is CompletedApplication => Boolean(farm?.id)
    );

    return rows
      .map((application) => {
        const farmName = application.farm?.name || application.id;
        const zoneName = application.zone?.name || "Clean Grid Project";
        const status = application.status || "Unknown";
        const completedDate =
          application.farm?.auditCompleteDate ||
          application.installFinishedDate ||
          application.revisedInstallFinishedDate ||
          application.paymentDate ||
          application.createdAt;
        const paymentAmount = application.paymentAmount;
        const paymentCurrency = application.paymentCurrency;
        const netCCProduction = application.netCarbonCreditEarningWeekly;
        const solarPanelsQuantity = application.solarPanelsQuantity;
        const timestampMs = completedDate ? Date.parse(completedDate) : 0;
        const timestampLabel = completedDate
          ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(completedDate))
          : "Date pending";
        const auditUrl = application.farm?.id
          ? `https://glow.org/audits/${application.farm.id}`
          : undefined;

        return {
          id: application.id,
          name: farmName,
          zoneName,
          netCCProduction,
          solarPanelsQuantity,
          status,
          timestampMs,
          timestampLabel,
          auditUrl,
          paymentAmount,
          paymentCurrency,
        } satisfies CompletedFarmRow;
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [completedFarms]);

  const totalFarms = completedRows.length;
  const farmsThisMonth = React.useMemo(() => {
    if (completedRows.length === 0) return 0;
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).getTime();
    return completedRows.filter((row) => row.timestampMs >= startOfMonth)
      .length;
  }, [completedRows]);
  const currentMonthLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
      }).format(new Date()),
    []
  );
  const farmsChartData = React.useMemo(() => {
    if (completedRows.length === 0) return [];

    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    const getWeekStartUtc = (timestamp: number) => {
      const date = new Date(timestamp);
      const utcYear = date.getUTCFullYear();
      const utcMonth = date.getUTCMonth();
      const utcDate = date.getUTCDate();
      const utcDay = date.getUTCDay();

      const start = new Date(Date.UTC(utcYear, utcMonth, utcDate));
      const offset = (utcDay + 6) % 7; // Monday as start of week
      start.setUTCDate(start.getUTCDate() - offset);
      return start.getTime();
    };

    const totalsByWeek = new Map<number, number>();
    let minWeek: number | null = null;
    let maxWeek: number | null = null;

    completedRows.forEach((row) => {
      if (!row.timestampMs) return;
      const weekStart = getWeekStartUtc(row.timestampMs);
      totalsByWeek.set(weekStart, (totalsByWeek.get(weekStart) ?? 0) + 1);
      if (minWeek === null || weekStart < minWeek) minWeek = weekStart;
      if (maxWeek === null || weekStart > maxWeek) maxWeek = weekStart;
    });

    if (minWeek === null || maxWeek === null) return [];

    const results: {
      weekStart: number;
      weekLabel: string;
      rangeLabel: string;
      count: number;
    }[] = [];

    for (let ts: number = minWeek; ts <= maxWeek; ts += WEEK_MS) {
      const count = totalsByWeek.get(ts) ?? 0;
      const startDate = new Date(ts);
      const endDate = new Date(ts + WEEK_MS - 1);

      const weekLabel = startDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const rangeLabel = `${startDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} – ${endDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;

      results.push({
        weekStart: ts,
        weekLabel,
        rangeLabel,
        count,
      });
    }

    return results;
  }, [completedRows]);
  const farmsChartConfig = React.useMemo(
    () =>
      ({
        weeklyCount: {
          label: "Farms onboarded",
          color: "var(--chart-1)",
        },
      } satisfies ChartConfig),
    []
  );
  const isProtocolActivityLoading =
    summaryLoading ||
    availabilityLoading ||
    allSplitsLoading ||
    launchpadSplitsLoading ||
    miningSplitsLoading;

  // Intersection observer for sticky tabs
  const sectionRefs = {
    t0: React.useRef<HTMLDivElement>(null),
    t1: React.useRef<HTMLDivElement>(null),
    t2: React.useRef<HTMLDivElement>(null),
    t3: React.useRef<HTMLDivElement>(null),
  };

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id as keyof typeof sectionRefs;
            setActiveTab(id);
          }
        });
      },
      { threshold: 0.5, rootMargin: "-140px 0px -50% 0px" }
    );

    Object.values(sectionRefs).forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const ref = sectionRefs[id as keyof typeof sectionRefs];
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Derived metrics
  const totalGlwDelegated = totalDelegatedGlw;

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden min-h-screen pt-20">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 relative z-10 min-h-screen">
          {/* ============================================================
              HEADER & TOOLBAR
          ============================================================ */}
          <div className="py-8 border-b border-border/50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-4xl font-bold mb-2">Protocol Overview</h1>
                <p className="text-muted-foreground">
                  Real-time insights into Glow token markets, protocol activity,
                  regional staking, and economic health
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Clock
                    className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  <span>Last updated {lastUpdated.toLocaleTimeString()}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ============================================================
              STICKY LOCAL TABS
          ============================================================ */}
          <div
            className="sticky top-20 z-40 bg-background border-b border-border/50 -mx-4 md:-mx-6 lg:-mx-12 px-4 md:px-6 lg:px-12"
            role="navigation"
            aria-label="Page sections"
          >
            <div className="flex items-center gap-2 overflow-x-auto py-3">
              {[
                { id: "t0", label: "T0 · Tickers", icon: TrendingUp },
                { id: "t1", label: "T1 · Activity", icon: Activity },
                { id: "t2", label: "T2 · Regions", icon: Building },
                { id: "t3", label: "T3 · Economy", icon: Coins },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => scrollToSection(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                  aria-current={activeTab === tab.id ? "true" : undefined}
                  aria-label={`Navigate to ${tab.label}`}
                >
                  <tab.icon className="w-4 h-4" aria-hidden="true" />
                  <span className="text-sm">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ============================================================
              T0 — TICKERS
          ============================================================ */}
          <section id="t0" ref={sectionRefs.t0} className="scroll-mt-36">
            <MarketTickers
              spot={{
                price: spotPrice !== null ? `$${spotPrice.toFixed(4)}` : "$--",
                delta: spotDelta ?? undefined,
                deltaPercent: spotDeltaPercent ?? undefined,
                sparkline: spotSparkline.length > 0 ? spotSparkline : undefined,
                isLoading: spotPriceLoading || poolActivityLoading,
                updateFrequency: "~30s",
                externalLink: {
                  url: "https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d?maker=0x5abcfde6bc010138f65e8dc088927473c49867e4&preferredQuoteTokenAddress=0xf4fbc617a5733eaaf9af08e1ab816b103388d8b6&cache=f235f&quoteToken=token1",
                  label: "View pair on Defined.fi",
                },
              }}
              edgap={{
                price:
                  edgapPrice !== null ? `$${edgapPrice.toFixed(4)}` : "$--",
                delta: edgapDelta ?? undefined,
                deltaPercent: edgapDeltaPercent ?? undefined,
                sparkline:
                  edgapSparkline && edgapSparkline.length > 0
                    ? edgapSparkline
                    : undefined,
                isLoading: edgapPriceLoading,
                updateFrequency: "~1m",
              }}
              gctl={{
                price:
                  gctlMintPrice !== null
                    ? `$${gctlMintPrice.toFixed(2)}`
                    : "$--",
                delta: gctlMintDelta ?? undefined,
                deltaPercent: gctlMintDeltaPercent ?? undefined,
                sparkline:
                  gctlMintSparkline && gctlMintSparkline.length > 0
                    ? gctlMintSparkline
                    : undefined,
                isLoading: edgapPriceLoading,
                updateFrequency: "~1m",
              }}
            />
          </section>

          {/* ============================================================
              T1 — ACTIVITY
          ============================================================ */}
          <section id="t1" ref={sectionRefs.t1} className="py-12 scroll-mt-36">
            <ProtocolActivity
              delegation={{
                totalGlwDelegated,
                isProtocolActivityLoading,
                summaryLoading,
                delegatorsCount: launchpadContributors ?? 0,
                availableFarms,
                farmsCountdownDate: getNextTuesdayAt1pmET(),
                delegationPreviewEvents,
                hasDelegationPreview,
                shouldShowDelegationSeeAll,
                onSeeAllDelegation: () => setIsDelegationDialogOpen(true),
              }}
              miners={{
                totalMinersSold,
                summaryLoading,
                buyersCount: miningCenterContributors ?? 0,
                availableMiners,
                minersCountdownDate: getNextTuesdayAt1pmET(),
                minerPreviewEvents,
                minerEvents,
                hasMinerPreview,
                shouldShowMinerSeeAll,
                onSeeAllMiners: () => setIsMinerDialogOpen(true),
              }}
              isProtocolActivityLoading={isProtocolActivityLoading}
            />
            <LifetimeFarms
              totalFarms={totalFarms}
              farmsThisMonth={farmsThisMonth}
              currentMonthLabel={currentMonthLabel}
              completedRows={completedRows}
              farmsChartData={farmsChartData}
              farmsChartConfig={farmsChartConfig}
              completedLoading={completedLoading}
            />
          </section>

          {/* ============================================================
              T2 — REGIONS
          ============================================================ */}
          <section id="t2" ref={sectionRefs.t2} className="py-12 scroll-mt-36">
            <RegionsStaking
              regions={activeSummary?.regions ?? []}
              totalStakedGctl={totalStakedAcrossRegions}
              isLoading={activeSummaryLoading}
              isError={activeSummaryError}
            />
          </section>

          {/* ============================================================
              T3 — ECONOMY
          ============================================================ */}
          <section
            id="t3"
            ref={sectionRefs.t3}
            className="py-12 pb-24 scroll-mt-36"
          >
            <EconomyOverview
              gctlCirculatingSupplyNumber={gctlCirculatingSupplyNumber}
              isGctlCirculatingSupplyLoading={isGctlCirculatingSupplyLoading}
              glwCirculatingSupply={circulatingSupply}
              glwMarketCap={marketCap}
              totalGlwDelegated={totalGlwDelegated}
              percentGlwDelegated={percentGlwDelegated}
              usdcLiquidity={usdcLiquidity}
              glwInPool={poolReserves.glw}
              isGlwDataLoading={isCirculatingSupplyLoading || isPoolLoading}
              gctlPriceNumber={gctlPriceNumber}
              totalStakedGctl={totalStakedAcrossRegions}
              gctlHoldersCount={gctlHoldersCount}
              isGctlDataLoading={
                isGctlPriceLoading ||
                isGctlCirculatingSupplyLoading ||
                isGctlHoldersLoading ||
                activeSummaryLoading
              }
            />
          </section>
        </div>
      </div>

      {/* Delegation History Dialog */}
      <Dialog
        open={isDelegationDialogOpen}
        onOpenChange={setIsDelegationDialogOpen}
      >
        <DialogContent className="md:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Delegation History</DialogTitle>
            <DialogDescription>
              All delegation and undelegation events across all farms
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="space-y-2">
              {delegationEvents.map((event) => (
                <div
                  key={event.id}
                  className="group flex items-start gap-3 p-4 bg-muted/30 rounded-xl hover:bg-muted transition-all border border-border/50 hover:border-border hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold mb-1.5">
                      {event.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground">
                        {event.applicationId}
                      </span>
                      <span>·</span>
                      <Badge
                        variant="secondary"
                        className="h-5 px-2 text-xs font-medium"
                      >
                        {event.token}
                      </Badge>
                      <span>·</span>
                      <span className="font-mono">{event.buyer}</span>
                      <span>·</span>
                      <span>{event.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Miner Purchase History Dialog */}
      <Dialog open={isMinerDialogOpen} onOpenChange={setIsMinerDialogOpen}>
        <DialogContent className="md:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Purchase History</DialogTitle>
            <DialogDescription>
              All miner purchases across the platform
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="space-y-2">
              {minerEvents.map((event) => (
                <div
                  key={event.id}
                  className="group flex items-start gap-3 p-4 bg-muted/30 rounded-xl hover:bg-muted transition-all border border-border/50 hover:border-border hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold mb-1.5">
                      {event.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground">
                        {event.applicationId}
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {event.totalValueFormatted}
                      </span>
                      <span>·</span>
                      <span className="font-mono">{event.buyer}</span>
                      <span>·</span>
                      <span>{event.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
