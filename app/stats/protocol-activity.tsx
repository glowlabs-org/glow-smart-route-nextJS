"use client";

import React from "react";
import Link from "next/link";

import { Activity, Building, DollarSign, Users, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  useFractionsSummary,
  type FractionsSummaryResponse,
} from "@/hooks/useFractionsSummary";
import {
  useGlowLaunchpad,
  useSplitsActivity,
  calculateProtocolDepositAmount,
  type AuctionApplication,
} from "@/hooks/useGlowLaunchpad";
import { useMiningCenter } from "@/hooks/useMiningCenter";
import {
  useRewardScore,
  getRewardScoreForApplication,
} from "@/hooks/useRewardScore";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import {
  useMiningScore,
  getMiningScoreForApplication,
} from "@/hooks/useMiningScore";
import { formatNumber } from "@/app/marketplace/utils";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { formatUnits } from "viem";
import { getNextTuesdayAt1pmET } from "@/utils/nextTuesdayET";
import {
  parseFractionsSummary,
  formatDelegationEvents,
  formatMinerEvents,
} from "@/lib/fractions";
import { useToast } from "@/hooks/use-toast";
import { MiniCountdown } from "./mini-countdown";

export interface ProtocolEventRowProps {
  id: string;
  title: string;
  farmName: string;
  buyer: string;
  applicationId: string;
  token: string;
  totalValueFormatted: string;
  timestamp: string;
}

interface InventoryItem {
  id: string;
  applicationId: string;
  token: string;
  remainingStepsFormatted: string;
  remainingValueFormatted: string;
  remainingPercentFormatted: string;
  stepPriceFormatted: string;
  type: "launchpad" | "mining-center";
  rewardScore?: number | null;
  miningScore?: number | null;
  weeklyGlwRewards?: string | null;
}

interface DelegationCardState {
  totalGlwDelegated: number;
  summaryLoading: boolean;
  delegatorsCount: number;
  availableFarms: InventoryItem[];
  farmsCountdownDate: Date;
  delegationPreviewEvents: ProtocolEventRowProps[];
  hasDelegationPreview: boolean;
  shouldShowDelegationSeeAll: boolean;
  onSeeAllDelegation: () => void;
}

interface MinerCardState {
  totalMinersSold: number;
  summaryLoading: boolean;
  buyersCount: number;
  availableMiners: InventoryItem[];
  minersCountdownDate: Date;
  minerPreviewEvents: ProtocolEventRowProps[];
  minerEvents: ProtocolEventRowProps[];
  hasMinerPreview: boolean;
  shouldShowMinerSeeAll: boolean;
  onSeeAllMiners: () => void;
}

