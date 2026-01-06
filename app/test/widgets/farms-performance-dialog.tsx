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

const FILTER_VALUES = [
  "all",
  "miners",
  "delegations",
  "other",
  "in-progress",
] as const;
type FilterValue = (typeof FILTER_VALUES)[number];

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
  if (data.type === "miner")
    return "text-[color:var(--color-miner-yellow-contrast)]";
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
  // 1. Calculations
  const isInProgress = data.type === "in-progress";
  const isPendingStart = Boolean(data.isPendingStart);
  const totalValue = data.recovered + data.inflation;
  const isMiner = data.type === "miner";
  const isOther = data.type === "other";
  const isProtocolDepositUsd = data.isProtocolDepositUsd;
  const isUsdRow = isMiner || (isOther && isProtocolDepositUsd);
  const inProgressIsMiningCenter =
    data.type === "in-progress" && data.inProgressKind === "mining-center";
  const totalRewardsLabel = getTotalRewardsLabel(data);

  // Percentages (0-100 for bar width)
  const timePct = isInProgress
    ? 0
    : Math.min((data.weeksActive / data.totalWeeks) * 100, 100);

  // Stacking Logic:
  const denom =
    isOther || isInProgress
      ? Math.max(totalValue, 1)
      : Math.max(data.initialCost, 1);
  const principalPct = Math.min((data.recovered / denom) * 100, 100);
  // Inflation sits on top of principal. If total > 100, we clamp for the main bar
  // and handle the overflow visually.
  const inflationPct = Math.min(
    (data.inflation / denom) * 100,
    100 - principalPct
  );

  const totalValuePct = (totalValue / denom) * 100;

  // Status Flags
  const isProfit = !isOther && !isInProgress && totalValuePct >= 100;
  const isLagging = !isOther && !isInProgress && totalValuePct < timePct - 10; // Buffer of 10% before warning

  return (
    <>
      {/* Mobile card */}
      <div
        className={cn(
          "sm:hidden p-4 rounded-xl border border-border bg-muted/10 hover:bg-muted/20 hover:border-border/80 transition-colors",
          isPendingStart && "opacity-60"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border",
                data.type === "miner"
                  ? "bg-[color:var(--color-miner-yellow)]/15 border-[color:var(--color-miner-yellow)]/30 text-[color:var(--color-miner-yellow-contrast)]"
                  : data.type === "delegation" ||
                    (data.type === "in-progress" && !inProgressIsMiningCenter)
                  ? "bg-[#C084FC]/15 border-[#C084FC]/30 text-[#C084FC]"
                  : data.type === "in-progress" && inProgressIsMiningCenter
                  ? "bg-[color:var(--color-miner-yellow)]/15 border-[color:var(--color-miner-yellow)]/30 text-[color:var(--color-miner-yellow-contrast)]"
                  : "bg-[color:var(--color-glow-green)]/15 border-[color:var(--color-glow-green)]/30 text-[color:var(--color-glow-green)]"
              )}
            >
              {data.type === "miner" ? (
                <Cpu className="w-5 h-5" />
              ) : data.type === "delegation" ||
                (data.type === "in-progress" && !inProgressIsMiningCenter) ? (
                <Layers className="w-5 h-5" />
              ) : data.type === "in-progress" && inProgressIsMiningCenter ? (
                <Cpu className="w-5 h-5" />
              ) : (
                <Gift className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-base text-foreground leading-tight truncate">
                {data.id}
              </div>
              <div className="text-sm font-mono text-muted-foreground truncate">
                {data.region}
              </div>
              {totalRewardsLabel ? (
                <div className="text-xs font-mono text-muted-foreground truncate">
                  Rewards:{" "}
                  <span
                    className={cn("font-bold", getTotalRewardsClassName(data))}
                  >
                    {totalRewardsLabel}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="shrink-0">
            {isPendingStart ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-border/60 bg-muted/30 text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span className="text-xs font-bold font-mono">
                  STARTS NEXT WEEK
                </span>
              </div>
            ) : isInProgress ? (
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded border",
                  inProgressIsMiningCenter
                    ? "text-[color:var(--color-miner-yellow-contrast)] bg-[color:var(--color-miner-yellow)]/10 border-[color:var(--color-miner-yellow)]/20"
                    : "text-[#C084FC] bg-[#C084FC]/10 border-[#C084FC]/20"
                )}
              >
                {inProgressIsMiningCenter ? (
                  <Cpu className="w-3 h-3" />
                ) : (
                  <Layers className="w-3 h-3" />
                )}
                <span className="text-xs font-bold font-mono">IN PROGRESS</span>
              </div>
            ) : isOther ? (
              <div className="flex items-center gap-1.5 text-[color:var(--color-glow-green)] bg-[color:var(--color-glow-green)]/10 px-2 py-1 rounded border border-[color:var(--color-glow-green)]/20">
                <Gift className="w-3 h-3" />
                <span className="text-xs font-bold font-mono">REWARDS</span>
              </div>
            ) : isProfit ? (
              <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">
                <TrendingUp className="w-3 h-3" />
                <span className="text-xs font-bold font-mono">PROFIT</span>
              </div>
            ) : isLagging ? (
              <div className="flex items-center gap-1.5 text-orange-400 bg-orange-400/10 px-2 py-1 rounded border border-orange-400/20">
                <AlertCircle className="w-3 h-3" />
                <span className="text-xs font-bold font-mono">LAGGING</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/20 px-2 py-1 rounded border border-border/60">
                <CheckCircle2 className="w-3 h-3" />
                <span className="text-xs font-bold font-mono">ON TRACK</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {isInProgress ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Funding progress
                </div>
                <div className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  {Math.round(data.inProgressPercent ?? 0)}% filled
                </div>
              </div>
              <Progress
                value={Math.max(0, Math.min(100, data.inProgressPercent ?? 0))}
              />
              {data.inProgressFilledLabel ? (
                <div className="text-[10px] font-mono text-muted-foreground">
                  {data.inProgressFilledLabel}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Est. weekly
                </div>
                <div
                  className={cn(
                    "text-xs font-mono font-bold tabular-nums",
                    inProgressIsMiningCenter
                      ? "text-[color:var(--color-miner-yellow-contrast)]"
                      : "text-[#C084FC]"
                  )}
                >
                  {formatGlwPrecise(data.estimatedUserWeeklyGlw ?? 0)} GLW/wk
                </div>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">
                Your steps: {(data.inProgressUserSteps ?? 0).toLocaleString()}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Time
                </div>
                <div className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  {isPendingStart
                    ? "Starts next week"
                    : `${data.totalWeeks - data.weeksActive} Left`}
                </div>
              </div>
              <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground/20 dark:bg-white/20"
                  style={{ width: `${timePct}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Value
                </div>
                <div
                  className={cn(
                    "text-xs font-mono font-bold tabular-nums",
                    isOther
                      ? "text-[color:var(--color-glow-green)]"
                      : isProfit
                      ? "text-emerald-500"
                      : "text-foreground"
                  )}
                >
                  {isOther ? "—" : `${Math.round(totalValuePct)}%`}
                </div>
              </div>

              <div className="relative">
                <ShadTooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "relative w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border/70 cursor-help",
                        isProfit &&
                          "ring-1 ring-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute left-0 h-full",
                          isMiner
                            ? "bg-muted-foreground/35"
                            : isOther
                            ? data.isProtocolDepositUsd
                              ? "bg-[color:var(--color-glow-green)]"
                              : "bg-[color:var(--color-glow-orange)]"
                            : "bg-[#C084FC]"
                        )}
                        style={{ width: `${principalPct}%` }}
                      />
                      <div
                        className="absolute h-full bg-[color:var(--color-miner-yellow)]"
                        style={{
                          left: `${principalPct}%`,
                          width: `${inflationPct}%`,
                        }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-popover text-popover-foreground border-border text-sm font-mono px-4 py-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {!isOther ? (
                        <>
                          <span className="text-muted-foreground">
                            Initial:
                          </span>
                          <span className="text-right text-foreground">
                            {isMiner
                              ? fmtUsd(data.initialCost)
                              : `${fmtGlw(data.initialCost)} GLW`}
                          </span>
                        </>
                      ) : null}

                      <span className="text-muted-foreground">
                        {isOther
                          ? `PD rewards (${data.protocolDepositAsset ?? "—"}):`
                          : "Recovered:"}
                      </span>
                      <span
                        className={cn(
                          "text-right",
                          isMiner
                            ? "text-muted-foreground"
                            : isOther
                            ? "text-[color:var(--color-glow-green)]"
                            : "text-[#C084FC]"
                        )}
                      >
                        {isOther
                          ? data.isProtocolDepositUsd
                            ? `${fmtUsdAmount(data.recovered)} USDG`
                            : `${fmtGlw(data.recovered)} GLW`
                          : isUsdRow
                          ? fmtUsd(data.recovered)
                          : `${fmtGlw(data.recovered)} GLW`}
                      </span>

                      <span className="text-muted-foreground">
                        {isOther ? "Inflation:" : "Emissions:"}
                      </span>
                      <span className="text-right text-[color:var(--color-miner-yellow-contrast)]">
                        {`+${fmtGlw(data.inflationGlw)} GLW`}
                      </span>

                      <div className="col-span-2 h-px bg-border my-1" />

                      <span className="text-muted-foreground">Total:</span>
                      <span className="text-right font-bold">
                        {isOther
                          ? data.isProtocolDepositUsd
                            ? `${fmtGlw(
                                data.inflationGlw
                              )} GLW + ${fmtUsdAmount(data.recovered)} USDG`
                            : `${fmtGlw(
                                data.inflationGlw + data.recovered
                              )} GLW`
                          : isUsdRow
                          ? fmtUsd(totalValue)
                          : `${fmtGlw(totalValue)} GLW`}
                      </span>
                    </div>
                  </TooltipContent>
                </ShadTooltip>

                {isProfit ? (
                  <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-1 h-3 bg-foreground rounded-full z-10" />
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Desktop row */}
      <div
        className={cn(
          "hidden sm:grid grid-cols-12 items-center p-4 rounded-xl border border-border bg-muted/10 hover:bg-muted/20 hover:border-border/80 transition-colors group",
          isPendingStart && "opacity-60"
        )}
      >
        {/* COLUMN 1: IDENTITY (3 Cols) */}
        <div className="col-span-4 flex items-center gap-3">
          <div
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center border",
              data.type === "miner"
                ? "bg-[color:var(--color-miner-yellow)]/15 border-[color:var(--color-miner-yellow)]/30 text-[color:var(--color-miner-yellow-contrast)]"
                : data.type === "delegation" ||
                  (data.type === "in-progress" && !inProgressIsMiningCenter)
                ? "bg-[#C084FC]/15 border-[#C084FC]/30 text-[#C084FC]"
                : data.type === "in-progress" && inProgressIsMiningCenter
                ? "bg-[color:var(--color-miner-yellow)]/15 border-[color:var(--color-miner-yellow)]/30 text-[color:var(--color-miner-yellow-contrast)]"
                : "bg-[color:var(--color-glow-green)]/15 border-[color:var(--color-glow-green)]/30 text-[color:var(--color-glow-green)]"
            )}
          >
            {data.type === "miner" ? (
              <Cpu className="w-5 h-5" />
            ) : data.type === "delegation" ||
              (data.type === "in-progress" && !inProgressIsMiningCenter) ? (
              <Layers className="w-5 h-5" />
            ) : data.type === "in-progress" && inProgressIsMiningCenter ? (
              <Cpu className="w-5 h-5" />
            ) : (
              <Gift className="w-5 h-5" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-base text-foreground leading-tight truncate">
              {data.id}
            </span>
            <span className="text-sm font-mono text-muted-foreground truncate">
              {data.region}
            </span>
            {totalRewardsLabel ? (
              <span className="text-xs font-mono text-muted-foreground truncate">
                Rewards:{" "}
                <span
                  className={cn("font-bold", getTotalRewardsClassName(data))}
                >
                  {totalRewardsLabel}
                </span>
              </span>
            ) : null}
          </div>
        </div>

        {/* COLUMN 2: DUAL TRACKS (7 Cols) */}
        <div className="col-span-6 px-4 flex flex-col justify-center gap-3 min-w-0">
          {isInProgress ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-16 text-right uppercase tracking-wider">
                  Funding
                </span>
                <div className="flex-1 min-w-0">
                  <Progress
                    value={Math.max(
                      0,
                      Math.min(100, data.inProgressPercent ?? 0)
                    )}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-16 text-right tabular-nums">
                  {Math.round(data.inProgressPercent ?? 0)}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-16 text-right uppercase tracking-wider">
                  Est.
                </span>
                <div className="flex-1 min-w-0 text-xs font-mono text-muted-foreground truncate">
                  {data.inProgressFilledLabel ?? " "}
                </div>
                <div className="w-16 text-right tabular-nums">
                  <div
                    className={cn(
                      "text-sm font-mono font-bold leading-none",
                      inProgressIsMiningCenter
                        ? "text-[color:var(--color-miner-yellow-contrast)]"
                        : "text-[#C084FC]"
                    )}
                  >
                    {formatGlwPrecise(data.estimatedUserWeeklyGlw ?? 0)}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground leading-none mt-1">
                    GLW/wk
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Track A: TIME */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-10 text-right uppercase tracking-wider">
                  Time
                </span>
                <div className="flex-1 relative group/tooltip min-w-0">
                  <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground/20 dark:bg-white/20"
                      style={{ width: `${timePct}%` }}
                    />
                  </div>
                  {/* Hover Data */}
                  <div className="absolute -top-8 left-0 hidden group-hover/tooltip:block bg-popover text-popover-foreground border border-border text-sm px-2.5 py-1.5 rounded whitespace-nowrap z-10 leading-snug">
                    {data.weeksActive} weeks elapsed
                  </div>
                </div>
                <span className="text-xs font-mono text-muted-foreground w-16 text-right">
                  {isPendingStart
                    ? "Starts next week"
                    : `${data.totalWeeks - data.weeksActive} Left`}
                </span>
              </div>

              {/* Track B: MONEY */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-10 text-right uppercase tracking-wider">
                  Value
                </span>
                <div className="flex-1 relative min-w-0">
                  <ShadTooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "relative w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border/70 cursor-help",
                          isProfit &&
                            "ring-1 ring-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                        )}
                      >
                        {/* Segment 1: Recovered Principal / Deposit */}
                        <div
                          className={cn(
                            "absolute left-0 h-full",
                            isMiner
                              ? "bg-muted-foreground/35"
                              : isOther
                              ? data.isProtocolDepositUsd
                                ? "bg-[color:var(--color-glow-green)]"
                                : "bg-[color:var(--color-glow-orange)]"
                              : "bg-[#C084FC]"
                          )}
                          style={{ width: `${principalPct}%` }}
                        />
                        {/* Segment 2: Emissions */}
                        <div
                          className="absolute h-full bg-[color:var(--color-miner-yellow)]"
                          style={{
                            left: `${principalPct}%`,
                            width: `${inflationPct}%`,
                          }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover text-popover-foreground border-border text-sm font-mono px-4 py-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {!isOther ? (
                          <>
                            <span className="text-muted-foreground">
                              Initial:
                            </span>
                            <span className="text-right text-foreground">
                              {isMiner
                                ? fmtUsd(data.initialCost)
                                : `${fmtGlw(data.initialCost)} GLW`}
                            </span>
                          </>
                        ) : null}

                        <span className="text-muted-foreground">
                          {isOther
                            ? `PD rewards (${
                                data.protocolDepositAsset ?? "—"
                              }):`
                            : "Recovered:"}
                        </span>
                        <span
                          className={cn(
                            "text-right",
                            isMiner
                              ? "text-muted-foreground"
                              : isOther
                              ? "text-[color:var(--color-glow-green)]"
                              : "text-[#C084FC]"
                          )}
                        >
                          {isOther
                            ? data.isProtocolDepositUsd
                              ? `${fmtUsdAmount(data.recovered)} USDG`
                              : `${fmtGlw(data.recovered)} GLW`
                            : isUsdRow
                            ? fmtUsd(data.recovered)
                            : `${fmtGlw(data.recovered)} GLW`}
                        </span>

                        <span className="text-muted-foreground">
                          {isOther ? "Inflation:" : "Emissions:"}
                        </span>
                        <span className="text-right text-[color:var(--color-miner-yellow-contrast)]">
                          {`+${fmtGlw(data.inflationGlw)} GLW`}
                        </span>

                        <div className="col-span-2 h-px bg-border my-1" />

                        <span className="text-muted-foreground">Total:</span>
                        <span className="text-right font-bold">
                          {isOther
                            ? data.isProtocolDepositUsd
                              ? `${fmtGlw(
                                  data.inflationGlw
                                )} GLW + ${fmtUsdAmount(data.recovered)} USDG`
                              : `${fmtGlw(
                                  data.inflationGlw + data.recovered
                                )} GLW`
                            : isUsdRow
                            ? fmtUsd(totalValue)
                            : `${fmtGlw(totalValue)} GLW`}
                        </span>
                      </div>
                    </TooltipContent>
                  </ShadTooltip>

                  {/* Profit Overflow Marker */}
                  {isProfit && (
                    <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-1 h-3 bg-foreground rounded-full z-10" />
                  )}
                </div>

                <div className="flex flex-col items-end w-16">
                  <span
                    className={cn(
                      "text-sm font-mono font-bold",
                      isOther
                        ? "text-[color:var(--color-glow-green)]"
                        : isProfit
                        ? "text-emerald-500"
                        : "text-foreground"
                    )}
                  >
                    {isOther ? "—" : `${Math.round(totalValuePct)}%`}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* COLUMN 3: STATUS (2 Cols) */}
        <div className="col-span-2 flex justify-end">
          {isPendingStart ? (
            <div
              className="flex items-center gap-1.5 text-muted-foreground"
              title="This position is filled and will start earning next week"
            >
              <span className="text-xs font-mono uppercase tracking-wide">
                Starts next week
              </span>
              <Clock className="w-3.5 h-3.5" />
            </div>
          ) : isInProgress ? (
            <div
              className={cn(
                "flex items-center gap-1.5 opacity-90",
                inProgressIsMiningCenter
                  ? "text-[color:var(--color-miner-yellow-contrast)]"
                  : "text-[#C084FC]"
              )}
              title="Delegation is still being filled"
            >
              <span className="text-xs font-mono uppercase tracking-wide">
                In Progress
              </span>
              {inProgressIsMiningCenter ? (
                <Cpu className="w-3.5 h-3.5" />
              ) : (
                <Layers className="w-3.5 h-3.5" />
              )}
            </div>
          ) : isOther ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 text-[color:var(--color-glow-green)] bg-[color:var(--color-glow-green)]/10 px-2 py-1 rounded border border-[color:var(--color-glow-green)]/20">
                <Gift className="w-3 h-3" />
                <span className="text-xs font-bold font-mono">REWARDS</span>
              </div>
            </div>
          ) : isProfit ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">
                <TrendingUp className="w-3 h-3" />
                <span className="text-xs font-bold font-mono">PROFIT</span>
              </div>
            </div>
          ) : isLagging ? (
            <div
              className="flex items-center gap-1.5 text-orange-400 opacity-80"
              title="Value is growing slower than time passed"
            >
              <span className="text-xs font-mono uppercase tracking-wide">
                Lagging
              </span>
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 text-muted-foreground"
              title="On track to break even"
            >
              <span className="text-xs font-mono uppercase tracking-wide">
                On Track
              </span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

interface FarmsPerformanceDialogContentProps {
  walletAddress?: string;
}

export function FarmsPerformanceDialogContent({
  walletAddress,
}: FarmsPerformanceDialogContentProps) {
  const [filter, setFilter] = React.useState<FilterValue>("all");

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
        };
      }

      const investedUsd = parseUsdcFromBaseUnits(item.totalAmount.toString());
      return {
        farmId: item.farmId,
        id: item.farmName,
        region: "Mining Center",
        type: "miner",
        isPendingStart: true,
        initialCost: investedUsd,
        recovered: 0,
        inflation: 0,
        inflationGlw: 0,
        protocolDepositAsset: "USDC",
        isProtocolDepositUsd: true,
        weeksActive: 0,
        totalWeeks: 99,
      };
    });
  }, [rewardFarmIds, splitsActivity]);

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
      <DialogHeader className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border bg-muted/20 flex-shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 space-y-0">
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
              className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground"
            >
              ALL
            </TabsTrigger>
            {tabCounts.miners > 0 || filter === "miners" ? (
              <TabsTrigger
                value="miners"
                className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-miner-yellow"
              >
                MINERS
              </TabsTrigger>
            ) : null}
            {tabCounts.delegations > 0 || filter === "delegations" ? (
              <TabsTrigger
                value="delegations"
                className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-[#C084FC]"
              >
                DELEGATIONS
              </TabsTrigger>
            ) : null}
            {tabCounts.other > 0 || filter === "other" ? (
              <TabsTrigger
                value="other"
                className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-[color:var(--color-glow-green)]"
              >
                OTHER
              </TabsTrigger>
            ) : null}
            {tabCounts.inProgress > 0 || filter === "in-progress" ? (
              <TabsTrigger
                value="in-progress"
                className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-[#C084FC]"
              >
                IN PROGRESS
              </TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>
      </DialogHeader>

      {/* Legend / Columns */}
      <div className="hidden sm:grid grid-cols-12 px-6 py-3 border-b border-border/60 bg-muted/10 text-xs font-mono uppercase text-muted-foreground tracking-wider flex-shrink-0">
        <div className="col-span-4">Identity</div>
        <div className="col-span-6 pl-4 flex gap-4">
          <span>Lifecycle (Time vs Money)</span>
          <span className="ml-auto text-muted-foreground normal-case tracking-normal">
            <span className="text-[#C084FC]">■</span> Principal
            <span className="ml-2 text-[color:var(--color-miner-yellow-contrast)]">
              ■
            </span>{" "}
            Emissions
          </span>
        </div>
        <div className="col-span-2 text-right">Status</div>
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
