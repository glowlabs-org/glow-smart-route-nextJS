"use client";

import React from "react";
import {
  Gift,
  ChevronRight,
  Clock,
  X,
  HelpCircle,
  LayoutGrid,
  Grid3x3,
  List,
  Image as ImageIcon,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/utils";
import {
  CashMinerIcon,
  DelegationIcon,
  VaultIcon,
  EmissionsIcon,
} from "@/components/impact-icons";
import { formatUnits } from "viem";
import { trackEvent } from "@/lib/telemetry";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FallbackImage } from "@/components/ui/fallback-image";
import { GlowSymbol } from "@/components/glow-symbol";

import {
  useGlowLaunchpad,
  useRewardsBreakdown,
  useWalletFarms,
  useWalletFarmsAtWeek,
  useRegions,
  useSplitsActivity,
  useMiningCenter,
  useEvergreenMiners,
  useMiningScore,
} from "@/hooks";
import { getCurrentEpoch, dateToEpoch } from "@/utils/getCurrentEpoch";
import { useWalletLaunchpadInProgress } from "@/hooks/use-wallet-launchpad-in-progress";
import { useShopMinerHoldings } from "@/hooks/v2-shop-miner";
import { useQuery } from "@tanstack/react-query";
import { getRegionRouter } from "@/lib/api/control-routers";
import type { SponsoredFarm } from "@glowlabs-org/utils/browser";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import {
  attachEstimatedWeeklyMiningCenterRewards,
  deriveMiningCenterSponsorshipsInProgress,
  estimateMiningCenterWeeklyGlw,
} from "@/utils/sponsorships-in-progress";
import {
  normalizeDelegationCurrency,
  parseDelegationAmountFromBaseUnits,
  resolveDelegationCurrency,
} from "@/utils/launchpad-rewards";
import { filterPublicLaunchpadApplications } from "@/utils/launchpad";
import {
  isSplitActivityStillActive,
  resolveLaunchpadActivityFarmId,
  resolveLaunchpadSplitCurrency,
  type DelegationAmountsByAsset,
} from "@/utils/wallet-launchpad";
import { shouldIncludePendingStartCard } from "@/utils/pending-start-cards";
import {
  buildPendingRewardTimeline,
  formatRewardPipelineDate,
  type PendingRewardPipelinePhase,
} from "@/utils/reward-pipeline";
import { useLang, type Strings } from "@/lib/i18n";

type MyFarmsLabels = Strings["widgets"]["myFarms"];

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

  const is6Decimals = asset === "USDG" || asset === "USDC";
  return num / (is6Decimals ? 1e6 : 1e18);
}

function formatProtocolDepositAsset(asset: string | null | undefined): string {
  if (!asset) return "GLW";
  const normalized = asset.toUpperCase();
  if (normalized === "GCTL") return "SGCTL";
  return normalized;
}

function parseProtocolDepositTokenAmount(
  value: string,
  asset: string | null | undefined
): number {
  const delegationCurrency = normalizeDelegationCurrency(asset);
  return parseDelegationAmountFromBaseUnits(value, delegationCurrency);
}

type WeeklyBreakdownRow = {
  weekNumber: number;
  inflationRewards: string;
  protocolDepositRewards: string;
  protocolDepositAsset?: string | null;
  protocolDepositRewardsByAsset?: Record<string, string>;
  totalRewards: string;
};

function parseBigIntSafe(value: string | number | bigint | null | undefined): bigint {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return BigInt(Math.trunc(value));
    }
    if (typeof value === "string" && value.trim() !== "") {
      return BigInt(value);
    }
  } catch {}
  return BigInt(0);
}

function getWeeklyProtocolDepositByAsset(params: {
  week: WeeklyBreakdownRow;
  fallbackAsset: string | null | undefined;
}): Map<string, bigint> {
  const byAsset = new Map<string, bigint>();
  const explicit = params.week.protocolDepositRewardsByAsset;
  if (explicit && Object.keys(explicit).length > 0) {
    for (const [asset, amount] of Object.entries(explicit)) {
      const normalizedAsset = formatProtocolDepositAsset(asset);
      const atomicAmount = parseBigIntSafe(amount);
      if (atomicAmount <= BigInt(0)) continue;
      byAsset.set(normalizedAsset, atomicAmount);
    }
    return byAsset;
  }

  const fallbackAsset = formatProtocolDepositAsset(
    params.week.protocolDepositAsset ?? params.fallbackAsset
  );
  const amount = parseBigIntSafe(params.week.protocolDepositRewards);
  if (amount > BigInt(0)) {
    byAsset.set(fallbackAsset, amount);
  }
  return byAsset;
}

function groupWeeklyBreakdownByWeek(params: {
  weeks: WeeklyBreakdownRow[];
  fallbackAsset: string | null | undefined;
}): Array<{
  weekNumber: number;
  inflationRewards: bigint;
  protocolDepositByAsset: Map<string, bigint>;
  totalRewards: bigint;
}> {
  const grouped = new Map<
    number,
    {
      inflationRewards: bigint;
      protocolDepositByAsset: Map<string, bigint>;
      totalRewards: bigint;
    }
  >();

  for (const week of params.weeks) {
    const existing = grouped.get(week.weekNumber) ?? {
      inflationRewards: BigInt(0),
      protocolDepositByAsset: new Map<string, bigint>(),
      totalRewards: BigInt(0),
    };
    existing.inflationRewards += parseBigIntSafe(week.inflationRewards);
    existing.totalRewards += parseBigIntSafe(week.totalRewards);
    for (const [asset, amount] of getWeeklyProtocolDepositByAsset({
      week,
      fallbackAsset: params.fallbackAsset,
    })) {
      existing.protocolDepositByAsset.set(
        asset,
        (existing.protocolDepositByAsset.get(asset) ?? BigInt(0)) + amount
      );
    }
    grouped.set(week.weekNumber, existing);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekNumber, data]) => ({
      weekNumber,
      inflationRewards: data.inflationRewards,
      protocolDepositByAsset: data.protocolDepositByAsset,
      totalRewards: data.totalRewards,
    }));
}

function sumWeeklyProtocolDepositByAsset(params: {
  weeks: WeeklyBreakdownRow[];
  fallbackAsset: string | null | undefined;
}): Map<string, bigint> {
  const total = new Map<string, bigint>();
  for (const week of params.weeks) {
    for (const [asset, amount] of getWeeklyProtocolDepositByAsset({
      week,
      fallbackAsset: params.fallbackAsset,
    })) {
      total.set(asset, (total.get(asset) ?? BigInt(0)) + amount);
    }
  }
  return total;
}

function getProtocolDepositDisplayEntries(params: {
  byAsset: Map<string, bigint>;
  isProtocolDepositUsd: boolean;
}) {
  return Array.from(params.byAsset.entries())
    .filter(([, amount]) => amount > BigInt(0))
    .sort(([assetA], [assetB]) => {
      if (assetA === "GLW") return -1;
      if (assetB === "GLW") return 1;
      return assetA.localeCompare(assetB);
    })
    .map(([asset, amount]) => {
      const raw = amount.toString();
      const parsed = params.isProtocolDepositUsd
        ? parsePdRewardsUsd({ value: raw, asset })
        : parseProtocolDepositTokenAmount(raw, asset);
      return {
        asset,
        amount: parsed,
        label: params.isProtocolDepositUsd
          ? `${fmtUsdAmount(parsed)} ${asset}`
          : `${formatTokenAmountByAsset(parsed, asset)} ${asset}`,
      };
    });
}

function getCombinedRewardsLabel(params: {
  inflationGlw: number;
  protocolDepositEntries: Array<{ asset: string; amount: number; label: string }>;
  isMiner: boolean;
}): string {
  if (params.isMiner) {
    return `${fmtGlw(params.inflationGlw)} GLW`;
  }

  const glwPd =
    params.protocolDepositEntries.find((entry) => entry.asset === "GLW")?.amount ??
    0;
  const nonGlw = params.protocolDepositEntries.filter(
    (entry) => entry.asset !== "GLW"
  );
  const glwTotal = params.inflationGlw + glwPd;

  if (nonGlw.length === 0) {
    return `${fmtGlw(glwTotal)} GLW`;
  }

  return `${fmtGlw(glwTotal)} GLW + ${nonGlw.map((entry) => entry.label).join(
    " + "
  )}`;
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
}): string | null {
  const {
    estimatedUserWeeklyGlw,
    estimatedUserWeeklyUsd,
    estimatedUserWeeklyPd,
    estimatedUserWeeklyPdAsset,
  } = params;

  const pdAsset = formatProtocolDepositAsset(estimatedUserWeeklyPdAsset);
  if (
    pdAsset !== "GLW" &&
    (estimatedUserWeeklyPd ?? 0) > 0 &&
    Number.isFinite(estimatedUserWeeklyPd)
  ) {
    const parts: string[] = [];
    if ((estimatedUserWeeklyGlw ?? 0) > 0 && Number.isFinite(estimatedUserWeeklyGlw)) {
      parts.push(`${fmtGlw(estimatedUserWeeklyGlw ?? 0)} GLW`);
    }
    parts.push(
      `${formatTokenAmountByAsset(estimatedUserWeeklyPd ?? 0, pdAsset)} ${pdAsset}`
    );
    return `~${parts.join(" + ")}/wk`;
  }

  if ((estimatedUserWeeklyGlw ?? 0) > 0 && Number.isFinite(estimatedUserWeeklyGlw)) {
    return `~${fmtGlw(estimatedUserWeeklyGlw ?? 0)} GLW/wk`;
  }

  if ((estimatedUserWeeklyUsd ?? 0) > 0 && Number.isFinite(estimatedUserWeeklyUsd)) {
    return `~$${fmtUsdAmount(estimatedUserWeeklyUsd ?? 0)}/wk`;
  }

  return null;
}

type PendingTimelineStep = {
  key: "epoch" | "audit" | "claim";
  label: string;
  dateLabel: string;
  isActive: boolean;
  isComplete: boolean;
};

type PendingTimelineCopy = {
  isClaimReady: boolean;
  badgeLabel: string;
  statusLabel: string;
  helperLabel: string;
  timelineLabel: string;
  timelineValue: string;
  nextMilestoneLabel: string;
  nextMilestoneValue: string;
  progressPercent: number;
  steps: PendingTimelineStep[];
};

