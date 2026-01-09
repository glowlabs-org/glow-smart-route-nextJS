"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AuctionApplication } from "@/hooks";
import { formatUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { formatNumber } from "./utils";
import { useActiveRegionsSummary, useRegions } from "@/hooks";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { RegionRouter } from "@glowlabs-org/utils/browser";

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

  const weeksRemaining = 99;

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
        label: "Cost",
        value: costPerMiner > 0 ? `$${formatNumber(costPerMiner, 0)}` : "N/A",
        tooltip: "Upfront USDC payment for this miner.",
        secondary: "per miner",
      },
      {
        id: "weekly-glw",
        label: "Estimated GLW per Week",
        value: weeklyGlwRewards > 0 ? formatNumber(weeklyGlwRewards, 2) : "N/A",
        tooltip:
          "Current weekly GLW tokens earned per miner based on farm's allocation and reward split.",
        secondary: weeklyRewardsUsd ? `≈ $${weeklyRewardsUsd} USD` : undefined,
      },
      {
        id: "duration",
        label: "Duration",
        value: formatNumber(weeksRemaining, 0),
        tooltip: "Remaining weeks in the farm's GLW emission schedule.",
        secondary: "weeks",
      },
      {
        id: "apr",
        label: "Estimated APR",
        value: apr > 0 ? `${formatNumber(apr, 1)}%` : "N/A",
        tooltip:
          "Annualized return based on current GLW emissions and price. Assumes no dilution from new regional farms.",
        highlight: true,
        secondary: "Estimate only, changes weekly",
      },
    ],
    [apr, costPerMiner, weeklyGlwRewards, weeklyRewardsUsd, weeksRemaining]
  );

  const regionCards = React.useMemo<StatCardConfig[]>(
    () => [
      {
        id: "region-name",
        label: "Region",
        value: zoneName || "N/A",
      },
      {
        id: "regional-glw",
        label: "Weekly GLW",
        value:
          regionSummary?.glwPerWeek != null
            ? formatNumber(regionSummary.glwPerWeek, 0)
            : "N/A",
        tooltip:
          "Total weekly GLW allocated to this region based on GCTL staking.",
      },
      {
        id: "active-farms",
        label: "Active Farms",
        value:
          region?.solarFarmCount != null
            ? formatNumber(region.solarFarmCount, 0)
            : "N/A",
        tooltip: "Currently operational farms in this region.",
      },
      {
        id: "farms-on-deck",
        label: "Farms Pipeline",
        value:
          regionDetails?.solarFarmApplications != null
            ? formatNumber(farmsOnDeck, 0)
            : "N/A",
        tooltip: "Farms in pipeline awaiting completion.",
      },
    ],
    [
      farmsOnDeck,
      region,
      regionDetails?.solarFarmApplications,
      regionSummary?.glwPerWeek,
      zoneName,
    ]
  );

  if (!application) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className="text-2xl font-light"
            style={{ fontFamily: "Duplicate Slab, serif" }}
          >
            Mining Advanced Stats
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Fractional mining position for {zoneName ?? "this"} solar farm
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-4">
          <section className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Opportunity snapshot
              </h3>
              <p className="text-sm text-muted-foreground/80">
                Key metrics for this pre-packaged mining position earning GLW
                from an active solar farm.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {snapshotCards.map(({ id, ...card }) => (
                <StatCard key={id} {...card} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Region context
              </h3>
              <p className="text-sm text-muted-foreground/80">
                Regional GLW allocation and network activity supporting this
                farm's token emissions.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {regionCards.map(({ id, ...card }) => (
                <StatCard key={id} {...card} loading={isLoading} />
              ))}
            </div>
          </section>

          <section>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
              <strong>Pre-packaged mining positions:</strong> Each mining
              position represents fractional claims to GLW token emissions from
              active solar farms. Returns are based on current network
              conditions including regional GLW allocations, farm deposit size,
              and predetermined reward splits. Actual returns may vary as new
              farms join the region and dilute per-farm token allocations. GLW
              price appreciation is not guaranteed. Mining positions earn token
              streams over {weeksRemaining} weeks from live solar
              infrastructure.
            </div>
          </section>
        </div>
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
  const isRegionName = label === "Region";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        highlight
          ? "border-accent/40 bg-accent/10"
          : "border-border/60 bg-muted/30"
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger
              className="text-muted-foreground/70"
              type="button"
              aria-label={`${label} details`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top">{tooltip}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <div
          className={cn(
            "mt-2 font-semibold text-foreground",
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
