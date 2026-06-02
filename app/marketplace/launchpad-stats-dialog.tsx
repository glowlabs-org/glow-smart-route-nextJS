"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type AuctionApplication,
} from "@/hooks";
import { formatUnits } from "viem";
import {
  DECIMALS_BY_TOKEN,
  calculateFarmEfficiency,
} from "@glowlabs-org/utils/browser";
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
import { useQuery } from "@tanstack/react-query";
import { RegionRouter } from "@glowlabs-org/utils/browser";
import { cn } from "@/lib/utils";
import {
  calculateLaunchpadPerShareRewards,
  parseDelegationStepAmount,
  parseUsd6Amount,
  resolveDelegationCurrency,
  resolveLaunchpadDelegationUnitCount,
} from "@/utils/launchpad-rewards";
import { useLang } from "@/lib/i18n";

const regionRouter = RegionRouter(
  process.env.NEXT_PUBLIC_CONTROL_API_URL || "",
);

interface LaunchpadStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: AuctionApplication | null;
  rewardScore?: {
    userWeeklyGlwRewards: string;
    userWeeklyPdRewards: string;
    userWeeklyGlwValueUsd?: string;
    userWeeklyPdRewardsUsd?: string;
  } | null;
}

type StatCardConfig = {
  id: string;
  label: string;
  value: string;
  tooltip?: string;
  secondary?: string;
  highlight?: boolean;
  compactValue?: boolean;
};

