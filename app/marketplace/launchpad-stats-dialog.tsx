"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
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
  resolveLaunchpadDelegationShareCount,
} from "@/utils/launchpad-rewards";

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

  const totalFractionSteps = resolveLaunchpadDelegationShareCount(application);
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
        label: `Delegated ${delegationCurrency}`,
        value:
          totalDelegationPerFraction > 0
            ? formatNumber(totalDelegationPerFraction, 0)
            : "N/A",
        tooltip: `Amount of ${delegationCurrency} required to post as protocol deposit per fraction.`,
        secondary: costPerFractionUsd
          ? `≈ $${costPerFractionUsd} USD`
          : undefined,
      },
      {
        id: "weekly-glw",
        label:
          delegationCurrency === "SGCTL"
            ? "Estimated Rewards / Week"
            : "Estimated GLW / Week",
        value:
          delegationCurrency === "SGCTL"
            ? weeklyGlwFromInflation > 0 || weeklyPdFromDeposit > 0
              ? `${formatNumber(
                  weeklyPdFromDeposit,
                  2,
                )} SGCTL + ${formatNumber(weeklyGlwFromInflation, 2)} GLW`
              : "N/A"
            : totalWeeklyGlw > 0
              ? formatNumber(totalWeeklyGlw, 2)
              : "N/A",
        tooltip:
          delegationCurrency === "SGCTL"
            ? "Expected weekly rewards from SGCTL protocol-deposit recovery plus GLW emissions share."
            : "Expected weekly rewards from deposit recovery and GLW emission rewards share.",
        secondary:
          delegationCurrency === "SGCTL"
            ? weeklyRewardsUsd
              ? `≈ $${weeklyRewardsUsd} USD`
              : undefined
            : weeklyRewardsUsd
              ? `≈ $${weeklyRewardsUsd} USD`
              : undefined,
        compactValue: delegationCurrency === "SGCTL",
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
          "Annualized return including deposit recovery and emissions, based on expected farm performance and regional competitiveness.",
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
        label:
          delegationCurrency === "SGCTL" ? "SGCTL From CCs" : "GLW From CCs",
        value: formatNumber(weeklyPdFromDeposit, 2),
        tooltip:
          delegationCurrency === "SGCTL"
            ? "Weekly SGCTL rewards from protocol-deposit recovery based on carbon credit generation."
            : "Weekly GLW rewards from deposit recovery based on carbon credit generation.",
        secondary:
          delegationCurrency === "SGCTL"
            ? weeklyRewardsUsdValue > 0
              ? `${formatNumber(
                  (weeklyPdUsdPerFraction / weeklyRewardsUsdValue) * 100,
                  1,
                )}% of total weekly USD rewards`
              : undefined
            : totalWeeklyGlw > 0
              ? `${formatNumber(
                  (weeklyPdFromDeposit / totalWeeklyGlw) * 100,
                  1,
                )}% of total rewards`
              : undefined,
      },
      {
        id: "glw-from-inflation",
        label: "GLW from Emissions",
        value: formatNumber(weeklyGlwFromInflation, 2),
        tooltip: "Weekly GLW rewards from protocol emissions share.",
        secondary:
          delegationCurrency === "SGCTL"
            ? weeklyRewardsUsdValue > 0
              ? `${formatNumber(
                  (weeklyInflationUsdPerFraction / weeklyRewardsUsdValue) * 100,
                  1,
                )}% of total weekly USD rewards`
              : undefined
            : totalWeeklyGlw > 0
              ? `${formatNumber(
                  (weeklyGlwFromInflation / totalWeeklyGlw) * 100,
                  1,
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
    ],
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
      zoneName,
    ],
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
              depend on regional competitiveness, market conditions, and network
              growth. Deposit recovery and GLW emissions continue based on
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
  compactValue,
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
