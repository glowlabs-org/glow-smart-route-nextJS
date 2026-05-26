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
  HelpCircle,
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
  useSplitsActivity,
  useWalletFarms,
} from "@/hooks";
import { useWalletLaunchpadInProgress } from "@/hooks/use-wallet-launchpad-in-progress";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { Progress } from "@/components/ui/progress";
import {
  attachEstimatedWeeklyMiningCenterRewards,
  deriveMiningCenterSponsorshipsInProgress,
  estimateMiningCenterWeeklyGlw,
} from "@/utils/sponsorships-in-progress";
import {
  buildPendingRewardTimeline,
  formatRewardPipelineDate,
} from "@/utils/reward-pipeline";
import {
  normalizeDelegationCurrency,
  parseDelegationAmountFromBaseUnits,
  resolveLaunchpadDelegationShareCount,
  resolveDelegationCurrency,
} from "@/utils/launchpad-rewards";
import { filterPublicLaunchpadApplications } from "@/utils/launchpad";
import { type AuctionApplication } from "@/hooks/hub-listings";
import { GlowSymbol } from "@/components/glow-symbol";
import { CashMinerIcon, DelegationIcon } from "@/components/impact-icons";
import {
  resolveLaunchpadActivityFarmId,
  resolveLaunchpadSplitCurrency,
  type DelegationAmountsByAsset,
} from "@/utils/wallet-launchpad";
import { useLang, type Strings } from "@/lib/i18n";

type FarmsPerfLabels = Strings["bigDialogs"]["farmsPerformance"];

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

function formatProtocolDepositAsset(asset: string | null | undefined): string {
  if (!asset) return "GLW";
  const normalized = asset.toUpperCase();
  if (normalized === "GCTL") return "SGCTL";
  return normalized;
}

function formatTokenAmountByAsset(
  value: number,
  asset: string | null | undefined
): string {
  if (!Number.isFinite(value)) return "—";
  const normalized = formatProtocolDepositAsset(asset);
  const maximumFractionDigits =
    normalized === "SGCTL" || normalized === "USDC" || normalized === "USDG"
      ? 2
      : 0;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatEstimatedWeeklyRewards(params: {
  estimatedUserWeeklyGlw?: number;
  estimatedUserWeeklyUsd?: number;
  estimatedUserWeeklyPd?: number;
  estimatedUserWeeklyPdAsset?: string | null;
}, labels?: Pick<FarmsPerfLabels, "weekAbbrev">) {
  const pdAsset = formatProtocolDepositAsset(params.estimatedUserWeeklyPdAsset);
  const weekAbbrev = labels?.weekAbbrev ?? "wk";

  if (
    pdAsset !== "GLW" &&
    (params.estimatedUserWeeklyPd ?? 0) > 0 &&
    Number.isFinite(params.estimatedUserWeeklyPd)
  ) {
    const parts: string[] = [];
    if (
      (params.estimatedUserWeeklyGlw ?? 0) > 0 &&
      Number.isFinite(params.estimatedUserWeeklyGlw)
    ) {
      parts.push(
        `${formatGlwPrecise(params.estimatedUserWeeklyGlw ?? 0)} GLW`
      );
    }
    parts.push(
      `${formatTokenAmountByAsset(
        params.estimatedUserWeeklyPd ?? 0,
        pdAsset
      )} ${pdAsset}`
    );
    return `~${parts.join(" + ")}/${weekAbbrev}`;
  }

  if (
    (params.estimatedUserWeeklyGlw ?? 0) > 0 &&
    Number.isFinite(params.estimatedUserWeeklyGlw)
  ) {
    return `~${formatGlwPrecise(
      params.estimatedUserWeeklyGlw ?? 0
    )} GLW/${weekAbbrev}`;
  }

  if (
    (params.estimatedUserWeeklyUsd ?? 0) > 0 &&
    Number.isFinite(params.estimatedUserWeeklyUsd)
  ) {
    return `~$${fmtUsdAmount(params.estimatedUserWeeklyUsd ?? 0)}/${weekAbbrev}`;
  }

  return null;
}

function formatDelegatedAmountsByAsset(params: {
  amounts?: DelegationAmountsByAsset;
  fallbackAmount: number;
  fallbackAsset: string | null | undefined;
}) {
  const entries = (["GLW", "SGCTL"] as const)
    .map((asset) => {
      const amount = params.amounts?.[asset] ?? 0;
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return `${formatTokenAmountByAsset(amount, asset)} ${asset}`;
    })
    .filter((value): value is string => value !== null);

  if (entries.length > 0) {
    return entries.join(" + ");
  }

  const fallbackAsset = formatProtocolDepositAsset(params.fallbackAsset);
  return `${formatTokenAmountByAsset(
    params.fallbackAmount,
    fallbackAsset
  )} ${fallbackAsset}`;
}

function parseRecoveredAmountsByAsset(
  raw: Record<string, string> | undefined
): DelegationAmountsByAsset | undefined {
  if (!raw) return undefined;
  const result: DelegationAmountsByAsset = {};
  for (const asset of ["GLW", "SGCTL"] as const) {
    const value = raw[asset];
    if (!value) continue;
    const parsed = parseProtocolDepositTokenAmount(value, asset);
    if (parsed > 0) result[asset] = parsed;
  }
  return result;
}

function hasAnyAssetAmount(amounts: DelegationAmountsByAsset): boolean {
  return (["GLW", "SGCTL"] as const).some(
    (asset) => (amounts[asset] ?? 0) > 0
  );
}

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
  purchaseDate?: string | null;
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
  estimatedUserWeeklyUsd?: number;
  estimatedUserWeeklyPd?: number;
  estimatedUserWeeklyPdAsset?: string | null;
  delegatedAmountsByAsset?: DelegationAmountsByAsset;
  recoveredAmountsByAsset?: DelegationAmountsByAsset;
  inProgressKind?: "launchpad" | "mining-center";
}