function FirstFundsInfo(props: { className?: string; labels: MyFarmsLabels }) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground",
              props.className,
            )}
            aria-label={props.labels.firstFundsAria}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
          {props.labels.firstFundsTooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getPendingStartPositionLabel(
  farm: FarmCardData,
  labels: MyFarmsLabels,
) {
  if (farm.type === "miner") return labels.positionMiner;
  if (farm.type === "delegation") return labels.positionDelegation;
  return labels.positionGeneric;
}

function getPendingStartTimelineCopy(params: {
  positionLabel: string;
  purchaseDate: string | null | undefined;
  labels: MyFarmsLabels;
}
): PendingTimelineCopy | null {
  const { positionLabel, purchaseDate, labels } = params;
  if (!purchaseDate) return null;

  const timeline = buildPendingRewardTimeline({ purchaseDate });
  const epochEndLabel = formatRewardPipelineDate(timeline.epochEndsAtMs);
  const postedLabel = formatRewardPipelineDate(timeline.auditPostedAtMs);
  const claimableLabel = formatRewardPipelineDate(timeline.claimableAtMs, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isClaimable = timeline.phase === "claimable";

  const statusLabel =
    timeline.phase === "epoch"
      ? labels.statusOwnership(positionLabel)
      : timeline.phase === "audit"
        ? labels.statusStartsEarning(positionLabel)
        : timeline.phase === "finalization"
          ? labels.statusEarning(positionLabel)
          : labels.statusClaimable(positionLabel);

  const helperLabel =
    timeline.phase === "epoch"
      ? labels.helperEpoch
      : timeline.phase === "audit"
        ? labels.helperAudit
        : timeline.phase === "finalization"
          ? labels.helperFinalization
          : labels.helperClaimable;

  const phaseOrder: PendingRewardPipelinePhase[] = [
    "epoch",
    "audit",
    "finalization",
    "claimable",
  ];
  const currentPhaseIndex = phaseOrder.indexOf(timeline.phase);

  return {
    isClaimReady: isClaimable,
    badgeLabel:
      timeline.phase === "epoch"
        ? labels.badgeOwned
        : timeline.phase === "claimable"
          ? labels.badgeClaimReady
          : labels.badgeEarningSoon,
    statusLabel,
    helperLabel,
    timelineLabel: isClaimable
      ? labels.timelineLabelFundsAvailable
      : labels.timelineLabelFirstFunds,
    timelineValue: isClaimable ? labels.timelineValueNow : claimableLabel,
    nextMilestoneLabel:
      timeline.phase === "epoch"
        ? labels.nextMilestoneStartsEarning
        : timeline.phase === "claimable"
          ? labels.nextMilestoneFundsAvailable
          : labels.nextMilestoneStartedEarning,
    nextMilestoneValue:
      timeline.phase === "epoch"
        ? epochEndLabel
        : timeline.phase === "claimable"
          ? labels.timelineValueNow
          : postedLabel,
    progressPercent: timeline.progressPercent,
    steps: [
      {
        key: "epoch",
        label: labels.stepWeekCloses,
        dateLabel: epochEndLabel,
        isActive: timeline.phase === "epoch",
        isComplete: currentPhaseIndex > 0,
      },
      {
        key: "audit",
        label: labels.stepAudited,
        dateLabel: postedLabel,
        isActive: timeline.phase === "audit",
        isComplete: currentPhaseIndex > 1,
      },
      {
        key: "claim",
        label: labels.stepFirstFunds,
        dateLabel: claimableLabel,
        isActive:
          timeline.phase === "finalization" || timeline.phase === "claimable",
        isComplete: timeline.phase === "claimable",
      },
    ],
  };
}

function getFarmEarnedLabel(farm: FarmCardData): string {
  const protocolDepositEntries = getProtocolDepositDisplayEntries({
    byAsset: sumWeeklyProtocolDepositByAsset({
      weeks: farm.weeklyBreakdown,
      fallbackAsset: farm.protocolDepositAsset,
    }),
    isProtocolDepositUsd: farm.isProtocolDepositUsd,
  });

  if (farm.type === "miner") {
    return `${fmtGlw(farm.inflationGlw)} GLW`;
  }

  if (protocolDepositEntries.length > 0) {
    return getCombinedRewardsLabel({
      inflationGlw: farm.inflationGlw,
      protocolDepositEntries,
      isMiner: false,
    });
  }

  return `${fmtGlw(farm.inflationGlw)} GLW`;
}

function getFarmLastWeekLabel(farm: FarmCardData): string | null {
  const groupedWeeks = groupWeeklyBreakdownByWeek({
    weeks: farm.weeklyBreakdown,
    fallbackAsset: farm.protocolDepositAsset,
  });
  const latestWeek = groupedWeeks.at(-1);

  if (latestWeek) {
    const protocolDepositEntries = getProtocolDepositDisplayEntries({
      byAsset: latestWeek.protocolDepositByAsset,
      isProtocolDepositUsd: farm.isProtocolDepositUsd,
    });
    const inflationGlw = parseGlwFromWei(latestWeek.inflationRewards.toString());
    const hasRewards =
      inflationGlw > 0 ||
      protocolDepositEntries.some((entry) => entry.amount > 0);

    if (hasRewards) {
      return getCombinedRewardsLabel({
        inflationGlw,
        protocolDepositEntries,
        isMiner: farm.type === "miner",
      });
    }
  }

  if (
    typeof farm.lastWeekRewardsGlw === "number" &&
    Number.isFinite(farm.lastWeekRewardsGlw) &&
    farm.lastWeekRewardsGlw > 0
  ) {
    return `${fmtGlw(farm.lastWeekRewardsGlw)} GLW`;
  }

  return null;
}

function getAuditUrl(params: { id: string | null | undefined }) {
  if (!params.id) return null;
  return `https://glow.org/audits/${params.id}`;
}

interface FarmCardData {
  farmKey: string;
  farmId: string;
  farmName: string;
  regionName: string;
  imageUrls: string[];
  type: "miner" | "delegation" | "other" | "in-progress";
  inProgressKind?: "launchpad" | "mining-center";
  /** A miner acquired via the points shop (GLW split transferred from the
   * Foundation), as opposed to a USDC mining-center purchase. Badged
   * distinctly; has no USD cost or reward history. */
  isShopMiner?: boolean;
  /** Points spent on this shop miner (summed across repeat purchases). */
  shopPointsCost?: number;
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
    protocolDepositAsset?: string | null;
    protocolDepositRewardsByAsset?: Record<string, string>;
    totalRewards: string;
  }>;
  lastWeekRewardsGlw?: number;
  inProgressPercent?: number;
  /** When a recent purchase merged into THIS already-owned farm's card (so no
   * separate "pending start" card appears), a short note like "+$1,596 added"
   * to reassure the user their purchase landed here. Null when none. */
  recentlyAddedNote?: string | null;
  estimatedUserWeeklyGlw?: number;
  estimatedUserWeeklyUsd?: number;
  estimatedUserWeeklyPd?: number;
  estimatedUserWeeklyPdAsset?: string | null;
  delegatedAmountsByAsset?: DelegationAmountsByAsset;
  isPendingStart?: boolean;
  pendingPurchaseDate?: string | null;
  /** A points-shop miner bought in the current protocol epoch. Its card is built
   *  from the shop-holdings path, which has no recentlyAddedNote/isPendingStart,
   *  so this flag is what makes a fresh shop-miner glow. */
  isNewThisWeek?: boolean;
}

/** A position the wallet acquired THIS week — across ALL types: in-progress
 * delegations (still funding), funded "pending start" delegations/miners, a
 * purchase merged into an existing card, or a points-shop miner bought this
 * protocol epoch. These float to the top and get a glow ring so a brand-new buy
 * is immediately visible. */
function isFarmNewThisWeek(card: {
  recentlyAddedNote?: string | null;
  isPendingStart?: boolean;
  type?: string;
  isNewThisWeek?: boolean;
}): boolean {
  return (
    Boolean(card.recentlyAddedNote) ||
    Boolean(card.isPendingStart) ||
    card.type === "in-progress" ||
    Boolean(card.isNewThisWeek)
  );
}

/** Fold each points-shop miner into the wallet's existing regular MINER card for
 * the SAME farm: one card shows all that farm's miners (summed initial cost,
 * weekly reward, and points spent), carrying the shop miner's "+$X added
 * recently" note + glow. A shop miner whose farm has no regular miner card stays
 * as its own standalone card. */
function mergeShopMinerCards(
  regular: FarmCardData[],
  shop: FarmCardData[],
): FarmCardData[] {
  const shopByFarmId = new Map<string, FarmCardData>();
  for (const s of shop) shopByFarmId.set(s.farmId, s);
  const usedFarmIds = new Set<string>();
  const merged = regular.map((c) => {
    if (c.type !== "miner") return c;
    const s = shopByFarmId.get(c.farmId);
    if (!s) return c;
    usedFarmIds.add(c.farmId);
    return {
      ...c,
      initialCost: c.initialCost + s.initialCost,
      estimatedUserWeeklyGlw:
        (c.estimatedUserWeeklyGlw ?? 0) + (s.estimatedUserWeeklyGlw ?? 0),
      estimatedUserWeeklyUsd:
        (c.estimatedUserWeeklyUsd ?? 0) + (s.estimatedUserWeeklyUsd ?? 0),
      shopPointsCost: (c.shopPointsCost ?? 0) + (s.shopPointsCost ?? 0),
      recentlyAddedNote: s.recentlyAddedNote ?? c.recentlyAddedNote,
      isNewThisWeek: Boolean(c.isNewThisWeek) || Boolean(s.isNewThisWeek),
    };
  });
  const standalone = shop.filter((s) => !usedFarmIds.has(s.farmId));
  return [...merged, ...standalone];
}

interface FarmListRowProps {
  farm: FarmCardData;
  onClick: () => void;
}

interface FarmMosaicCardProps {
  farm: FarmCardData;
  onClick: () => void;
}

function PendingTimelinePanel(props: {
  timeline: PendingTimelineCopy;
  compact?: boolean;
}) {
  const { t } = useLang();
  const { timeline, compact = false } = props;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/20 bg-muted/20 dark:border-border/40 dark:bg-muted/40",
        compact ? "p-2.5 space-y-2" : "p-3 space-y-2.5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
            {t.widgets.myFarms.whatHappensNext}
          </div>
          <div
            className={cn(
              "mt-1 font-medium text-foreground",
              compact ? "text-[11px]" : "text-xs",
            )}
          >
            {timeline.helperLabel}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center justify-end gap-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
            <span>{timeline.timelineLabel}</span>
            <FirstFundsInfo labels={t.widgets.myFarms} />
          </div>
          <div
            className={cn(
              "mt-1 font-mono font-semibold text-foreground",
              compact ? "text-[11px]" : "text-xs",
            )}
          >
            {timeline.timelineValue}
          </div>
        </div>
      </div>

      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-3")}>
        {timeline.steps.map((step) => (
          <div
            key={step.key}
            className={cn(
              "rounded-lg border px-2.5 py-2 transition-colors",
              step.isComplete
                ? "border-emerald-500/20 bg-emerald-500/5"
                : step.isActive
                  ? "border-primary/25 bg-primary/5"
                  : "border-border/20 bg-background/50 dark:border-border/40 dark:bg-background/20",
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  step.isComplete
                    ? "bg-emerald-500"
                    : step.isActive
                      ? "bg-primary"
                      : "bg-muted-foreground/30",
                )}
              />
              <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                {step.label}
              </div>
            </div>
            <div
              className={cn(
                "mt-1.5 font-mono font-semibold text-foreground",
                compact ? "text-[11px]" : "text-xs",
              )}
            >
              {step.dateLabel}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingTimelineCompact(props: {
  timeline: PendingTimelineCopy;
  compact?: boolean;
}) {
  const { t } = useLang();
  const { timeline, compact = false } = props;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/20 bg-muted/20 dark:border-border/40 dark:bg-muted/40",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
      )}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
            {timeline.nextMilestoneLabel}
          </div>
          <div
            className={cn(
              "mt-1 font-mono font-semibold text-foreground",
              compact ? "text-[11px]" : "text-xs",
            )}
          >
            {timeline.nextMilestoneValue}
          </div>
        </div>
        <div className="min-w-0 text-right">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
            {timeline.isClaimReady ? t.widgets.myFarms.nextStep : timeline.timelineLabel}
          </div>
          <div
            className={cn(
              "mt-1 font-mono font-semibold text-foreground",
              compact ? "text-[11px]" : "text-xs",
            )}
          >
            {timeline.isClaimReady ? t.widgets.myFarms.openRewards : timeline.timelineValue}
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingTimelineModalPanel(props: {
  timeline: PendingTimelineCopy;
}) {
  const { t } = useLang();
  const { timeline } = props;

  return (
    <Card className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40">
      <CardContent className="p-6 md:p-7 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/20 bg-card dark:border-border/40">
                <Clock className="w-4 h-4 text-[color:var(--color-miner-contrast)]" />
              </div>
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {t.widgets.myFarms.modalStatusLabel}
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              {timeline.statusLabel}
            </div>
            <div className="text-sm md:text-base leading-relaxed text-muted-foreground dark:text-muted-foreground/80 max-w-xl">
              {timeline.helperLabel}
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-border/20 dark:border-border/40 bg-card px-4 py-3">
            <div className="flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              <span>{t.widgets.myFarms.stepFirstFunds}</span>
              <FirstFundsInfo labels={t.widgets.myFarms} />
            </div>
            <div className="mt-2 text-xl font-semibold text-foreground">
              {timeline.timelineValue}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/20 dark:border-border/40 bg-card px-4 py-3">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              {t.widgets.myFarms.modalStartsEarning}
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {timeline.steps[0]?.dateLabel}
            </div>
          </div>
          <div className="rounded-xl border border-border/20 dark:border-border/40 bg-card px-4 py-3">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              {t.widgets.myFarms.modalAuditedPosted}
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {timeline.steps[1]?.dateLabel}
            </div>
          </div>
          <div className="rounded-xl border border-border/20 dark:border-border/40 bg-card px-4 py-3">
            <div className="flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              <span>{t.widgets.myFarms.stepFirstFunds}</span>
              <FirstFundsInfo labels={t.widgets.myFarms} />
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {timeline.steps[2]?.dateLabel}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FarmMosaicCard({ farm, onClick }: FarmMosaicCardProps) {
  const { t } = useLang();
  const isPendingStart = Boolean(farm.isPendingStart);
  const pendingTimeline = getPendingStartTimelineCopy({
    positionLabel: getPendingStartPositionLabel(farm, t.widgets.myFarms),
    purchaseDate: farm.pendingPurchaseDate,
    labels: t.widgets.myFarms,
  });

  return (
    <Card
      data-farm-id={farm.farmId}
      className={cn(
        "group relative overflow-hidden cursor-pointer bg-muted/30 dark:bg-muted/50 hover:bg-muted/50 dark:hover:bg-muted/60 transition-colors border-border/20 dark:border-border/40 p-0 gap-0 h-full",
        isFarmNewThisWeek(farm) &&
          "ring-2 ring-emerald-500/50 dark:ring-[color:var(--color-glow-green)]/60",
      )}
      onClick={onClick}
    >
      <div className="relative h-full aspect-square w-full overflow-hidden bg-muted/20">
        <FallbackImage
          src={farm.imageUrls[0]}
          widthForProxy={600}
          quality={80}
          alt={farm.farmName}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

        {isPendingStart && (
          <div className="absolute top-2 right-2 z-10">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono uppercase tracking-wider border bg-background/90 text-foreground border-border/40">
              <Clock className="w-2.5 h-2.5" />
              {pendingTimeline?.badgeLabel ?? t.widgets.myFarms.badgePending}
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
          <Badge
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-0 text-[9px] px-1.5 h-4 mb-1.5 font-medium w-fit"
          >
            {farm.regionName}
          </Badge>
          <h3 className="font-bold text-white text-sm leading-tight truncate">
            {farm.farmName}
          </h3>
        </div>
      </div>
    </Card>
  );
}

interface FarmCardProps {
  farm: FarmCardData;
  onClick: () => void;
  isCompact?: boolean;
  showAuditButton?: boolean;
}

function FarmCard({
  farm,
  onClick,
  isCompact = false,
  showAuditButton = false,
}: FarmCardProps) {
  const { t } = useLang();
  const isInProgress = farm.type === "in-progress";
  const isMiner = farm.type === "miner";
  const isShopMiner = Boolean(farm.isShopMiner);
  const isDelegation = farm.type === "delegation";
  const isOther = farm.type === "other";
  const isPendingStart = Boolean(farm.isPendingStart);
  const pendingTimeline = getPendingStartTimelineCopy({
    positionLabel: getPendingStartPositionLabel(farm, t.widgets.myFarms),
    purchaseDate: farm.pendingPurchaseDate,
    labels: t.widgets.myFarms,
  });
  const inProgressIsMiningCenter =
    isInProgress && farm.inProgressKind === "mining-center";
  const protocolDepositAssetLabel = formatProtocolDepositAsset(
    farm.protocolDepositAsset
  );
  const delegatedOrCostLabel =
    isMiner || inProgressIsMiningCenter
      ? fmtUsd(farm.initialCost)
      : formatDelegatedAmountsByAsset({
          amounts: farm.delegatedAmountsByAsset,
          fallbackAmount: farm.initialCost,
          fallbackAsset: protocolDepositAssetLabel,
        });
  const estimatedWeeklyLabel = formatEstimatedWeeklyRewards({
    estimatedUserWeeklyGlw: farm.estimatedUserWeeklyGlw,
    estimatedUserWeeklyUsd: farm.estimatedUserWeeklyUsd,
    estimatedUserWeeklyPd: farm.estimatedUserWeeklyPd,
    estimatedUserWeeklyPdAsset:
      farm.estimatedUserWeeklyPdAsset ?? farm.protocolDepositAsset,
  });
  const auditUrl = showAuditButton ? getAuditUrl({ id: farm.farmId }) : null;
  const isClaimReadyPending = Boolean(
    isPendingStart && pendingTimeline?.isClaimReady,
  );

  // For a non-GLW (SGCTL) delegation the inflation reward is denominated in GLW
  // while the protocol-deposit recovery (and the delegated principal) are SGCTL.
  // Summing them mixes units and pushed the progress bar past 100%, so here the
  // progress is the deposit-recovery ratio only (recovered SGCTL / delegated
  // SGCTL). GLW inflation is a separate stream surfaced under EARNED. GLW
  // delegations keep the total-value (recovery + inflation) ratio since both
  // legs are GLW.
  const isNonGlwDelegation =
    isDelegation &&
    farm.protocolDepositAsset != null &&
    farm.protocolDepositAsset !== "GLW";
  const progressValue = isNonGlwDelegation
    ? farm.recovered
    : farm.recovered + farm.inflation;
  const timeBasedProgress =
    (farm.weeksActive / Math.max(farm.totalWeeks, 1)) * 100;
  const roiPercent =
    isMiner || isOther
      ? timeBasedProgress
      : farm.initialCost > 0
        ? (progressValue / farm.initialCost) * 100
        : 0;
  const isProfitable = roiPercent >= 100;
  const lastWeekLabel = getFarmLastWeekLabel(farm);
  const hasLastWeekRewards = lastWeekLabel !== null;

  const getTypeBadge = () => {
    // For pending start, we still want to show the type (Miner/Delegation)
    // but the "Starts Next Week" badge is handled separately in the parent
    if (isInProgress) {
      return (
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-lg font-bold font-mono uppercase tracking-wider border",
            isCompact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]",
            inProgressIsMiningCenter
              ? "border-[color:var(--color-miner)]/30 bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner)]"
              : "border-delegation-purple/30 bg-delegation-purple/10 text-delegation-purple",
          )}
        >
          {inProgressIsMiningCenter ? (
            <CashMinerIcon className={"w-5 h-5"} />
          ) : (
            <DelegationIcon className={"w-5 h-5"} />
          )}
          {inProgressIsMiningCenter ? t.widgets.myFarms.typeMiner : t.widgets.myFarms.typeDelegation}
        </div>
      );
    }
    if (isMiner) {
      return (
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-lg font-bold font-mono uppercase tracking-wider border border-[color:var(--color-miner)]/30 bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner)]",
            isCompact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]",
          )}
        >
          <CashMinerIcon className={"w-5 h-5"} />
          {farm.isShopMiner
            ? t.widgets.myFarms.typeShopMiner
            : t.widgets.myFarms.typeMiner}
        </div>
      );
    }
    if (isDelegation) {
      return (
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-lg font-bold font-mono uppercase tracking-wider border border-delegation-purple/30 bg-delegation-purple/10 text-delegation-purple",
            isCompact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]",
          )}
        >
          <DelegationIcon className={"w-5 h-5"} />
          {t.widgets.myFarms.typeDelegation}
        </div>
      );
    }
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg font-bold font-mono uppercase tracking-wider border border-[color:var(--color-glow-green)]/30 bg-[color:var(--color-glow-green)]/10 text-emerald-700 dark:text-[color:var(--color-glow-green)]",
          isCompact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]",
        )}
      >
        <Gift className={isCompact ? "w-2.5 h-2.5" : "w-3 h-3"} />
        {t.widgets.myFarms.typeRewards}
      </div>
    );
  };

  return (
    <Card
      data-farm-id={farm.farmId}
      className={cn(
        "group relative overflow-hidden cursor-pointer bg-muted/30 dark:bg-muted/50 hover:bg-muted/50 dark:hover:bg-muted/60 transition-colors border-border/20 dark:border-border/40 p-0 gap-0",
        isFarmNewThisWeek(farm) &&
          "ring-2 ring-emerald-500/50 dark:ring-[color:var(--color-glow-green)]/60",
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-muted/20 transition-all",
          isCompact ? "h-32" : "h-48",
        )}
      >
        <FallbackImage
          src={farm.imageUrls[0]}
          widthForProxy={isCompact ? 400 : 600}
          quality={75}
          alt={farm.farmName}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {(auditUrl || isPendingStart) && (
          <div
            className={cn(
              "absolute z-10 flex items-center justify-end gap-2",
              isCompact ? "top-2 right-2" : "top-3 right-3",
            )}
          >
            {isPendingStart && pendingTimeline && (
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg font-bold font-mono tracking-wider border bg-background/90 text-foreground border-border/40",
                  isCompact
                    ? "px-1.5 py-0.5 text-[9px]"
                    : "px-2 py-1 text-[10px]",
                )}
              >
                <Clock className={isCompact ? "w-2.5 h-2.5" : "w-3 h-3"} />
                {pendingTimeline.badgeLabel}
              </div>
            )}
            {auditUrl && (
              <a
                href={auditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg font-bold font-mono tracking-wider border bg-background/90 text-foreground border-border/40 hover:bg-background transition-colors",
                  isCompact
                    ? "px-1.5 py-0.5 text-[9px]"
                    : "px-2 py-1 text-[10px]",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  trackEvent("dashboard_my_farm_audit_click", {
                    source: "my_farms_grid_section",
                    farm_id: farm.farmId,
                    farm_type: farm.type,
                  });
                }}
              >
                <ExternalLink
                  className={isCompact ? "w-2.5 h-2.5" : "w-3 h-3"}
                />
                {t.widgets.myFarms.seeAudit}
              </a>
            )}
          </div>
        )}
        <div
          className={cn(
            "absolute z-10 left-4 right-4",
            isCompact ? "bottom-2.5 left-3 right-3" : "bottom-4 left-4 right-4",
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Badge
              variant="secondary"
              className={cn(
                "bg-white/20 hover:bg-white/30 text-white border-0 font-medium",
                isCompact ? "text-[9px] px-1 h-4" : "text-[10px] px-1.5 h-5",
              )}
            >
              {farm.regionName}
            </Badge>
          </div>
          <h3
            className={cn(
              "font-bold text-white leading-tight truncate",
              isCompact ? "text-sm" : "text-xl",
            )}
          >
            {farm.farmName}
          </h3>
        </div>
      </div>
      <div className={cn(isCompact ? "p-3" : "p-5")}>
        {isInProgress ? (
          <div className={cn("space-y-4", isCompact && "space-y-2.5")}>
            <div
              className={cn(
                "flex items-center justify-between",
                isCompact ? "text-[10px]" : "text-xs",
              )}
            >
              <span className="text-muted-foreground font-medium">
                {t.widgets.myFarms.fundingProgress}
              </span>
              <span className="font-mono font-bold">
                {Math.round(farm.inProgressPercent ?? 0)}%
              </span>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, farm.inProgressPercent ?? 0))}
              className={cn(isCompact ? "h-1" : "h-1.5", "bg-muted")}
            />
            <div
              className={cn(
                "grid grid-cols-2 gap-2",
                !isCompact && "grid-cols-[max-content_minmax(0,1fr)] gap-6",
              )}
            >
              <div>
                <div
                  className={cn(
                    "uppercase tracking-wider text-muted-foreground font-semibold mb-1",
                    isCompact ? "text-[9px]" : "text-[10px]",
                  )}
                >
                  {inProgressIsMiningCenter ? t.widgets.myFarms.costLabel : t.widgets.myFarms.delegatedLabel}
                </div>
                <div className={cn("font-mono font-bold", isCompact ? "text-xs" : "text-sm")}>
                  {delegatedOrCostLabel}
                </div>
              </div>
              <div className={cn("text-right", !isCompact && "min-w-0")}>
                <div
                  className={cn(
                    "uppercase tracking-wider text-muted-foreground font-semibold mb-1",
                    isCompact ? "text-[9px]" : "text-[10px]",
                  )}
                >
                  {t.widgets.myFarms.estWeekly}
                </div>
                <div
                  className={cn(
                    "font-mono font-bold",
                    isCompact ? "text-xs" : "text-sm",
                    !isCompact && "whitespace-nowrap",
                    inProgressIsMiningCenter
                      ? "text-[color:var(--color-miner-contrast)]"
                      : "text-delegation-purple",
                  )}
                >
                  {estimatedWeeklyLabel ?? "—"}
                </div>
              </div>
            </div>
            <div
              className={cn(
                "border-t border-border/20 dark:border-border/40 flex justify-between items-center",
                isCompact ? "pt-1.5" : "pt-2",
              )}
            >
              {getTypeBadge()}
              <div
                className={cn(
                  "font-medium text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform",
                  isCompact ? "text-[10px]" : "text-xs",
                )}
              >
                {!isCompact && t.widgets.myFarms.viewDetails}{" "}
                <ChevronRight
                  className={cn(isCompact ? "w-2.5 h-2.5" : "w-3 h-3")}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className={cn("space-y-4", isCompact && "space-y-2.5")}>
            {farm.recentlyAddedNote && (
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-[color:var(--color-glow-green)] font-mono font-semibold",
                  isCompact ? "text-[9px] px-2 py-0.5" : "text-[10px] px-2.5 py-1",
                )}
              >
                <Sparkles className={cn(isCompact ? "w-2.5 h-2.5" : "w-3 h-3")} />
                {farm.recentlyAddedNote}
              </div>
            )}
            <div
              className={cn(
                "grid",
                isCompact
                  ? "grid-cols-2 gap-2"
                  : hasLastWeekRewards
                    ? "grid-cols-3 gap-4"
                    : "grid-cols-2 gap-4",
              )}
            >
              <div>
                <div
                  className={cn(
                    "uppercase tracking-wider text-muted-foreground font-semibold mb-1",
                    isCompact ? "text-[9px]" : "text-[10px]",
                  )}
                >
                  {isPendingStart ? t.widgets.myFarms.statusLabel : t.widgets.myFarms.active}
                </div>
                <div
                  className={cn(
                    "font-mono font-medium",
                    isCompact ? "text-xs" : "text-sm",
                  )}
                >
                  {isPendingStart
                    ? pendingTimeline?.statusLabel ?? t.widgets.myFarms.processing
                    : t.widgets.myFarms.wksFormat(farm.weeksActive, farm.totalWeeks)}
                </div>
              </div>
              {!isCompact && hasLastWeekRewards && (
                <div className="text-center">
                  <div
                    className={cn(
                      "uppercase tracking-wider text-muted-foreground font-semibold mb-1",
                      "text-[10px]",
                    )}
                  >
                    {t.widgets.myFarms.lastWeek}
                  </div>
                  <div className="font-mono font-medium text-sm">
                    {lastWeekLabel}
                  </div>
                </div>
              )}
              <div className="text-right min-w-0">
                <div
                  className={cn(
                    "uppercase tracking-wider text-muted-foreground font-semibold mb-1",
                    isCompact ? "text-[9px]" : "text-[10px]",
                  )}
                >
                  {isPendingStart
                    ? isClaimReadyPending
                      ? t.widgets.myFarms.typeRewards
                      : t.widgets.myFarms.estWeekly
                    : isShopMiner
                      ? t.widgets.myFarms.estWeekly
                      : t.widgets.myFarms.earned}
                </div>
                <div
                  className={cn(
                    "font-mono font-bold",
                    isCompact ? "text-xs" : "text-sm",
                    // Two-asset earned values (e.g. "37,155 GLW + 2,410.78
                    // SGCTL") must wrap within the grid cell, not overflow the
                    // card edge. Let it wrap like the LAST WEEK column does.
                    isPendingStart
                      ? "text-muted-foreground"
                      : isMiner
                        ? "text-[color:var(--color-miner-contrast)]"
                        : isDelegation
                          ? "text-delegation-purple"
                          : "text-emerald-700 dark:text-[color:var(--color-glow-green)]",
                  )}
                >
                  {isPendingStart
                    ? isClaimReadyPending
                      ? t.widgets.myFarms.readyToClaim
                      : estimatedWeeklyLabel ?? t.widgets.myFarms.calculating
                    : isShopMiner
                      ? estimatedWeeklyLabel ?? t.widgets.myFarms.calculating
                      : getFarmEarnedLabel(farm)}
                </div>
                {isCompact && !isPendingStart && hasLastWeekRewards && (
                  <div
                    className={cn(
                      "text-[10px] font-mono text-muted-foreground mt-1",
                      isCompact && "text-[9px]",
                    )}
                  >
                    {t.widgets.myFarms.lastWeekPrefix}{" "}
                    <span className="font-semibold text-foreground">
                      {lastWeekLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {isPendingStart ? (
              pendingTimeline ? (
                <PendingTimelineCompact
                  timeline={pendingTimeline}
                  compact={isCompact}
                />
              ) : null
            ) : (
              <div className={cn("space-y-1.5", isCompact && "space-y-1")}>
                <div
                  className={cn(
                    "flex items-center justify-between font-medium text-muted-foreground",
                    isCompact ? "text-[9px]" : "text-[10px]",
                  )}
                >
                  <span>
                    {isOther
                      ? t.widgets.myFarms.timelineText(
                          farm.weeksActive,
                          farm.totalWeeks,
                        )
                      : isShopMiner
                        ? t.widgets.myFarms.costText(
                            t.widgets.myFarms.pointsCost(
                              (farm.shopPointsCost ?? 0).toLocaleString("en-US"),
                            ),
                          )
                        : isMiner
                        ? t.widgets.myFarms.costText(fmtUsd(farm.initialCost))
                        : t.widgets.myFarms.delegatedText(
                            formatDelegatedAmountsByAsset({
                              amounts: farm.delegatedAmountsByAsset,
                              fallbackAmount: farm.initialCost,
                              fallbackAsset: farm.protocolDepositAsset,
                            }),
                          )}
                  </span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      isProfitable ? "text-emerald-500" : "text-foreground",
                    )}
                  >
                    {t.widgets.myFarms.progressText(Math.round(roiPercent))}
                  </span>
                </div>
                <Progress
                  value={Math.min(roiPercent, 100)}
                  className={cn(
                    "bg-muted",
                    isCompact ? "h-1" : "h-1.5",
                    isProfitable && "[&>div]:bg-emerald-500",
                  )}
                />
              </div>
            )}
            <div
              className={cn(
                "border-t border-border/20 dark:border-border/40 flex justify-between items-center",
                isCompact ? "pt-1.5" : "pt-2",
              )}
            >
              {getTypeBadge()}
              <div
                className={cn(
                  "font-medium text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform",
                  isCompact ? "text-[10px]" : "text-xs",
                )}
              >
                {!isCompact && t.widgets.myFarms.viewDetails}{" "}
                <ChevronRight
                  className={cn(isCompact ? "w-2.5 h-2.5" : "w-3 h-3")}
                />
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
  const { t } = useLang();
  if (!farm) return null;

  const isInProgress = farm.type === "in-progress";
  const isMiner = farm.type === "miner";
  const isShopMiner = Boolean(farm.isShopMiner);
  const isOther = farm.type === "other";
  const isPendingStart = Boolean(farm.isPendingStart);
  const pendingTimeline = getPendingStartTimelineCopy({
    positionLabel: getPendingStartPositionLabel(farm, t.widgets.myFarms),
    purchaseDate: farm.pendingPurchaseDate,
    labels: t.widgets.myFarms,
  });
  const inProgressIsMiningCenter =
    isInProgress && farm.inProgressKind === "mining-center";

  const protocolDepositAsset = formatProtocolDepositAsset(
    farm.protocolDepositAsset
  );
  const groupedWeeklyBreakdown = groupWeeklyBreakdownByWeek({
    weeks: farm.weeklyBreakdown,
    fallbackAsset: protocolDepositAsset,
  });
  const protocolDepositEntries = getProtocolDepositDisplayEntries({
    byAsset: sumWeeklyProtocolDepositByAsset({
      weeks: farm.weeklyBreakdown,
      fallbackAsset: protocolDepositAsset,
    }),
    isProtocolDepositUsd: farm.isProtocolDepositUsd,
  });
  const protocolDepositSummaryLabel =
    protocolDepositEntries.length > 0
      ? protocolDepositEntries.map((entry) => entry.label).join(" + ")
      : farm.isProtocolDepositUsd
      ? `${fmtUsdAmount(farm.recovered)} ${protocolDepositAsset}`
      : `${formatTokenAmountByAsset(
          farm.recovered,
          farm.protocolDepositAsset
        )} ${protocolDepositAsset}`;
  const investedLabel = (() => {
    if (isInProgress) {
      if (inProgressIsMiningCenter) return fmtUsd(farm.initialCost);
      return formatDelegatedAmountsByAsset({
        amounts: farm.delegatedAmountsByAsset,
        fallbackAmount: farm.initialCost,
        fallbackAsset: protocolDepositAsset,
      });
    }
    if (isShopMiner)
      return t.widgets.myFarms.pointsCost(
        (farm.shopPointsCost ?? 0).toLocaleString("en-US"),
      );
    if (isMiner) return fmtUsd(farm.initialCost);
    if (isOther) return "—";
    return formatDelegatedAmountsByAsset({
      amounts: farm.delegatedAmountsByAsset,
      fallbackAmount: farm.initialCost,
      fallbackAsset: protocolDepositAsset,
    });
  })();

  const earnedLabel = (() => {
    if (isInProgress || isPendingStart || isShopMiner) {
      return (
        formatEstimatedWeeklyRewards({
          estimatedUserWeeklyGlw: farm.estimatedUserWeeklyGlw,
          estimatedUserWeeklyUsd: farm.estimatedUserWeeklyUsd,
          estimatedUserWeeklyPd: farm.estimatedUserWeeklyPd,
          estimatedUserWeeklyPdAsset:
            farm.estimatedUserWeeklyPdAsset ?? farm.protocolDepositAsset,
        }) ?? t.widgets.myFarms.calculating
      );
    }
    if (isMiner) return `${fmtGlw(farm.inflationGlw)} GLW`;
    return getFarmEarnedLabel(farm);
  })();

  const progressPercent = Math.min(
    (farm.weeksActive / Math.max(farm.totalWeeks, 1)) * 100,
    100,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[760px] lg:max-w-[1060px] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden rounded-[24px] bg-card border border-border/40"
      >
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b border-border/40 bg-card z-20 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-8 w-8 rounded-full border border-transparent hover:border-border/40 dark:hover:border-border/60 hover:bg-transparent"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t.widgets.myFarms.closeAria}</span>
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pr-8">
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {t.widgets.myFarms.farmOverview}
              </div>
              <DialogTitle className="text-3xl font-semibold tracking-tight text-foreground">
                {farm.farmName}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="secondary"
                  className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 text-muted-foreground hover:bg-muted/30 dark:hover:bg-muted/50 font-normal"
                >
                  {farm.regionName}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {farm.type === "miner" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 text-foreground">
                  <CashMinerIcon className="w-4 h-4 text-[color:var(--color-miner)]" />
                  {farm.isShopMiner
                    ? t.widgets.myFarms.typeShopMiner
                    : t.widgets.myFarms.typeMiner}
                </div>
              )}
              {farm.type === "delegation" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 text-foreground">
                  <DelegationIcon className="w-4 h-4 text-delegation-purple" />
                  {t.widgets.myFarms.typeDelegation}
                </div>
              )}
              {farm.type === "other" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 text-foreground">
                  <Gift className="w-3.5 h-3.5 text-emerald-700 dark:text-[color:var(--color-glow-green)]" />
                  {t.widgets.myFarms.typeRewards}
                </div>
              )}
              {farm.type === "in-progress" && (
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 text-foreground",
                  )}
                >
                  {farm.inProgressKind === "mining-center" ? (
                    <CashMinerIcon className="w-4 h-4 text-[color:var(--color-miner)]" />
                  ) : (
                    <DelegationIcon className="w-4 h-4 text-delegation-purple" />
                  )}
                  {t.widgets.myFarms.typeInProgress}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 space-y-8 w-full">
            {/* Image Grid + KPI Cards: side-by-side on desktop */}
            <div className="flex flex-col lg:flex-row gap-6">
            {/* Farm Image Grid */}
            <div className="rounded-2xl overflow-hidden border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 lg:flex-1 lg:min-w-0">
              {farm.imageUrls.length >= 3 ? (
                <div className="grid grid-cols-3 grid-rows-2 gap-1 h-[300px] lg:h-full lg:min-h-[300px]">
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
                <div className="grid grid-cols-2 gap-1 h-[300px] lg:h-full lg:min-h-[300px]">
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
                <div className="relative aspect-video sm:h-[300px] lg:h-full lg:min-h-[300px] w-full">
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
            <div className="grid grid-cols-1 gap-4 lg:w-[320px] lg:shrink-0">
              {/* Invested / Delegated */}
              {!isOther && (
                <Card className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40">
                  <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div
                        className={cn(
                          "p-1.5 rounded-lg",
                          isMiner || inProgressIsMiningCenter
                            ? "bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner)]"
                            : "bg-delegation-purple/10 text-delegation-purple",
                        )}
                      >
                        {isMiner || inProgressIsMiningCenter ? (
                          <CashMinerIcon className="w-5 h-5" />
                        ) : (
                          <DelegationIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                        {isMiner || inProgressIsMiningCenter
                          ? t.widgets.myFarms.initialCost
                          : t.widgets.myFarms.totalDelegated}
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-semibold font-mono tracking-tight leading-tight whitespace-normal break-words text-foreground">
                      {investedLabel}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Total Earned */}
              <Card
                className={cn(
                  "bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 relative overflow-hidden",
                )}
              >
                <CardContent className="p-6 flex flex-col h-full justify-between gap-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div
                        className={cn(
                          "p-1.5 rounded-lg",
                          isMiner
                            ? "bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner)]"
                            : farm.type === "delegation"
                              ? "bg-delegation-purple/10 text-delegation-purple"
                              : "bg-[#4ADE80]/10 text-[#4ADE80]",
                        )}
                      >
                        <Gift className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                        {isInProgress || isPendingStart || isShopMiner
                          ? t.widgets.myFarms.estWeeklyRewards
                          : t.widgets.myFarms.lifetimeEarnings}
                      </div>
                    </div>
                    {!isInProgress && !isPendingStart && !isOther && (
                      <div className="text-xs font-mono font-medium text-muted-foreground bg-card border border-border/20 dark:border-border/40 px-2 py-0.5 rounded-lg">
                        {farm.initialCost > 0
                          ? `${Math.round(
                              ((farm.recovered +
                                (isMiner
                                  ? farm.inflation
                                  : farm.inflationGlw)) /
                                farm.initialCost) *
                                100,
                            )}%`
                          : "—"}
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      "text-2xl sm:text-3xl font-semibold font-mono tracking-tight leading-tight whitespace-normal break-words",
                      isMiner && "text-[color:var(--color-miner)]",
                      farm.type === "delegation" && "text-delegation-purple",
                      isOther &&
                        "text-emerald-700 dark:text-[color:var(--color-glow-green)]",
                    )}
                  >
                    {earnedLabel}
                  </div>
                </CardContent>
              </Card>

              {/* Time Progress */}
              {!isInProgress && !isPendingStart && (
                <Card className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40">
                  <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="p-1.5 rounded-lg bg-muted/50">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                          {t.widgets.myFarms.timelineCard}
                        </div>
                      </div>
                      <div className="text-xs font-mono font-medium text-muted-foreground bg-card border border-border/20 dark:border-border/40 px-2 py-0.5 rounded-lg">
                        {Math.round(progressPercent)}%
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-semibold font-mono tracking-tight">
                          {farm.weeksActive}
                          <span className="text-muted-foreground/60 text-sm ml-1 font-normal">
                            {t.widgets.myFarms.wksUnit}
                          </span>
                        </div>
                        <div className="text-sm font-mono text-muted-foreground/60">
                          {t.widgets.myFarms.timelineTotal(farm.totalWeeks)}
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
                <Card className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40">
                  <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div
                        className={cn(
                          "p-1.5 rounded-lg",
                          farm.inProgressKind === "mining-center"
                            ? "bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner)]"
                            : "bg-delegation-purple/10 text-delegation-purple",
                        )}
                      >
                        {farm.inProgressKind === "mining-center" ? (
                          <CashMinerIcon className="w-5 h-5" />
                        ) : (
                          <DelegationIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                        {t.widgets.myFarms.fundingProgress}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-3xl font-semibold font-mono tracking-tight">
                        {Math.round(farm.inProgressPercent ?? 0)}%
                      </div>
                      <Progress
                        value={Math.max(
                          0,
                          Math.min(100, farm.inProgressPercent ?? 0),
                        )}
                        className="h-2 bg-muted"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
            </div>

            {/* Pending Start Status - full width below image + KPI row */}
            {isPendingStart && pendingTimeline && (
              <PendingTimelineModalPanel timeline={pendingTimeline} />
            )}

            {/* Breakdown Section */}
            {!isInProgress && !isPendingStart && (
              <div className="space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 px-1">
                  {t.widgets.myFarms.rewardsBreakdown}
                </h3>
                <Card className="bg-muted/30 border-border/20 overflow-hidden py-0">
                  <div className="divide-y divide-border/20">
                    {!isMiner && (
                      <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-delegation-purple/10 flex items-center justify-center text-delegation-purple">
                            <VaultIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {t.widgets.myFarms.protocolDeposit}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {isOther
                                ? t.widgets.myFarms.protocolDepositRecoveredIn(
                                    formatProtocolDepositAsset(
                                      farm.protocolDepositAsset,
                                    ) ?? "—",
                                  )
                                : t.widgets.myFarms.protocolDepositRecoveredCapital}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono font-bold text-delegation-purple">
                          {protocolDepositSummaryLabel}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[color:var(--color-miner)]/10 flex items-center justify-center text-[color:var(--color-miner-contrast)]">
                          <EmissionsIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{t.widgets.myFarms.emissions}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.widgets.myFarms.emissionsProduction}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-[color:var(--color-miner-contrast)]">
                        +{fmtGlw(farm.inflationGlw)} GLW
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/20">
                      <div className="font-bold text-sm">{t.widgets.myFarms.totalValue}</div>
                      <div className="text-right font-mono font-bold text-lg">
                        {earnedLabel}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Weekly Rewards Table */}
            {!isInProgress &&
              !isPendingStart &&
              farm.weeklyBreakdown.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 px-1">
                    {t.widgets.myFarms.weeklyHistory}
                  </h3>
                  <div className="rounded-xl border border-border/20 bg-muted/30 overflow-hidden">
                    <div className="custom-scrollbar">
                      <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 bg-muted/80 z-10">
                          <tr className="border-b border-border/20">
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
                        <tbody className="divide-y divide-border/20">
                          {groupedWeeklyBreakdown
                            .reverse()
                            .map((week) => {
                              const inflationGlw =
                                Number(week.inflationRewards) / 1e18;
                              const weekProtocolDepositEntries =
                                getProtocolDepositDisplayEntries({
                                  byAsset: week.protocolDepositByAsset,
                                  isProtocolDepositUsd: farm.isProtocolDepositUsd,
                                });
                              const pdLabel =
                                weekProtocolDepositEntries.length > 0
                                  ? weekProtocolDepositEntries
                                      .map((entry) => entry.label)
                                      .join(" + ")
                                  : farm.isProtocolDepositUsd
                                  ? `${fmtUsdAmount(0)} ${protocolDepositAsset}`
                                  : `${formatTokenAmountByAsset(
                                      0,
                                      protocolDepositAsset
                                    )} ${protocolDepositAsset}`;
                              const totalLabel = getCombinedRewardsLabel({
                                inflationGlw,
                                protocolDepositEntries: weekProtocolDepositEntries,
                                isMiner,
                              });

                              return (
                                <tr
                                  key={week.weekNumber}
                                  className="hover:bg-muted/40 transition-colors group"
                                >
                                  <td className="py-3.5 px-6 font-mono text-muted-foreground text-xs group-hover:text-foreground transition-colors">
                                    #{week.weekNumber}
                                  </td>
                                  {!isMiner && (
                                    <td className="py-3.5 px-6 text-right font-mono text-delegation-purple text-sm tabular-nums">
                                      {pdLabel}
                                    </td>
                                  )}
                                  <td className="py-3.5 px-6 text-right font-mono text-[color:var(--color-miner-contrast)] text-sm tabular-nums">
                                    {fmtGlw(inflationGlw)}
                                    <span className="text-[10px] font-normal text-muted-foreground ml-1">
                                      GLW
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-6 text-right font-mono font-bold text-sm tabular-nums text-foreground">
                                    {totalLabel}
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
  const { t } = useLang();
  const { isConnected } = useAccount();
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "my_farms_grid_section";

  const [selectedFarm, setSelectedFarm] = React.useState<FarmCardData | null>(
    null,
  );
  const [viewMode, setViewMode] = React.useState<
    "default" | "compact" | "list" | "mosaic"
  >("default");
  const [sortBy, setSortBy] = React.useState<
    "default" | "alphabetical" | "size" | "date"
  >("default");
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

  // Last-epoch snapshot of per-wallet weekly rewards. Used by pending-start
  // cards so the displayed estimate is the value locked at the end of the
  // just-ended week, not the current-week live value which dilutes as more
  // delegators land on the farm (e.g. Beacon Knoll dropped from ~14k to
  // ~5.98k GLW between Sunday and Monday). Audited rewards for the previous
  // epoch don't post until Thursday; this fills the gap.
  const previousEpoch = React.useMemo(
    () => Math.max(getCurrentEpoch() - 1, 0),
    [],
  );
  const { farms: purchasedFarmsLastWeek } = useWalletFarmsAtWeek({
    walletAddress: walletAddress ?? undefined,
    week: previousEpoch,
    enabled: hasWallet,
  });
  const purchasedFarmsLastWeekById = React.useMemo(() => {
    const map = new Map<string, (typeof purchasedFarmsLastWeek)[number]>();
    for (const f of purchasedFarmsLastWeek) {
      map.set(f.farmId, f);
    }
    return map;
  }, [purchasedFarmsLastWeek]);

  const { regions, isRegionsLoading } = useRegions();

  const otherFarmIds = React.useMemo(() => {
    return (
      rewardsBreakdown?.otherFarmsWithRewards?.farms?.map((f) => f.farmId) ?? []
    );
  }, [rewardsBreakdown]);

  const shouldFetchSponsoredFarms =
    hasWallet && otherFarmIds.length > 0 && regions.length > 0;

  const { data: allSponsoredFarms, isLoading: isSponsoredFarmsLoading } =
    useQuery<SponsoredFarm[]>({
      queryKey: [
        "sponsored-farms-for-other",
        regions.map((region) => region.id).join(","),
      ],
      enabled: shouldFetchSponsoredFarms,
      staleTime: 5 * 60_000,
      queryFn: async () => {
        try {
          const regionIds = regions
            .map((region) => region.id)
            .filter((id) => Number.isFinite(id));
          const sponsoredFarmsByRegion = await Promise.all(
            regionIds.map((regionId) =>
              getRegionRouter().fetchRegionSolarFarms(regionId),
            ),
          );
          return sponsoredFarmsByRegion.flat();
        } catch {
          return [];
        }
      },
    });

  const otherFarmsMap = React.useMemo(() => {
    const map = new Map<string, SponsoredFarm>();
    if (!allSponsoredFarms) return map;
    for (const farm of allSponsoredFarms) {
      if (otherFarmIds.includes(farm.farmId)) {
        map.set(farm.farmId, farm);
      }
    }
    return map;
  }, [allSponsoredFarms, otherFarmIds]);

  const { spotPrice: glwSpotPriceUsd, isLoading: isSpotPriceLoading } =
    useGlowSpotPrice();

  const { activity: splitsActivity, isLoading: isSplitsActivityLoading } =
    useSplitsActivity({
      walletAddress: walletAddress ?? undefined,
      enabled: hasWallet,
      limit: 200,
    });

  const shouldLoadInProgress = hasWallet && splitsActivity.length > 0;
  const {
    sponsorListings,
    sponsorListingById,
    sponsorshipsInProgress,
    sponsorshipsInProgressWithEstimates,
    currentLaunchpadCurrencyByFarmId,
    launchpadCurrenciesByFarmId,
    launchpadDelegatedAmountsByFarmId,
    isSponsorListingsLoading,
    isRewardScoresLoading,
    isSgctlRewardScoresLoading,
  } = useWalletLaunchpadInProgress({
    splitsActivity,
    walletAddress: walletAddress ?? null,
    enabled: shouldLoadInProgress,
  });

  const {
    applications: miningCenterListings,
    isLoading: isMiningCenterListingsLoading,
  } = useMiningCenter({
    filters: { paymentCurrency: "USDC", includeFilled: true },
    enabled: shouldLoadInProgress,
  });

  // Evergreen miners are hidden from the public mining-center feed, so a buyer's
  // committed evergreen purchase has no listing metadata in `miningCenterListings`.
  // Fetch them separately and merge below so the pending-start card resolves its
  // region / image / est-weekly score instead of falling back to a bare card.
  const { applications: evergreenMinerListings } = useEvergreenMiners({
    filters: { paymentCurrency: "USDC", includeFilled: true },
    enabled: shouldLoadInProgress,
  });

  const { applications: visibleLaunchpadApplications } = useGlowLaunchpad({
    enabled: shouldLoadInProgress,
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
  }, [splitsActivity, miningCenterListings]);

  const miningCenterListingById = React.useMemo(() => {
    const map = new Map<string, (typeof miningCenterListings)[number]>();
    for (const app of miningCenterListings) {
      map.set(app.id, app);
    }
    // Merge evergreen listings so committed evergreen purchases resolve metadata.
    for (const app of evergreenMinerListings) {
      map.set(app.id, app);
    }
    return map;
  }, [miningCenterListings, evergreenMinerListings]);

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

  const { miningScoreMap, isLoading: isMiningScoresLoading } = useMiningScore({
    applications: miningCenterAppsForScores,
    extraLiveApplications: extraLiveLaunchpadApplications,
    enabled: shouldLoadInProgress && miningCenterAppsForScores.length > 0,
  });

  const miningCenterInProgressWithEstimates = React.useMemo(() => {
    return attachEstimatedWeeklyMiningCenterRewards({
      sponsorshipsInProgress: miningCenterInProgress,
      miningScoreMap,
    });
  }, [miningCenterInProgress, miningScoreMap]);

  const inProgressAmountByApplicationType = React.useMemo(() => {
    const amounts = new Map<string, bigint>();
    for (const evt of splitsActivity) {
      const applicationId = evt.applicationId;
      const fractionType = evt.fractionType;
      if (!applicationId || !fractionType) continue;
      try {
        const listing = sponsorListingById.get(applicationId);
        if (!isSplitActivityStillActive({ split: evt, listing })) continue;

        const amount = BigInt(evt.amount);
        const delegationCurrency =
          fractionType === "launchpad"
            ? resolveLaunchpadSplitCurrency({
                currency: evt.currency,
                amount: evt.amount,
                stepPrice: evt.stepPrice,
                transactionHash: evt.transactionHash,
                listingCurrency: listing
                  ? resolveDelegationCurrency(listing)
                  : null,
              })
            : null;
        const key =
          fractionType === "launchpad"
            ? `${applicationId}:${fractionType}:${delegationCurrency}`
            : `${applicationId}:${fractionType}`;
        amounts.set(key, (amounts.get(key) ?? 0n) + amount);
      } catch {}
    }
    return amounts;
  }, [splitsActivity, sponsorListingById]);

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

  const rewardedFarmTypeKeys = React.useMemo(() => {
    if (!rewardsBreakdown) return new Set<string>();
    return new Set(
      rewardsBreakdown.farmDetails.map(
        (f) =>
          `${f.farmId}:${
            f.type === "launchpad" ? "launchpad" : "mining-center"
          }`,
      ),
    );
  }, [rewardsBreakdown]);

  // For each mining-center farm, check whether the rewards-breakdown's
  // amountInvested already covers the wallet's total mining-center split
  // amount on that farm. When it does, a pending-start card is redundant
  // and its marketplace-step-price-based estimate is misleading (it uses
  // the *current* listing's step price, not the fraction the wallet
  // actually bought). Suppress those pending-start cards.
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

  const unsortedFarmCards = React.useMemo<FarmCardData[]>(() => {
    const cards: FarmCardData[] = [];

    // A recent purchase on an ALREADY-owned farm merges into its existing card
    // (no separate pending-start card shows), which confused users ("I can't
    // find my new miners"). recentPurchasesWithoutRewards lists which farms+types
    // just got a purchase; surface a "+$X added recently" note on that card. The
    // wallet-total recent amount maps cleanly to a figure only when a single
    // (farm, type) is recent, so we show the amount just then, else a plain note.
    const recentPairs: Array<{
      farmId: string;
      type: "launchpad" | "mining-center";
    }> = [];
    for (const entry of rewardsBreakdown?.recentPurchasesWithoutRewards ?? []) {
      for (const ty of entry.types) {
        recentPairs.push({ farmId: entry.farmId, type: ty });
      }
    }
    const recentUsdcAfter =
      Number(
        rewardsBreakdown?.delegatedAfterWeekRange?.totalUsdcSpentAfter ?? "0"
      ) / 1e6;
    const recentGlwAfter = parseGlwFromWei(
      rewardsBreakdown?.delegatedAfterWeekRange?.totalGlwDelegatedAfter ?? "0"
    );
    const recentMiningCount = recentPairs.filter(
      (p) => p.type === "mining-center"
    ).length;
    const recentLaunchpadCount = recentPairs.filter(
      (p) => p.type === "launchpad"
    ).length;
    const recentlyAddedNoteByFarmTypeKey = new Map<string, string>();
    for (const p of recentPairs) {
      let amountLabel: string | null = null;
      if (p.type === "mining-center" && recentMiningCount === 1 && recentUsdcAfter > 0) {
        amountLabel = fmtUsd(recentUsdcAfter);
      } else if (
        p.type === "launchpad" &&
        recentLaunchpadCount === 1 &&
        recentGlwAfter > 0
      ) {
        amountLabel = `${fmtGlw(recentGlwAfter)} GLW`;
      }
      recentlyAddedNoteByFarmTypeKey.set(
        `${p.farmId}:${p.type}`,
        t.widgets.myFarms.recentlyAddedNote(amountLabel)
      );
    }

    (rewardsBreakdown?.farmDetails ?? []).forEach((farm) => {
      const farmMetadata = purchasedFarms.find((f) => f.farmId === farm.farmId);
      const regionName = (() => {
        if (!farmMetadata) return "—";
        const region = regions.find((r) => r.id === farmMetadata.regionId);
        return region?.name || t.widgets.myFarms.fallbackRegion(farmMetadata.regionId);
      })();

      const displayName =
        farmMetadata?.name ||
        farmNameByFarmId.get(farm.farmId) ||
        t.widgets.myFarms.fallbackFarmName(farm.farmId.substring(0, 8));

      const imageUrls =
        farmMetadata?.afterInstallPictures?.map((p) => p.url) || [];
      if (imageUrls.length === 0) {
        imageUrls.push("/images/sections/residential.jpg");
      }

      if (farm.type === "launchpad") {
        const protocolDepositAsset = formatProtocolDepositAsset(
          farmMetadata?.userWeeklyRewards?.protocolDepositAsset ?? "GLW"
        );
        const initialCost = parseProtocolDepositTokenAmount(
          farm.amountInvested,
          protocolDepositAsset
        );
        const recovered = parseProtocolDepositTokenAmount(
          farm.totalProtocolDepositRewards,
          protocolDepositAsset
        );
        const inflation = parseGlwFromWei(farm.totalInflationRewards);
        cards.push({
          farmKey: `${farm.farmId}:delegation`,
          farmId: farm.farmId,
          farmName: displayName,
          regionName,
          imageUrls,
          type: "delegation",
          initialCost,
          recovered,
          inflation,
          inflationGlw: inflation,
          protocolDepositAsset,
          isProtocolDepositUsd: false,
          weeksActive: farm.totalWeeksEarned,
          totalWeeks: 100,
          weeklyBreakdown: farm.weeklyBreakdown,
          lastWeekRewardsGlw: parseGlwFromWei(farm.lastWeekRewards ?? "0"),
          delegatedAmountsByAsset:
            launchpadDelegatedAmountsByFarmId.get(farm.farmId),
          recentlyAddedNote:
            recentlyAddedNoteByFarmTypeKey.get(`${farm.farmId}:launchpad`) ??
            null,
        });
      } else {
        const initialCostUsd = parseUsdcFromBaseUnits(farm.amountInvested);
        const inflationGlw = parseGlwFromWei(farm.totalInflationRewards);
        const inflationUsd =
          Number.isFinite(glwSpotPriceUsd ?? NaN) && (glwSpotPriceUsd ?? 0) > 0
            ? inflationGlw * (glwSpotPriceUsd ?? 0)
            : 0;

        cards.push({
          farmKey: `${farm.farmId}:miner`,
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
          lastWeekRewardsGlw: parseGlwFromWei(farm.lastWeekRewards ?? "0"),
          recentlyAddedNote:
            recentlyAddedNoteByFarmTypeKey.get(
              `${farm.farmId}:mining-center`
            ) ?? null,
        });
      }
    });

    (rewardsBreakdown?.otherFarmsWithRewards?.farms ?? []).forEach((farm) => {
      const displayName =
        farm.farmName || `Farm ${farm.farmId.substring(0, 8)}`;

      const farmMetadata =
        purchasedFarms.find((f) => f.farmId === farm.farmId) ||
        otherFarmsMap.get(farm.farmId);
      const imageUrls =
        farmMetadata?.afterInstallPictures?.map((p) => p.url) || [];
      if (imageUrls.length === 0) {
        imageUrls.push("/images/sections/residential.jpg");
      }

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

      cards.push({
        farmKey: `${farm.farmId}:other`,
        farmId: farm.farmId,
        farmName: displayName,
        regionName: "Clean Grid Project",
        imageUrls,
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
        lastWeekRewardsGlw: parseGlwFromWei(farm.lastWeekRewards ?? "0"),
      });
    });

    // Add Pending Start Cards
    const pendingByFarm = new Map<
      string,
      {
        farmId: string;
        applicationId: string;
        farmName: string;
        fractionType: "launchpad" | "mining-center";
        launchpadCurrency?: "GLW" | "SGCTL";
        totalAmount: bigint;
        totalStepsPurchased: number;
        latestPurchaseDate: string | null;
      }
    >();

    for (const evt of splitsActivity) {
      const fractionType = evt.fractionType;
      if (!fractionType) continue;
      const status = (evt.fractionStatus ?? "").toLowerCase();

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
      const hasCurrentOwnership = purchasedFarms.some((f) => f.farmId === farmId);
      const isAccountedForByRewards =
        fractionType === "mining-center" &&
        fullyAccountedMiningCenterFarmIds.has(farmId);
      const includePendingStartCard = shouldIncludePendingStartCard({
        fractionType,
        status,
        farmTypeKey,
        rewardedFarmTypeKeys,
        hasCurrentOwnership,
        purchaseDate: evt.purchaseDate ?? null,
        isAccountedForByRewards,
      });

      if (!includePendingStartCard) {
        // Multi-asset launchpad exception:
        // if this farm already has a rewarded card, still show pending-start for the
        // currently-selected launchpad currency when multiple delegation currencies exist.
        if (
          fractionType !== "launchpad" ||
          !hasCurrentOwnership ||
          status !== "filled" ||
          !rewardedFarmTypeKeys.has(farmTypeKey)
        ) {
          continue;
        }

        const currencies = launchpadCurrenciesByFarmId.get(farmId);
        const hasMultipleLaunchpadCurrencies = (currencies?.size ?? 0) > 1;
        const currentLaunchpadCurrency =
          currentLaunchpadCurrencyByFarmId.get(farmId);

        if (
          !hasMultipleLaunchpadCurrencies ||
          !launchpadCurrency ||
          !currentLaunchpadCurrency ||
          launchpadCurrency !== currentLaunchpadCurrency
        ) {
          continue;
        }
      }

      let amount = BigInt(0);
      try {
        amount = BigInt(evt.amount);
      } catch {
        amount = BigInt(0);
      }

      // Launchpad positions can contain both SGCTL and GLW purchases for the same
      // farm after the handoff. Show one pending-start card per farm, not per asset.
      const pendingKey = farmTypeKey;

      const existing = pendingByFarm.get(pendingKey) ?? {
        farmId,
        applicationId: evt.applicationId,
        farmName: evt.farmName || `Farm ${farmId.substring(0, 8)}`,
        fractionType,
        launchpadCurrency,
        totalAmount: BigInt(0),
        totalStepsPurchased: 0,
        latestPurchaseDate: evt.purchaseDate ?? null,
      };
      if (fractionType !== "launchpad") {
        existing.totalAmount += amount;
      }
      existing.totalStepsPurchased += evt.stepsPurchased ?? 0;
      if (
        evt.purchaseDate &&
        (!existing.latestPurchaseDate ||
          Date.parse(evt.purchaseDate) > Date.parse(existing.latestPurchaseDate))
      ) {
        existing.latestPurchaseDate = evt.purchaseDate;
      }
      pendingByFarm.set(pendingKey, existing);
    }

    pendingByFarm.forEach((item) => {
      // Try to find images from purchasedFarms first, then sponsorListings/miningCenterListings
      const currentFarmMetadata = purchasedFarms.find(
        (f) => f.farmId === item.farmId,
      );
      // Prefer the previous-epoch simulation for the rewards estimate so the
      // pending-start card doesn't shift as same-week delegators dilute the
      // live per-share. Fall back to the current-week metadata if the wallet
      // didn't yet hold this farm last week (e.g. fresh delegation today).
      const lastWeekFarmMetadata = purchasedFarmsLastWeekById.get(item.farmId);
      const farmMetadata = lastWeekFarmMetadata ?? currentFarmMetadata;
      const pendingLaunchpadListing = sponsorListingById.get(item.applicationId);
      const pendingMiningCenterListing = miningCenterListingById.get(
        item.applicationId
      );
      const imageUrls =
        farmMetadata?.afterInstallPictures?.map((p) => p.url) || [];
      const regionName =
        (() => {
          if (farmMetadata) {
            const region = regions.find((r) => r.id === farmMetadata.regionId);
            if (region?.name) return region.name;
          }

          if (item.fractionType === "launchpad") {
            return pendingLaunchpadListing?.zone?.name || "Launchpad";
          }

          return pendingMiningCenterListing?.zone?.name || "Miner";
        })();

      // If no images from purchasedFarms, try listings
      if (imageUrls.length === 0) {
        if (item.fractionType === "launchpad") {
          const app =
            pendingLaunchpadListing ??
            sponsorListings?.find((a) => a.id === item.farmId);
          if (app?.afterInstallPictures?.length) {
            app.afterInstallPictures.forEach((p) => imageUrls.push(p.url));
          }
        } else {
          const app =
            pendingMiningCenterListing ??
            miningCenterListings?.find((a) => a.id === item.farmId);
          if (app?.afterInstallPictures?.length) {
            app.afterInstallPictures.forEach((p) => imageUrls.push(p.url));
          }
        }
      }

      if (imageUrls.length === 0) {
        imageUrls.push("/images/sections/residential.jpg");
      }

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
        Boolean(farmMetadata?.userWeeklyRewards?.glwInflationRewardsFromMiner);

      if (canUseCurrentMinerRewardEstimate) {
        // For brand-new miner purchases on farms that do not yet have any
        // settled miner reward history for this wallet, prefer the current
        // wallet-specific split from Control. The marketplace listing's
        // activeFraction can move on to a newer fraction on the same
        // application, which underestimates the owned pending position.
        estimatedUserWeeklyGlw = parseGlwFromWei(
          farmMetadata?.userWeeklyRewards?.glwInflationRewardsFromMiner ?? "0",
        );
      } else if (pendingMiningScore && item.totalStepsPurchased > 0) {
        estimatedUserWeeklyGlw = estimateMiningCenterWeeklyGlw({
          miningScore: pendingMiningScore,
          userSteps: item.totalStepsPurchased,
        });
      } else if (farmMetadata?.userWeeklyRewards) {
        // Use source-specific breakdown if available (prevents double-counting for farms with both delegation + miner)
        const isMiningCenter = item.fractionType === "mining-center";
        const pdAsset = formatProtocolDepositAsset(
          farmMetadata.userWeeklyRewards.protocolDepositAsset
        );
        // Only fold a non-GLW (SGCTL) PD line in when it matches the wallet's OWN
        // delegation leg on this farm. The backend now reports the wallet's
        // per-leg protocolDepositAsset, so a GLW-leg delegator gets pdAsset ===
        // "GLW" (folded into the GLW total via pdGlw below) and an SGCTL-leg
        // delegator gets pdAsset === item.launchpadCurrency. The old
        // !hasMultipleLaunchpadCurrencies short-circuit derived from the WALLET's
        // own currency set, so a GLW-only delegator (size 1) bypassed the asset
        // check and inherited the farm's SGCTL PD line; that disjunct is removed.
        const canUsePdForLaunchpadEstimate =
          item.fractionType !== "launchpad" ||
          pdAsset === "GLW" ||
          pdAsset === item.launchpadCurrency;

        if (
          isMiningCenter &&
          farmMetadata.userWeeklyRewards.glwInflationRewardsFromMiner
        ) {
          // Miner: only inflation from mining-center splits (no PD recovery)
          estimatedUserWeeklyGlw = parseGlwFromWei(
            farmMetadata.userWeeklyRewards.glwInflationRewardsFromMiner,
          );
        } else if (
          !isMiningCenter &&
          farmMetadata.userWeeklyRewards.glwInflationRewardsFromDelegation
        ) {
          // Delegation: inflation from delegation splits + PD recovery
          const delegationInflationGlw = parseGlwFromWei(
            farmMetadata.userWeeklyRewards.glwInflationRewardsFromDelegation,
          );
          const pdAmount = canUsePdForLaunchpadEstimate
            ? parseProtocolDepositTokenAmount(
                farmMetadata.userWeeklyRewards.protocolDepositRewards,
                pdAsset
              )
            : 0;
          const pdGlw = pdAsset === "GLW" ? pdAmount : 0;
          if (canUsePdForLaunchpadEstimate && pdAsset !== "GLW" && pdAmount > 0) {
            estimatedUserWeeklyPd = pdAmount;
            estimatedUserWeeklyPdAsset = pdAsset;
          }
          estimatedUserWeeklyGlw = delegationInflationGlw + pdGlw;
        } else {
          // Fallback for old API response (no breakdown fields)
          const inflationGlw = parseGlwFromWei(
            farmMetadata.userWeeklyRewards.glwInflationRewards,
          );
          const pdAmount = canUsePdForLaunchpadEstimate
            ? parseProtocolDepositTokenAmount(
                farmMetadata.userWeeklyRewards.protocolDepositRewards,
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
        const launchpadApp = sponsorListings?.find((a) => a.id === item.farmId);
        const launchpadCurrency =
          item.launchpadCurrency ?? resolveDelegationCurrency(launchpadApp);
        const delegatedAmounts =
          launchpadDelegatedAmountsByFarmId.get(item.farmId) ?? undefined;
        const initialCost =
          delegatedAmounts?.[launchpadCurrency] ??
          parseDelegationAmountFromBaseUnits(
            item.totalAmount.toString(),
            launchpadCurrency
          );
        cards.push({
          farmKey: `${item.farmId}:delegation:${launchpadCurrency}:pending-start`,
          farmId: item.farmId,
          farmName: item.farmName,
          regionName,
          imageUrls,
          type: "delegation", // Explicitly delegation
          isPendingStart: true,
          initialCost,
          recovered: 0,
          inflation: 0,
          inflationGlw: 0,
          protocolDepositAsset: launchpadCurrency,
          isProtocolDepositUsd: false,
          weeksActive: 0,
          totalWeeks: 100,
          weeklyBreakdown: [],
          estimatedUserWeeklyGlw,
          estimatedUserWeeklyPd,
          estimatedUserWeeklyPdAsset,
          delegatedAmountsByAsset: delegatedAmounts,
          pendingPurchaseDate: item.latestPurchaseDate,
        });
      } else {
        const initialCostUsd = parseUsdcFromBaseUnits(
          item.totalAmount.toString(),
        );
        cards.push({
          farmKey: `${item.farmId}:miner:pending-start`,
          farmId: item.farmId,
          farmName: item.farmName,
          regionName,
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
          estimatedUserWeeklyGlw,
          estimatedUserWeeklyPd,
          estimatedUserWeeklyPdAsset,
          pendingPurchaseDate: item.latestPurchaseDate,
        });
      }
    });

    const inProgressCards = new Map<string, FarmCardData>();

    [
      ...sponsorshipsInProgressWithEstimates,
      ...miningCenterInProgressWithEstimates,
    ].forEach((item) => {
      const app = item.application;
      const zoneName = app?.zone?.name || t.widgets.myFarms.fallbackZone;
      const launchpadDelegationCurrency =
        item.fractionType === "launchpad"
          ? item.delegationCurrency ?? resolveDelegationCurrency(app)
          : null;
      const launchpadCurrency = launchpadDelegationCurrency ?? "USDC";
      const rowFarmId = app?.farmId ?? item.applicationId;
      const displayName =
        app?.farmName || t.widgets.myFarms.fallbackFarmName(item.applicationId.substring(0, 8));
      const imageUrls = app?.afterInstallPictures?.map((p) => p.url) || [];
      if (imageUrls.length === 0) {
        imageUrls.push("/images/sections/residential.jpg");
      }

      const amountAtomic =
        inProgressAmountByApplicationType.get(
          item.fractionType === "launchpad"
            ? `${item.applicationId}:${item.fractionType}:${launchpadCurrency}`
            : `${item.applicationId}:${item.fractionType}`
        ) ?? 0n;
      const initialCost =
        launchpadDelegationCurrency
          ? parseDelegationAmountFromBaseUnits(
              amountAtomic.toString(),
              launchpadDelegationCurrency
            )
          : parseUsdcFromBaseUnits(amountAtomic.toString());
      const farmKey =
        item.fractionType === "launchpad"
          ? `${rowFarmId}:in-progress:${item.fractionType}`
          : `${item.applicationId}:in-progress:${item.fractionType}`;
      const baseCard: FarmCardData = {
        farmKey,
        farmId: rowFarmId,
        farmName: displayName,
        regionName: zoneName,
        imageUrls,
        type: "in-progress",
        inProgressKind: item.fractionType,
        initialCost,
        recovered: 0,
        inflation: 0,
        inflationGlw: 0,
        protocolDepositAsset:
          item.fractionType === "launchpad"
            ? resolveDelegationCurrency(app)
            : launchpadCurrency,
        isProtocolDepositUsd: item.fractionType === "mining-center",
        weeksActive: 0,
        totalWeeks: 1,
        weeklyBreakdown: [],
        inProgressPercent: item.progressPercent ?? 0,
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
      };

      const existing = inProgressCards.get(farmKey);
      if (!existing) {
        inProgressCards.set(farmKey, baseCard);
        return;
      }

      existing.initialCost += baseCard.initialCost;
      existing.inProgressPercent = Math.max(
        existing.inProgressPercent ?? 0,
        baseCard.inProgressPercent ?? 0
      );
      existing.estimatedUserWeeklyGlw =
        (existing.estimatedUserWeeklyGlw ?? 0) +
        (baseCard.estimatedUserWeeklyGlw ?? 0);
      existing.estimatedUserWeeklyUsd =
        (existing.estimatedUserWeeklyUsd ?? 0) +
        (baseCard.estimatedUserWeeklyUsd ?? 0);
      existing.delegatedAmountsByAsset =
        item.fractionType === "launchpad"
          ? launchpadDelegatedAmountsByFarmId.get(rowFarmId)
          : existing.delegatedAmountsByAsset;

      const existingPdAsset = existing.estimatedUserWeeklyPdAsset ?? null;
      const basePdAsset = baseCard.estimatedUserWeeklyPdAsset ?? null;
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
          (baseCard.estimatedUserWeeklyPd ?? 0);
        existing.estimatedUserWeeklyPdAsset =
          existingPdAsset ?? basePdAsset;
      }
    });

    cards.push(...inProgressCards.values());

    return cards;
  }, [
    farmNameByFarmId,
    glwSpotPriceUsd,
    miningCenterInProgressWithEstimates,
    otherFarmsMap,
    purchasedFarms,
    purchasedFarmsLastWeekById,
    regions,
    rewardsBreakdown,
    rewardedFarmTypeKeys,
    fullyAccountedMiningCenterFarmIds,
    splitsActivity,
    inProgressAmountByApplicationType,
    launchpadDelegatedAmountsByFarmId,
    sponsorListings,
    sponsorListingById,
    launchpadCurrenciesByFarmId,
    currentLaunchpadCurrencyByFarmId,
    miningCenterListings,
    miningCenterListingById,
    miningScoreMap,
    sponsorshipsInProgressWithEstimates,
  ]);

  // Shop-purchased miners: a GLW emission split transferred from the
  // Foundation. Not in the CRM rewards breakdown (it's a control-side split),
  // so they're sourced separately from the wallet's shop purchase history and
  // rendered as miner cards badged "Shop miner".
  const { holdings: shopMinerHoldings, isLoading: isShopMinersLoading } =
    useShopMinerHoldings(walletAddress);

  const shopMinerCards = React.useMemo<FarmCardData[]>(() => {
    const currentEpoch = getCurrentEpoch();
    return shopMinerHoldings.map((h) => ({
      farmKey: `shop-miner-${h.farmId}`,
      farmId: h.farmId,
      farmName: h.farmName ?? "Solar farm",
      regionName: t.widgets.myFarms.shopMinerSource,
      imageUrls: h.imageUrl ? [h.imageUrl] : [],
      type: "miner" as const,
      isShopMiner: true,
      shopPointsCost: h.pricePoints,
      initialCost: h.minerValueUsd,
      recovered: 0,
      inflation: 0,
      inflationGlw: 0,
      protocolDepositAsset: null,
      isProtocolDepositUsd: false,
      weeksActive: 0,
      totalWeeks: h.weeksRemaining ?? 0,
      weeklyBreakdown: [],
      estimatedUserWeeklyGlw: h.weeklyGlwRewards ?? undefined,
      estimatedUserWeeklyUsd: h.weeklyGlwRewardsUsd ?? undefined,
      // Glow + "added recently" note for a points-shop miner bought in the
      // current protocol epoch (its card path carries no recentlyAddedNote/
      // isPendingStart signal otherwise).
      isNewThisWeek:
        h.latestPurchaseAtMs != null &&
        dateToEpoch(new Date(h.latestPurchaseAtMs)) === currentEpoch,
      recentlyAddedNote:
        h.recentValueUsd > 0
          ? t.widgets.myFarms.recentlyAddedNote(fmtUsd(h.recentValueUsd))
          : null,
    }));
  }, [
    shopMinerHoldings,
    t.widgets.myFarms.shopMinerSource,
    t.widgets.myFarms.recentlyAddedNote,
  ]);

  const farmCards = React.useMemo(() => {
    const cards = mergeShopMinerCards(unsortedFarmCards, shopMinerCards);

    const getSize = (f: FarmCardData) => {
      const price = glwSpotPriceUsd || 0;
      // If miner, initialCost is USD
      if (
        f.type === "miner" ||
        f.protocolDepositAsset === "USDC" ||
        f.protocolDepositAsset === "USDG"
      ) {
        return f.initialCost;
      }
      // GLW-denominated delegations can be converted to USD for size sorting.
      if (formatProtocolDepositAsset(f.protocolDepositAsset) === "GLW") {
        return f.initialCost * (price > 0 ? price : 0);
      }
      // Non-USD/Non-GLW assets (e.g. SGCTL): keep native magnitude for sort.
      return f.initialCost;
    };

    switch (sortBy) {
      case "alphabetical":
        return cards.sort((a, b) => a.farmName.localeCompare(b.farmName));
      case "size":
        // Descending size
        return cards.sort((a, b) => getSize(b) - getSize(a));
      case "date":
        // Newest first
        return cards.sort((a, b) => {
          const isAPending = isFarmNewThisWeek(a) || a.type === "in-progress";
          const isBPending = isFarmNewThisWeek(b) || b.type === "in-progress";

          if (isAPending && !isBPending) return -1;
          if (!isAPending && isBPending) return 1;

          if (isAPending && isBPending) {
            return (b.inProgressPercent || 0) - (a.inProgressPercent || 0);
          }

          return a.weeksActive - b.weeksActive;
        });
      default:
        return cards.sort((a, b) => {
          // New-this-week buys (a fresh pending position or a merged purchase)
          // float to the very top so the user sees what they just bought.
          const aNew = isFarmNewThisWeek(a);
          const bNew = isFarmNewThisWeek(b);
          if (aNew && !bNew) return -1;
          if (!aNew && bNew) return 1;
          if (a.type === "in-progress" && b.type !== "in-progress") return -1;
          if (a.type !== "in-progress" && b.type === "in-progress") return 1;
          const totalA = a.recovered + a.inflationGlw;
          const totalB = b.recovered + b.inflationGlw;
          return totalB - totalA;
        });
    }
  }, [unsortedFarmCards, shopMinerCards, sortBy, glwSpotPriceUsd]);

  const isLoading =
    isRewardsLoading ||
    isShopMinersLoading ||
    isFarmsLoading ||
    isRegionsLoading ||
    isSplitsActivityLoading ||
    isSponsorListingsLoading ||
    isMiningCenterListingsLoading ||
    isRewardScoresLoading ||
    isSgctlRewardScoresLoading ||
    isMiningScoresLoading ||
    isSponsoredFarmsLoading;

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
          {!isRewardsError && <GlowSymbol className="w-10 h-10 opacity-20" />}
          <p className="text-sm font-mono uppercase tracking-wider">
            {isRewardsError
              ? t.widgets.myFarms.unableToLoad
              : t.widgets.myFarms.noFarmsFound}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:block">
            {t.widgets.myFarms.sortBy}
          </span>
          <Select
            value={sortBy}
            onValueChange={(v) => {
              trackEvent("dashboard_my_farms_sort_change", {
                source,
                wallet_connected: isConnected,
                wallet_address: normalizedWalletAddress,
                sort_by: v,
              });
              setSortBy(v as "default" | "alphabetical" | "size" | "date");
            }}
          >
            <SelectTrigger className="w-[120px] sm:w-[160px] h-9 text-xs sm:text-sm">
              <SelectValue placeholder={t.widgets.myFarms.sortPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{t.widgets.myFarms.sortDefault}</SelectItem>
              <SelectItem value="date">{t.widgets.myFarms.sortNewest}</SelectItem>
              <SelectItem value="alphabetical">{t.widgets.myFarms.sortAlphabetical}</SelectItem>
              <SelectItem value="size">{t.widgets.myFarms.sortSize}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center bg-muted/30 dark:bg-muted/50 p-1 rounded-lg border border-border/20 dark:border-border/40">
          <Button
            variant={viewMode === "default" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 md:px-2.5 text-xs font-medium"
            onClick={() => {
              trackEvent("dashboard_my_farms_view_change", {
                source,
                wallet_connected: isConnected,
                wallet_address: normalizedWalletAddress,
                view_mode: "default",
              });
              setViewMode("default");
            }}
          >
            <LayoutGrid className="w-3.5 h-3.5 md:mr-1.5" />
            <span className="hidden md:inline">{t.widgets.myFarms.viewDefault}</span>
          </Button>
          <Button
            variant={viewMode === "compact" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 md:px-2.5 text-xs font-medium"
            onClick={() => {
              trackEvent("dashboard_my_farms_view_change", {
                source,
                wallet_connected: isConnected,
                wallet_address: normalizedWalletAddress,
                view_mode: "compact",
              });
              setViewMode("compact");
            }}
          >
            <Grid3x3 className="w-3.5 h-3.5 md:mr-1.5" />
            <span className="hidden md:inline">{t.widgets.myFarms.viewCompact}</span>
          </Button>
          <Button
            variant={viewMode === "mosaic" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 md:px-2.5 text-xs font-medium"
            onClick={() => {
              trackEvent("dashboard_my_farms_view_change", {
                source,
                wallet_connected: isConnected,
                wallet_address: normalizedWalletAddress,
                view_mode: "mosaic",
              });
              setViewMode("mosaic");
            }}
          >
            <ImageIcon className="w-3.5 h-3.5 md:mr-1.5" />
            <span className="hidden md:inline">{t.widgets.myFarms.viewMosaic}</span>
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 md:px-2.5 text-xs font-medium"
            onClick={() => {
              trackEvent("dashboard_my_farms_view_change", {
                source,
                wallet_connected: isConnected,
                wallet_address: normalizedWalletAddress,
                view_mode: "list",
              });
              setViewMode("list");
            }}
          >
            <List className="w-3.5 h-3.5 md:mr-1.5" />
            <span className="hidden md:inline">{t.widgets.myFarms.viewList}</span>
          </Button>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 overflow-hidden mb-8">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/20 dark:border-border/40">
                <TableHead className="w-full sm:w-[300px] text-[10px] uppercase tracking-wider font-mono font-bold">
                  {t.widgets.myFarms.listItem}
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-mono font-bold">
                  {t.widgets.myFarms.listStatus}
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-mono font-bold text-right">
                  {t.widgets.myFarms.listActive}
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-mono font-bold text-right">
                  {t.widgets.myFarms.listCost}
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-mono font-bold text-right">
                  {t.widgets.myFarms.listEarned}
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-mono font-bold text-right">
                  {t.widgets.myFarms.listLastWeek}
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-mono font-bold text-right">
                  {t.widgets.myFarms.listProgress}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {farmCards.map((farm) => {
                const isInProgress = farm.type === "in-progress";
                const isMiner = farm.type === "miner";
                const isDelegation = farm.type === "delegation";
                const isPendingStart = Boolean(farm.isPendingStart);
                const pendingTimeline = getPendingStartTimelineCopy({
                  positionLabel: getPendingStartPositionLabel(farm, t.widgets.myFarms),
                  purchaseDate: farm.pendingPurchaseDate,
                  labels: t.widgets.myFarms,
                });
                const inProgressIsMiningCenter =
                  isInProgress && farm.inProgressKind === "mining-center";
                const timeBasedProgress =
                  (farm.weeksActive / Math.max(farm.totalWeeks, 1)) * 100;
                const isOther = farm.type === "other";
                const roiPercent =
                  isMiner || isOther
                    ? timeBasedProgress
                    : farm.initialCost > 0
                      ? ((farm.recovered + farm.inflation) / farm.initialCost) *
                        100
                      : 0;

                return (
                  <TableRow
                    key={farm.farmKey}
                    data-farm-id={farm.farmId}
                    className={cn(
                      "cursor-pointer border-border/20 dark:border-border/40 hover:bg-muted/50 dark:hover:bg-muted/60 transition-colors group",
                      isFarmNewThisWeek(farm) &&
                        "ring-2 ring-inset ring-emerald-500/40 dark:ring-[color:var(--color-glow-green)]/50",
                    )}
                    onClick={() => {
                      trackEvent("dashboard_my_farm_click", {
                        source,
                        wallet_connected: isConnected,
                        wallet_address: normalizedWalletAddress,
                        farm_id: farm.farmId,
                        farm_type: farm.type,
                      });
                      setSelectedFarm(farm);
                    }}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted/20">
                          <FallbackImage
                            src={farm.imageUrls[0]}
                            widthForProxy={100}
                            quality={70}
                            alt={farm.farmName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="truncate font-bold text-sm">
                            {farm.farmName}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                            {farm.regionName}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isInProgress ? (
                        <div
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold font-mono uppercase tracking-wider border",
                            inProgressIsMiningCenter
                              ? "border-[color:var(--color-miner)]/30 bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner)]"
                              : "border-delegation-purple/30 bg-delegation-purple/10 text-delegation-purple",
                          )}
                        >
                          {t.widgets.myFarms.listInProgressStatus}
                        </div>
                      ) : isPendingStart ? (
                        <div className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold font-mono uppercase tracking-wider border bg-muted/50 text-muted-foreground border-border/40">
                          {pendingTimeline?.badgeLabel ?? t.widgets.myFarms.listPending}
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold font-mono uppercase tracking-wider border",
                            isMiner
                              ? "border-[color:var(--color-miner)]/30 bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner)]"
                              : isDelegation
                                ? "border-delegation-purple/30 bg-delegation-purple/10 text-delegation-purple"
                                : "border-[color:var(--color-glow-green)]/30 bg-[color:var(--color-glow-green)]/10 text-emerald-700 dark:text-[color:var(--color-glow-green)]",
                          )}
                        >
                          {isMiner
                            ? farm.isShopMiner
                              ? t.widgets.myFarms.typeShopMiner
                              : t.widgets.myFarms.typeMiner
                            : isDelegation
                              ? t.widgets.myFarms.typeDelegation
                              : t.widgets.myFarms.typeRewards}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {isPendingStart
                        ? pendingTimeline?.statusLabel ?? t.widgets.myFarms.listProcessing
                        : isInProgress
                          ? "—"
                          : t.widgets.myFarms.wksFormat(farm.weeksActive, farm.totalWeeks)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {isInProgress
                        ? inProgressIsMiningCenter
                          ? fmtUsd(farm.initialCost)
                          : formatDelegatedAmountsByAsset({
                              amounts: farm.delegatedAmountsByAsset,
                              fallbackAmount: farm.initialCost,
                              fallbackAsset: farm.protocolDepositAsset,
                            })
                        : isMiner
                          ? fmtUsd(farm.initialCost)
                          : formatDelegatedAmountsByAsset({
                              amounts: farm.delegatedAmountsByAsset,
                              fallbackAmount: farm.initialCost,
                              fallbackAsset: farm.protocolDepositAsset,
                            })}
                    </TableCell>
                    <TableCell className="text-right">
                      {isInProgress ? (
                        <span className="font-mono text-xs tabular-nums font-bold text-muted-foreground">
                          {formatEstimatedWeeklyRewards({
                            estimatedUserWeeklyGlw: farm.estimatedUserWeeklyGlw,
                            estimatedUserWeeklyUsd: farm.estimatedUserWeeklyUsd,
                            estimatedUserWeeklyPd: farm.estimatedUserWeeklyPd,
                            estimatedUserWeeklyPdAsset:
                              farm.estimatedUserWeeklyPdAsset ??
                              farm.protocolDepositAsset,
                          }) ?? "—"}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "font-mono text-xs tabular-nums font-bold",
                            isPendingStart
                              ? "text-muted-foreground"
                              : isMiner
                                ? "text-[color:var(--color-miner-contrast)]"
                                : isDelegation
                                  ? "text-delegation-purple"
                                  : "text-emerald-700 dark:text-[color:var(--color-glow-green)]",
                          )}
                        >
                          {isPendingStart
                            ? formatEstimatedWeeklyRewards({
                                estimatedUserWeeklyGlw: farm.estimatedUserWeeklyGlw,
                                estimatedUserWeeklyUsd: farm.estimatedUserWeeklyUsd,
                                estimatedUserWeeklyPd: farm.estimatedUserWeeklyPd,
                                estimatedUserWeeklyPdAsset:
                                  farm.estimatedUserWeeklyPdAsset ??
                                  farm.protocolDepositAsset,
                              }) ?? t.widgets.myFarms.calculating
                            : getFarmEarnedLabel(farm)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isInProgress || isPendingStart ? (
                        <span className="text-muted-foreground text-xs font-mono">
                          —
                        </span>
                      ) : (
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {getFarmLastWeekLabel(farm) ?? "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isInProgress ? (
                        <div className="flex items-center justify-end gap-2">
                          <Progress
                            value={farm.inProgressPercent ?? 0}
                            className="h-1.5 w-16 bg-muted"
                          />
                          <span className="font-mono text-xs font-bold w-8 text-right">
                            {Math.round(farm.inProgressPercent ?? 0)}%
                          </span>
                        </div>
                      ) : isPendingStart ? (
                        <span className="text-muted-foreground text-xs font-mono">
                          {pendingTimeline?.timelineValue ?? t.widgets.myFarms.listPending}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "font-mono text-xs font-bold",
                            roiPercent >= 100
                              ? "text-emerald-500"
                              : "text-muted-foreground",
                          )}
                        >
                          {roiPercent.toFixed(0)}%
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4 transition-all duration-300 pb-8",
            viewMode === "mosaic"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              : viewMode === "compact"
                ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
          )}
        >
          {farmCards.map((farm) =>
            viewMode === "mosaic" ? (
              <FarmMosaicCard
                key={farm.farmKey}
                farm={farm}
                onClick={() => {
                  trackEvent("dashboard_my_farm_click", {
                    source,
                    wallet_connected: isConnected,
                    wallet_address: normalizedWalletAddress,
                    farm_id: farm.farmId,
                    farm_type: farm.type,
                  });
                  setSelectedFarm(farm);
                }}
              />
            ) : (
              <FarmCard
                key={farm.farmKey}
                farm={farm}
                onClick={() => {
                  trackEvent("dashboard_my_farm_click", {
                    source,
                    wallet_connected: isConnected,
                    wallet_address: normalizedWalletAddress,
                    farm_id: farm.farmId,
                    farm_type: farm.type,
                  });
                  setSelectedFarm(farm);
                }}
                isCompact={viewMode === "compact"}
                showAuditButton={viewMode === "default"}
              />
            ),
          )}
        </div>
      )}

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
