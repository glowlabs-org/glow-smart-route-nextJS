"use client";

import React from "react";
import { Cpu, Gift, Layers, ChevronRight, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUnits } from "viem";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { FallbackImage } from "@/components/ui/fallback-image";
import { GlowSymbol } from "@/components/glow-symbol";

import {
  useRewardsBreakdown,
  useWalletFarms,
  useRegions,
  useSplitsActivity,
  useGlowLaunchpad,
  useMiningCenter,
  useRewardScore,
  useMiningScore,
} from "@/hooks";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import {
  attachEstimatedWeeklyLaunchpadRewards,
  attachEstimatedWeeklyMiningCenterRewards,
  deriveLaunchpadSponsorshipsInProgress,
  deriveMiningCenterSponsorshipsInProgress,
} from "@/utils/sponsorships-in-progress";

const fmtGlw = (n: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(n);

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const fmtUsdAmount = (n: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(n);

function parseGlwFromWei(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num / 1e18;
}

function parseUsdcFromBaseUnits(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num / 1e6;
}

function parsePdRewardsUsd(params: { value: string; asset: string | null }) {
  const { value, asset } = params;
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;

  const is6Decimals = asset === "USDG" || asset === "USDC" || asset === "GCTL";
  return num / (is6Decimals ? 1e6 : 1e18);
}

interface FarmCardData {
  farmId: string;
  farmName: string;
  regionName: string;
  imageUrls: string[];
  type: "miner" | "delegation" | "other" | "in-progress";
  inProgressKind?: "launchpad" | "mining-center";
  initialCost: number;
  recovered: number;
  inflation: number;
  inflationGlw: number;
  protocolDepositAsset: string | null;
  isProtocolDepositUsd: boolean;
  weeksActive: number;
  totalWeeks: number;
  weeklyBreakdown: Array<{
    weekNumber: number;
    inflationRewards: string;
    protocolDepositRewards: string;
    totalRewards: string;
  }>;
  inProgressPercent?: number;
  estimatedUserWeeklyGlw?: number;
  isPendingStart?: boolean;
}

interface FarmCardProps {
  farm: FarmCardData;
  onClick: () => void;
}

function FarmCard({ farm, onClick }: FarmCardProps) {
  const isInProgress = farm.type === "in-progress";
  const isMiner = farm.type === "miner";
  const isDelegation = farm.type === "delegation";
  const isOther = farm.type === "other";
  const isPendingStart = Boolean(farm.isPendingStart);
  const inProgressIsMiningCenter =
    isInProgress && farm.inProgressKind === "mining-center";

  const totalValue = farm.recovered + farm.inflation;
  const roiPercent =
    farm.initialCost > 0 ? (totalValue / farm.initialCost) * 100 : 0;
  const isProfitable = roiPercent >= 100;

  const getTypeBadge = () => {
    // For pending start, we still want to show the type (Miner/Delegation)
    // but the "Starts Next Week" badge is handled separately in the parent
    if (isInProgress) {
      return (
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider border backdrop-blur-xl",
            inProgressIsMiningCenter
              ? "text-[color:var(--color-miner-yellow-contrast)] bg-background/60 border-[color:var(--color-miner-yellow)]/40"
              : "text-[#C084FC] bg-background/60 border-[#C084FC]/40"
          )}
        >
          {inProgressIsMiningCenter ? (
            <Cpu className="w-3 h-3" />
          ) : (
            <Layers className="w-3 h-3" />
          )}
          In Progress
        </div>
      );
    }
    if (isMiner) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider border text-[color:var(--color-miner-yellow)] bg-black/60 backdrop-blur-xl border-[color:var(--color-miner-yellow)]/40 shadow-sm">
          <Cpu className="w-3 h-3" />
          Miner
        </div>
      );
    }
    if (isDelegation) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider border text-[#C084FC] bg-black/60 backdrop-blur-xl border-[#C084FC]/40 shadow-sm">
          <GlowSymbol className="w-3 h-3 !text-[#C084FC]" />
          Delegation
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider border text-[color:var(--color-glow-green)] bg-black/60 backdrop-blur-xl border-[color:var(--color-glow-green)]/40 shadow-sm">
        <Gift className="w-3 h-3" />
        Rewards
      </div>
    );
  };

  return (
    <Card
      className="group relative overflow-hidden cursor-pointer  bg-muted/30 hover:bg-muted/10 transition-all duration-300 hover:-translate-y-1 border-border p-0 gap-0"
      onClick={onClick}
    >
      <div className="relative h-48 overflow-hidden bg-muted/20">
        <FallbackImage
          src={farm.imageUrls[0]}
          widthForProxy={600}
          quality={75}
          alt={farm.farmName}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t dark:from-background/90 dark:via-background/40 to-transparent dark:opacity-90" />
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          {getTypeBadge()}
          {isPendingStart && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider border bg-muted/50 text-muted-foreground border-border backdrop-blur-xl">
              <Clock className="w-3 h-3" />
              Starts Next Week
            </div>
          )}
        </div>
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge
              variant="secondary"
              className="bg-foreground/20 hover:bg-foreground/30 text-background backdrop-blur-md border-0 text-[10px] px-1.5 h-5 font-medium"
            >
              {farm.regionName}
            </Badge>
          </div>
          <h3 className="font-bold text-background dark:text-white text-xl leading-tight truncate">
            {farm.farmName}
          </h3>
        </div>
      </div>
      <div className="p-5">
        {isInProgress ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                Funding Progress
              </span>
              <span className="font-mono font-bold">
                {Math.round(farm.inProgressPercent ?? 0)}%
              </span>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, farm.inProgressPercent ?? 0))}
              className="h-1.5 bg-muted"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Active
                </div>
                <div className="text-sm font-mono font-medium">
                  {isPendingStart
                    ? "—"
                    : `${farm.weeksActive} / ${farm.totalWeeks} wks`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Earned
                </div>
                <div
                  className={cn(
                    "text-sm font-mono font-bold",
                    isPendingStart
                      ? "text-muted-foreground"
                      : isMiner
                      ? "text-[color:var(--color-miner-yellow-contrast)]"
                      : isDelegation
                      ? "text-[#C084FC]"
                      : "text-[color:var(--color-glow-green)]"
                  )}
                >
                  {isPendingStart
                    ? "—"
                    : isMiner
                    ? fmtUsd(farm.inflation)
                    : `${fmtGlw(farm.recovered + farm.inflationGlw)} GLW`}
                </div>
              </div>
            </div>
            {!isOther && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                  <span>
                    {isMiner ? "Cost" : "Delegated"}:{" "}
                    {isMiner
                      ? fmtUsd(farm.initialCost)
                      : `${fmtGlw(farm.initialCost)} GLW`}
                  </span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      isPendingStart
                        ? "text-muted-foreground"
                        : isProfitable
                        ? "text-emerald-500"
                        : "text-foreground"
                    )}
                  >
                    {isPendingStart
                      ? "—"
                      : `${roiPercent.toFixed(0)}% Progress`}
                  </span>
                </div>
                <Progress
                  value={isPendingStart ? 0 : Math.min(roiPercent, 100)}
                  className={cn(
                    "h-1.5 bg-muted",
                    isProfitable && !isPendingStart && "[&>div]:bg-emerald-500"
                  )}
                />
              </div>
            )}
            <div className="pt-2 border-t border-border/50 flex justify-end">
              <div className="text-xs font-medium text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                View Details <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

