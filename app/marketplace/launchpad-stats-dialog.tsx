"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AuctionApplication } from "@/hooks/useGlowLaunchpad";
import { formatUnits } from "viem";
import {
  DECIMALS_BY_TOKEN,
  calculateFarmEfficiency,
} from "@glowlabs-org/utils/browser";
import { formatNumber } from "./utils";
import { useActiveRegionsSummary } from "@/hooks/useActiveRegionsSummary";
import { useRegions } from "@/hooks/useRegions";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { RegionRouter } from "@glowlabs-org/utils/browser";
import { cn } from "@/lib/utils";

const regionRouter = RegionRouter(
  process.env.NEXT_PUBLIC_CONTROL_API_URL || ""
);

interface LaunchpadStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: AuctionApplication | null;
  rewardScore?: {
    userWeeklyGlwRewards: string;
    userWeeklyPdRewards: string;
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

export function LaunchpadStatsDialog({
  open,
  onOpenChange,
  application,
  rewardScore,
}: LaunchpadStatsDialogProps) {
  const { data: activeSummary, isLoading: isActiveSummaryLoading } =
    useActiveRegionsSummary({ enabled: open && Boolean(application) });
  const { regions, isRegionsLoading } = useRegions();
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();

  // Fetch region details for farms on deck and PDs
  const zoneId = application?.zone?.id;
  const zoneName = application?.zone?.name;

  const { data: regionDetails, isLoading: isRegionDetailsLoading } = useQuery({
    queryKey: ["region-details", zoneId],
    enabled: open && Boolean(zoneId),
    queryFn: async () => {
      if (!zoneId) return null;
      return await regionRouter.fetchRegionByIdOrSlug(zoneId.toString());
    },
    staleTime: 30 * 1000,
  });

  const isLoading =
    isActiveSummaryLoading || isRegionsLoading || isRegionDetailsLoading;

  const weeksRemaining = 100; // Launchpad is 100 weeks
  const yearsForCCs = 30;
  const weeksPerYear = 52;
  const totalWeeksForCCs = yearsForCCs * weeksPerYear;

  // Total GLW to delegate (one fraction)
  const fractionStep = application?.activeFraction?.step;
  const totalGlwPerFraction = fractionStep
    ? parseFloat(formatUnits(BigInt(fractionStep), DECIMALS_BY_TOKEN["GLW"]))
    : 0;

  // Weekly CCs from application
  const weeklyCC = application?.auditFields?.netCarbonCreditEarningWeekly ?? 0;

  // Solar panels quantity
  const solarPanelsQuantity =
    application?.auditFields?.solarPanelsQuantity ?? 0;

  // Total CCs over 30 years
  const totalCCsOver30Years = weeklyCC * totalWeeksForCCs;

  // Farm Efficiency Rating using SDK
  const farmEfficiency = React.useMemo(() => {
    if (!application?.finalProtocolFee || weeklyCC === 0) return 0;
    try {
      const protocolDepositUsd6 = BigInt(application.finalProtocolFee);
      const weeklyImpactAssetsWad = BigInt(Math.floor(weeklyCC * 10 ** 18));
      return calculateFarmEfficiency(
        protocolDepositUsd6,
        weeklyImpactAssetsWad
      );
    } catch {
      return 0;
    }
  }, [application?.finalProtocolFee, weeklyCC]);

  // Weekly GLW rewards breakdown
  const weeklyGlwFromDeposit = rewardScore?.userWeeklyPdRewards
    ? parseFloat(
        formatUnits(
          BigInt(rewardScore.userWeeklyPdRewards),
          DECIMALS_BY_TOKEN["GLW"]
        )
      )
    : 0;

  const weeklyGlwFromInflation = rewardScore?.userWeeklyGlwRewards
    ? parseFloat(
        formatUnits(
          BigInt(rewardScore.userWeeklyGlwRewards),
          DECIMALS_BY_TOKEN["GLW"]
        )
      )
    : 0;

  const totalFractionSteps = application?.activeFraction?.totalSteps ?? 0;
  const stepsForMath = totalFractionSteps > 0 ? totalFractionSteps : 1;

  const totalWeeklyGlw =
    (weeklyGlwFromDeposit + weeklyGlwFromInflation) / stepsForMath;

  // Find region data
  const regionSummary = activeSummary?.regions.find(
    (r) => r.id === zoneId || r.name === zoneName
  );

  const region = regions.find((r) => r.id === zoneId || r.name === zoneName);

  // Regional Efficiency Rating from RegionWithMetadata
  const regionalEfficiency = region?.efficiencyScore ?? 0;

  // Farms on deck
  const farmsOnDeck = regionDetails?.solarFarmApplications?.length || 0;

  // Calculate APY (Annual Percentage Yield)
  const costPerFraction = totalGlwPerFraction * glwSpotPrice;
  const apy =
    costPerFraction > 0
      ? ((totalWeeklyGlw * glwSpotPrice * 52.18) / costPerFraction) * 100
      : 0;

  const carbonCreditsPerFraction =
    totalFractionSteps > 0 ? totalCCsOver30Years / totalFractionSteps : 0;
  const weeklyPdPerFraction =
    totalFractionSteps > 0 ? weeklyGlwFromDeposit / totalFractionSteps : 0;
  const weeklyInflationPerFraction =
    totalFractionSteps > 0 ? weeklyGlwFromInflation / totalFractionSteps : 0;
  const weeklyRewardsUsd =
    totalWeeklyGlw > 0 && glwSpotPrice > 0
      ? formatNumber(totalWeeklyGlw * glwSpotPrice, 2)
      : null;
  const costPerFractionUsd =
    totalGlwPerFraction > 0 && glwSpotPrice > 0
      ? formatNumber(costPerFraction, 0)
      : null;

  // Calculate weekly CCs per fraction
  const weeklyCCPerFraction =
    totalFractionSteps > 0 ? weeklyCC / totalFractionSteps : 0;

  // Determine if farm efficiency is higher, lower, or equal to regional efficiency
  const efficiencyComparison = React.useMemo(() => {
    if (!region?.efficiencyScore || farmEfficiency === 0) return "equal";
    if (farmEfficiency > regionalEfficiency) return "higher";
    if (farmEfficiency < regionalEfficiency) return "lower";
    return "equal";
  }, [farmEfficiency, regionalEfficiency, region]);

  const opportunityCards = React.useMemo<StatCardConfig[]>(
    () => [
      {
        id: "delegated-glw",
        label: "Delegated GLW",
        value:
          totalGlwPerFraction > 0
            ? formatNumber(totalGlwPerFraction, 0)
            : "N/A",
        tooltip:
          "Amount of GLW required to post as protocol deposit per fraction.",
        secondary: costPerFractionUsd
          ? `≈ $${costPerFractionUsd} USD`
          : undefined,
      },
      {
        id: "weekly-glw",
        label: "Estimated GLW Per Week",
        value: totalWeeklyGlw > 0 ? formatNumber(totalWeeklyGlw, 2) : "N/A",
        tooltip:
          "Expected weekly rewards from deposit recovery and GLW emission rewards share.",
        secondary: weeklyRewardsUsd ? `≈ $${weeklyRewardsUsd} USD` : undefined,
      },
      {
        id: "farm-efficiency",
        label: "Efficiency Score",
        value: formatNumber(farmEfficiency, 2),
        tooltip:
          "Expected carbon credits per $100k deposit weekly, based on audited farm projections.",
        secondary:
          region?.efficiencyScore != null
            ? `Region: ${formatNumber(regionalEfficiency, 2)}`
            : undefined,
        highlight: efficiencyComparison === "higher",
      },
      {
        id: "apy",
        label: "Estimated APY",
        value: apy > 0 ? `${formatNumber(apy, 1)}%` : "N/A",
        tooltip:
          "Annual percentage yield based on expected farm performance, current GLW price, and regional GLW per week.",
        secondary: "Estimate only, changes weekly",
        highlight: true,
      },
      {
        id: "cc-week",
        label: "CCs Per Week",
        value: formatNumber(weeklyCCPerFraction, 4),
        tooltip: "Expected carbon credits generated weekly per fraction.",
        secondary: "Per fraction",
      },
      {
        id: "glw-from-ccs",
        label: "GLW From CCs",
        value: formatNumber(weeklyPdPerFraction, 2),
        tooltip:
          "Weekly GLW rewards from deposit recovery based on carbon credit generation.",
        secondary:
          totalWeeklyGlw > 0
            ? `${formatNumber(
                (weeklyPdPerFraction / totalWeeklyGlw) * 100,
                1
              )}% of total rewards`
            : undefined,
      },
      {
        id: "glw-from-inflation",
        label: "GLW from Emissions",
        value: formatNumber(weeklyInflationPerFraction, 2),
        tooltip: "Weekly GLW rewards from protocol emissions share.",
        secondary:
          totalWeeklyGlw > 0
            ? `${formatNumber(
                (weeklyInflationPerFraction / totalWeeklyGlw) * 100,
                1
              )}% of total rewards`
            : undefined,
      },
      {
        id: "solar-panels",
        label: "Solar Panels",
        value:
          solarPanelsQuantity > 0
            ? formatNumber(solarPanelsQuantity, 0)
            : "N/A",
        tooltip: "Total number of solar panels installed at this farm.",
        secondary: "Total panels",
      },
    ],
    [
      apy,
      costPerFractionUsd,
      efficiencyComparison,
      farmEfficiency,
      region,
      regionalEfficiency,
      solarPanelsQuantity,
      totalGlwPerFraction,
      totalWeeklyGlw,
      weeklyCCPerFraction,
      weeklyInflationPerFraction,
      weeklyPdPerFraction,
      weeklyRewardsUsd,
    ]
  );

  const regionCards = React.useMemo<StatCardConfig[]>(
    () => [
      {
        id: "region",
        label: "Region",
        value: zoneName || "N/A",
      },

      {
        id: "active-farms",
        label: "Active Farms",
        value:
          region?.solarFarmCount != null
            ? formatNumber(region.solarFarmCount, 0)
            : "N/A",
      },
      {
        id: "farms-under-construction",
        label: "Farms Under Construction",
        value:
          regionDetails?.solarFarmApplications != null
            ? formatNumber(farmsOnDeck, 0)
            : "N/A",
      },
      {
        id: "regional-glw-week",
        label: "Regional GLW Per Week",
        value:
          regionSummary?.glwPerWeek != null
            ? formatNumber(regionSummary.glwPerWeek, 0)
            : "N/A",
      },
    ],
    [
      farmsOnDeck,
      region,
      regionDetails?.solarFarmApplications,
      regionSummary?.glwPerWeek,
      regionalEfficiency,
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
            Delegation Advanced Stats
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Evaluate expected performance and regional competitiveness for{" "}
            {zoneName ?? "this delegation"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-4">
          <section className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Opportunity snapshot
              </h3>
              <p className="text-sm text-muted-foreground/80">
                Expected returns per fraction based on audited farm performance
                and current market conditions.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {opportunityCards.slice(0, 4).map(({ id, ...card }) => (
                <StatCard key={id} {...card} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 mt-3">
              {opportunityCards.slice(4).map(({ id, ...card }) => (
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
                Regional competitive landscape and network activity. Farms
                compete only within their region.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {regionCards.map(({ id, ...card }) => (
                <StatCard key={id} {...card} loading={isLoading} />
              ))}
            </div>
          </section>

          <section>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
              <strong>Expectation-based rewards:</strong> Returns are calculated
              based on expected lifetime carbon displacement audited at farm
              construction, not actual weekly performance. This protects
              delegators from weather volatility and operational risk while
              focusing competition on maximum climate impact. Actual returns
              depend on regional competitiveness, GLW price appreciation, and
              network growth. Deposit recovery and GLW rewards continue based on
              original projections regardless of realized farm output.
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
  const isFarmEfficiency = label === "Farm Efficiency";

  // Determine the border/background color for farm efficiency
  const efficiencyStyle = React.useMemo(() => {
    if (!isFarmEfficiency || !secondary?.includes("Region:")) {
      return highlight
        ? "border-accent/40 bg-accent/10"
        : "border-border/60 bg-muted/30";
    }

    // Extract numbers from farm efficiency value and region efficiency secondary text
    const farmValue = parseFloat(value.replace(/[^0-9.-]/g, ""));
    const regionMatch = secondary.match(/Region:\s*([\d.]+)/);
    const regionValue = regionMatch ? parseFloat(regionMatch[1]) : null;

    if (regionValue === null || farmValue === regionValue) {
      return "border-border/60 bg-muted/30";
    }

    return farmValue > regionValue
      ? "border-green-500/40 bg-green-500/10"
      : "border-red-500/40 bg-red-500/10";
  }, [isFarmEfficiency, secondary, value, highlight]);

  return (
    <div
      className={cn("rounded-xl border p-4 transition-colors", efficiencyStyle)}
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
            <TooltipContent className="max-w-xs" side="top">
              {tooltip}
            </TooltipContent>
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