export function LaunchpadStatsDialog({
  open,
  onOpenChange,
  application,
  rewardScore,
}: LaunchpadStatsDialogProps) {
  const { t } = useLang();
  const ls = t.routes.launchpadStats;
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
  const delegationCurrency = resolveDelegationCurrency(application);

  // Total delegation amount per fraction (GLW during GLW phase, SGCTL during SGCTL phase)
  const totalDelegationPerFraction = parseDelegationStepAmount(application);

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
        weeklyImpactAssetsWad,
      );
    } catch {
      return 0;
    }
  }, [application?.finalProtocolFee, weeklyCC]);

  const totalFractionSteps = resolveLaunchpadDelegationUnitCount(application);
  const stepsForMath = totalFractionSteps > 0 ? totalFractionSteps : 1;
  const perShareRewards = calculateLaunchpadPerShareRewards({
    reward: rewardScore,
    totalShares: stepsForMath,
    delegationCurrency,
    glwSpotPrice,
  });
  const weeklyGlwFromInflation = perShareRewards.emissionGlwPerShare;
  const weeklyPdFromDeposit = perShareRewards.pdPerShare;
  const totalWeeklyGlw = perShareRewards.totalGlwPerShare;
  const weeklyRewardsUsdValue = perShareRewards.totalUsdPerShare;
  const weeklyGlwFromInflationUsd = parseUsd6Amount(
    rewardScore?.userWeeklyGlwValueUsd,
  );
  const weeklyPdFromDepositUsd = parseUsd6Amount(
    rewardScore?.userWeeklyPdRewardsUsd,
  );
  const weeklyInflationUsdPerFraction =
    Number.isFinite(weeklyGlwFromInflationUsd) && weeklyGlwFromInflationUsd > 0
      ? weeklyGlwFromInflationUsd / stepsForMath
      : 0;
  const weeklyPdUsdPerFraction =
    Number.isFinite(weeklyPdFromDepositUsd) && weeklyPdFromDepositUsd > 0
      ? weeklyPdFromDepositUsd / stepsForMath
      : 0;

  // Find region data
  const regionSummary = activeSummary?.regions.find(
    (r) => r.id === zoneId || r.name === zoneName,
  );

  const region = regions.find((r) => r.id === zoneId || r.name === zoneName);

  // Regional Efficiency Rating from RegionWithMetadata
  const regionalEfficiency = region?.efficiencyScore ?? 0;

  // Farms on deck
  const farmsOnDeck = regionDetails?.solarFarmApplications?.length || 0;

  // Calculate APY (Annual Percentage Yield)
  const costPerFractionUsdValue = (() => {
    if (application?.finalProtocolFee) {
      try {
        const totalProtocolDepositUsd = parseFloat(
          formatUnits(
            BigInt(application.finalProtocolFee),
            DECIMALS_BY_TOKEN["USDC"],
          ),
        );
        if (Number.isFinite(totalProtocolDepositUsd) && totalProtocolDepositUsd > 0) {
          return totalProtocolDepositUsd / stepsForMath;
        }
      } catch {
        return 0;
      }
    }
    if (delegationCurrency === "GLW" && glwSpotPrice > 0) {
      return totalDelegationPerFraction * glwSpotPrice;
    }
    return 0;
  })();
  const apy =
    costPerFractionUsdValue > 0 && weeklyRewardsUsdValue > 0
      ? (weeklyRewardsUsdValue * weeksPerYear * 100) / costPerFractionUsdValue
      : 0;

  const carbonCreditsPerFraction =
    totalFractionSteps > 0 ? totalCCsOver30Years / totalFractionSteps : 0;
  const weeklyRewardsUsd =
    weeklyRewardsUsdValue > 0 ? formatNumber(weeklyRewardsUsdValue, 2) : null;
  const costPerFractionUsd =
    costPerFractionUsdValue > 0
      ? formatNumber(costPerFractionUsdValue, 0)
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
        label: ls.delegatedToken(delegationCurrency),
        value:
          totalDelegationPerFraction > 0
            ? formatNumber(totalDelegationPerFraction, 0)
            : ls.naValue,
        tooltip: ls.delegatedTooltip(delegationCurrency),
        secondary: costPerFractionUsd
          ? ls.usdApprox(costPerFractionUsd)
          : undefined,
      },
      {
        id: "weekly-glw",
        label:
          delegationCurrency === "SGCTL"
            ? ls.estimatedRewardsPerWeek
            : ls.estimatedGlwPerWeek,
        value:
          delegationCurrency === "SGCTL"
            ? weeklyGlwFromInflation > 0 || weeklyPdFromDeposit > 0
              ? ls.sgctlPlusGlw(
                  formatNumber(weeklyPdFromDeposit, 2),
                  formatNumber(weeklyGlwFromInflation, 2),
                )
              : ls.naValue
            : totalWeeklyGlw > 0
              ? formatNumber(totalWeeklyGlw, 2)
              : ls.naValue,
        tooltip:
          delegationCurrency === "SGCTL"
            ? ls.rewardsTooltipSgctl
            : ls.rewardsTooltipDefault,
        secondary: weeklyRewardsUsd ? ls.usdApprox(weeklyRewardsUsd) : undefined,
        compactValue: delegationCurrency === "SGCTL",
      },
      {
        id: "farm-efficiency",
        label: ls.efficiencyScore,
        value: formatNumber(farmEfficiency, 2),
        tooltip: ls.efficiencyTooltip,
        secondary:
          region?.efficiencyScore != null
            ? ls.regionLabel(formatNumber(regionalEfficiency, 2))
            : undefined,
        highlight: efficiencyComparison === "higher",
      },
      {
        id: "apy",
        label: ls.estimatedApy,
        value: apy > 0 ? `${formatNumber(apy, 1)}%` : ls.naValue,
        tooltip: ls.apyTooltip,
        secondary: ls.apyFootnote,
        highlight: true,
      },
      {
        id: "cc-week",
        label: ls.ccsPerWeek,
        value: formatNumber(weeklyCCPerFraction, 4),
        tooltip: ls.ccsPerWeekTooltip,
        secondary: ls.perFraction,
      },
      {
        id: "glw-from-ccs",
        label:
          delegationCurrency === "SGCTL" ? ls.sgctlFromCCs : ls.glwFromCCs,
        value: formatNumber(weeklyPdFromDeposit, 2),
        tooltip:
          delegationCurrency === "SGCTL"
            ? ls.fromCCsTooltipSgctl
            : ls.fromCCsTooltipDefault,
        secondary:
          delegationCurrency === "SGCTL"
            ? weeklyRewardsUsdValue > 0
              ? ls.pctOfTotalUsd(
                  formatNumber(
                    (weeklyPdUsdPerFraction / weeklyRewardsUsdValue) * 100,
                    1,
                  ),
                )
              : undefined
            : totalWeeklyGlw > 0
              ? ls.pctOfTotal(
                  formatNumber(
                    (weeklyPdFromDeposit / totalWeeklyGlw) * 100,
                    1,
                  ),
                )
              : undefined,
      },
      {
        id: "glw-from-inflation",
        label: ls.glwFromEmissions,
        value: formatNumber(weeklyGlwFromInflation, 2),
        tooltip: ls.glwFromEmissionsTooltip,
        secondary:
          delegationCurrency === "SGCTL"
            ? weeklyRewardsUsdValue > 0
              ? ls.pctOfTotalUsd(
                  formatNumber(
                    (weeklyInflationUsdPerFraction / weeklyRewardsUsdValue) *
                      100,
                    1,
                  ),
                )
              : undefined
            : totalWeeklyGlw > 0
              ? ls.pctOfTotal(
                  formatNumber(
                    (weeklyGlwFromInflation / totalWeeklyGlw) * 100,
                    1,
                  ),
                )
              : undefined,
      },
      {
        id: "solar-panels",
        label: ls.solarPanels,
        value:
          solarPanelsQuantity > 0
            ? formatNumber(solarPanelsQuantity, 0)
            : ls.naValue,
        tooltip: ls.solarPanelsTooltip,
        secondary: ls.totalPanels,
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
      totalDelegationPerFraction,
      totalWeeklyGlw,
      weeklyCCPerFraction,
      weeklyGlwFromInflation,
      weeklyInflationUsdPerFraction,
      weeklyPdFromDeposit,
      weeklyPdUsdPerFraction,
      weeklyRewardsUsd,
      weeklyRewardsUsdValue,
      delegationCurrency,
      ls,
    ],
  );

  const regionCards = React.useMemo<StatCardConfig[]>(
    () => [
      {
        id: "region",
        label: ls.region,
        value: zoneName || ls.naValue,
      },

      {
        id: "active-farms",
        label: ls.activeFarms,
        value:
          region?.solarFarmCount != null
            ? formatNumber(region.solarFarmCount, 0)
            : ls.naValue,
      },
      {
        id: "farms-under-construction",
        label: ls.farmsUnderConstruction,
        value:
          regionDetails?.solarFarmApplications != null
            ? formatNumber(farmsOnDeck, 0)
            : ls.naValue,
      },
      {
        id: "regional-glw-week",
        label: ls.regionalGlwPerWeek,
        value:
          regionSummary?.glwPerWeek != null
            ? formatNumber(regionSummary.glwPerWeek, 0)
            : ls.naValue,
      },
    ],
    [
      farmsOnDeck,
      region,
      regionDetails?.solarFarmApplications,
      regionSummary?.glwPerWeek,
      zoneName,
      ls,
    ],
  );

  if (!application) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40">
        {/* Header */}
        <div className="border-b border-border/40 pb-6 pt-8 px-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              {ls.title}
            </DialogTitle>
            <div className="text-[10px] font-mono text-muted-foreground/50 dark:text-muted-foreground/70 uppercase tracking-wider mt-2">
              {ls.subtitle(zoneName ?? "")}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="max-h-[65vh]">
          <div className="p-5 space-y-8">
            <section className="space-y-3">
              <div>
                <h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                  {ls.snapshotHeading}
                </h3>
                <p className="text-sm text-muted-foreground/80 mt-1">
                  {ls.snapshotDesc}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {opportunityCards.slice(0, 4).map(({ id, ...card }) => (
                  <StatCard key={id} {...card} />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-3">
                {opportunityCards.slice(4).map(({ id, ...card }) => (
                  <StatCard key={id} {...card} />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                  {ls.regionHeading}
                </h3>
                <p className="text-sm text-muted-foreground/80 mt-1">
                  {ls.regionDesc}
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
                <strong>{ls.expectationHeader}</strong>
                {ls.expectationDesc}
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
  compactValue,
  loading,
}: StatCardProps) {
  const { t } = useLang();
  const ls = t.routes.launchpadStats;
  const isRegionName = label === ls.region;
  const isFarmEfficiency = label === ls.efficiencyScore;

  // Determine the border/background color for farm efficiency
  const efficiencyStyle = React.useMemo(() => {
    // Match locale-aware "Region:" prefix from regionLabel(value).
    // En: "Region: 1.23" — Ko: "지역: 1.23"
    const regionPrefixMatch = secondary
      ? secondary.match(/^[^:]+:\s*([\d.]+)/)
      : null;
    if (!isFarmEfficiency || !regionPrefixMatch) {
      return highlight
        ? "border-accent/40 bg-accent/10"
        : "border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50";
    }

    // Extract numbers from farm efficiency value and region efficiency secondary text
    const farmValue = parseFloat(value.replace(/[^0-9.-]/g, ""));
    const regionValue = parseFloat(regionPrefixMatch[1]);

    if (Number.isNaN(regionValue) || farmValue === regionValue) {
      return "border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50";
    }

    return farmValue > regionValue
      ? "border-green-500/40 bg-green-500/10"
      : "border-red-500/40 bg-red-500/10";
  }, [isFarmEfficiency, secondary, value, highlight]);

  return (
    <div
      className={cn("rounded-xl border p-4 transition-colors", efficiencyStyle)}
    >
      <div className="flex items-center gap-2 text-xs font-mono font-medium uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
        <span>{label}</span>
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger
              className="text-muted-foreground/70"
              type="button"
              aria-label={ls.detailsAriaLabel(label)}
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
        <Skeleton className="mt-3 h-8 w-24 bg-muted/50" />
      ) : (
        <div
          className={cn(
            "mt-2 font-mono font-semibold text-foreground",
            isRegionName
              ? "text-2xl"
              : compactValue
                ? "text-base leading-tight whitespace-nowrap sm:text-lg"
                : "text-3xl",
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
