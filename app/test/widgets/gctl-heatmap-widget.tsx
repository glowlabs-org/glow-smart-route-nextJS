"use client";

import React, { useMemo } from "react";
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
  useWallets,
  useRegions,
  useActiveRegionsSummary,
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
    <Card className="h-full lg:max-h-[380px] bg-card dark:bg-muted/30 border-border">
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
}: {
  regionName: string;
  userStakedGctl: number;
  totalRegionStakedGctl: number;
  regionWeeklyEmissions: number;
  isMax: boolean;
}) {
  // Calculate Share %
  const shareOfRegion =
    totalRegionStakedGctl > 0 ? userStakedGctl / totalRegionStakedGctl : 0;

  // Calculate GLW Directed (The Impact)
  const glwDirected = regionWeeklyEmissions * shareOfRegion;

  return (
    <div className="group relative overflow-hidden rounded-xl bg-muted/40 border border-border/50 transition-all hover:bg-muted/60 hover:border-cyan-500/30">
      {/* Background Fill Animation based on share strength */}
      <div
        className="absolute inset-y-0 left-0 bg-cyan-500/5 dark:bg-cyan-900/10 transition-all duration-1000 ease-out"
        style={{ width: `${Math.min(shareOfRegion * 500, 100)}%` }} // Visual scaling, purely cosmetic
      />

      <div className="relative flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
              isMax
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400"
                : "bg-background/50 border-border text-muted-foreground"
            )}
          >
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground leading-none">
              {regionName}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              {formatCompact(userStakedGctl)} GCTL Staked
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono font-bold text-foreground flex items-center justify-end gap-1">
            {formatCompact(glwDirected)}{" "}
            <span className="text-[10px] text-muted-foreground font-normal">
              GLW/wk
            </span>
          </div>
          <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">
            {/* If we don't have totalRegionStakedGctl yet, hide the %, or show <1% */}
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
}: {
  walletAddress?: string | null;
  onMintAndStakeClick?: () => void;
  variant?: "default" | "flow" | "minimal";
}) {
  const { isConnecting, isReconnecting } = useAccount();
  const isEnabled = Boolean(walletAddress);
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const isWalletConnecting = isConnecting || isReconnecting;
  const isFlow = variant === "flow";
  const isMinimal = variant === "minimal";

  // --- Data Fetching ---
  const { gctlBalance, isGctlBalanceLoading } = useGctlApi(
    walletAddress ?? undefined,
    { enabled: isEnabled }
  );
  const { walletDetails, isWalletDetailsLoading } = useWallets({
    walletAddress: walletAddress ?? undefined,
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
          try {
            return BigInt(r.totalStaked || "0") > BigInt(0);
          } catch {
            return false;
          }
        })
        .map((r) => {
          const fallbackName =
            regions.find((reg) => reg.id === r.regionId)?.name ??
            `Region ${r.regionId}`;
          const regionData = regionDataMap.get(r.regionId);

          return {
            regionId: r.regionId,
            regionName: r.region?.name || fallbackName,
            amountGctl: gctlAmountFromRaw(r.totalStaked),
            totalRegionStaked: regionData?.totalStaked ?? 0,
            weeklyEmissions: regionData?.weeklyEmissions ?? 0,
          };
        })
        .sort((a, b) => b.amountGctl - a.amountGctl)
        .slice(0, 4) ?? []
    );
  }, [isEnabled, regions, walletDetails?.regions, regionDataMap]);

  const stakedTotalGctl = useMemo(
    () => stakes.reduce((acc, curr) => acc + curr.amountGctl, 0),
    [stakes]
  );
  const totalBalanceGctl = walletBalanceGctl + stakedTotalGctl;
  const hasLiquidGctl = walletBalanceGctl > 0.01;
  const isLoading =
    isGctlBalanceLoading ||
    isWalletDetailsLoading ||
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
      ? "bg-transparent border-transparent h-full"
      : isFlow
      ? "bg-card/30 border-foreground/5 min-h-[380px]"
      : "h-full lg:max-h-[380px] bg-card dark:bg-muted/30 border-border shadow-sm hover:shadow-md hover:border-border/80"
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
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full" />
            <SteeringIcon className="relative h-16 w-16 text-muted-foreground/50" />
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
              className="relative group cursor-pointer"
              onClick={onMintAndStakeClick}
            >
              <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl animate-pulse group-hover:bg-cyan-500/30 transition-colors" />
              <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-b from-cyan-500/10 to-transparent border border-cyan-500/30 group-hover:scale-105 transition-transform">
                <SteeringIcon className="w-10 h-10 text-cyan-500" />
              </div>
            </div>

            {/* Value Prop */}
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">
                Direct Global Emissions
              </h3>
              <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                Decide where solar gets built.
              </p>
            </div>

            {/* Gamification Hook */}
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg px-4 py-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-500 fill-cyan-500" />
              <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                Earn <span className="font-bold">3 Points</span> per GLW Steered
              </span>
            </div>

            <Button className="w-full " onClick={onMintAndStakeClick}>
              Mint & Stake GCTL
            </Button>
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
                  <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-cyan-500 transition-colors" />
                </TooltipTrigger>
                <TooltipContent>
                  Your governance influence over the solar grid.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-dashed border-border hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:text-cyan-600"
            onClick={onMintAndStakeClick}
          >
            <TrendingUp className="h-3 w-3" />
            Boost
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 gap-4">
        {/* Top: KPI Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* KPI 1: Holdings */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              My Holdings
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-foreground">
                {formatCompact(totalBalanceGctl)}
              </span>
              <span className="text-xs text-muted-foreground">GCTL</span>
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span
                className={cn(hasLiquidGctl && "text-[#ffb472] font-medium")}
              >
                {formatCompact(walletBalanceGctl)} Liquid
              </span>
              <span>•</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                {formatCompact(stakedTotalGctl)} Active
              </span>
            </div>
          </div>

          {/* KPI 2: Impact Score Contribution */}
          <div className="space-y-1 text-right">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Steering Score
            </div>
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-2xl font-mono font-bold text-foreground">
                {/* TODO: Connect to real Steering Points from Impact API */}
                {formatCompact(
                  totalSteeringPoints > 0
                    ? totalSteeringPoints
                    : stakedTotalGctl * 0.1
                )}
              </span>
              <span className="text-xs text-muted-foreground">Pts</span>
            </div>
            <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">
              +3 pts / GLW rate
            </div>
          </div>
        </div>

        {/* Middle: Region Steering List */}
        <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto pr-1 -mr-1">
          <div className="flex items-center justify-between text-[10px] uppercase font-mono text-muted-foreground/70 mb-1 border-b border-border/40 pb-1">
            <span>Active Stakes</span>
            <span>Impact</span>
          </div>

          {stakes.length > 0 ? (
            stakes.map((stake, i) => (
              <RegionSteeringRow
                key={stake.regionId}
                regionName={stake.regionName}
                userStakedGctl={stake.amountGctl}
                totalRegionStakedGctl={stake.totalRegionStaked}
                regionWeeklyEmissions={stake.weeklyEmissions}
                isMax={i === 0}
              />
            ))
          ) : (
            <div
              className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-xl p-4 cursor-pointer hover:bg-muted/30 hover:border-cyan-500/30 transition-all group"
              onClick={onMintAndStakeClick}
            >
              <SteeringIcon className="h-8 w-8 text-muted-foreground/30 group-hover:text-cyan-500/50 mb-2 transition-colors" />
              <span className="text-xs font-medium text-muted-foreground">
                No Active Steering
              </span>
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Stake GCTL to Direct Emissions
              </span>
            </div>
          )}
        </div>

        {/* Warning if Liquid GCTL exists (Loss Aversion) */}
        {hasLiquidGctl && (
          <div className="mt-auto pt-2 border-t border-border/50 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-1.5 text-[#ffb472]">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase">
                Unused Influence
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-muted-foreground hover:text-[#ffb472] px-2"
              onClick={onMintAndStakeClick}
            >
              Stake {formatCompact(walletBalanceGctl)} GCTL
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
