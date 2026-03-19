"use client";

import React, { useMemo, useState } from "react";
import {
  Zap,
  ArrowRight,
  AlertCircle,
  TrendingUp,
  Activity,
  Lock,
  Wallet,
  Globe,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { useAccount } from "wagmi";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { formatUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { cn } from "@/lib/utils";
import {
  useGctlApi,
  useRegions,
  useActiveRegionsSummary,
  useWallets,
  useWalletRegionAvailableStakeMap,
} from "@/hooks";
import { ConnectButton } from "@/components/connect-button";
import { trackEvent } from "@/lib/telemetry";
import { SteeringIcon } from "@/components/impact-icons";

// --- Utility Functions ---

function gctlAmountFromRaw(raw: string) {
  try {
    return Number(formatUnits(BigInt(raw || "0"), DECIMALS_BY_TOKEN.GCTL));
  } catch {
    return 0;
  }
}

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(1).replace(/\.?0+$/, "");
}

// --- Components ---

function GctlSkeleton() {
  return (
    <Card className="h-full lg:max-h-[380px] bg-card dark:bg-card border-border/20">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}

/**
 * Represents a single region the user is steering towards.
 * Displays: Region Name, User's GCTL Staked, % of Region Controlled, and Est. GLW Directed.
 */
function RegionSteeringRow({
  regionName,
  userStakedGctl,
  totalRegionStakedGctl,
  regionWeeklyEmissions,
  isMax,
  normalizedWidth,
}: {
  regionName: string;
  userStakedGctl: number;
  totalRegionStakedGctl: number;
  regionWeeklyEmissions: number;
  isMax: boolean;
  normalizedWidth: number;
}) {
  // Calculate Share %
  const shareOfRegion =
    totalRegionStakedGctl > 0 ? userStakedGctl / totalRegionStakedGctl : 0;

  // Calculate GLW Directed (The Impact)
  const glwDirected = regionWeeklyEmissions * shareOfRegion;

  return (
    <div className="group relative overflow-hidden rounded-xl bg-muted/30 border border-border/20 transition-all hover:bg-muted/40 hover:border-border/40">
      {/* Background Fill - normalized so the max stake is 100% */}
      <div
        className="absolute inset-y-0 left-0 bg-[#22D3EE]/5 transition-all duration-700 ease-out"
        style={{ width: `${normalizedWidth}%` }}
      />

      <div className="relative flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors",
              isMax
                ? "bg-[#22D3EE]/10 text-[#22D3EE]"
                : "bg-muted/50 text-muted-foreground"
            )}
          >
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-sm text-foreground leading-none">
              {regionName}
            </div>
            <div className="text-[10px] text-muted-foreground/60 font-mono mt-1">
              {formatCompact(userStakedGctl)} GCTL Staked
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono font-semibold text-foreground flex items-center justify-end gap-1">
            {formatCompact(glwDirected)}{" "}
            <span className="text-[10px] text-muted-foreground/60 font-normal">
              GLW/wk
            </span>
          </div>
          <div className="text-[10px] text-[#22D3EE] font-medium">
            {totalRegionStakedGctl > 0
              ? `Directing ${(shareOfRegion * 100).toFixed(2)}% of Region`
              : "Directing Emissions"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GctlControlWidget({
  walletAddress,
  onMintAndStakeClick,
  variant = "default",
  readOnly = false,
}: {
  walletAddress?: string | null;
  onMintAndStakeClick?: () => void;
  variant?: "default" | "flow" | "minimal";
  readOnly?: boolean;
}) {
  const [showAllStakes, setShowAllStakes] = useState(false);
  const { isConnecting, isReconnecting } = useAccount();
  const isEnabled = Boolean(walletAddress);
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const isWalletConnecting = isConnecting || isReconnecting;
  const isFlow = variant === "flow";
  const isMinimal = variant === "minimal";
  const source = "gctl_heatmap_widget";

  const handleMintAndStakeClick = () => {
    trackEvent("dashboard_gctl_mint_stake_open_click", {
      source,
      wallet_connected: isEnabled,
      wallet_address: normalizedWalletAddress,
    });
    onMintAndStakeClick?.();
  };

  // --- Data Fetching ---
  const { gctlBalance, isGctlBalanceLoading } = useGctlApi(
    walletAddress ?? undefined,
    { enabled: isEnabled }
  );
  const { walletDetails, isWalletDetailsLoading } = useWallets({
    walletAddress: walletAddress ?? undefined,
    enabled: isEnabled,
  });
  const regionIds = useMemo(
    () => (walletDetails?.regions ?? []).map((region) => region.regionId),
    [walletDetails?.regions],
  );
  const {
    impactEligibleStakedGctlByRegion,
    isAvailableStakeMapLoading,
  } = useWalletRegionAvailableStakeMap({
    walletAddress: walletAddress ?? undefined,
    regionIds,
    enabled: isEnabled,
  });
  const { regions, isRegionsLoading } = useRegions();
  const { data: activeSummary, isLoading: isActiveSummaryLoading } =
    useActiveRegionsSummary({
      enabled: isEnabled,
    });

  // --- Computations ---
  const walletBalanceGctl = useMemo(() => {
    if (!isEnabled) return 0;
    return gctlAmountFromRaw(gctlBalance);
  }, [gctlBalance, isEnabled]);

  const regionDataMap = useMemo(() => {
    if (!activeSummary) return new Map();
    return new Map(
      activeSummary.regions.map((r) => [
        r.id,
        {
          totalStaked: r.stakedGctl,
          weeklyEmissions: r.glwPerWeek,
        },
      ])
    );
  }, [activeSummary]);

  const stakes = useMemo(() => {
    if (!isEnabled) return [];
    return (
      walletDetails?.regions
        ?.filter((r) => {
          return (impactEligibleStakedGctlByRegion.get(r.regionId) ?? 0n) > 0n;
        })
        .map((r) => {
          const fallbackName =
            regions.find((reg) => reg.id === r.regionId)?.name ??
            `Region ${r.regionId}`;
          const regionData = regionDataMap.get(r.regionId);
          const impactEligibleStaked =
            impactEligibleStakedGctlByRegion.get(r.regionId) ?? 0n;

          return {
            regionId: r.regionId,
            regionName: r.region?.name || fallbackName,
            amountGctl: gctlAmountFromRaw(impactEligibleStaked.toString()),
            totalRegionStaked: regionData?.totalStaked ?? 0,
            weeklyEmissions: regionData?.weeklyEmissions ?? 0,
          };
        })
        .sort((a, b) => b.amountGctl - a.amountGctl) ?? []
    );
  }, [
    impactEligibleStakedGctlByRegion,
    isEnabled,
    regionDataMap,
    regions,
    walletDetails?.regions,
  ]);

  const stakedTotalGctl = useMemo(
    () => stakes.reduce((acc, curr) => acc + curr.amountGctl, 0),
    [stakes]
  );
  const totalBalanceGctl = walletBalanceGctl + stakedTotalGctl;

  // Calculate shares for normalization (biggest stake = 75% bar width)
  const stakesWithNormalizedWidth = useMemo(() => {
    const shares = stakes.map((stake) => ({
      ...stake,
      share:
        stake.totalRegionStaked > 0
          ? stake.amountGctl / stake.totalRegionStaked
          : 0,
    }));
    const maxShare = Math.max(...shares.map((s) => s.share), 0);
    return shares.map((stake) => ({
      ...stake,
      normalizedWidth: maxShare > 0 ? (stake.share / maxShare) * 75 : 0,
    }));
  }, [stakes]);
  const maxVisibleStakes = 3;
  const hasMoreStakes = stakesWithNormalizedWidth.length > maxVisibleStakes;
  const isExpanded = hasMoreStakes && showAllStakes;
  const hiddenStakesCount = Math.max(
    stakesWithNormalizedWidth.length - maxVisibleStakes,
    0,
  );
  const visibleStakes = isExpanded
    ? stakesWithNormalizedWidth
    : stakesWithNormalizedWidth.slice(0, maxVisibleStakes);
  const hasLiquidGctl = walletBalanceGctl > 0.01;
  const isLoading =
    isGctlBalanceLoading ||
    isWalletDetailsLoading ||
    isAvailableStakeMapLoading ||
    isRegionsLoading ||
    isActiveSummaryLoading;

  // Calculate Total Steering Points (KPI)
  // Logic: Estimated GLW Directed * 3
  // TODO: Replace with actual value from Impact Score API if available (impactScore.composition.steeringPoints)
  const totalSteeringPoints = stakes.reduce((acc, curr) => {
    const share = curr.amountGctl / curr.totalRegionStaked;
    const glw = curr.weeklyEmissions * share;
    return acc + glw * 3;
  }, 0);

  // --- Layout Classes ---
  const cardClasses = cn(
    "overflow-hidden flex flex-col pt-0 w-full transition-all duration-300",
    isMinimal
      ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl h-full"
      : isFlow
      ? "bg-card/30 border-border/20 min-h-[380px]"
      : "h-full lg:max-h-[380px] bg-card dark:bg-card border-border/20"
  );

  // --- 1. Loading State ---
  if (isWalletConnecting && !isEnabled) return <GctlSkeleton />;

  // --- 2. Disconnected State ---
  if (!isEnabled) {
    return (
      <Card className={cardClasses}>
        <CardHeader className="pb-0 pt-4 flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold tracking-tight">
            Glow Control (GCTL)
          </CardTitle>
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
            <SteeringIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              Steer Solar Rewards
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-[200px] mx-auto">
              Direct GLW emissions to regions and earn 3 points per GLW.
            </p>
          </div>
          <ConnectButton variant="default" />
        </CardContent>
      </Card>
    );
  }

  // --- 3. Zero Balance State (Sales Pitch) ---
  if (!isLoading && totalBalanceGctl <= 0) {
    return (
      <Card className={cn(cardClasses)}>
        <CardHeader className="pb-0 pt-4 flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              Glow Control
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-6 pt-2">
          <div className="flex-1 flex flex-col justify-center items-center text-center gap-5">
            {/* Hero Visual */}
            <div
              className={cn("group", !readOnly && "cursor-pointer")}
              onClick={readOnly ? undefined : handleMintAndStakeClick}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-20 h-20 rounded-full bg-[#22D3EE]/10 transition-colors",
                  !readOnly && "group-hover:bg-[#22D3EE]/15"
                )}
              >
                <SteeringIcon className="w-10 h-10 text-[#22D3EE]" />
              </div>
            </div>

            {/* Value Prop */}
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                {readOnly ? "No GCTL Holdings" : "Direct Global Emissions"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                {readOnly
                  ? "This wallet has no GCTL staked."
                  : "Decide where solar gets built."}
              </p>
            </div>

            {!readOnly && (
              <>
                {/* Gamification Hook */}
                <div className="bg-[#22D3EE]/10 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#22D3EE]" />
                  <span className="text-xs font-medium text-[#22D3EE]">
                    Earn <span className="font-semibold">3 Points</span> per GLW
                    Steered
                  </span>
                </div>

                <Button className="w-full" onClick={handleMintAndStakeClick}>
                  Mint & Stake GCTL
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- 4. Active State (The Control Panel) ---
  return (
    <Card className={cardClasses}>
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              Glow Control (GCTL)
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-[#22D3EE] transition-colors" />
                </TooltipTrigger>
                <TooltipContent>
                  Your governance influence over the solar grid.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 border-border/40 bg-transparent hover:bg-transparent hover:text-[#22D3EE] hover:border-[#22D3EE] transition-colors"
              onClick={handleMintAndStakeClick}
            >
              <TrendingUp className="h-3 w-3" />
              Boost
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 gap-4">
        {/* Top: KPI Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* KPI 1: Holdings */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              My Holdings
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-semibold text-foreground">
                {formatCompact(totalBalanceGctl)}
              </span>
              <span className="text-xs text-muted-foreground/60">GCTL</span>
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground/60">
              <span
                className={cn(
                  hasLiquidGctl &&
                    "text-[color:var(--color-glow-orange)] font-medium"
                )}
              >
                {formatCompact(walletBalanceGctl)} Liquid
              </span>
              <span>•</span>
              <span className="text-[#22D3EE] font-medium">
                {formatCompact(stakedTotalGctl)} Active
              </span>
            </div>
          </div>

          {/* KPI 2: Impact Score Contribution */}
          <div className="space-y-1 text-right">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              Steering Score
            </div>
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-2xl font-mono font-semibold text-foreground">
                {formatCompact(
                  totalSteeringPoints > 0
                    ? totalSteeringPoints
                    : stakedTotalGctl * 0.1
                )}
              </span>
              <span className="text-xs text-muted-foreground/60">Pts</span>
            </div>
            <div className="text-[10px] text-[#22D3EE] font-medium">
              +3 pts / GLW rate
            </div>
          </div>
        </div>

        {/* Middle: Region Steering List */}
        <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto pr-1 -mr-1">
          <div className="flex items-center justify-between text-[10px] uppercase font-mono text-muted-foreground/50 mb-1 border-b border-border/20 pb-1">
            <span>Active Stakes</span>
            <span>Impact</span>
          </div>

          {stakesWithNormalizedWidth.length > 0 ? (
            <>
              {visibleStakes.map((stake, i) => (
                <RegionSteeringRow
                  key={stake.regionId}
                  regionName={stake.regionName}
                  userStakedGctl={stake.amountGctl}
                  totalRegionStakedGctl={stake.totalRegionStaked}
                  regionWeeklyEmissions={stake.weeklyEmissions}
                  isMax={i === 0}
                  normalizedWidth={stake.normalizedWidth}
                />
              ))}
              {hasMoreStakes && (
                <button
                  type="button"
                  onClick={() => setShowAllStakes((value) => !value)}
                  className="mt-1 w-full rounded-lg border border-border/30 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground transition-colors hover:border-[#22D3EE]/50 hover:text-[#22D3EE] flex items-center justify-center gap-1"
                >
                  {isExpanded ? (
                    <>
                      Show Less
                      <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Show {hiddenStakesCount} More
                      <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              )}
            </>
          ) : (
            <div
              className={cn(
                "flex-1 flex flex-col items-center justify-center border border-dashed border-border/40 rounded-xl p-4 transition-all group",
                !readOnly &&
                  "cursor-pointer hover:bg-muted/30 hover:border-border/60"
              )}
              onClick={readOnly ? undefined : handleMintAndStakeClick}
            >
              <div
                className={cn(
                  "h-12 w-12 rounded-lg bg-muted/50 flex items-center justify-center mb-2 transition-colors",
                  !readOnly && "group-hover:bg-[#22D3EE]/10"
                )}
              >
                <SteeringIcon
                  className={cn(
                    "h-6 w-6 text-muted-foreground/40 transition-colors",
                    !readOnly && "group-hover:text-[#22D3EE]"
                  )}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                No Active Steering
              </span>
              {!readOnly && (
                <span className="text-[10px] text-[#22D3EE] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Stake GCTL to Direct Emissions
                </span>
              )}
            </div>
          )}
        </div>

        {/* Warning if Liquid GCTL exists */}
        {!readOnly && (
          <div className="mt-auto pt-3 border-t border-border/20 flex items-center justify-between">
            {hasLiquidGctl && (
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded-lg bg-[color:var(--color-glow-orange)]/10 flex items-center justify-center">
                  <AlertCircle className="h-3.5 w-3.5 text-[color:var(--color-glow-orange)]" />
                </div>
                <span className="text-[10px] font-medium text-[color:var(--color-glow-orange)] uppercase tracking-wide">
                  Unused Influence
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={handleMintAndStakeClick}
            >
              Stake{" "}
              {walletBalanceGctl > 0 ? formatCompact(walletBalanceGctl) : ""}{" "}
              GCTL
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