export function formatInProgressFilledLabel(params: {
  application: AuctionApplication | null | undefined;
  fractionType: "launchpad" | "mining-center";
  labels?: Pick<FarmsPerfLabels, "filledLabel" | "minersFilledLabel">;
}): string | null {
  const application = params.application;
  if (!application?.activeFraction) return null;

  if (params.fractionType === "launchpad") {
    // total and "filled" must be in the same unit. resolveLaunchpadDelegationShareCount
    // returns sGCTL-phase shares during pre-sale (ceil(finalProtocolFee / currentStepUsd6))
    // while resolveFractionRemainingSteps returns GLW-step remainder. Source filled
    // from splitsSold (single counter for both phases) and cap at total. See
    // Crimson Valley wk128: splits_sold=463, total_steps=113 — splitsSold can
    // legitimately exceed totalSteps mid-sGCTL.
    const totalShares = resolveLaunchpadDelegationShareCount(application);
    const splitsSold = Math.max(
      0,
      Math.floor(application.activeFraction.splitsSold ?? 0)
    );
    if (totalShares <= 0) return null;
    const filled = Math.min(splitsSold, totalShares);
    return params.labels?.filledLabel
      ? params.labels.filledLabel(filled, totalShares)
      : `${filled} / ${totalShares} filled`;
  }

  const remainingSteps = application.activeFraction.remainingSteps ?? null;
  const totalSteps = application.activeFraction.totalSteps ?? null;

  if (typeof totalSteps !== "number" || typeof remainingSteps !== "number") {
    return null;
  }

  const filled = totalSteps - remainingSteps;
  return params.labels?.minersFilledLabel
    ? params.labels.minersFilledLabel(filled, totalSteps)
    : `${filled} / ${totalSteps} miners filled`;
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
  const protocolDepositAsset = formatProtocolDepositAsset(
    data.protocolDepositAsset
  );

  if (data.type === "miner") return `${fmtGlw(data.inflationGlw)} GLW`;
  if (data.type === "delegation") {
    if (protocolDepositAsset !== "GLW") {
      return `${fmtGlw(data.inflationGlw)} GLW + ${formatTokenAmountByAsset(
        data.recovered,
        protocolDepositAsset
      )} ${protocolDepositAsset}`;
    }
    return `${fmtGlw(data.recovered + data.inflation)} GLW`;
  }

  if (data.isProtocolDepositUsd) {
    const asset = protocolDepositAsset || "USD";
    return `${fmtGlw(data.inflationGlw)} GLW + ${fmtUsdAmount(
      data.recovered
    )} ${asset}`;
  }

  if (protocolDepositAsset !== "GLW") {
    return `${fmtGlw(data.inflationGlw)} GLW + ${formatTokenAmountByAsset(
      data.recovered,
      protocolDepositAsset
    )} ${protocolDepositAsset}`;
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

  // USDG and USDC are 1:1 USD-denominated assets.
  const is6Decimals = asset === "USDG" || asset === "USDC";
  return num / (is6Decimals ? 1e6 : 1e18);
}

function parseGlwFromWei(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num / 1e18;
}

function parseProtocolDepositTokenAmount(
  value: string,
  asset: string | null | undefined
): number {
  const delegationCurrency = normalizeDelegationCurrency(asset);
  return parseDelegationAmountFromBaseUnits(value, delegationCurrency);
}

function getPendingPhaseLabel(
  phase: ReturnType<typeof buildPendingRewardTimeline>["phase"],
  labels: FarmsPerfLabels,
) {
  switch (phase) {
    case "epoch":
      return labels.phaseWeekClosing;
    case "audit":
      return labels.phaseAuditReview;
    case "finalization":
      return labels.phaseFinalizing;
    case "claimable":
      return labels.phaseClaimReady;
    default:
      return labels.phasePending;
  }
}

function getPendingNextMilestone(params: {
  phase: ReturnType<typeof buildPendingRewardTimeline>["phase"];
  epochEndsAtMs: number;
  auditPostedAtMs: number;
  claimableAtMs: number;
  labels: FarmsPerfLabels;
}) {
  const { phase, epochEndsAtMs, auditPostedAtMs, claimableAtMs, labels } =
    params;

  if (phase === "epoch") {
    return {
      label: labels.milestoneWeekCloses,
      date: formatRewardPipelineDate(epochEndsAtMs, {
        locale: labels.dateLocale,
        month: "short",
        day: "numeric",
      }),
    };
  }
  if (phase === "audit") {
    return {
      label: labels.milestoneAuditedPosted,
      date: formatRewardPipelineDate(auditPostedAtMs, {
        locale: labels.dateLocale,
        month: "short",
        day: "numeric",
      }),
    };
  }
  return {
    label:
      phase === "claimable"
        ? labels.milestoneFundsAvailable
        : labels.milestoneFirstFundsAvailable,
    date:
      phase === "claimable"
        ? labels.nowLabel
        : formatRewardPipelineDate(claimableAtMs, {
            locale: labels.dateLocale,
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
  };
}

function FirstFundsInfo(props: { className?: string; labels: FarmsPerfLabels }) {
  return (
    <ShadTooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground",
            props.className
          )}
          aria-label={props.labels.firstFundsAriaLabel}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
        {props.labels.firstFundsTooltip}
      </TooltipContent>
    </ShadTooltip>
  );
}

// --- COMPONENT: THE FARM ROW ---
const FarmPerformanceRow = ({ data }: { data: PerformanceRowData }) => {
  const { t } = useLang();
  const fp = t.bigDialogs.farmsPerformance;
  const [isExpanded, setIsExpanded] = React.useState(false);

  const isInProgress = data.type === "in-progress";
  const isPendingStart = Boolean(data.isPendingStart);
  const isMiner = data.type === "miner";
  const isOther = data.type === "other";
  const isUsdRow = isMiner || (isOther && data.isProtocolDepositUsd);
  const inProgressIsMiningCenter =
    data.type === "in-progress" && data.inProgressKind === "mining-center";
  const protocolDepositAssetLabel = formatProtocolDepositAsset(
    data.protocolDepositAsset
  );
  const recoveredLabel = data.isProtocolDepositUsd
    ? `${fmtUsdAmount(data.recovered)} ${protocolDepositAssetLabel}`
    : formatDelegatedAmountsByAsset({
        amounts: data.recoveredAmountsByAsset,
        fallbackAmount: data.recovered,
        fallbackAsset: protocolDepositAssetLabel,
      });
  const totalRewardsLabel = getTotalRewardsLabel(data);
  const delegatedLabel = isMiner
    ? fmtUsd(data.initialCost)
    : formatDelegatedAmountsByAsset({
        amounts: data.delegatedAmountsByAsset,
        fallbackAmount: data.initialCost,
        fallbackAsset: protocolDepositAssetLabel,
      });
  const estimatedWeeklyLabel =
    formatEstimatedWeeklyRewards({
      estimatedUserWeeklyGlw: data.estimatedUserWeeklyGlw,
      estimatedUserWeeklyUsd: data.estimatedUserWeeklyUsd,
      estimatedUserWeeklyPd: data.estimatedUserWeeklyPd,
      estimatedUserWeeklyPdAsset:
        data.estimatedUserWeeklyPdAsset ?? data.protocolDepositAsset,
    }, fp) ?? "—";
  const pendingTimeline = React.useMemo(() => {
    if (!isPendingStart || !data.purchaseDate) return null;
    return buildPendingRewardTimeline({ purchaseDate: data.purchaseDate });
  }, [data.purchaseDate, isPendingStart]);
  const pendingPhaseLabel = pendingTimeline
    ? getPendingPhaseLabel(pendingTimeline.phase, fp)
    : fp.pending;
  const isClaimReadyPending = pendingTimeline?.phase === "claimable";
  const pendingNextMilestone = pendingTimeline
    ? getPendingNextMilestone({
        phase: pendingTimeline.phase,
        epochEndsAtMs: pendingTimeline.epochEndsAtMs,
        auditPostedAtMs: pendingTimeline.auditPostedAtMs,
        claimableAtMs: pendingTimeline.claimableAtMs,
        labels: fp,
      })
    : null;
  const pendingStartsEarningLabel = pendingTimeline
    ? formatRewardPipelineDate(pendingTimeline.epochEndsAtMs, {
        locale: fp.dateLocale,
        month: "short",
        day: "numeric",
      })
    : null;
  const pendingAuditPostedLabel = pendingTimeline
    ? formatRewardPipelineDate(pendingTimeline.auditPostedAtMs, {
        locale: fp.dateLocale,
        month: "short",
        day: "numeric",
      })
    : null;
  const pendingClaimingStartsLabel = pendingTimeline
    ? pendingTimeline.phase === "claimable"
      ? fp.nowLabel
      : formatRewardPipelineDate(pendingTimeline.claimableAtMs, {
          locale: fp.dateLocale,
          month: "short",
          day: "numeric",
          year: "numeric",
        })
    : null;

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
    ? "—"
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
          {pendingPhaseLabel.toUpperCase()}
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
          {fp.inProgress}
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
          {fp.rewardsStatus}
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
        "rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 transition-colors",
        isPendingStart && "border-border/30 dark:border-border/50"
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
                {fp.funding}
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
                {fp.estWeekly}
              </div>
              <div
                className={cn(
                  "text-xs font-mono font-bold tabular-nums",
                  inProgressIsMiningCenter
                    ? "text-[color:var(--color-miner-contrast)]"
                    : "text-delegation-purple dark:text-delegation-purple"
                )}
              >
                {estimatedWeeklyLabel}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-2 grid-cols-2">
              <div className="text-center">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  {isOther ? fp.cost : isMiner ? fp.cost : fp.delegated}
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  {isOther ? (
                    <span className="text-sm font-bold font-mono text-muted-foreground tabular-nums">
                      —
                    </span>
                  ) : (
                    <>
                      <span className="text-sm font-bold font-mono text-foreground tabular-nums">
                        {delegatedLabel}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  {isPendingStart && data.estimatedUserWeeklyGlw
                    ? isClaimReadyPending
                      ? fp.rewards
                      : fp.estWeekly
                    : fp.earned}
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
                      ? isClaimReadyPending
                        ? fp.readyToClaim
                        : estimatedWeeklyLabel
                      : isMiner
                      ? fmtGlw(totalEarnedGlw)
                      : getTotalRewardsLabel(data)}
                  </span>
                </div>
              </div>
            </div>

            {isPendingStart && pendingTimeline ? (
              <div className="mt-4 rounded-xl border border-border/20 dark:border-border/40 bg-card/70 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {fp.startsEarning}
                    </div>
                    <div className="text-sm font-semibold text-foreground mt-1">
                      {pendingStartsEarningLabel}
                    </div>
                  </div>
                  {pendingNextMilestone ? (
                    <div className="text-right">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {fp.nextStep}
                      </div>
                      <div className="text-sm font-semibold text-foreground mt-1">
                        {pendingNextMilestone.date}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-2">
                  <span>
                    {fp.weeksProgress(data.weeksActive, data.totalWeeks)}
                  </span>
                  <span>{fp.weeksLeft(weeksRemaining)}</span>
                </div>
                <div className="relative w-full h-3 bg-muted/70 dark:bg-muted rounded-full overflow-hidden border border-border/30 dark:border-border/40">
                  <div
                    className="absolute left-0 h-full bg-foreground/20"
                    style={{ width: `${timePercent}%` }}
                  />
                </div>
              </div>
            )}

            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-border/30 dark:border-border/40 space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {isPendingStart ? fp.rewardPipeline : fp.breakdown}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-mono">
                  {!isMiner && !isPendingStart && (
                    <>
                      <span className="text-muted-foreground">
                        {fp.pdRecovered}
                      </span>
                      <span
                        className={cn(
                          "text-right",
                          "text-delegation-purple dark:text-delegation-purple"
                        )}
                      >
                        {recoveredLabel}
                      </span>
                    </>
                  )}
                  {isPendingStart ? (
                    <>
                      <span className="text-muted-foreground">
                        {isMiner ? fp.cost : fp.delegated}
                      </span>
                      <span className="text-right text-foreground">
                        {isMiner ? fmtUsd(data.initialCost) : delegatedLabel}
                      </span>
                      <span className="text-muted-foreground">
                        {isClaimReadyPending ? fp.rewards : fp.estWeeklyLower}
                      </span>
                      <span className="text-right text-[color:var(--color-miner-contrast)]">
                        {isClaimReadyPending ? fp.readyToClaim : estimatedWeeklyLabel}
                      </span>
                      <div className="col-span-2 h-px bg-border/30 dark:bg-border/40" />
                      <span className="text-muted-foreground">
                        {fp.rewardsStart}
                      </span>
                      <span className="text-right text-foreground">
                        {pendingStartsEarningLabel ?? "—"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground">
                        {fp.emissions}
                      </span>
                      <span className="text-right text-[color:var(--color-miner-contrast)]">
                        +{fmtGlw(data.inflationGlw)} GLW
                      </span>
                      <div className="col-span-2 h-px bg-border/30 dark:bg-border/40" />
                      <span className="text-muted-foreground font-bold">
                        {fp.total}
                      </span>
                      <span className="text-right font-bold text-foreground">
                        {isMiner ? fmtUsd(totalEarned) : totalRewardsLabel ?? "—"}
                      </span>
                    </>
                  )}
                </div>
                {isPendingStart && pendingTimeline ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-mono mt-3">
                    <span className="text-muted-foreground">
                      {fp.weekCloses}
                    </span>
                    <span className="text-right text-foreground">
                      {pendingStartsEarningLabel}
                    </span>
                    <span className="text-muted-foreground">
                      {fp.auditedPosted}
                    </span>
                    <span className="text-right text-foreground">
                      {pendingAuditPostedLabel ?? "—"}
                    </span>
                    <span className="text-muted-foreground">
                      {fp.firstFundsAvailable}
                    </span>
                    <span className="flex items-center justify-end gap-1 text-right text-foreground">
                      <FirstFundsInfo labels={fp} />
                      <span>{pendingClaimingStartsLabel ?? "—"}</span>
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-mono mt-3">
                    <span className="text-muted-foreground">
                      {fp.timeProgress}
                    </span>
                    <span className="text-right text-foreground">
                      {timePercent.toFixed(0)}%
                    </span>
                    {!isMiner && (
                      <>
                        <span className="text-muted-foreground">
                          {fp.valueProgress}
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
                )}
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
                  fp.percentFilled(Math.round(data.inProgressPercent ?? 0))}
              </div>
            ) : isPendingStart && pendingTimeline ? (
              <div className="space-y-1">
                <div className="text-xs font-mono text-muted-foreground">
                  {fp.startsEarningOn(pendingStartsEarningLabel)}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground/80">
                  {fp.firstFundsAvailableOn(pendingClaimingStartsLabel)}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1.5">
                  <span>
                    {fp.weeksProgressShort(data.weeksActive, data.totalWeeks)}
                  </span>
                  <span>{fp.weeksLeft(weeksRemaining)}</span>
                </div>
                <div className="relative w-full h-2.5 bg-muted/70 dark:bg-muted rounded-full overflow-hidden border border-border/30 dark:border-border/40">
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
                    {fp.funding}
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
                    {estimatedWeeklyLabel}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center min-w-[70px]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                    {isOther ? fp.cost : isMiner ? fp.cost : fp.delegated}
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    {isOther ? (
                      <span className="text-lg font-bold font-mono text-muted-foreground tabular-nums leading-tight">
                        —
                      </span>
                    ) : (
                      <>
                          <span className="text-lg font-bold font-mono text-foreground tabular-nums leading-tight">
                            {delegatedLabel}
                          </span>
                        </>
                      )}
                  </div>
                </div>
                <div className="text-center min-w-[70px]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                    {isPendingStart && data.estimatedUserWeeklyGlw
                      ? fp.estWeekly
                      : fp.earned}
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
                        ? estimatedWeeklyLabel
                        : isMiner
                        ? fmtGlw(totalEarnedGlw)
                        : getTotalRewardsLabel(data)}
                    </span>
                  </div>
                </div>
                <div className="text-center min-w-[70px]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                    {fp.lastWeek}
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
            <div className="rounded-xl border border-border/20 dark:border-border/40 bg-card p-4">
              <div className="grid grid-cols-2 gap-6">
                {/* LEFT: BREAKDOWN */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
                    {isPendingStart ? fp.rewardPipeline : fp.breakdown}
                  </div>
                  <div className="space-y-2 text-sm font-mono">
                    {!isOther && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {isMiner ? fp.cost : fp.delegated}
                        </span>
                        <span className="text-foreground">
                          {isMiner
                            ? fmtUsd(data.initialCost)
                            : delegatedLabel}
                        </span>
                      </div>
                    )}
                    {!isMiner && !isPendingStart && (
                      <div className="flex justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-delegation-purple dark:bg-delegation-purple" />
                          <span className="text-muted-foreground">
                            {isOther
                              ? `PD (${data.protocolDepositAsset ?? "—"})`
                              : fp.recovered}
                          </span>
                        </div>
                        <span className="text-delegation-purple dark:text-delegation-purple">
                          {recoveredLabel}
                        </span>
                      </div>
                    )}
                    {isPendingStart ? (
                      <div className="flex justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[color:var(--color-miner)]" />
                          <span className="text-muted-foreground">
                            {fp.estWeekly}
                          </span>
                        </div>
                        <span className="text-[color:var(--color-miner-contrast)]">
                          {estimatedWeeklyLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[color:var(--color-miner)]" />
                          <span className="text-muted-foreground">
                            {fp.emissions}
                          </span>
                        </div>
                        <span className="text-[color:var(--color-miner-contrast)]">
                          +{fmtGlw(data.inflationGlw)} GLW
                        </span>
                      </div>
                    )}
                    <div className="h-px bg-border/30 dark:bg-border/40 my-2" />
                    {isPendingStart ? (
                      <div className="flex justify-between font-bold">
                        <span className="text-muted-foreground">
                          {fp.rewardsStart}
                        </span>
                        <span className="text-foreground">
                          {pendingStartsEarningLabel ?? "—"}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between font-bold">
                        <span className="text-muted-foreground">
                          {fp.total}
                        </span>
                        <span className="text-foreground">
                          {isMiner ? fmtUsd(totalEarned) : totalRewardsLabel ?? "—"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT: TIMELINE */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
                    {fp.timeline}
                  </div>
                  <div className="space-y-2 text-sm font-mono">
                    {isPendingStart && pendingTimeline ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {fp.currentPhase}
                          </span>
                          <span className="text-foreground">
                            {pendingPhaseLabel}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {fp.weekCloses}
                          </span>
                          <span className="text-foreground">
                            {pendingStartsEarningLabel ?? "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {fp.auditedPosted}
                          </span>
                          <span className="text-foreground">
                            {pendingAuditPostedLabel ?? "—"}
                          </span>
                        </div>
                        <div className="h-px bg-border/30 dark:bg-border/40 my-2" />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {fp.firstFundsAvailable}
                          </span>
                          <span className="flex items-center gap-1 text-foreground">
                            <FirstFundsInfo labels={fp} />
                            <span>{pendingClaimingStartsLabel ?? "—"}</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {fp.week}
                          </span>
                          <span className="text-foreground">
                            {fp.weekOf(data.weeksActive, data.totalWeeks)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {fp.timeProgress}
                          </span>
                          <span className="text-foreground">
                            {timePercent.toFixed(1)}%
                          </span>
                        </div>
                        {!isMiner && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {fp.valueProgress}
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
                        <div className="h-px bg-border/30 dark:bg-border/40 my-2" />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {fp.remaining}
                          </span>
                          <span className="text-foreground">
                            {fp.remainingWeeks(weeksRemaining)}
                          </span>
                        </div>
                      </>
                    )}
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
  const { t } = useLang();
  const fp = t.bigDialogs.farmsPerformance;
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

  const {
    sponsorListings,
    sponsorListingById,
    sponsorshipsInProgress,
    sponsorshipsInProgressWithEstimates,
    currentLaunchpadCurrencyByFarmId,
    launchpadCurrenciesByFarmId,
    launchpadDelegatedAmountsByFarmId,
    isSponsorListingsLoading,
    isSponsorListingsError,
    isRewardScoresLoading,
    isRewardScoresError,
    isSgctlRewardScoresLoading,
  } = useWalletLaunchpadInProgress({
    splitsActivity,
    walletAddress: walletAddress ?? null,
    enabled: shouldLoadInProgress,
  });

  const farmNameByFarmId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const evt of splitsActivity) {
      const listing = sponsorListingById.get(evt.applicationId);
      const farmId =
        evt.fractionType === "launchpad"
          ? resolveLaunchpadActivityFarmId({
              applicationId: evt.applicationId,
              activityFarmId: evt.farmId,
              listingFarmId: listing?.farmId,
            })
          : evt.farmId;
      const farmName = evt.farmName;
      if (!farmId) continue;
      if (!farmName) continue;
      if (!map.has(farmId)) map.set(farmId, farmName);
    }
    return map;
  }, [splitsActivity, sponsorListingById]);

  const hasMiningCenterSplits = React.useMemo(() => {
    return splitsActivity.some((s) => s.fractionType === "mining-center");
  }, [splitsActivity]);

  const {
    applications: miningCenterListings,
    isLoading: isMiningCenterListingsLoading,
    isError: isMiningCenterListingsError,
  } = useMiningCenter({
    filters: { paymentCurrency: "USDC", includeFilled: true },
    enabled: shouldLoadInProgress && hasMiningCenterSplits,
  });

  const { applications: visibleLaunchpadApplications } = useGlowLaunchpad({
    enabled: shouldLoadInProgress && hasMiningCenterSplits,
  });

  const extraLiveLaunchpadApplications = React.useMemo(
    () => filterPublicLaunchpadApplications(visibleLaunchpadApplications),
    [visibleLaunchpadApplications],
  );

  const miningCenterInProgress = React.useMemo(() => {
    return deriveMiningCenterSponsorshipsInProgress({
      splitsActivity,
      sponsorListings: miningCenterListings,
    });
  }, [miningCenterListings, splitsActivity]);

  const miningCenterListingById = React.useMemo(() => {
    const map = new Map<string, (typeof miningCenterListings)[number]>();
    for (const app of miningCenterListings) {
      map.set(app.id, app);
    }
    return map;
  }, [miningCenterListings]);

  const miningCenterAppsForScores = React.useMemo(() => {
    const apps = new Map<string, (typeof miningCenterListings)[number]>();

    for (const item of miningCenterInProgress) {
      if (item.application) {
        apps.set(item.application.id, item.application);
      }
    }

    for (const evt of splitsActivity) {
      if (evt.fractionType !== "mining-center") continue;
      const app = miningCenterListingById.get(evt.applicationId);
      if (!app) continue;
      apps.set(app.id, app);
    }

    return Array.from(apps.values());
  }, [miningCenterInProgress, miningCenterListingById, splitsActivity]);

  const {
    miningScoreMap,
    isLoading: isMiningScoresLoading,
    isError: isMiningScoresError,
  } = useMiningScore({
    applications: miningCenterAppsForScores,
    extraLiveApplications: extraLiveLaunchpadApplications,
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
      isSgctlRewardScoresLoading ||
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
          return region?.name || fp.regionFallback(farmMetadata.regionId);
        })();

        const displayName =
          farmMetadata?.name ||
          farmNameByFarmId.get(farm.farmId) ||
          fp.farmFallback(farm.farmId.substring(0, 8));

        if (farm.type === "launchpad") {
          const protocolDepositAsset = formatProtocolDepositAsset(
            farmMetadata?.userWeeklyRewards?.protocolDepositAsset ?? "GLW"
          );
          const initialCost = parseProtocolDepositTokenAmount(
            farm.amountInvested,
            protocolDepositAsset
          );
          const recoveredAmountsByAsset = parseRecoveredAmountsByAsset(
            farm.totalProtocolDepositRewardsByAsset
          );
          const recovered =
            recoveredAmountsByAsset && hasAnyAssetAmount(recoveredAmountsByAsset)
              ? recoveredAmountsByAsset[protocolDepositAsset as "GLW" | "SGCTL"] ?? 0
              : parseProtocolDepositTokenAmount(
                  farm.totalProtocolDepositRewards,
                  protocolDepositAsset
                );
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
            protocolDepositAsset,
            isProtocolDepositUsd: false,
            weeksActive: farm.totalWeeksEarned,
            totalWeeks: 100,
            delegatedAmountsByAsset:
              launchpadDelegatedAmountsByFarmId.get(farm.farmId),
            recoveredAmountsByAsset,
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
        farm.farmName || fp.farmFallback(farm.farmId.substring(0, 8));
      const identityDetail = farm.asset ?? "—";

      const isProtocolDepositUsd = farm.asset === "USDG" || farm.asset === "USDC";
      const recovered = isProtocolDepositUsd
        ? parsePdRewardsUsd({
            value: farm.totalProtocolDepositRewards,
            asset: farm.asset,
          })
        : parseProtocolDepositTokenAmount(
            farm.totalProtocolDepositRewards,
            farm.asset
          );
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
    fp,
    farmNameByFarmId,
    launchpadDelegatedAmountsByFarmId,
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

  // Mirror of my-farms-grid-section: when the rewards-breakdown's
  // amountInvested for a mining-center farm already covers the wallet's
  // total mining-center splits on it, the rewarded row represents the
  // whole position. A parallel pending row would duplicate it and would
  // estimate its weekly GLW from the *current* listing's per-step price
  // (which has no relation to the fraction the wallet actually bought).
  const fullyAccountedMiningCenterFarmIds = React.useMemo(() => {
    const accounted = new Set<string>();
    if (!rewardsBreakdown) return accounted;
    const splitSumByFarmId = new Map<string, bigint>();
    for (const evt of splitsActivity) {
      if (evt.fractionType !== "mining-center") continue;
      if (!evt.farmId) continue;
      try {
        const amount = BigInt(evt.amount ?? "0");
        splitSumByFarmId.set(
          evt.farmId,
          (splitSumByFarmId.get(evt.farmId) ?? 0n) + amount,
        );
      } catch {
        // Skip splits with unparseable amounts.
      }
    }
    for (const farm of rewardsBreakdown.farmDetails) {
      if (farm.type !== "mining-center") continue;
      try {
        const invested = BigInt(farm.amountInvested ?? "0");
        const splitSum = splitSumByFarmId.get(farm.farmId) ?? 0n;
        if (splitSum > 0n && invested >= splitSum) {
          accounted.add(farm.farmId);
        }
      } catch {
        // Skip farms with unparseable amountInvested.
      }
    }
    return accounted;
  }, [rewardsBreakdown, splitsActivity]);

  const pendingStartRows = React.useMemo<PerformanceRowData[]>(() => {
    if (!splitsActivity.length) return [];

    const byFarm = new Map<
      string,
      {
        farmId: string;
        applicationId: string;
        farmName: string;
        purchaseDate: string | null;
        fractionType: "launchpad" | "mining-center";
        launchpadCurrency?: "GLW" | "SGCTL";
        totalAmount: bigint;
        totalStepsPurchased: number;
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

      const listing = sponsorListingById.get(evt.applicationId);
      const farmId =
        fractionType === "launchpad"
          ? resolveLaunchpadActivityFarmId({
              applicationId: evt.applicationId,
              activityFarmId: evt.farmId,
              listingFarmId: listing?.farmId,
            })
          : evt.farmId ?? evt.applicationId;
      if (!farmId) continue;
      const farmTypeKey = `${farmId}:${fractionType}`;

      const launchpadCurrency =
        fractionType === "launchpad"
          ? resolveLaunchpadSplitCurrency({
              currency: evt.currency,
              amount: evt.amount,
              stepPrice: evt.stepPrice,
              transactionHash: evt.transactionHash,
              listingCurrency: currentLaunchpadCurrencyByFarmId.get(farmId),
            })
          : undefined;

      if (rewardedFarmTypeKeys.has(farmTypeKey)) {
        if (fractionType !== "launchpad") {
          // If the rewarded row's amountInvested already covers every
          // mining-center dollar this wallet has on the farm, skip the
          // pending row entirely — the rewarded row represents the full
          // position end-to-end.
          if (fullyAccountedMiningCenterFarmIds.has(farmId)) continue;
          const phase = evt.purchaseDate
            ? buildPendingRewardTimeline({ purchaseDate: evt.purchaseDate }).phase
            : null;
          if (phase === "claimable") continue;
        } else {
          const currencies = launchpadCurrenciesByFarmId.get(farmId);
          const hasMultipleLaunchpadCurrencies = (currencies?.size ?? 0) > 1;
          const currentLaunchpadCurrency = currentLaunchpadCurrencyByFarmId.get(farmId);

          if (
            !hasMultipleLaunchpadCurrencies ||
            !launchpadCurrency ||
            !currentLaunchpadCurrency ||
            launchpadCurrency !== currentLaunchpadCurrency
          ) {
            continue;
          }
        }
      }

      let amount = BigInt(0);
      try {
        amount = BigInt(evt.amount);
      } catch {
        amount = BigInt(0);
      }

      const pendingKey = launchpadCurrency
        ? `${farmTypeKey}:${launchpadCurrency}`
        : farmTypeKey;

      const existing = byFarm.get(pendingKey) ?? {
        farmId,
        applicationId: evt.applicationId,
        farmName: evt.farmName || fp.farmFallback(farmId.substring(0, 8)),
        purchaseDate: evt.purchaseDate ?? null,
        fractionType,
        launchpadCurrency,
        totalAmount: BigInt(0),
        totalStepsPurchased: 0,
      };
      existing.totalAmount += amount;
      existing.totalStepsPurchased += evt.stepsPurchased ?? 0;
      if (evt.purchaseDate) {
        existing.purchaseDate = evt.purchaseDate;
      }
      byFarm.set(pendingKey, existing);
    }

    return Array.from(byFarm.values()).map((item): PerformanceRowData => {
      const farmData = purchasedFarms.find((f) => f.farmId === item.farmId);

      let estimatedUserWeeklyGlw: number | undefined = undefined;
      let estimatedUserWeeklyPd: number | undefined = undefined;
      let estimatedUserWeeklyPdAsset: string | null | undefined = undefined;
      const pendingMiningScore =
        item.fractionType === "mining-center"
          ? miningScoreMap.get(item.applicationId) ?? null
          : null;
      const hasRewardedMinerRow = rewardedFarmTypeKeys.has(
        `${item.farmId}:mining-center`,
      );
      const canUseCurrentMinerRewardEstimate =
        item.fractionType === "mining-center" &&
        !hasRewardedMinerRow &&
        Boolean(farmData?.userWeeklyRewards?.glwInflationRewardsFromMiner);

      if (canUseCurrentMinerRewardEstimate) {
        // For brand-new miner purchases on farms that do not yet have any
        // settled miner reward history for this wallet, prefer the current
        // wallet-specific split from Control. The marketplace listing's
        // activeFraction can move on to a newer fraction on the same
        // application, which underestimates the owned pending position.
        estimatedUserWeeklyGlw = parseGlwFromWei(
          farmData?.userWeeklyRewards?.glwInflationRewardsFromMiner ?? "0",
        );
      } else if (pendingMiningScore && item.totalStepsPurchased > 0) {
        estimatedUserWeeklyGlw = estimateMiningCenterWeeklyGlw({
          miningScore: pendingMiningScore,
          userSteps: item.totalStepsPurchased,
        });
      } else if (farmData?.userWeeklyRewards) {
        // Use source-specific breakdown if available (prevents double-counting for farms with both delegation + miner)
        const isMiningCenter = item.fractionType === "mining-center";
        const hasMultipleLaunchpadCurrencies =
          (launchpadCurrenciesByFarmId.get(item.farmId)?.size ?? 0) > 1;
        const pdAsset = formatProtocolDepositAsset(
          farmData.userWeeklyRewards.protocolDepositAsset
        );
        const canUsePdForLaunchpadEstimate =
          !hasMultipleLaunchpadCurrencies ||
          item.fractionType !== "launchpad" ||
          pdAsset === "GLW" ||
          pdAsset === item.launchpadCurrency;

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
          const pdGlw =
            canUsePdForLaunchpadEstimate && pdAsset === "GLW"
              ? parseProtocolDepositTokenAmount(
                  farmData.userWeeklyRewards.protocolDepositRewards,
                  pdAsset
                )
              : 0;
          const pdAmount = canUsePdForLaunchpadEstimate
            ? parseProtocolDepositTokenAmount(
                farmData.userWeeklyRewards.protocolDepositRewards,
                pdAsset
              )
            : 0;
          if (canUsePdForLaunchpadEstimate && pdAsset !== "GLW" && pdAmount > 0) {
            estimatedUserWeeklyPd = pdAmount;
            estimatedUserWeeklyPdAsset = pdAsset;
          }
          estimatedUserWeeklyGlw = delegationInflationGlw + pdGlw;
        } else {
          // Fallback for old API response (no breakdown fields)
          const inflationGlw = parseGlwFromWei(
            farmData.userWeeklyRewards.glwInflationRewards
          );
          const pdAmount = canUsePdForLaunchpadEstimate
            ? parseProtocolDepositTokenAmount(
                farmData.userWeeklyRewards.protocolDepositRewards,
                pdAsset
              )
            : 0;
          const pdGlw = pdAsset === "GLW" ? pdAmount : 0;
          if (canUsePdForLaunchpadEstimate && pdAsset !== "GLW" && pdAmount > 0) {
            estimatedUserWeeklyPd = pdAmount;
            estimatedUserWeeklyPdAsset = pdAsset;
          }
          estimatedUserWeeklyGlw = inflationGlw + pdGlw;
        }
      }

      if (item.fractionType === "launchpad") {
        const launchpadApp = sponsorListingById.get(item.applicationId);
        const regionName =
          (() => {
            if (farmData) {
              const region = regions.find((r) => r.id === farmData.regionId);
              if (region?.name) return region.name;
            }
            return launchpadApp?.zone?.name || fp.launchpadLabel;
          })();
        const launchpadCurrency =
          item.launchpadCurrency ?? resolveDelegationCurrency(launchpadApp);
        const investedDelegationAmount = parseDelegationAmountFromBaseUnits(
          item.totalAmount.toString(),
          launchpadCurrency
        );
        return {
          farmId: item.farmId,
          id: item.farmName,
          region: regionName,
          type: "delegation",
          isPendingStart: true,
          purchaseDate: item.purchaseDate,
          initialCost: investedDelegationAmount,
          recovered: 0,
          inflation: 0,
          inflationGlw: 0,
          protocolDepositAsset: launchpadCurrency,
          isProtocolDepositUsd: false,
          weeksActive: 0,
          totalWeeks: 100,
          lastWeekRewardsGlw: 0,
          estimatedUserWeeklyGlw,
          estimatedUserWeeklyPd,
          estimatedUserWeeklyPdAsset,
          delegatedAmountsByAsset:
            launchpadDelegatedAmountsByFarmId.get(item.farmId),
        };
      }

      const miningCenterApp = miningCenterListingById.get(item.applicationId);
      const regionName =
        (() => {
          if (farmData) {
            const region = regions.find((r) => r.id === farmData.regionId);
            if (region?.name) return region.name;
          }
          return miningCenterApp?.zone?.name || fp.minerLabel;
        })();
      const investedUsd = parseUsdcFromBaseUnits(item.totalAmount.toString());
      return {
        farmId: item.farmId,
        id: item.farmName,
        region: regionName,
        type: "miner",
        isPendingStart: true,
        purchaseDate: item.purchaseDate,
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
  }, [
    fp,
    launchpadDelegatedAmountsByFarmId,
    regions,
    purchasedFarms,
    rewardedFarmTypeKeys,
    fullyAccountedMiningCenterFarmIds,
    splitsActivity,
    sponsorListingById,
    launchpadCurrenciesByFarmId,
    currentLaunchpadCurrencyByFarmId,
    miningCenterListingById,
    miningScoreMap,
  ]);

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

    const rowsByKey = new Map<string, PerformanceRowData>();

    combined.forEach((item) => {
      const app = item.application;
      const zoneName = app?.zone?.name || fp.launchpadLabel;
      const delegationCurrency =
        item.fractionType === "launchpad"
          ? item.delegationCurrency ?? resolveDelegationCurrency(app)
          : "GLW";
      const filledLabel = formatInProgressFilledLabel({
        application: app,
        fractionType: item.fractionType,
        labels: fp,
      });

      const displayName =
        app?.farmName || fp.farmFallback(item.applicationId.substring(0, 8));
      const rowFarmId = app?.farmId ?? item.applicationId;
      const rowKey =
        item.fractionType === "launchpad"
          ? `${rowFarmId}:in-progress:${item.fractionType}`
          : `${item.applicationId}:in-progress:${item.fractionType}`;

      const baseRow: PerformanceRowData = {
        farmId: rowFarmId,
        id: displayName,
        region: zoneName,
        type: "in-progress",
        initialCost: 0,
        recovered: 0,
        inflation: 0,
        inflationGlw: 0,
        lastWeekRewardsGlw: 0,
        protocolDepositAsset:
          item.fractionType === "launchpad"
            ? resolveDelegationCurrency(app)
            : "USDC",
        isProtocolDepositUsd: false,
        weeksActive: 0,
        totalWeeks: 1,
        inProgressPercent: item.progressPercent ?? 0,
        inProgressFilledLabel: filledLabel,
        inProgressUserSteps: item.userSteps,
        estimatedUserWeeklyGlw: item.estimatedUserWeeklyGlw ?? 0,
        estimatedUserWeeklyUsd: item.estimatedUserWeeklyUsd ?? 0,
        estimatedUserWeeklyPd:
          item.fractionType === "launchpad"
            ? item.estimatedUserWeeklyPd ?? 0
            : 0,
        estimatedUserWeeklyPdAsset:
          item.fractionType === "launchpad"
            ? item.estimatedUserWeeklyPdAsset ?? null
            : null,
        delegatedAmountsByAsset:
          item.fractionType === "launchpad"
            ? launchpadDelegatedAmountsByFarmId.get(rowFarmId)
            : undefined,
        inProgressKind: item.fractionType,
      };

      const existing = rowsByKey.get(rowKey);
      if (!existing) {
        rowsByKey.set(rowKey, baseRow);
        return;
      }

      existing.inProgressPercent = Math.max(
        existing.inProgressPercent ?? 0,
        baseRow.inProgressPercent ?? 0
      );
      existing.inProgressUserSteps =
        (existing.inProgressUserSteps ?? 0) + (baseRow.inProgressUserSteps ?? 0);
      existing.estimatedUserWeeklyGlw =
        (existing.estimatedUserWeeklyGlw ?? 0) +
        (baseRow.estimatedUserWeeklyGlw ?? 0);
      existing.estimatedUserWeeklyUsd =
        (existing.estimatedUserWeeklyUsd ?? 0) +
        (baseRow.estimatedUserWeeklyUsd ?? 0);
      existing.delegatedAmountsByAsset =
        item.fractionType === "launchpad"
          ? launchpadDelegatedAmountsByFarmId.get(rowFarmId)
          : existing.delegatedAmountsByAsset;

      const existingPdAsset = existing.estimatedUserWeeklyPdAsset ?? null;
      const basePdAsset = baseRow.estimatedUserWeeklyPdAsset ?? null;
      const canMergePdEstimate =
        !existingPdAsset ||
        !basePdAsset ||
        existingPdAsset === basePdAsset;

      if (!canMergePdEstimate) {
        existing.estimatedUserWeeklyUsd = 0;
        existing.estimatedUserWeeklyPd = 0;
        existing.estimatedUserWeeklyPdAsset = null;
      } else {
        existing.estimatedUserWeeklyPd =
          (existing.estimatedUserWeeklyPd ?? 0) +
          (baseRow.estimatedUserWeeklyPd ?? 0);
        existing.estimatedUserWeeklyPdAsset =
          existingPdAsset ?? basePdAsset;
      }
    });

    return Array.from(rowsByKey.values());
  }, [
    fp,
    launchpadDelegatedAmountsByFarmId,
    miningCenterInProgressWithEstimates,
    sponsorshipsInProgressWithEstimates,
  ]);

  const visibleRowsWithInProgress = React.useMemo(() => {
    if (filter === "in-progress") return inProgressRows;
    if (filter === "all")
      return [...pendingStartRows, ...inProgressRows, ...visibleRows];
    if (filter === "miners")
      return [
        ...pendingStartRows.filter(
          (r) => r.type === "miner" && r.isProtocolDepositUsd
        ),
        ...inProgressRows.filter((r) => r.inProgressKind === "mining-center"),
        ...visibleRows.filter((r) => r.type === "miner"),
      ];
    if (filter === "delegations")
      return [
        ...pendingStartRows.filter(
          (r) => r.type === "delegation" && !r.isProtocolDepositUsd
        ),
        ...inProgressRows.filter((r) => r.inProgressKind === "launchpad"),
        ...visibleRows.filter((r) => r.type === "delegation"),
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
    <DialogContent className="max-w-5xl h-[92dvh] sm:h-[80vh] min-h-0 flex flex-col p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40">
      {/* Header */}
      <DialogHeader className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 flex-shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 space-y-0">
        <DialogTitle className="text-xl sm:text-2xl font-bold font-mono uppercase tracking-wide leading-tight">
          {fp.farmPerformance}
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
          <TabsList className="w-full sm:w-auto bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 h-10 sm:h-12 p-1 overflow-x-auto">
            <TabsTrigger
              value="all"
              className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-[#ffb472] data-[state=active]:bg-[#ffb472]/12 data-[state=active]:border data-[state=active]:border-[#ffb472]"
            >
              {fp.all}
            </TabsTrigger>
            {tabCounts.miners > 0 || filter === "miners" ? (
              <TabsTrigger
                value="miners"
                className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-[color:var(--color-miner)] data-[state=active]:bg-[color:var(--color-miner)]/12 data-[state=active]:border data-[state=active]:border-[color:var(--color-miner)]"
              >
                {fp.miners}
              </TabsTrigger>
            ) : null}
            {tabCounts.delegations > 0 || filter === "delegations" ? (
              <TabsTrigger
                value="delegations"
                className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-delegation-purple data-[state=active]:bg-delegation-purple/12 data-[state=active]:border data-[state=active]:border-delegation-purple"
              >
                {fp.delegations}
              </TabsTrigger>
            ) : null}
            {tabCounts.other > 0 || filter === "other" ? (
              <TabsTrigger
                value="other"
                className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-emerald-700 dark:data-[state=active]:text-[color:var(--color-glow-green)] data-[state=active]:bg-[color:var(--color-glow-green)]/10 data-[state=active]:border data-[state=active]:border-[color:var(--color-glow-green)]"
              >
                {fp.other}
              </TabsTrigger>
            ) : null}
            {tabCounts.inProgress > 0 || filter === "in-progress" ? (
              <TabsTrigger
                value="in-progress"
                className="h-8 sm:h-7 text-xs font-mono px-3 sm:px-4 text-muted-foreground data-[state=active]:text-delegation-purple data-[state=active]:bg-delegation-purple/12 data-[state=active]:border data-[state=active]:border-delegation-purple"
              >
                {fp.inProgress}
              </TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>
      </DialogHeader>

      {/* Legend / Columns */}
      <div className="hidden sm:grid grid-cols-12 px-6 py-3 border-b border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 text-xs font-mono uppercase text-muted-foreground tracking-wider flex-shrink-0 gap-4">
        <div className="col-span-3">{fp.identity}</div>
        <div className="col-span-3 px-2">{fp.lifecycle}</div>
        <div className="col-span-4 text-center">{fp.keyMetrics}</div>
        <div className="col-span-2 text-right">{fp.progress}</div>
      </div>

      {/* Scrollable List */}
      <ScrollArea className="flex-1 min-h-0">
        <TooltipProvider delayDuration={0}>
          <div className="p-4 sm:p-6 space-y-3 pb-12 min-h-0">
            {!hasWallet ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {fp.connectWalletPrompt}
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
                    ? fp.unableToLoadInProgress
                    : fp.unableToLoadFarms}
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
                    {fp.retry}
                  </Button>
                ) : null}
              </div>
            ) : visibleRowsWithInProgress.length === 0 ? (
              <div className="py-16 text-center text-xs font-mono text-muted-foreground uppercase tracking-wider">
                {filter === "in-progress"
                  ? fp.noInProgressFound
                  : fp.noFarmsFound}
              </div>
            ) : (
              <>
                {(filter === "miners" ||
                  (filter === "other" &&
                    visibleRows.some((r) => r.isProtocolDepositUsd))) &&
                  !isSpotPriceLoading &&
                  (!Number.isFinite(glwSpotPriceUsd ?? NaN) ||
                    (glwSpotPriceUsd ?? 0) <= 0) && (
                    <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                      {fp.roiRequiresSpotPrice}
                    </div>
                  )}
                {visibleRowsWithInProgress.map((row, index) => (
                  <FarmPerformanceRow
                    key={`${row.type}-${row.farmId}-${row.protocolDepositAsset ?? "x"}-${row.isPendingStart ? "p" : row.inProgressKind ?? "r"}-${index}`}
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
  const { t } = useLang();
  const fp = t.bigDialogs.farmsPerformance;
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <Card className="h-full max-h-[400px] flex flex-col overflow-hidden bg-card border border-border/20 dark:border-border/40">
        <CardHeader className="pb-2 border-b border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="tracking-tight text-sm font-bold text-foreground uppercase font-mono">
                {fp.glowMining}
              </CardTitle>
              <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground font-mono">
                {fp.last10Weeks}
              </span>
            </div>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
              >
                <LayoutGrid className="w-3 h-3" />
                {fp.viewDetails}
              </Button>
            </DialogTrigger>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 p-6 flex flex-col gap-6">
          <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-xs">
            {fp.chartViewComponent}
          </div>
        </CardContent>
      </Card>

      <FarmsPerformanceDialogContent walletAddress={walletAddress} />
    </Dialog>
  );
}
