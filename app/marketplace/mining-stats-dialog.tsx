"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AuctionApplication } from "@/hooks";
import { formatUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { formatNumber } from "./utils";
import { useActiveRegionsSummary, useRegions } from "@/hooks";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { RegionRouter } from "@glowlabs-org/utils/browser";
import { normalizeMinerWeeksRemainingDisplay } from "@/lib/mining-score";
import { useLang } from "@/lib/i18n";

const regionRouter = RegionRouter(
  process.env.NEXT_PUBLIC_CONTROL_API_URL || ""
);

interface MiningStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: AuctionApplication | null;
  miningScoreData?: {
    miningScore: number;
    weeklyGlwRewards?: string;
    weeklyGlwRewardsUsd?: string;
    weeksOfMinerLifeRemaining?: number;
  } | null;
}

type StatCardConfig = {
  id: string;
  label: string;
  value: string;
  tooltip?: string;
  secondary?: string;
  highlight?: boolean;
};

export function MiningStatsDialog({
  open,
  onOpenChange,
  application,
  miningScoreData,
}: MiningStatsDialogProps) {
  const { t } = useLang();
  const ms = t.routes.miningStats;
  const { data: activeSummary, isLoading: isActiveSummaryLoading } =
    useActiveRegionsSummary({ enabled: open && Boolean(application) });
  const { regions, isRegionsLoading } = useRegions();
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();

  const zoneId = application?.zone?.id;
  const zoneName = application?.zone?.name;

  // Fetch region details for farms under construction
  const { data: regionDetails, isLoading: isRegionDetailsLoading } = useQuery({
    queryKey: ["region-details", zoneId],
    enabled: open && Boolean(zoneId),
    queryFn: async () => {
      if (!zoneId) return null;
      return await regionRouter.fetchRegionByIdOrSlug(zoneId.toString());
    },
    staleTime: 30 * 1000,
  });

  const weeksRemaining = normalizeMinerWeeksRemainingDisplay(
    miningScoreData?.weeksOfMinerLifeRemaining,
  ) ?? 99;

  // Get cost per miner
  const stepPrice = application?.activeFraction?.stepPrice;
  const costPerMiner = stepPrice
    ? parseFloat(formatUnits(BigInt(stepPrice), DECIMALS_BY_TOKEN["USDC"]))
    : 0;

  // Get weekly GLW rewards
  const weeklyGlwRewards = miningScoreData?.weeklyGlwRewards
    ? parseFloat(
        formatUnits(
          BigInt(miningScoreData.weeklyGlwRewards),
          DECIMALS_BY_TOKEN["GLW"]
        )
      )
    : 0;

  // Find region data
  const regionSummary = activeSummary?.regions.find(
    (r) => r.id === zoneId || r.name === zoneName
  );

  const region = regions.find((r) => r.id === zoneId || r.name === zoneName);

  // Farms on deck (under construction)
  const farmsOnDeck = regionDetails?.solarFarmApplications?.length || 0;

  // Calculate APR: (((glwPerWeek * glwSpotPrice * 52.18) / costPerMiner) - 1) * 100
  const apr =
    costPerMiner > 0
      ? ((weeklyGlwRewards * glwSpotPrice * 52.18) / costPerMiner - 1) * 100
      : 0;

  const isLoading =
    isActiveSummaryLoading || isRegionsLoading || isRegionDetailsLoading;

  const weeklyRewardsUsd =
    weeklyGlwRewards > 0 && glwSpotPrice > 0
      ? formatNumber(weeklyGlwRewards * glwSpotPrice, 2)
      : null;

  const snapshotCards = React.useMemo<StatCardConfig[]>(
    () => [
      {
        id: "cost",
        label: ms.cost,
        value:
          costPerMiner > 0 ? `$${formatNumber(costPerMiner, 0)}` : ms.naValue,
        tooltip: ms.costTooltip,
        secondary: ms.perMiner,
      },
      {
        id: "weekly-glw",
        label: ms.estimatedGlwPerWeek,
        value:
          weeklyGlwRewards > 0
            ? formatNumber(weeklyGlwRewards, 2)
            : ms.naValue,
        tooltip: ms.weeklyGlwTooltip,
        secondary: weeklyRewardsUsd ? ms.usdApprox(weeklyRewardsUsd) : undefined,
      },
      {
        id: "duration",
        label: ms.duration,
        value: formatNumber(weeksRemaining, 0),
        tooltip: ms.durationTooltip,
        secondary: ms.weeks,
      },
      {
        id: "apr",
        label: ms.estimatedApr,
        value: apr > 0 ? `${formatNumber(apr, 1)}%` : ms.naValue,
        tooltip: ms.aprTooltip,
        highlight: true,
        secondary: ms.aprFootnote,
      },
    ],
    [apr, costPerMiner, weeklyGlwRewards, weeklyRewardsUsd, weeksRemaining, ms]
  );

  const regionCards = React.useMemo<StatCardConfig[]>(
    () => [
      {
        id: "region-name",
        label: ms.region,
        value: zoneName || ms.naValue,
      },
      {
        id: "regional-glw",
        label: ms.weeklyGlw,
        value:
          regionSummary?.glwPerWeek != null
            ? formatNumber(regionSummary.glwPerWeek, 0)
            : ms.naValue,
        tooltip: ms.regionalGlwTooltip,
      },
      {
        id: "active-farms",
        label: ms.activeFarms,
        value:
          region?.solarFarmCount != null
            ? formatNumber(region.solarFarmCount, 0)
            : ms.naValue,
        tooltip: ms.activeFarmsTooltip,
      },
      {
        id: "farms-on-deck",
        label: ms.farmsPipeline,
        value:
          regionDetails?.solarFarmApplications != null
            ? formatNumber(farmsOnDeck, 0)
            : ms.naValue,
        tooltip: ms.farmsPipelineTooltip,
      },
    ],
    [
      farmsOnDeck,
      region,
      regionDetails?.solarFarmApplications,
      regionSummary?.glwPerWeek,
      zoneName,
      ms,
    ]
  );

  if (!application) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40">
        {/* Header */}
        <div className="border-b border-border/40 pb-6 pt-8 px-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              {ms.title}
            </DialogTitle>
            <div className="text-[10px] font-mono text-muted-foreground/50 dark:text-muted-foreground/70 uppercase tracking-wider mt-2">
              {ms.subtitle(zoneName ?? "")}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="max-h-[65vh]">
          <div className="p-5 space-y-8">
            <section className="space-y-3">
              <div>
                <h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                  {ms.snapshotHeading}
                </h3>
                <p className="text-sm text-muted-foreground/80 mt-1">
                  {ms.snapshotDesc}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {snapshotCards.map(({ id, ...card }) => (
                  <StatCard key={id} {...card} />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                  {ms.regionHeading}
                </h3>
                <p className="text-sm text-muted-foreground/80 mt-1">
                  {ms.regionDesc}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {regionCards.map(({ id, ...card }) => (
                  <StatCard key={id} {...card} loading={isLoading} />
                ))}
              </div>
            </section>

            <section>
              <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 text-xs text-muted-foreground">
                <strong>{ms.prePackagedHeader}</strong>
                {ms.prePackagedDesc(String(weeksRemaining))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface StatCardProps extends Omit<StatCardConfig, "id"> {
  loading?: boolean;
}

function StatCard({
  label,
  value,
  tooltip,
  secondary,
  highlight,
  loading,
}: StatCardProps) {
  const { t } = useLang();
  const ms = t.routes.miningStats;
  const isRegionName = label === ms.region;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        highlight
          ? "border-accent/40 bg-accent/10"
          : "border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-2 text-xs font-mono font-medium uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
        <span>{label}</span>
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger
              className="text-muted-foreground/70"
              type="button"
              aria-label={ms.detailsAriaLabel(label)}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top">{tooltip}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24 bg-muted/50" />
      ) : (
        <div
          className={cn(
            "mt-2 font-mono font-semibold text-foreground",
            isRegionName ? "text-2xl" : "text-3xl"
          )}
        >
          {value}
        </div>
      )}
      {secondary && !loading ? (
        <div className="mt-1 text-sm text-muted-foreground">{secondary}</div>
      ) : null}
    </div>
  );
}