interface FarmDetailDialogProps {
  farm: FarmCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  glwSpotPrice: number | null;
}

function FarmDetailDialog({
  farm,
  open,
  onOpenChange,
  glwSpotPrice,
}: FarmDetailDialogProps) {
  if (!farm) return null;

  const isInProgress = farm.type === "in-progress";
  const isMiner = farm.type === "miner";
  const isOther = farm.type === "other";

  const totalEarned = farm.recovered + farm.inflation;
  const totalEarnedGlw = farm.recovered + farm.inflationGlw;

  const investedLabel = (() => {
    if (isInProgress) return "—";
    if (isMiner) return fmtUsd(farm.initialCost);
    if (isOther) return "—";
    return `${fmtGlw(farm.initialCost)} GLW`;
  })();

  const earnedLabel = (() => {
    if (isInProgress)
      return `~${fmtGlw(farm.estimatedUserWeeklyGlw ?? 0)} GLW/wk`;
    if (isMiner) return `${fmtGlw(farm.inflationGlw)} GLW`;
    if (isOther && farm.isProtocolDepositUsd) {
      const asset = farm.protocolDepositAsset ?? "USD";
      return `${fmtGlw(farm.inflationGlw)} GLW + ${fmtUsdAmount(
        farm.recovered
      )} ${asset}`;
    }
    return `${fmtGlw(totalEarnedGlw)} GLW`;
  })();

  const progressPercent = Math.min(
    (farm.weeksActive / Math.max(farm.totalWeeks, 1)) * 100,
    100
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] p-0 gap-0 flex flex-col overflow-hidden border-0 sm:border sm:rounded-3xl bg-background/95 backdrop-blur-xl">
        <DialogHeader className="px-6 py-5 shrink-0 border-b border-border/50 bg-muted/10 backdrop-blur-sm z-20 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-8 w-8 rounded-full hover:bg-muted/50"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {farm.farmName}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="secondary"
                  className="bg-muted text-muted-foreground hover:bg-muted font-normal"
                >
                  {farm.regionName}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {farm.type === "miner" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider border text-[color:var(--color-miner-yellow-contrast)] bg-[color:var(--color-miner-yellow)]/10 border-[color:var(--color-miner-yellow)]/20">
                  <Cpu className="w-3.5 h-3.5" />
                  Miner
                </div>
              )}
              {farm.type === "delegation" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider border text-[#C084FC] bg-[#C084FC]/10 border-[#C084FC]/20">
                  <GlowSymbol className="w-3.5 h-3.5" />
                  Delegation
                </div>
              )}
              {farm.type === "other" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider border text-[color:var(--color-glow-green)] bg-[color:var(--color-glow-green)]/10 border-[color:var(--color-glow-green)]/20">
                  <Gift className="w-3.5 h-3.5" />
                  Rewards
                </div>
              )}
              {farm.type === "in-progress" && (
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider border",
                    farm.inProgressKind === "mining-center"
                      ? "text-[color:var(--color-miner-yellow-contrast)] bg-[color:var(--color-miner-yellow)]/10 border-[color:var(--color-miner-yellow)]/20"
                      : "text-[#C084FC] bg-[#C084FC]/10 border-[#C084FC]/20"
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  In Progress
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto w-full">
            {/* Farm Image Grid */}
            <div className="rounded-2xl overflow-hidden border border-border/50">
              {farm.imageUrls.length >= 3 ? (
                <div className="grid grid-cols-3 grid-rows-2 gap-1 h-[360px]">
                  <div className="col-span-2 row-span-2 relative">
                    <FallbackImage
                      src={farm.imageUrls[0]}
                      widthForProxy={1200}
                      quality={85}
                      alt={`${farm.farmName} main`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="relative">
                    <FallbackImage
                      src={farm.imageUrls[1]}
                      widthForProxy={600}
                      quality={75}
                      alt={`${farm.farmName} 2`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="relative">
                    <FallbackImage
                      src={farm.imageUrls[2]}
                      widthForProxy={600}
                      quality={75}
                      alt={`${farm.farmName} 3`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              ) : farm.imageUrls.length === 2 ? (
                <div className="grid grid-cols-2 gap-1 h-[300px]">
                  <div className="relative">
                    <FallbackImage
                      src={farm.imageUrls[0]}
                      widthForProxy={1200}
                      quality={85}
                      alt={`${farm.farmName} main`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="relative">
                    <FallbackImage
                      src={farm.imageUrls[1]}
                      widthForProxy={1200}
                      quality={85}
                      alt={`${farm.farmName} 2`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              ) : (
                <div className="relative aspect-video sm:h-[300px] w-full">
                  <FallbackImage
                    src={farm.imageUrls[0]}
                    widthForProxy={1200}
                    quality={85}
                    alt={farm.farmName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Invested / Delegated */}
              {!isInProgress && !isOther && (
                <Card className="bg-card/50 border-border/60 backdrop-blur-sm">
                  <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="p-1.5 rounded-md bg-muted/50">
                        {isMiner ? (
                          <Cpu className="w-4 h-4" />
                        ) : (
                          <GlowSymbol className="w-4 h-4" />
                        )}
                      </div>
                      <div className="text-[11px] font-bold font-mono uppercase tracking-wider">
                        {isMiner ? "Initial Cost" : "Total Delegated"}
                      </div>
                    </div>
                    <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
                      {investedLabel}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Total Earned */}
              <Card
                className={cn(
                  "bg-card/50 border-border/60 backdrop-blur-sm relative overflow-hidden",
                  (isInProgress || isOther) && "md:col-span-2"
                )}
              >
                {/* Subtle gradient glow */}
                <div
                  className={cn(
                    "absolute top-0 right-0 w-48 h-48 bg-gradient-to-br opacity-10 blur-3xl rounded-full translate-x-12 -translate-y-12",
                    isMiner
                      ? "from-[var(--color-miner-yellow)] to-transparent"
                      : "from-[#C084FC] to-transparent"
                  )}
                />
                <CardContent className="p-6 flex flex-col h-full justify-between gap-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div
                        className={cn(
                          "p-1.5 rounded-md bg-muted/50",
                          isMiner
                            ? "text-[color:var(--color-miner-yellow-contrast)]"
                            : "text-[#C084FC]"
                        )}
                      >
                        <Gift className="w-4 h-4" />
                      </div>
                      <div className="text-[11px] font-bold font-mono uppercase tracking-wider">
                        {isInProgress
                          ? "Est. Weekly Rewards"
                          : "Lifetime Earnings"}
                      </div>
                    </div>
                    {!isInProgress && !isOther && (
                      <div className="text-xs font-mono font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-sm">
                        {farm.initialCost > 0
                          ? `${Math.round(
                              ((farm.recovered +
                                (isMiner
                                  ? farm.inflation
                                  : farm.inflationGlw)) /
                                farm.initialCost) *
                                100
                            )}%`
                          : "—"}
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      "text-3xl font-bold font-mono tracking-tight",
                      isMiner &&
                        "text-[color:var(--color-miner-yellow-contrast)]",
                      farm.type === "delegation" && "text-[#C084FC]",
                      isOther && "text-[color:var(--color-glow-green)]"
                    )}
                  >
                    {earnedLabel}
                  </div>
                </CardContent>
              </Card>

              {/* Time Progress */}
              {!isInProgress && (
                <Card className="bg-card/50 border-border/60 backdrop-blur-sm">
                  <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="p-1.5 rounded-md bg-muted/50">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="text-[11px] font-bold font-mono uppercase tracking-wider">
                          Timeline
                        </div>
                      </div>
                      <div className="text-xs font-mono font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-sm">
                        {Math.round(progressPercent)}%
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-bold font-mono tracking-tight">
                          {farm.weeksActive}
                          <span className="text-muted-foreground text-sm ml-1 font-normal">
                            wks
                          </span>
                        </div>
                        <div className="text-sm font-mono text-muted-foreground">
                          {farm.totalWeeks} wks total
                        </div>
                      </div>
                      <Progress
                        value={progressPercent}
                        className="h-2 bg-muted"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* In Progress Funding */}
              {isInProgress && (
                <Card className="bg-card/50 border-border/60 backdrop-blur-sm">
                  <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="p-1.5 rounded-md bg-muted/50">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="text-[11px] font-bold font-mono uppercase tracking-wider">
                        Funding Progress
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold font-mono tracking-tight">
                        {Math.round(farm.inProgressPercent ?? 0)}%
                      </div>
                      <Progress
                        value={Math.max(
                          0,
                          Math.min(100, farm.inProgressPercent ?? 0)
                        )}
                        className="h-2 bg-muted"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Breakdown Section */}
            {!isInProgress && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-muted-foreground px-1">
                  Rewards Breakdown
                </h3>
                <Card className="bg-card border-border/60 overflow-hidden py-0">
                  <div className="divide-y divide-border/50">
                    {!isMiner && (
                      <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#C084FC]/10 flex items-center justify-center text-[#C084FC]">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              Protocol Deposit
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {isOther
                                ? `Recovered in ${
                                    farm.protocolDepositAsset ?? "—"
                                  }`
                                : "Recovered capital"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono font-bold text-[#C084FC]">
                          {isOther && farm.isProtocolDepositUsd
                            ? `${fmtUsdAmount(farm.recovered)} ${
                                farm.protocolDepositAsset
                              }`
                            : `${fmtGlw(farm.recovered)} GLW`}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[color:var(--color-miner-yellow)]/10 flex items-center justify-center text-[color:var(--color-miner-yellow-contrast)]">
                          <Gift className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Emissions</div>
                          <div className="text-xs text-muted-foreground">
                            Production rewards
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-[color:var(--color-miner-yellow-contrast)]">
                        +{fmtGlw(farm.inflationGlw)} GLW
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/20">
                      <div className="font-bold text-sm">Total Value</div>
                      <div className="text-right font-mono font-bold text-lg">
                        {earnedLabel}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Weekly Rewards Table */}
            {!isInProgress && farm.weeklyBreakdown.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-muted-foreground px-1">
                  Weekly History
                </h3>
                <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden backdrop-blur-sm">
                  <div className="custom-scrollbar">
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 bg-muted/90 backdrop-blur-md z-10">
                        <tr className="border-b border-border/50">
                          <th className="text-left py-3.5 px-6 font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-24">
                            Week
                          </th>
                          {!isMiner && (
                            <th className="text-right py-3.5 px-6 font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              PD
                            </th>
                          )}
                          <th className="text-right py-3.5 px-6 font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Emission
                          </th>
                          <th className="text-right py-3.5 px-6 font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {farm.weeklyBreakdown
                          .slice()
                          .reverse()
                          .map((week) => {
                            const pdGlw = parseGlwFromWei(
                              week.protocolDepositRewards
                            );
                            const inflationGlw = parseGlwFromWei(
                              week.inflationRewards
                            );
                            const totalGlw = parseGlwFromWei(week.totalRewards);

                            return (
                              <tr
                                key={week.weekNumber}
                                className="hover:bg-muted/40 transition-colors group"
                              >
                                <td className="py-3.5 px-6 font-mono text-muted-foreground text-xs group-hover:text-foreground transition-colors">
                                  #{week.weekNumber}
                                </td>
                                {!isMiner && (
                                  <td className="py-3.5 px-6 text-right font-mono text-[#C084FC] text-sm tabular-nums">
                                    {fmtGlw(pdGlw)}
                                  </td>
                                )}
                                <td className="py-3.5 px-6 text-right font-mono text-[color:var(--color-miner-yellow-contrast)] text-sm tabular-nums">
                                  {fmtGlw(inflationGlw)}
                                </td>
                                <td className="py-3.5 px-6 text-right font-mono font-bold text-sm tabular-nums text-foreground">
                                  {fmtGlw(totalGlw)}
                                  <span className="text-[10px] font-normal text-muted-foreground ml-1">
                                    GLW
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MyFarmsGridSectionProps {
  walletAddress: string | null;
}

export default function MyFarmsGridSection({
  walletAddress,
}: MyFarmsGridSectionProps) {
  const [selectedFarm, setSelectedFarm] = React.useState<FarmCardData | null>(
    null
  );
  const hasWallet = Boolean(walletAddress);

  const {
    data: rewardsBreakdown,
    isLoading: isRewardsLoading,
    isError: isRewardsError,
  } = useRewardsBreakdown({
    walletAddress: walletAddress ?? null,
    enabled: hasWallet,
  });

  const { farms: purchasedFarms, isLoading: isFarmsLoading } = useWalletFarms({
    walletAddress: walletAddress ?? undefined,
    enabled: hasWallet,
  });

  const { regions, isRegionsLoading } = useRegions();
  const { spotPrice: glwSpotPriceUsd, isLoading: isSpotPriceLoading } =
    useGlowSpotPrice();

  const { activity: splitsActivity, isLoading: isSplitsActivityLoading } =
    useSplitsActivity({
      walletAddress: walletAddress ?? undefined,
      enabled: hasWallet,
      limit: 200,
    });

  const shouldLoadInProgress = hasWallet && splitsActivity.length > 0;

  const { applications: sponsorListings, isLoading: isSponsorListingsLoading } =
    useGlowLaunchpad({
      filters: { paymentCurrency: "GLW" },
      enabled: shouldLoadInProgress,
    });

  const {
    applications: miningCenterListings,
    isLoading: isMiningCenterListingsLoading,
  } = useMiningCenter({
    filters: { paymentCurrency: "USDC" },
    enabled: shouldLoadInProgress,
  });

  const sponsorshipsInProgress = React.useMemo(() => {
    return deriveLaunchpadSponsorshipsInProgress({
      splitsActivity,
      sponsorListings,
    });
  }, [splitsActivity, sponsorListings]);

  const miningCenterInProgress = React.useMemo(() => {
    return deriveMiningCenterSponsorshipsInProgress({
      splitsActivity,
      sponsorListings: miningCenterListings,
    });
  }, [splitsActivity, miningCenterListings]);

  const applicationsForRewards = React.useMemo(() => {
    return sponsorshipsInProgress
      .map((item) => item.application)
      .filter((app): app is NonNullable<typeof app> => app !== null);
  }, [sponsorshipsInProgress]);

  const miningCenterAppsForScores = React.useMemo(() => {
    return miningCenterInProgress
      .map((item) => item.application)
      .filter((app): app is NonNullable<typeof app> => app !== null);
  }, [miningCenterInProgress]);

  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications: applicationsForRewards,
    paymentCurrency: "GLW",
    enabled: shouldLoadInProgress && applicationsForRewards.length > 0,
    walletAddress: walletAddress ?? null,
  });

  const { miningScoreMap, isLoading: isMiningScoresLoading } = useMiningScore({
    applications: miningCenterAppsForScores,
    enabled: shouldLoadInProgress && miningCenterAppsForScores.length > 0,
  });

  const sponsorshipsInProgressWithEstimates = React.useMemo(() => {
    return attachEstimatedWeeklyLaunchpadRewards({
      sponsorshipsInProgress,
      rewardScoreMap,
    });
  }, [rewardScoreMap, sponsorshipsInProgress]);

  const miningCenterInProgressWithEstimates = React.useMemo(() => {
    return attachEstimatedWeeklyMiningCenterRewards({
      sponsorshipsInProgress: miningCenterInProgress,
      miningScoreMap,
    });
  }, [miningCenterInProgress, miningScoreMap]);

  const farmNameByFarmId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const evt of splitsActivity) {
      const farmId = evt.farmId;
      const farmName = evt.farmName;
      if (!farmId) continue;
      if (!farmName) continue;
      if (!map.has(farmId)) map.set(farmId, farmName);
    }
    return map;
  }, [splitsActivity]);

  const rewardedFarmTypeKeys = React.useMemo(() => {
    if (!rewardsBreakdown) return new Set<string>();
    return new Set(
      rewardsBreakdown.farmDetails.map(
        (f) =>
          `${f.farmId}:${
            f.type === "launchpad" ? "launchpad" : "mining-center"
          }`
      )
    );
  }, [rewardsBreakdown]);

  const farmCards = React.useMemo<FarmCardData[]>(() => {
    if (!rewardsBreakdown) return [];

    const cards: FarmCardData[] = [];

    rewardsBreakdown.farmDetails.forEach((farm) => {
      const farmMetadata = purchasedFarms.find((f) => f.farmId === farm.farmId);
      const regionName = (() => {
        if (!farmMetadata) return "—";
        const region = regions.find((r) => r.id === farmMetadata.regionId);
        return region?.name || `Region ${farmMetadata.regionId}`;
      })();

      const displayName =
        farmMetadata?.name ||
        farmNameByFarmId.get(farm.farmId) ||
        `Farm ${farm.farmId.substring(0, 8)}`;

      const imageUrls =
        farmMetadata?.afterInstallPictures?.map((p) => p.url) || [];
      if (imageUrls.length === 0) {
        imageUrls.push("/images/sections/residential.jpg");
      }

      if (farm.type === "launchpad") {
        const initialCost = parseGlwFromWei(farm.amountInvested);
        const recovered = parseGlwFromWei(farm.totalProtocolDepositRewards);
        const inflation = parseGlwFromWei(farm.totalInflationRewards);
        cards.push({
          farmId: farm.farmId,
          farmName: displayName,
          regionName,
          imageUrls,
          type: "delegation",
          initialCost,
          recovered,
          inflation,
          inflationGlw: inflation,
          protocolDepositAsset: "GLW",
          isProtocolDepositUsd: false,
          weeksActive: farm.totalWeeksEarned,
          totalWeeks: 100,
          weeklyBreakdown: farm.weeklyBreakdown,
        });
      } else {
        const initialCostUsd = parseUsdcFromBaseUnits(farm.amountInvested);
        const inflationGlw = parseGlwFromWei(farm.totalInflationRewards);
        const inflationUsd =
          Number.isFinite(glwSpotPriceUsd ?? NaN) && (glwSpotPriceUsd ?? 0) > 0
            ? inflationGlw * (glwSpotPriceUsd ?? 0)
            : 0;

        cards.push({
          farmId: farm.farmId,
          farmName: displayName,
          regionName,
          imageUrls,
          type: "miner",
          initialCost: initialCostUsd,
          recovered: 0,
          inflation: inflationUsd,
          inflationGlw,
          protocolDepositAsset: "USDC",
          isProtocolDepositUsd: true,
          weeksActive: farm.totalWeeksEarned,
          totalWeeks: 99,
          weeklyBreakdown: farm.weeklyBreakdown,
        });
      }
    });

    (rewardsBreakdown.otherFarmsWithRewards?.farms ?? []).forEach((farm) => {
      const displayName =
        farm.farmName || `Farm ${farm.farmId.substring(0, 8)}`;
      const identityDetail = farm.asset ?? "—";

      const isProtocolDepositUsd =
        farm.asset === "USDG" || farm.asset === "USDC" || farm.asset === "GCTL";
      const recovered = isProtocolDepositUsd
        ? parsePdRewardsUsd({
            value: farm.totalProtocolDepositRewards,
            asset: farm.asset,
          })
        : parseGlwFromWei(farm.totalProtocolDepositRewards);
      const inflationGlw = parseGlwFromWei(farm.totalInflationRewards);
      const inflation = isProtocolDepositUsd
        ? Number.isFinite(glwSpotPriceUsd ?? NaN) && (glwSpotPriceUsd ?? 0) > 0
          ? inflationGlw * (glwSpotPriceUsd ?? 0)
          : 0
        : inflationGlw;

      const weeksActive = farm.weeklyBreakdown.length;
      const totalWeeks =
        farm.weeksLeft !== null
          ? Math.max(weeksActive + farm.weeksLeft, 1)
          : Math.max(weeksActive, 1);

      cards.push({
        farmId: farm.farmId,
        farmName: displayName,
        regionName: identityDetail,
        imageUrls: ["/images/sections/residential.jpg"],
        type: "other",
        initialCost: 0,
        recovered,
        inflation,
        inflationGlw,
        protocolDepositAsset: farm.asset,
        isProtocolDepositUsd,
        weeksActive,
        totalWeeks,
        weeklyBreakdown: farm.weeklyBreakdown,
      });
    });

    // Add Pending Start Cards
    const pendingByFarm = new Map<
      string,
      {
        farmId: string;
        farmName: string;
        fractionType: "launchpad" | "mining-center";
        totalAmount: bigint;
      }
    >();

    for (const evt of splitsActivity) {
      const fractionType = evt.fractionType;
      if (!fractionType) continue;
      const status = (evt.fractionStatus ?? "").toLowerCase();

      const isPendingStart =
        (fractionType === "launchpad" && status === "filled") ||
        (fractionType === "mining-center" &&
          (status === "filled" || status === "expired"));
      if (!isPendingStart) continue;

      const farmId = evt.farmId ?? evt.applicationId;
      if (!farmId) continue;
      const farmTypeKey = `${farmId}:${fractionType}`;
      if (rewardedFarmTypeKeys.has(farmTypeKey)) continue;

      let amount = BigInt(0);
      try {
        amount = BigInt(evt.amount);
      } catch {
        amount = BigInt(0);
      }

      const existing = pendingByFarm.get(farmTypeKey) ?? {
        farmId,
        farmName: evt.farmName || `Farm ${farmId.substring(0, 8)}`,
        fractionType,
        totalAmount: BigInt(0),
      };
      existing.totalAmount += amount;
      pendingByFarm.set(farmTypeKey, existing);
    }

    pendingByFarm.forEach((item) => {
      const imageUrls = ["/images/sections/residential.jpg"]; // Placeholder
      // Try to find image in sponsorListings or miningCenterListings if available
      if (item.fractionType === "launchpad") {
        const app = sponsorListings?.find((a) => a.id === item.farmId);
        if (app?.afterInstallPictures?.length) {
          // Reset array
          while (imageUrls.length) imageUrls.pop();
          app.afterInstallPictures.forEach((p) => imageUrls.push(p.url));
        }
      } else {
        const app = miningCenterListings?.find((a) => a.id === item.farmId);
        if (app?.afterInstallPictures?.length) {
          while (imageUrls.length) imageUrls.pop();
          app.afterInstallPictures.forEach((p) => imageUrls.push(p.url));
        }
      }
      if (imageUrls.length === 0)
        imageUrls.push("/images/sections/residential.jpg");

      if (item.fractionType === "launchpad") {
        const initialCost = parseGlwFromWei(item.totalAmount.toString());
        cards.push({
          farmId: item.farmId,
          farmName: item.farmName,
          regionName: "Launchpad",
          imageUrls,
          type: "delegation", // Explicitly delegation
          isPendingStart: true,
          initialCost,
          recovered: 0,
          inflation: 0,
          inflationGlw: 0,
          protocolDepositAsset: "GLW",
          isProtocolDepositUsd: false,
          weeksActive: 0,
          totalWeeks: 100,
          weeklyBreakdown: [],
        });
      } else {
        const initialCostUsd = parseUsdcFromBaseUnits(
          item.totalAmount.toString()
        );
        cards.push({
          farmId: item.farmId,
          farmName: item.farmName,
          regionName: "Miner",
          imageUrls,
          type: "miner",
          isPendingStart: true,
          initialCost: initialCostUsd,
          recovered: 0,
          inflation: 0,
          inflationGlw: 0,
          protocolDepositAsset: "USDC",
          isProtocolDepositUsd: true,
          weeksActive: 0,
          totalWeeks: 99,
          weeklyBreakdown: [],
        });
      }
    });

    [
      ...sponsorshipsInProgressWithEstimates,
      ...miningCenterInProgressWithEstimates,
    ].forEach((item) => {
      const app = item.application;
      const zoneName = app?.zone?.name || "Launchpad";
      const displayName =
        app?.farmName || `Farm ${item.applicationId.substring(0, 8)}`;
      const imageUrls = app?.afterInstallPictures?.map((p) => p.url) || [];
      if (imageUrls.length === 0) {
        imageUrls.push("/images/sections/residential.jpg");
      }

      cards.push({
        farmId: item.applicationId,
        farmName: displayName,
        regionName: zoneName,
        imageUrls,
        type: "in-progress",
        inProgressKind: item.fractionType,
        initialCost: 0,
        recovered: 0,
        inflation: 0,
        inflationGlw: 0,
        protocolDepositAsset: "GLW",
        isProtocolDepositUsd: false,
        weeksActive: 0,
        totalWeeks: 1,
        weeklyBreakdown: [],
        inProgressPercent: item.progressPercent ?? 0,
        estimatedUserWeeklyGlw: item.estimatedUserWeeklyGlw ?? 0,
      });
    });

    return cards.sort((a, b) => {
      if (a.isPendingStart && !b.isPendingStart) return -1;
      if (!a.isPendingStart && b.isPendingStart) return 1;
      if (a.type === "in-progress" && b.type !== "in-progress") return -1;
      if (a.type !== "in-progress" && b.type === "in-progress") return 1;
      const totalA = a.recovered + a.inflationGlw;
      const totalB = b.recovered + b.inflationGlw;
      return totalB - totalA;
    });
  }, [
    farmNameByFarmId,
    glwSpotPriceUsd,
    miningCenterInProgressWithEstimates,
    purchasedFarms,
    regions,
    rewardsBreakdown,
    rewardedFarmTypeKeys,
    splitsActivity,
    sponsorListings,
    miningCenterListings,
    sponsorshipsInProgressWithEstimates,
  ]);

  const isLoading =
    isRewardsLoading ||
    isFarmsLoading ||
    isRegionsLoading ||
    isSplitsActivityLoading ||
    isSponsorListingsLoading ||
    isMiningCenterListingsLoading ||
    isRewardScoresLoading ||
    isMiningScoresLoading;

  if (!hasWallet) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="h-48 w-full" />
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isRewardsError || farmCards.length === 0) {
    return (
      <Card className="p-12 border-dashed bg-muted/20">
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
          {!isRewardsError && <Layers className="w-10 h-10 opacity-20" />}
          <p className="text-sm font-mono uppercase tracking-wider">
            {isRewardsError
              ? "Unable to load farms"
              : "No farms found for this wallet"}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {farmCards.map((farm) => (
          <FarmCard
            key={farm.farmId}
            farm={farm}
            onClick={() => setSelectedFarm(farm)}
          />
        ))}
      </div>

      <FarmDetailDialog
        farm={selectedFarm}
        open={Boolean(selectedFarm)}
        onOpenChange={(open) => {
          if (!open) setSelectedFarm(null);
        }}
        glwSpotPrice={glwSpotPriceUsd ?? null}
      />
    </>
  );
}
