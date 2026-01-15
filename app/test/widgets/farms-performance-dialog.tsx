"use client";

import React from "react";
import {
  Cpu,
  LayoutGrid,
  Layers,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Gift,
  Clock,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";

// --- Shadcn UI Components ---
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip as ShadTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectButton } from "@/components/connect-button";

import {
  useGlowLaunchpad,
  useMiningCenter,
  useMiningScore,
  useRegions,
  useRewardsBreakdown,
  useRewardScore,
  useSplitsActivity,
  useWalletFarms,
} from "@/hooks";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { Progress } from "@/components/ui/progress";
import {
  attachEstimatedWeeklyLaunchpadRewards,
  attachEstimatedWeeklyMiningCenterRewards,
  deriveLaunchpadSponsorshipsInProgress,
  deriveMiningCenterSponsorshipsInProgress,
} from "@/utils/sponsorships-in-progress";
import { GlowSymbol } from "@/components/glow-symbol";
import { CashMinerIcon, DelegationIcon } from "@/components/impact-icons";

// --- HELPER: FORMATTERS ---
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

export const FILTER_VALUES = [
  "all",
  "miners",
  "delegations",
  "other",
  "in-progress",
] as const;
export type FilterValue = (typeof FILTER_VALUES)[number];

function isFilterValue(value: string): value is FilterValue {
  return (FILTER_VALUES as readonly string[]).includes(value);
}

interface PerformanceRowData {
  farmId: string;
  id: string;
  region: string;
  type: "miner" | "delegation" | "other" | "in-progress";
  isPendingStart?: boolean;
  initialCost: number;
  recovered: number;
  inflation: number;
  inflationGlw: number;
  lastWeekRewardsGlw?: number;
  protocolDepositAsset: string | null;
  isProtocolDepositUsd: boolean;
  weeksActive: number;
  totalWeeks: number;
  inProgressPercent?: number;
  inProgressFilledLabel?: string | null;
  inProgressUserSteps?: number;
  estimatedUserWeeklyGlw?: number;
  inProgressKind?: "launchpad" | "mining-center";
}

function computeDerivedMetrics(data: PerformanceRowData) {
  const totalEarned = data.recovered + data.inflation;
  const totalEarnedGlw = data.recovered + data.inflationGlw;
  const denom = data.type === "other" ? 1 : Math.max(data.initialCost, 1);
  const timePercent = Math.min((data.weeksActive / data.totalWeeks) * 100, 100);
  const valuePercent =
    data.type === "other" || data.type === "miner"
      ? timePercent
      : (totalEarned / denom) * 100;
  const deltaPercent =
    data.type === "other" || data.initialCost === 0
      ? 0
      : ((totalEarned - data.initialCost) / data.initialCost) * 100;

  return {
    totalEarned,
    totalEarnedGlw,
    timePercent,
    valuePercent,
    deltaPercent,
  };
}

function getTotalRewardsLabel(data: PerformanceRowData) {
  if (data.type === "in-progress") return null;

  if (data.type === "miner") return `${fmtGlw(data.inflationGlw)} GLW`;
  if (data.type === "delegation")
    return `${fmtGlw(data.recovered + data.inflation)} GLW`;

  if (data.isProtocolDepositUsd) {
    const asset = data.protocolDepositAsset ?? "USD";
    return `${fmtGlw(data.inflationGlw)} GLW + ${fmtUsdAmount(
      data.recovered
    )} ${asset}`;
  }

  return `${fmtGlw(data.inflationGlw + data.recovered)} GLW`;
}

function getTotalRewardsClassName(data: PerformanceRowData) {
  if (data.type === "miner") return "text-[color:var(--color-miner-contrast)]";
  if (data.type === "delegation") return "text-[color:var(--color-glow-green)]";
  if (data.type === "other") return "text-[color:var(--color-glow-green)]";
  return "text-foreground";
}

function formatGlwPrecise(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

  // USDG is 1:1 with USDC (6 decimals). We keep this logic extensible.
  const is6Decimals = asset === "USDG" || asset === "USDC" || asset === "GCTL";
  return num / (is6Decimals ? 1e6 : 1e18);
}

function parseGlwFromWei(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num / 1e18;
}