interface ProtocolActivityProps {
  shouldLoad?: boolean;
  onSeeAllDelegation?: (events: ProtocolEventRowProps[]) => void;
  onSeeAllMiners?: (events: ProtocolEventRowProps[]) => void;
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <p className="mb-1 text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function InventoryList({
  items,
  emptyLabel,
  countdownLabel,
  countdownDate,
  badgeColor,
}: {
  items: InventoryItem[];
  emptyLabel: string;
  countdownLabel: string;
  countdownDate: Date;
  badgeColor: "green" | "blue";
}) {
  if (items.length === 0) {
    return (
      <div className="mb-6 rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center">
        <div className="mb-2 text-lg font-bold">SOLD OUT</div>
        <div className="mb-6 text-sm text-muted-foreground">
          {countdownLabel}
        </div>
        <MiniCountdown target={countdownDate} />
      </div>
    );
  }

  const accent = badgeColor === "green" ? "bg-green-500" : "bg-blue-500";

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${accent} animate-pulse`} />
        <div className="text-sm font-semibold">
          Available {emptyLabel} ({items.length})
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/?tab=${
              item.type === "launchpad" ? "launchpad" : "mining-center"
            }&fractionId=${item.id}`}
            className="block"
          >
            <div className="cursor-pointer rounded-xl border border-border bg-muted/50 p-4 transition-all hover:border-gray-300 hover:bg-muted dark:hover:border-gray-700">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 text-sm font-semibold">
                    {item.applicationId}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="h-5">
                      {item.token}
                    </Badge>
                    <span>Remaining {item.remainingStepsFormatted}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">
                    {item.remainingValueFormatted}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Inventory value
                  </div>
                </div>
              </div>
              {item.type === "launchpad" &&
                item.rewardScore !== null &&
                item.rewardScore !== undefined && (
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">
                      Reward Score
                    </span>
                    <span className="text-sm font-semibold">
                      {item.rewardScore.toFixed(0)}
                    </span>
                  </div>
                )}
              {item.type === "mining-center" && item.weeklyGlwRewards && (
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    Weekly Rewards/Miner
                  </span>
                  <span className="text-sm font-semibold">
                    {formatNumber(
                      parseFloat(
                        formatUnits(
                          BigInt(item.weeklyGlwRewards),
                          DECIMALS_BY_TOKEN["GLW"]
                        )
                      ),
                      2
                    )}{" "}
                    GLW
                  </span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EventList({
  rows,
  empty,
}: {
  rows: ProtocolEventRowProps[];
  empty: React.ReactNode;
}) {
  if (!rows.length) return <>{empty}</>;
  return (
    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
      {rows.map((event) => (
        <div
          key={event.id}
          className="group flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-4 transition-all hover:border-border hover:bg-muted hover:shadow-sm"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-green-500/20 bg-green-500/10">
            <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 text-sm font-semibold">{event.title}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {event.farmName}
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
  );
}

function DelegationEmptyState() {
  return (
    <EmptyState
      icon={<Zap className="h-8 w-8 text-muted-foreground" />}
      title="No delegations yet"
      description="When delegations happen, they'll appear here. Start with an available farm above."
    />
  );
}

function MinerItem({ event }: { event: ProtocolEventRowProps }) {
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-4 transition-all hover:border-border hover:bg-muted hover:shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10">
        <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 text-sm font-semibold">{event.title}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{event.farmName}</span>
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
  );
}

function MinerEmptyState() {
  return (
    <EmptyState
      icon={<DollarSign className="h-8 w-8 text-muted-foreground" />}
      title="No purchases yet"
      description="Miner purchases will appear here."
    />
  );
}

function ProtocolActivitySkeleton() {
  return (
    <div className="py-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {[0, 1].map((index) => (
        <Card key={index} className="overflow-hidden pt-0">
          <CardHeader className="border-b border-border/50 bg-muted/30 pt-8">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-6 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ProtocolActivity({
  shouldLoad = true,
  onSeeAllDelegation,
  onSeeAllMiners,
}: ProtocolActivityProps) {
  const { toast } = useToast();

  const {
    summary,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
    isError: summaryError,
  } = useFractionsSummary({ enabled: shouldLoad });

  // Fetch launchpad applications (GLW delegations)
  const {
    applications: launchpadApplications,
    isLoading: launchpadLoading,
    isError: launchpadError,
  } = useGlowLaunchpad({
    filters: {
      sortBy: "publishedOnAuctionTimestamp",
      sortOrder: "desc",
      paymentCurrency: "GLW",
    },
    enabled: shouldLoad,
  });

  // Fetch mining center applications (USDC purchases)
  const {
    applications: miningApplications,
    isLoading: miningLoading,
    isError: miningError,
  } = useMiningCenter({
    filters: {
      sortBy: "publishedOnAuctionTimestamp",
      sortOrder: "desc",
      paymentCurrency: "USDC",
    },
    enabled: shouldLoad,
  });

  // Get reward scores for launchpad
  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications: launchpadApplications,
    paymentCurrency: "GLW",
    enabled: shouldLoad && launchpadApplications.length > 0,
    walletAddress: null,
  });

  // Get mining scores for mining center
  const { miningScoreMap, isLoading: isMiningScoresLoading } = useMiningScore({
    applications: miningApplications,
    enabled: shouldLoad && miningApplications.length > 0,
  });

  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();

  const { activity: allSplitsActivity, isLoading: allSplitsLoading } =
    useSplitsActivity({ enabled: shouldLoad, limit: 100 });
  const {
    activity: launchpadSplitsActivity,
    isLoading: launchpadSplitsLoading,
  } = useSplitsActivity({
    enabled: shouldLoad,
    limit: 10,
    fractionType: "launchpad",
  });
  const { activity: miningSplitsActivity, isLoading: miningSplitsLoading } =
    useSplitsActivity({
      enabled: shouldLoad,
      limit: 10,
      fractionType: "mining-center",
    });

  React.useEffect(() => {
    if (!shouldLoad) return;
    if (summaryError) {
      toast({
        title: "Failed to load fractions summary",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  }, [shouldLoad, summaryError, toast]);

  React.useEffect(() => {
    if (!shouldLoad) return;
    if (launchpadError || miningError) {
      toast({
        title: "Failed to load availability",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  }, [shouldLoad, launchpadError, miningError, toast]);

  // Transform launchpad applications into inventory items
  const launchpadInventory = React.useMemo(() => {
    return launchpadApplications
      .filter((app) => app.activeFraction && !app.activeFraction.isFilled)
      .map((app) => {
        const fraction = app.activeFraction!;
        const remainingSteps = fraction.remainingSteps || 0;
        const totalSteps = fraction.totalSteps;

        // Calculate remaining value
        const stepPriceBigInt = BigInt(fraction.step);
        const remainingValueBigInt = stepPriceBigInt * BigInt(remainingSteps);

        const remainingValueFormatted = formatNumber(
          parseFloat(
            formatUnits(remainingValueBigInt, DECIMALS_BY_TOKEN["GLW"])
          ),
          0
        );

        const rewardScore = getRewardScoreForApplication(
          rewardScoreMap,
          app.id
        );

        return {
          id: fraction.id,
          applicationId: app.id,
          token: "GLW",
          remainingStepsFormatted: remainingSteps.toLocaleString(),
          remainingValueFormatted: `${remainingValueFormatted} GLW`,
          remainingPercentFormatted: `${Math.round(
            (remainingSteps / totalSteps) * 100
          )}%`,
          stepPriceFormatted: `${formatNumber(
            parseFloat(formatUnits(stepPriceBigInt, DECIMALS_BY_TOKEN["GLW"])),
            0
          )} GLW`,
          type: "launchpad" as const,
          rewardScore: rewardScore?.rewardScore || null,
        };
      });
  }, [launchpadApplications, rewardScoreMap]);

  // Transform mining center applications into inventory items
  const miningCenterInventory = React.useMemo(() => {
    return miningApplications
      .filter((app) => app.activeFraction && !app.activeFraction.isFilled)
      .map((app) => {
        const fraction = app.activeFraction!;
        const remainingSteps = fraction.remainingSteps || 0;
        const totalSteps = fraction.totalSteps;

        // Calculate remaining value
        const stepPriceBigInt = BigInt(fraction.stepPrice);
        const remainingValueBigInt = stepPriceBigInt * BigInt(remainingSteps);

        const remainingValueFormatted = formatNumber(
          parseFloat(
            formatUnits(remainingValueBigInt, DECIMALS_BY_TOKEN["USDC"])
          ),
          0
        );

        const miningScoreData = getMiningScoreForApplication(
          miningScoreMap,
          app.id
        );

        return {
          id: fraction.id,
          applicationId: app.id,
          token: "USDC",
          remainingStepsFormatted: remainingSteps.toLocaleString(),
          remainingValueFormatted: `$${remainingValueFormatted}`,
          remainingPercentFormatted: `${Math.round(
            (remainingSteps / totalSteps) * 100
          )}%`,
          stepPriceFormatted: `$${formatNumber(
            parseFloat(formatUnits(stepPriceBigInt, DECIMALS_BY_TOKEN["USDC"])),
            0
          )}`,
          type: "mining-center" as const,
          miningScore: miningScoreData?.miningScore || null,
          weeklyGlwRewards: miningScoreData?.weeklyGlwRewards || null,
        };
      });
  }, [miningApplications, miningScoreMap]);

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

  const isProtocolActivityLoading =
    summaryLoading ||
    summaryFetching ||
    launchpadLoading ||
    miningLoading ||
    isRewardScoresLoading ||
    isMiningScoresLoading ||
    allSplitsLoading ||
    launchpadSplitsLoading ||
    miningSplitsLoading;

  const isInitialLoading =
    (summaryLoading && !summary) ||
    (launchpadLoading && launchpadApplications.length === 0) ||
    (miningLoading && miningApplications.length === 0) ||
    (allSplitsLoading && allSplitsActivity.length === 0) ||
    (launchpadSplitsLoading && launchpadSplitsActivity.length === 0) ||
    (miningSplitsLoading && miningSplitsActivity.length === 0);

  if (!shouldLoad) {
    return <ProtocolActivitySkeleton />;
  }

  const pendingProps = {
    totalGlwDelegated: totalDelegatedGlw,
    summaryLoading: summaryLoading || summaryFetching,
    delegatorsCount: launchpadContributors ?? 0,
    availableFarms: launchpadInventory,
    farmsCountdownDate: getNextTuesdayAt1pmET(),
    delegationPreviewEvents,
    hasDelegationPreview,
    shouldShowDelegationSeeAll,
    onSeeAllDelegation: () => onSeeAllDelegation?.(delegationEvents),
  } satisfies DelegationCardState;

  const minerProps = {
    totalMinersSold: totalMiningCenterValue || 0,
    summaryLoading: summaryLoading || summaryFetching,
    buyersCount: miningCenterContributors ?? 0,
    availableMiners: miningCenterInventory,
    minersCountdownDate: getNextTuesdayAt1pmET(),
    minerPreviewEvents,
    minerEvents,
    hasMinerPreview,
    shouldShowMinerSeeAll,
    onSeeAllMiners: () => onSeeAllMiners?.(minerEvents),
  } satisfies MinerCardState;

  return (
    <div className="py-12">
      {isInitialLoading ? (
        <ProtocolActivitySkeleton />
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Protocol Activity</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Real-time delegation and miner activity
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden pt-0">
              <CardHeader className="border-b border-border/50 bg-muted/30 pt-8">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      Total GLW Delegated
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Community-backed solar farms
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    {pendingProps.delegatorsCount}
                    {pendingProps.delegatorsCount === 1
                      ? " Delegator"
                      : " Delegators"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="mb-6 text-4xl font-bold tracking-tight">
                  {pendingProps.summaryLoading
                    ? "--"
                    : pendingProps.totalGlwDelegated.toLocaleString()}{" "}
                  <span className="text-2xl text-muted-foreground">GLW</span>
                </div>

                <InventoryList
                  items={pendingProps.availableFarms}
                  emptyLabel="Farms"
                  countdownLabel="All farm slots are filled. Next batch available soon."
                  countdownDate={pendingProps.farmsCountdownDate}
                  badgeColor="green"
                />

                <div className="space-y-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      Delegation History
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Activity className="mr-1 h-3 w-3" />
                        Live
                      </Badge>
                      {pendingProps.shouldShowDelegationSeeAll ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={pendingProps.onSeeAllDelegation}
                        >
                          See All
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <EventList
                    rows={pendingProps.delegationPreviewEvents}
                    empty={<DelegationEmptyState />}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden pt-0">
              <CardHeader className="border-b border-border/50 bg-muted/30 pt-8">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Total Miners Sold</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Mining infrastructure investments
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Building className="h-3 w-3" />
                    {minerProps.buyersCount}
                    {minerProps.buyersCount === 1 ? " Buyer" : " Buyers"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="mb-6 text-4xl font-bold tracking-tight">
                  {minerProps.summaryLoading
                    ? "--"
                    : `$${minerProps.totalMinersSold.toLocaleString()}`}
                </div>

                <InventoryList
                  items={minerProps.availableMiners}
                  emptyLabel="Miners"
                  countdownLabel="All miners are sold. Next batch available soon."
                  countdownDate={minerProps.minersCountdownDate}
                  badgeColor="blue"
                />

                <div className="space-y-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      Purchase History
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Activity className="mr-1 h-3 w-3" />
                        Live
                      </Badge>
                      {minerProps.shouldShowMinerSeeAll ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={minerProps.onSeeAllMiners}
                        >
                          See All
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {minerProps.hasMinerPreview ? (
                    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                      {minerProps.minerPreviewEvents.map((event) => (
                        <MinerItem key={event.id} event={event} />
                      ))}
                    </div>
                  ) : (
                    <MinerEmptyState />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