// --- COMPONENT: THE FARM ROW ---
const FarmPerformanceRow = ({ data }: { data: PerformanceRowData }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const isInProgress = data.type === "in-progress";
  const isPendingStart = Boolean(data.isPendingStart);
  const isMiner = data.type === "miner";
  const isOther = data.type === "other";
  const isUsdRow = isMiner || (isOther && data.isProtocolDepositUsd);
  const inProgressIsMiningCenter =
    data.type === "in-progress" && data.inProgressKind === "mining-center";

  const {
    totalEarned,
    totalEarnedGlw,
    timePercent,
    valuePercent,
    deltaPercent,
  } = computeDerivedMetrics(data);

  const isProfit = !isOther && !isInProgress && valuePercent >= 100;
  const isLagging =
    !isOther && !isInProgress && valuePercent < timePercent - 10;

  const weeksRemaining = data.totalWeeks - data.weeksActive;
  const lastWeekLabel =
    typeof data.lastWeekRewardsGlw === "number"
      ? `${fmtGlw(data.lastWeekRewardsGlw)} GLW`
      : "—";
  const lastWeekValue = isPendingStart
    ? "Pending"
    : isInProgress
    ? "—"
    : lastWeekLabel;

  const getIconElement = () => {
    if (data.type === "miner" || (isInProgress && inProgressIsMiningCenter)) {
      return <CashMinerIcon className="w-6 h-6" />;
    }
    if (data.type === "other") {
      return <Gift className="w-5 h-5" />;
    }
    return <DelegationIcon className="w-6 h-6" />;
  };

  const getIconContainerClass = () => {
    if (isMiner || (isInProgress && inProgressIsMiningCenter)) {
      return "bg-[color:var(--color-miner)]/12 border-[color:var(--color-miner)] text-[color:var(--color-miner-contrast)]";
    }
    if (
      data.type === "delegation" ||
      (isInProgress && !inProgressIsMiningCenter)
    ) {
      return "bg-delegation-purple/12 border-delegation-purple text-delegation-purple dark:text-delegation-purple";
    }
    return "bg-[color:var(--color-glow-green)]/10 border-[color:var(--color-glow-green)] text-emerald-700 dark:text-[color:var(--color-glow-green)]";
  };

  const ProgressDisplay = ({ className }: { className?: string }) => {
    if (isPendingStart) {
      return (
        <div
          className={cn(
            "text-xs font-bold font-mono text-muted-foreground",
            className
          )}
        >
          PENDING
        </div>
      );
    }
    if (isInProgress) {
      return (
        <div
          className={cn(
            "text-xs font-bold font-mono text-muted-foreground",
            className
          )}
        >
          IN PROGRESS
        </div>
      );
    }
    // "Other" / Rewards rows don't really have a "Cost" so progress is just 100% or hidden?
    // User didn't specify for "Other", but "Progress" usually implies ROI.
    // For "Other" (rewards), valuePercent is 0 in current logic (line 116).
    // Let's check logic: const valuePercent = data.type === "other" ? 0 : (totalEarned / denom) * 100;
    // Maybe show nothing or "N/A" for other? Or just the earned amount is enough?
    // Let's stick to percentage if meaningful.
    if (isOther) {
      return (
        <div
          className={cn(
            "text-xs font-bold font-mono text-emerald-600 dark:text-[color:var(--color-glow-green)]",
            className
          )}
        >
          REWARDS
        </div>
      );
    }

    return (
      <div
        className={cn(
          "text-sm font-bold font-mono tabular-nums",
          valuePercent >= 100 ? "text-emerald-500" : "text-muted-foreground",
          className
        )}
      >
        {valuePercent.toFixed(1)}%
      </div>
    );
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-muted/30 transition-colors",
        isPendingStart && "opacity-60"
      )}
    >
      {/* MOBILE CARD */}
      <div
        className="sm:hidden p-4 cursor-pointer"
        onClick={() => !isInProgress && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border",
                getIconContainerClass()
              )}
            >
              {getIconElement()}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-base text-foreground leading-tight truncate">
                {data.id}
              </div>
              <div className="text-sm font-mono text-muted-foreground truncate">
                {data.region}
              </div>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <ProgressDisplay />
            {!isInProgress && (
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  isExpanded && "rotate-180"
                )}
              />
            )}
          </div>
        </div>

        {isInProgress ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Funding
              </div>
              <div className="text-[10px] font-mono text-muted-foreground tabular-nums">
                {Math.round(data.inProgressPercent ?? 0)}%
              </div>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, data.inProgressPercent ?? 0))}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Est. weekly
              </div>
              <div
                className={cn(
                  "text-xs font-mono font-bold tabular-nums",
                  inProgressIsMiningCenter
                    ? "text-[color:var(--color-miner-contrast)]"
                    : "text-delegation-purple dark:text-delegation-purple"
                )}
              >
                {formatGlwPrecise(data.estimatedUserWeeklyGlw ?? 0)} GLW/wk
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-2 grid-cols-2">
              <div className="text-center">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  {isOther ? "Cost" : isMiner ? "Cost" : "Delegated"}
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  {isOther ? (
                    <span className="text-sm font-bold font-mono text-muted-foreground tabular-nums">
                      —
                    </span>
                  ) : (
                    <>
                      <span className="text-sm font-bold font-mono text-foreground tabular-nums">
                        {isMiner
                          ? fmtUsd(data.initialCost)
                          : fmtGlw(data.initialCost)}
                      </span>
                      {!isMiner && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          GLW
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  {isPendingStart && data.estimatedUserWeeklyGlw
                    ? "Est. Weekly"
                    : "Earned"}
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span
                    className={cn(
                      "text-sm font-bold font-mono tabular-nums",
                      isPendingStart
                        ? "text-muted-foreground"
                        : isMiner
                        ? "text-[color:var(--color-miner-contrast)]"
                        : "text-delegation-purple dark:text-delegation-purple"
                    )}
                  >
                    {isPendingStart
                      ? data.estimatedUserWeeklyGlw
                        ? `~${fmtGlw(data.estimatedUserWeeklyGlw)}`
                        : "—"
                      : isMiner
                      ? fmtGlw(totalEarnedGlw)
                      : fmtGlw(totalEarnedGlw)}
                  </span>
                  {(!isPendingStart || data.estimatedUserWeeklyGlw) && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      GLW
                      {isPendingStart && data.estimatedUserWeeklyGlw
                        ? "/wk"
                        : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-2">
                <span>
                  {data.weeksActive} / {data.totalWeeks} weeks
                </span>
                <span>{weeksRemaining} left</span>
              </div>
              <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden border border-border/70">
                <div
                  className="absolute left-0 h-full bg-foreground/20"
                  style={{ width: `${timePercent}%` }}
                />
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Breakdown
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-mono">
                  {!isMiner && (
                    <>
                      <span className="text-muted-foreground">
                        PD Recovered
                      </span>
                      <span
                        className={cn(
                          "text-right",
                          "text-delegation-purple dark:text-delegation-purple"
                        )}
                      >
                        {isOther && data.isProtocolDepositUsd
                          ? `${fmtUsdAmount(data.recovered)} USDG`
                          : `${fmtGlw(data.recovered)} GLW`}
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground">Emissions</span>
                  <span className="text-right text-[color:var(--color-miner-contrast)]">
                    +{fmtGlw(data.inflationGlw)} GLW
                  </span>
                  <div className="col-span-2 h-px bg-border" />
                  <span className="text-muted-foreground font-bold">Total</span>
                  <span className="text-right font-bold text-foreground">
                    {isOther && data.isProtocolDepositUsd
                      ? `${fmtGlw(data.inflationGlw)} GLW + ${fmtUsdAmount(
                          data.recovered
                        )} USDG`
                      : isMiner
                      ? fmtUsd(totalEarned)
                      : `${fmtGlw(totalEarnedGlw)} GLW`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-mono mt-3">
                  <span className="text-muted-foreground">Time Progress</span>
                  <span className="text-right text-foreground">
                    {timePercent.toFixed(0)}%
                  </span>
                  {!isMiner && (
                    <>
                      <span className="text-muted-foreground">
                        Value Progress
                      </span>
                      <span
                        className={cn(
                          "text-right",
                          isProfit
                            ? "text-emerald-600 dark:text-emerald-500"
                            : "text-foreground"
                        )}
                      >
                        {valuePercent.toFixed(0)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* DESKTOP ROW */}
      <div
        className={cn(
          "hidden sm:block cursor-pointer hover:bg-muted/40 transition-colors",
          isExpanded && "bg-muted/30"
        )}
        onClick={() => !isInProgress && setIsExpanded(!isExpanded)}
      >
        <div className="grid grid-cols-12 items-center p-4 gap-4">
          {/* COLUMN 1: IDENTITY */}
          <div className="col-span-3 flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border",
                getIconContainerClass()
              )}
            >
              {getIconElement()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-base text-foreground leading-tight truncate">
                {data.id}
              </span>
              <span className="text-sm font-mono text-muted-foreground truncate">
                {data.region}
              </span>
            </div>
          </div>

          {/* COLUMN 2: LIFECYCLE BAR */}
          <div className="col-span-3 px-2">
            {isInProgress ? (
              <div className="text-xs font-mono text-muted-foreground">
                {data.inProgressFilledLabel ??
                  `${Math.round(data.inProgressPercent ?? 0)}% filled`}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1.5">
                  <span>
                    {data.weeksActive} / {data.totalWeeks} wks
                  </span>
                  <span>{weeksRemaining} left</span>
                </div>
                <div className="relative w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border/70">
                  <div
                    className="absolute left-0 h-full transition-all bg-foreground/20"
                    style={{ width: `${timePercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* COLUMN 3: KEY METRICS (INVESTED / EARNED) */}
          <div className="col-span-4 flex items-center justify-center gap-6">
            {isInProgress ? (
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    Funding
                  </div>
                  <Progress
                    value={Math.max(
                      0,
                      Math.min(100, data.inProgressPercent ?? 0)
                    )}
                  />
                </div>
                <div className="text-right">
                  <div
                    className={cn(
                      "text-lg font-bold font-mono tabular-nums",
                      inProgressIsMiningCenter
                        ? "text-[color:var(--color-miner-contrast)]"
                        : "text-delegation-purple dark:text-delegation-purple"
                    )}
                  >
                    {formatGlwPrecise(data.estimatedUserWeeklyGlw ?? 0)}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    GLW/wk est.
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center min-w-[70px]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                    {isOther ? "Cost" : isMiner ? "Cost" : "Delegated"}
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    {isOther ? (
                      <span className="text-lg font-bold font-mono text-muted-foreground tabular-nums leading-tight">
                        —
                      </span>
                    ) : (
                      <>
                        <span className="text-lg font-bold font-mono text-foreground tabular-nums leading-tight">
                          {isMiner
                            ? fmtUsd(data.initialCost)
                            : fmtGlw(data.initialCost)}
                        </span>
                        {!isMiner && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            GLW
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="text-center min-w-[70px]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                    {isPendingStart && data.estimatedUserWeeklyGlw
                      ? "Est. Weekly"
                      : "Earned"}
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span
                      className={cn(
                        "text-lg font-bold font-mono tabular-nums leading-tight",
                        isPendingStart
                          ? "text-muted-foreground"
                          : isMiner
                          ? "text-[color:var(--color-miner-contrast)]"
                          : "text-delegation-purple dark:text-delegation-purple"
                      )}
                    >
                      {isPendingStart
                        ? data.estimatedUserWeeklyGlw
                          ? `~${fmtGlw(data.estimatedUserWeeklyGlw)}`
                          : "—"
                        : isMiner
                        ? fmtGlw(totalEarnedGlw)
                        : fmtGlw(totalEarnedGlw)}
                    </span>
                    {(!isPendingStart || data.estimatedUserWeeklyGlw) && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        GLW
                        {isPendingStart && data.estimatedUserWeeklyGlw
                          ? "/wk"
                          : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-center min-w-[70px]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                    Last week
                  </div>
                  <div className="text-sm font-mono font-semibold text-foreground tabular-nums">
                    {lastWeekValue}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* COLUMN 4: PROGRESS */}
          <div className="col-span-2 flex items-center justify-end gap-2">
            <ProgressDisplay />
            {!isInProgress && (
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  isExpanded && "rotate-180"
                )}
              />
            )}
          </div>
        </div>

        {/* EXPANDABLE DETAIL PANEL */}
        {isExpanded && !isInProgress && (
          <div className="px-4 pb-4 pt-0">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="grid grid-cols-2 gap-6">
                {/* LEFT: BREAKDOWN */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
                    Breakdown
                  </div>
                  <div className="space-y-2 text-sm font-mono">
                    {!isOther && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {isMiner ? "Cost" : "Delegated"}
                        </span>
                        <span className="text-foreground">
                          {isMiner
                            ? fmtUsd(data.initialCost)
                            : `${fmtGlw(data.initialCost)} GLW`}
                        </span>
                      </div>
                    )}
                    {!isMiner && (
                      <div className="flex justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-delegation-purple dark:bg-delegation-purple" />
                          <span className="text-muted-foreground">
                            {isOther
                              ? `PD (${data.protocolDepositAsset ?? "—"})`
                              : "Recovered"}
                          </span>
                        </div>
                        <span className="text-delegation-purple dark:text-delegation-purple">
                          {isOther && data.isProtocolDepositUsd
                            ? `${fmtUsdAmount(data.recovered)} USDG`
                            : `${fmtGlw(data.recovered)} GLW`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[color:var(--color-miner)]" />
                        <span className="text-muted-foreground">Emissions</span>
                      </div>
                      <span className="text-[color:var(--color-miner-contrast)]">
                        +{fmtGlw(data.inflationGlw)} GLW
                      </span>
                    </div>
                    <div className="h-px bg-border my-2" />
                    <div className="flex justify-between font-bold">
                      <span className="text-muted-foreground">Total</span>
                      <span className="text-foreground">
                        {isOther && data.isProtocolDepositUsd
                          ? `${fmtGlw(data.inflationGlw)} GLW + ${fmtUsdAmount(
                              data.recovered
                            )} USDG`
                          : isMiner
                          ? fmtUsd(totalEarned)
                          : `${fmtGlw(totalEarnedGlw)} GLW`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* RIGHT: TIMELINE */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
                    Timeline
                  </div>
                  <div className="space-y-2 text-sm font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Week</span>
                      <span className="text-foreground">
                        {data.weeksActive} of {data.totalWeeks}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Time Progress
                      </span>
                      <span className="text-foreground">
                        {timePercent.toFixed(1)}%
                      </span>
                    </div>
                    {!isMiner && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Value Progress
                        </span>
                        <span
                          className={cn(
                            isProfit
                              ? "text-emerald-600 dark:text-emerald-500 font-bold"
                              : "text-foreground"
                          )}
                        >
                          {valuePercent.toFixed(1)}%
                        </span>
                      </div>
                    )}
                    <div className="h-px bg-border my-2" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Remaining</span>
                      <span className="text-foreground">
                        {weeksRemaining} weeks
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface FarmsPerformanceDialogContentProps {
  walletAddress?: string;
  initialFilter?: FilterValue;
}

export function FarmsPerformanceDialogContent({
  walletAddress,
  initialFilter = "all",
}: FarmsPerformanceDialogContentProps) {
  const [filter, setFilter] = React.useState<FilterValue>(initialFilter);

  // Sync internal filter state when initialFilter prop changes
  React.useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const hasWallet = Boolean(walletAddress);
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "farms_performance_dialog";
  const isInProgressTab = filter === "in-progress";
  const shouldLoadSplitsActivity = hasWallet;
  const shouldLoadInProgress =
    hasWallet && (filter === "all" || isInProgressTab);

  const {
    data: rewardsBreakdown,
    isLoading: isRewardsLoading,
    isError: isRewardsError,
    refetch: refetchRewards,
  } = useRewardsBreakdown({
    walletAddress: walletAddress ?? null,
    enabled: hasWallet,
  });

  const {
    farms: purchasedFarms,
    isLoading: isFarmsLoading,
    isError: isFarmsError,
  } = useWalletFarms({
    walletAddress: walletAddress ?? undefined,
    enabled: hasWallet,
  });

  const { regions, isRegionsLoading } = useRegions();

  const { spotPrice: glwSpotPriceUsd, isLoading: isSpotPriceLoading } =
    useGlowSpotPrice();

  const {
    activity: splitsActivity,
    isLoading: isSplitsActivityLoading,
    isError: isSplitsActivityError,
  } = useSplitsActivity({
    walletAddress: walletAddress ?? undefined,
    enabled: shouldLoadSplitsActivity,
    limit: 200,
  });

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

  const {
    applications: sponsorListings,
    isLoading: isSponsorListingsLoading,
    isError: isSponsorListingsError,
  } = useGlowLaunchpad({
    filters: { paymentCurrency: "GLW" },
    enabled: shouldLoadInProgress && splitsActivity.length > 0,
  });

  const sponsorshipsInProgress = React.useMemo(() => {
    return deriveLaunchpadSponsorshipsInProgress({
      splitsActivity,
      sponsorListings,
    });
  }, [splitsActivity, sponsorListings]);

  const applicationsForRewards = React.useMemo(() => {
    return sponsorshipsInProgress
      .map((item) => item.application)
      .filter((app): app is NonNullable<typeof app> => app !== null);
  }, [sponsorshipsInProgress]);

  const {
    rewardScoreMap,
    isLoading: isRewardScoresLoading,
    isError: isRewardScoresError,
  } = useRewardScore({
    applications: applicationsForRewards,
    paymentCurrency: "GLW",
    enabled: shouldLoadInProgress && applicationsForRewards.length > 0,
    walletAddress: walletAddress ?? null,
  });

  const sponsorshipsInProgressWithEstimates = React.useMemo(() => {
    return attachEstimatedWeeklyLaunchpadRewards({
      sponsorshipsInProgress,
      rewardScoreMap,
    }).sort((a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0));
  }, [rewardScoreMap, sponsorshipsInProgress]);

  const hasMiningCenterSplits = React.useMemo(() => {
    return splitsActivity.some((s) => s.fractionType === "mining-center");
  }, [splitsActivity]);

  const {
    applications: miningCenterListings,
    isLoading: isMiningCenterListingsLoading,
    isError: isMiningCenterListingsError,
  } = useMiningCenter({
    filters: { paymentCurrency: "USDC" },
    enabled: shouldLoadInProgress && hasMiningCenterSplits,
  });

  const miningCenterInProgress = React.useMemo(() => {
    return deriveMiningCenterSponsorshipsInProgress({
      splitsActivity,
      sponsorListings: miningCenterListings,
    });
  }, [miningCenterListings, splitsActivity]);

  const miningCenterAppsForScores = React.useMemo(() => {
    return miningCenterInProgress
      .map((item) => item.application)
      .filter((app): app is NonNullable<typeof app> => app !== null);
  }, [miningCenterInProgress]);

  const {
    miningScoreMap,
    isLoading: isMiningScoresLoading,
    isError: isMiningScoresError,
  } = useMiningScore({
    applications: miningCenterAppsForScores,
    enabled: shouldLoadInProgress && miningCenterAppsForScores.length > 0,
  });

  const miningCenterInProgressWithEstimates = React.useMemo(() => {
    return attachEstimatedWeeklyMiningCenterRewards({
      sponsorshipsInProgress: miningCenterInProgress,
      miningScoreMap,
    }).sort((a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0));
  }, [miningCenterInProgress, miningScoreMap]);

  const isInProgressLoading =
    shouldLoadInProgress &&
    (isSplitsActivityLoading ||
      isSponsorListingsLoading ||
      isRewardScoresLoading ||
      isMiningCenterListingsLoading ||
      isMiningScoresLoading);
  const isInProgressError =
    shouldLoadInProgress &&
    (isSplitsActivityError ||
      isSponsorListingsError ||
      isRewardScoresError ||
      isMiningCenterListingsError ||
      isMiningScoresError);

  const rows = React.useMemo<PerformanceRowData[]>(() => {
    if (!rewardsBreakdown) return [];

    const farmRows: PerformanceRowData[] = rewardsBreakdown.farmDetails.map(
      (farm): PerformanceRowData => {
        const farmMetadata = purchasedFarms.find(
          (f) => f.farmId === farm.farmId
        );
        const regionName = (() => {
          if (!farmMetadata) return "—";
          const region = regions.find((r) => r.id === farmMetadata.regionId);
          return region?.name || `Region ${farmMetadata.regionId}`;
        })();

        const displayName =
          farmMetadata?.name ||
          farmNameByFarmId.get(farm.farmId) ||
          `Farm ${farm.farmId.substring(0, 8)}`;

        if (farm.type === "launchpad") {
          const initialCost = parseGlwFromWei(farm.amountInvested);
          const recovered = parseGlwFromWei(farm.totalProtocolDepositRewards);
          const inflation = parseGlwFromWei(farm.totalInflationRewards);
          return {
            farmId: farm.farmId,
            id: displayName,
            region: regionName,
            type: "delegation",
            initialCost,
            recovered,
            inflation,
            inflationGlw: inflation,
            lastWeekRewardsGlw: parseGlwFromWei(farm.lastWeekRewards ?? "0"),
            protocolDepositAsset: "GLW",
            isProtocolDepositUsd: false,
            weeksActive: farm.totalWeeksEarned,
            totalWeeks: 100,
          };
        }

        const initialCostUsd = parseUsdcFromBaseUnits(farm.amountInvested);
        const inflationGlw = parseGlwFromWei(farm.totalInflationRewards);
        const inflationUsd =
          Number.isFinite(glwSpotPriceUsd ?? NaN) && (glwSpotPriceUsd ?? 0) > 0
            ? inflationGlw * (glwSpotPriceUsd ?? 0)
            : 0;

        return {
          farmId: farm.farmId,
          id: displayName,
          region: regionName,
          type: "miner",
          initialCost: initialCostUsd,
          recovered: 0,
          inflation: inflationUsd,
          inflationGlw,
          lastWeekRewardsGlw: parseGlwFromWei(farm.lastWeekRewards ?? "0"),
          protocolDepositAsset: "USDC",
          isProtocolDepositUsd: true,
          weeksActive: farm.totalWeeksEarned,
          totalWeeks: 99,
        };
      }
    );

    const otherRows: PerformanceRowData[] = (
      rewardsBreakdown.otherFarmsWithRewards?.farms ?? []
    ).map((farm): PerformanceRowData => {
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

      return {
        farmId: farm.farmId,
        id: displayName,
        region: identityDetail,
        type: "other",
        initialCost: 0,
        recovered,
        inflation,
        inflationGlw,
        lastWeekRewardsGlw: parseGlwFromWei(farm.lastWeekRewards ?? "0"),
        protocolDepositAsset: farm.asset,
        isProtocolDepositUsd,
        weeksActive,
        totalWeeks,
      };
    });

    return [...farmRows, ...otherRows];
  }, [
    farmNameByFarmId,
    purchasedFarms,
    regions,
    rewardsBreakdown,
    glwSpotPriceUsd,
  ]);

  const rewardFarmIds = React.useMemo(() => {
    return new Set(rows.map((r) => r.farmId));
  }, [rows]);

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

  const pendingStartRows = React.useMemo<PerformanceRowData[]>(() => {
    if (!splitsActivity.length) return [];

    const byFarm = new Map<
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

      const existing = byFarm.get(farmTypeKey) ?? {
        farmId,
        farmName: evt.farmName || `Farm ${farmId.substring(0, 8)}`,
        fractionType,
        totalAmount: BigInt(0),
      };
      existing.totalAmount += amount;
      byFarm.set(farmTypeKey, existing);
    }

    return Array.from(byFarm.values()).map((item): PerformanceRowData => {
      const farmData = purchasedFarms.find((f) => f.farmId === item.farmId);

      let estimatedUserWeeklyGlw: number | undefined = undefined;
      if (farmData?.userWeeklyRewards) {
        // Use source-specific breakdown if available (prevents double-counting for farms with both delegation + miner)
        const isMiningCenter = item.fractionType === "mining-center";

        if (
          isMiningCenter &&
          farmData.userWeeklyRewards.glwInflationRewardsFromMiner
        ) {
          // Miner: only inflation from mining-center splits (no PD recovery)
          estimatedUserWeeklyGlw = parseGlwFromWei(
            farmData.userWeeklyRewards.glwInflationRewardsFromMiner
          );
        } else if (
          !isMiningCenter &&
          farmData.userWeeklyRewards.glwInflationRewardsFromDelegation
        ) {
          // Delegation: inflation from delegation splits + PD recovery
          const delegationInflationGlw = parseGlwFromWei(
            farmData.userWeeklyRewards.glwInflationRewardsFromDelegation
          );
          const pdGlw = parseGlwFromWei(
            farmData.userWeeklyRewards.protocolDepositRewards
          );
          estimatedUserWeeklyGlw = delegationInflationGlw + pdGlw;
        } else {
          // Fallback for old API response (no breakdown fields)
          const inflationGlw = parseGlwFromWei(
            farmData.userWeeklyRewards.glwInflationRewards
          );
          const pdAsset = farmData.userWeeklyRewards.protocolDepositAsset;
          const isPdGlw = pdAsset === "GLW";
          const pdGlw = isPdGlw
            ? parseGlwFromWei(farmData.userWeeklyRewards.protocolDepositRewards)
            : 0;
          estimatedUserWeeklyGlw = inflationGlw + pdGlw;
        }
      }

      if (item.fractionType === "launchpad") {
        const investedGlw = parseGlwFromWei(item.totalAmount.toString());
        return {
          farmId: item.farmId,
          id: item.farmName,
          region: "Launchpad",
          type: "delegation",
          isPendingStart: true,
          initialCost: investedGlw,
          recovered: 0,
          inflation: 0,
          inflationGlw: 0,
          protocolDepositAsset: "GLW",
          isProtocolDepositUsd: false,
          weeksActive: 0,
          totalWeeks: 100,
          lastWeekRewardsGlw: 0,
          estimatedUserWeeklyGlw,
        };
      }

      const investedUsd = parseUsdcFromBaseUnits(item.totalAmount.toString());
      return {
        farmId: item.farmId,
        id: item.farmName,
        region: "Miner",
        type: "miner",
        isPendingStart: true,
        initialCost: investedUsd,
        recovered: 0,
        inflation: 0,
        inflationGlw: 0,
        lastWeekRewardsGlw: 0,
        protocolDepositAsset: "USDC",
        isProtocolDepositUsd: true,
        weeksActive: 0,
        totalWeeks: 99,
        estimatedUserWeeklyGlw,
      };
    });
  }, [purchasedFarms, rewardedFarmTypeKeys, splitsActivity]);

  const visibleRows = React.useMemo(() => {
    if (filter === "in-progress") return [] as PerformanceRowData[];
    let filtered = [...rows];
    if (filter === "miners")
      filtered = filtered.filter((r) => r.type === "miner");
    if (filter === "delegations")
      filtered = filtered.filter((r) => r.type === "delegation");
    if (filter === "other")
      filtered = filtered.filter((r) => r.type === "other");
    // Sort by Total Value % (High performance first)
    return filtered.sort((a, b) => {
      const totalA = a.recovered + a.inflation;
      const totalB = b.recovered + b.inflation;

      const scoreA =
        a.type === "other" ? totalA : totalA / Math.max(a.initialCost, 1);
      const scoreB =
        b.type === "other" ? totalB : totalB / Math.max(b.initialCost, 1);

      return scoreB - scoreA;
    });
  }, [filter, rows]);

  const inProgressRows = React.useMemo<PerformanceRowData[]>(() => {
    const combined = [
      ...sponsorshipsInProgressWithEstimates,
      ...miningCenterInProgressWithEstimates,
    ];
    if (!combined.length) return [];

    return combined.map((item) => {
      const app = item.application;
      const zoneName = app?.zone?.name || "Launchpad";
      const remainingSteps = app?.activeFraction?.remainingSteps ?? null;
      const totalSteps = app?.activeFraction?.totalSteps ?? null;
      const filledLabel =
        typeof totalSteps === "number" && typeof remainingSteps === "number"
          ? item.fractionType === "mining-center"
            ? `${totalSteps - remainingSteps} / ${totalSteps} miners filled`
            : `${totalSteps - remainingSteps} / ${totalSteps} filled`
          : null;

      const displayName =
        app?.farmName || `Farm ${item.applicationId.substring(0, 8)}`;

      return {
        farmId: item.applicationId,
        id: displayName,
        region: zoneName,
        type: "in-progress",
        initialCost: 0,
        recovered: 0,
        inflation: 0,
        inflationGlw: 0,
        lastWeekRewardsGlw: 0,
        protocolDepositAsset: "GLW",
        isProtocolDepositUsd: false,
        weeksActive: 0,
        totalWeeks: 1,
        inProgressPercent: item.progressPercent ?? 0,
        inProgressFilledLabel: filledLabel,
        inProgressUserSteps: item.userSteps,
        estimatedUserWeeklyGlw: item.estimatedUserWeeklyGlw ?? 0,
        inProgressKind: item.fractionType,
      };
    });
  }, [
    miningCenterInProgressWithEstimates,
    sponsorshipsInProgressWithEstimates,
  ]);

  const visibleRowsWithInProgress = React.useMemo(() => {
    if (filter === "in-progress") return inProgressRows;
    if (filter === "all")
      return [...pendingStartRows, ...inProgressRows, ...visibleRows];
    if (filter === "miners")
      return [
        ...pendingStartRows.filter((r) => r.type === "miner"),
        ...inProgressRows.filter((r) => r.inProgressKind === "mining-center"),
        ...visibleRows,
      ];
    if (filter === "delegations")
      return [
        ...pendingStartRows.filter((r) => r.type === "delegation"),
        ...inProgressRows.filter((r) => r.inProgressKind !== "mining-center"),
        ...visibleRows,
      ];
    return visibleRows;
  }, [filter, inProgressRows, pendingStartRows, visibleRows]);

  const isListLoading =
    filter === "in-progress"
      ? isInProgressLoading
      : isRewardsLoading || isFarmsLoading || isRegionsLoading;

  const isListError =
    filter === "in-progress"
      ? isInProgressError
      : isRewardsError || isFarmsError;

  const tabCounts = React.useMemo(() => {
    const rewardMinerCount = rows.filter((r) => r.type === "miner").length;
    const rewardDelegationCount = rows.filter(
      (r) => r.type === "delegation"
    ).length;
    const rewardOtherCount = rows.filter((r) => r.type === "other").length;
    const pendingMinerCount = pendingStartRows.filter(
      (r) => r.type === "miner"
    ).length;
    const pendingDelegationCount = pendingStartRows.filter(
      (r) => r.type === "delegation"
    ).length;
    const inProgressMinerCount = inProgressRows.filter(
      (r) => r.inProgressKind === "mining-center"
    ).length;
    const inProgressDelegationCount = inProgressRows.filter(
      (r) => r.inProgressKind !== "mining-center"
    ).length;

    return {
      all: rows.length + pendingStartRows.length + inProgressRows.length,
      miners: rewardMinerCount + pendingMinerCount + inProgressMinerCount,
      delegations:
        rewardDelegationCount +
        pendingDelegationCount +
        inProgressDelegationCount,
      other: rewardOtherCount,
      inProgress: inProgressRows.length,
    };
  }, [inProgressRows, pendingStartRows, rows]);

  return (
    <DialogContent className="max-w-4xl h-[92dvh] sm:h-[80vh] min-h-0 flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
      {/* Header */}
      <DialogHeader className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border bg-muted/40 flex-shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 space-y-0">
        <DialogTitle className="text-xl sm:text-2xl font-bold font-mono uppercase tracking-wide leading-tight">
          Farm Performance
        </DialogTitle>

        <Tabs
          value={filter}
          onValueChange={(value) => {
            const next = isFilterValue(value) ? value : "all";
            trackEvent("dashboard_mining_filter_change", {
              source,
              wallet_connected: hasWallet,
              wallet_address: normalizedWalletAddress,
              filter: next,
            });
            setFilter(next);
          }}
          className="w-full sm:w-auto"
        >
          <TabsList className="w-full sm:w-auto bg-muted/30 border border-border h-10 sm:h-12 p-1 overflow-x-auto">
            <TabsTrigger
              value="all"
              className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-[#ffb472] data-[state=active]:bg-[#ffb472]/12 data-[state=active]:border data-[state=active]:border-[#ffb472]"
            >
              ALL
            </TabsTrigger>
            {tabCounts.miners > 0 || filter === "miners" ? (
              <TabsTrigger
                value="miners"
                className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-[color:var(--color-miner)] data-[state=active]:bg-[color:var(--color-miner)]/12 data-[state=active]:border data-[state=active]:border-[color:var(--color-miner)]"
              >
                MINERS
              </TabsTrigger>
            ) : null}
            {tabCounts.delegations > 0 || filter === "delegations" ? (
              <TabsTrigger
                value="delegations"
                className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-delegation-purple data-[state=active]:bg-delegation-purple/12 data-[state=active]:border data-[state=active]:border-delegation-purple"
              >
                DELEGATIONS
              </TabsTrigger>
            ) : null}
            {tabCounts.other > 0 || filter === "other" ? (
              <TabsTrigger
                value="other"
                className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-emerald-700 dark:data-[state=active]:text-[color:var(--color-glow-green)] data-[state=active]:bg-[color:var(--color-glow-green)]/10 data-[state=active]:border data-[state=active]:border-[color:var(--color-glow-green)]"
              >
                OTHER
              </TabsTrigger>
            ) : null}
            {tabCounts.inProgress > 0 || filter === "in-progress" ? (
              <TabsTrigger
                value="in-progress"
                className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-delegation-purple data-[state=active]:bg-delegation-purple/12 data-[state=active]:border data-[state=active]:border-delegation-purple"
              >
                IN PROGRESS
              </TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>
      </DialogHeader>

      {/* Legend / Columns */}
      <div className="hidden sm:grid grid-cols-12 px-6 py-3 border-b border-border bg-muted/30 text-xs font-mono uppercase text-muted-foreground tracking-wider flex-shrink-0 gap-4">
        <div className="col-span-3">Identity</div>
        <div className="col-span-3 px-2">Lifecycle</div>
        <div className="col-span-4 text-center">Key Metrics</div>
        <div className="col-span-2 text-right">Progress</div>
      </div>

      {/* Scrollable List */}
      <ScrollArea className="flex-1 min-h-0 bg-background">
        <TooltipProvider delayDuration={0}>
          <div className="p-4 sm:p-6 space-y-3 pb-12 min-h-0">
            {!hasWallet ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Connect your wallet to view farm performance
                </div>
                <ConnectButton
                  variant="default"
                  size="medium"
                  className="w-full"
                />
              </div>
            ) : isListLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : isListError ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {filter === "in-progress"
                    ? "Unable to load in-progress delegations"
                    : "Unable to load farm performance"}
                </div>
                {filter !== "in-progress" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono"
                    onClick={() => {
                      trackEvent("dashboard_mining_retry_click", {
                        source,
                        wallet_connected: hasWallet,
                        wallet_address: normalizedWalletAddress,
                        filter,
                      });
                      refetchRewards();
                    }}
                  >
                    Retry
                  </Button>
                ) : null}
              </div>
            ) : visibleRowsWithInProgress.length === 0 ? (
              <div className="py-16 text-center text-xs font-mono text-muted-foreground uppercase tracking-wider">
                {filter === "in-progress"
                  ? "No in-progress delegations found for this wallet"
                  : "No farms found for this wallet"}
              </div>
            ) : (
              <>
                {(filter === "miners" ||
                  (filter === "other" &&
                    visibleRows.some((r) => r.isProtocolDepositUsd))) &&
                  !isSpotPriceLoading &&
                  (!Number.isFinite(glwSpotPriceUsd ?? NaN) ||
                    (glwSpotPriceUsd ?? 0) <= 0) && (
                    <div className="rounded-xl border border-border bg-muted/20 p-3 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                      ROI requires GLW spot price; showing $0 until price is
                      available.
                    </div>
                  )}
                {visibleRowsWithInProgress.map((row) => (
                  <FarmPerformanceRow
                    key={`${row.type}-${row.farmId}`}
                    data={row}
                  />
                ))}
              </>
            )}
          </div>
        </TooltipProvider>
      </ScrollArea>
    </DialogContent>
  );
}

// --- STANDALONE WIDGET (OPTIONAL) ---

interface FarmsPerformanceDialogWidgetProps {
  walletAddress?: string;
}

export default function FarmsPerformanceDialogWidget({
  walletAddress,
}: FarmsPerformanceDialogWidgetProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <Card className="h-full max-h-[400px] flex flex-col overflow-hidden shadow-2xl shadow-black/10">
        <CardHeader className="pb-2 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="tracking-tight text-sm font-bold text-foreground uppercase font-mono">
                Glow Mining
              </CardTitle>
              <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground font-mono">
                Last 10 Weeks
              </span>
            </div>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
              >
                <LayoutGrid className="w-3 h-3" />
                View Details
              </Button>
            </DialogTrigger>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 p-6 flex flex-col gap-6">
          <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-xs">
            [ Chart View Component ]
          </div>
        </CardContent>
      </Card>

      <FarmsPerformanceDialogContent walletAddress={walletAddress} />
    </Dialog>
  );
}
