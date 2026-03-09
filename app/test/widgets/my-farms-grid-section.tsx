"use client";

import React from "react";
import {
  Gift,
  ChevronRight,
  Clock,
  X,
  LayoutGrid,
  Grid3x3,
  List,
  Image as ImageIcon,
  ExternalLink,
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
import { useQuery } from "@tanstack/react-query";
import { getRegionRouter } from "@/lib/api/control-routers";
import type { SponsoredFarm } from "@glowlabs-org/utils/browser";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import {
  attachEstimatedWeeklyLaunchpadRewards,
  attachEstimatedWeeklyMiningCenterRewards,
  deriveLaunchpadSponsorshipsInProgress,
  deriveMiningCenterSponsorshipsInProgress,
} from "@/utils/sponsorships-in-progress";
import {
  normalizeDelegationCurrency,
  parseDelegationAmountFromBaseUnits,
  resolveDelegationCurrency,
} from "@/utils/launchpad-rewards";

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

function getFarmEarnedLabel(farm: FarmCardData): string {
  const protocolDepositAsset = formatProtocolDepositAsset(
    farm.protocolDepositAsset
  );
  if (farm.isProtocolDepositUsd) {
    return `${fmtGlw(farm.inflationGlw)} GLW + ${fmtUsdAmount(
      farm.recovered
    )} ${protocolDepositAsset}`;
  }
  if (protocolDepositAsset !== "GLW") {
    return `${fmtGlw(farm.inflationGlw)} GLW + ${fmtGlw(farm.recovered)} ${protocolDepositAsset}`;
  }
  return `${fmtGlw(farm.recovered + farm.inflationGlw)} GLW`;
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
  lastWeekRewardsGlw?: number;
  inProgressPercent?: number;
  estimatedUserWeeklyGlw?: number;
  estimatedUserWeeklyUsd?: number;
  isPendingStart?: boolean;
}

interface FarmListRowProps {
  farm: FarmCardData;
  onClick: () => void;
}

interface FarmMosaicCardProps {
  farm: FarmCardData;
  onClick: () => void;
}

function FarmMosaicCard({ farm, onClick }: FarmMosaicCardProps) {
  const isPendingStart = Boolean(farm.isPendingStart);

  return (
    <Card
      data-farm-id={farm.farmId}
      className="group relative overflow-hidden cursor-pointer bg-muted/30 dark:bg-muted/50 hover:bg-muted/50 dark:hover:bg-muted/60 transition-colors border-border/20 dark:border-border/40 p-0 gap-0 h-full"
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
              Soon
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
  const isInProgress = farm.type === "in-progress";
  const isMiner = farm.type === "miner";
  const isDelegation = farm.type === "delegation";
  const isOther = farm.type === "other";
  const isPendingStart = Boolean(farm.isPendingStart);
  const inProgressIsMiningCenter =
    isInProgress && farm.inProgressKind === "mining-center";
  const auditUrl = showAuditButton ? getAuditUrl({ id: farm.farmId }) : null;

  const totalValue = farm.recovered + farm.inflation;
  const timeBasedProgress =
    (farm.weeksActive / Math.max(farm.totalWeeks, 1)) * 100;
  const roiPercent =
    isMiner || isOther
      ? timeBasedProgress
      : farm.initialCost > 0
        ? (totalValue / farm.initialCost) * 100
        : 0;
  const isProfitable = roiPercent >= 100;
  const lastWeekLabel =
    typeof farm.lastWeekRewardsGlw === "number"
      ? `${fmtGlw(farm.lastWeekRewardsGlw)} GLW`
      : "—";

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
          In Progress
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
          Miner
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
          Delegation
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
        Rewards
      </div>
    );
  };

  return (
    <Card
      data-farm-id={farm.farmId}
      className="group relative overflow-hidden cursor-pointer bg-muted/30 dark:bg-muted/50 hover:bg-muted/50 dark:hover:bg-muted/60 transition-colors border-border/20 dark:border-border/40 p-0 gap-0"
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
                See audit
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
          <div className={cn("space-y-3", isCompact && "space-y-2")}>
            <div
              className={cn(
                "flex items-center justify-between",
                isCompact ? "text-[10px]" : "text-xs",
              )}
            >
              <span className="text-muted-foreground font-medium">
                Funding Progress
              </span>
              <span className="font-mono font-bold">
                {Math.round(farm.inProgressPercent ?? 0)}%
              </span>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, farm.inProgressPercent ?? 0))}
              className={cn(isCompact ? "h-1" : "h-1.5", "bg-muted")}
            />
          </div>
        ) : (
          <div className={cn("space-y-4", isCompact && "space-y-2.5")}>
            <div
              className={cn(
                "grid",
                isCompact ? "grid-cols-2 gap-2" : "grid-cols-3 gap-4",
              )}
            >
              <div>
                <div
                  className={cn(
                    "uppercase tracking-wider text-muted-foreground font-semibold mb-1",
                    isCompact ? "text-[9px]" : "text-[10px]",
                  )}
                >
                  Active
                </div>
                <div
                  className={cn(
                    "font-mono font-medium",
                    isCompact ? "text-xs" : "text-sm",
                  )}
                >
                  {isPendingStart
                    ? "Starts Soon"
                    : `${farm.weeksActive} / ${farm.totalWeeks} wks`}
                </div>
              </div>
              {!isCompact && (
                <div className="text-center">
                  <div
                    className={cn(
                      "uppercase tracking-wider text-muted-foreground font-semibold mb-1",
                      "text-[10px]",
                    )}
                  >
                    Last Week
                  </div>
                  <div className="font-mono font-medium text-sm">
                    {isPendingStart
                      ? "Pending"
                      : `${fmtGlw(farm.lastWeekRewardsGlw ?? 0)} GLW`}
                  </div>
                </div>
              )}
              <div className={cn(isCompact ? "text-right" : "text-right")}>
                <div
                  className={cn(
                    "uppercase tracking-wider text-muted-foreground font-semibold mb-1",
                    isCompact ? "text-[9px]" : "text-[10px]",
                  )}
                >
                  {isPendingStart && farm.estimatedUserWeeklyGlw
                    ? "Est. Weekly"
                    : "Earned"}
                </div>
                <div
                  className={cn(
                    "font-mono font-bold",
                    isCompact ? "text-xs" : "text-sm",
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
                    ? farm.estimatedUserWeeklyGlw
                      ? farm.estimatedUserWeeklyUsd &&
                        farm.estimatedUserWeeklyUsd > 0
                        ? `~$${fmtUsdAmount(farm.estimatedUserWeeklyUsd)}/wk`
                        : `~${fmtGlw(farm.estimatedUserWeeklyGlw)} GLW/wk`
                      : "Pending"
                    : getFarmEarnedLabel(farm)}
                </div>
                {isCompact && !isPendingStart && (
                  <div
                    className={cn(
                      "text-[10px] font-mono text-muted-foreground mt-1",
                      isCompact && "text-[9px]",
                    )}
                  >
                    Last week:{" "}
                    <span className="font-semibold text-foreground">
                      {lastWeekLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className={cn("space-y-1.5", isCompact && "space-y-1")}>
              <div
                className={cn(
                  "flex items-center justify-between font-medium text-muted-foreground",
                  isCompact ? "text-[9px]" : "text-[10px]",
                )}
              >
                <span>
                  {isOther ? "Timeline" : isMiner ? "Cost" : "Delegated"}:{" "}
                  {isOther
                    ? `${farm.weeksActive} / ${farm.totalWeeks} wks`
                    : isMiner
                      ? fmtUsd(farm.initialCost)
                      : `${fmtGlw(farm.initialCost)} ${formatProtocolDepositAsset(
                          farm.protocolDepositAsset
                        )}`}
                </span>
                <span
                  className={cn(
                    "font-mono font-bold",
                    isPendingStart
                      ? "text-muted-foreground"
                      : isProfitable
                        ? "text-emerald-500"
                        : "text-foreground",
                  )}
                >
                  {isPendingStart
                    ? "Pending"
                    : `${roiPercent.toFixed(0)}% Progress`}
                </span>
              </div>
              <Progress
                value={isPendingStart ? 0 : Math.min(roiPercent, 100)}
                className={cn(
                  "bg-muted",
                  isCompact ? "h-1" : "h-1.5",
                  isProfitable && !isPendingStart && "[&>div]:bg-emerald-500",
                )}
              />
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
                {!isCompact && "View Details"}{" "}
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
  if (!farm) return null;

  const isInProgress = farm.type === "in-progress";
  const isMiner = farm.type === "miner";
  const isOther = farm.type === "other";
  const isPendingStart = Boolean(farm.isPendingStart);

  const totalEarned = farm.recovered + farm.inflation;
  const protocolDepositAsset = formatProtocolDepositAsset(
    farm.protocolDepositAsset
  );

  const investedLabel = (() => {
    if (isInProgress) return "—";
    if (isMiner) return fmtUsd(farm.initialCost);
    if (isOther) return "—";
    return `${fmtGlw(farm.initialCost)} ${protocolDepositAsset}`;
  })();

  const earnedLabel = (() => {
    if (isInProgress || isPendingStart)
      return farm.estimatedUserWeeklyUsd && farm.estimatedUserWeeklyUsd > 0
        ? `~$${fmtUsdAmount(farm.estimatedUserWeeklyUsd)}/wk`
        : `~${fmtGlw(farm.estimatedUserWeeklyGlw ?? 0)} GLW/wk`;
    if (isMiner) return `${fmtGlw(farm.inflationGlw)} GLW`;
    return getFarmEarnedLabel(farm);
  })();

  const progressPercent = Math.min(
    (farm.weeksActive / Math.max(farm.totalWeeks, 1)) * 100,
    100,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] p-0 gap-0 flex flex-col overflow-hidden border-0 sm:border sm:border-border/20 sm:rounded-2xl bg-card">
        <DialogHeader className="px-6 py-5 shrink-0 border-b border-border/20 bg-muted/30 z-20 relative">
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
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider border text-[color:var(--color-miner)] bg-[color:var(--color-miner)]/10 border-[color:var(--color-miner)]/30">
                  <CashMinerIcon className="w-4 h-4" />
                  Miner
                </div>
              )}
              {farm.type === "delegation" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider border text-delegation-purple bg-delegation-purple/10 border-delegation-purple/30">
                  <DelegationIcon className="w-4 h-4" />
                  Delegation
                </div>
              )}
              {farm.type === "other" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider border text-emerald-700 dark:text-[color:var(--color-glow-green)] bg-[color:var(--color-glow-green)]/10 border-[color:var(--color-glow-green)]/30">
                  <Gift className="w-3.5 h-3.5" />
                  Rewards
                </div>
              )}
              {farm.type === "in-progress" && (
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider border",
                    farm.inProgressKind === "mining-center"
                      ? "text-[color:var(--color-miner)] bg-[color:var(--color-miner)]/10 border-[color:var(--color-miner)]/30"
                      : "text-delegation-purple bg-delegation-purple/10 border-delegation-purple/30",
                  )}
                >
                  {farm.inProgressKind === "mining-center" ? (
                    <CashMinerIcon className="w-4 h-4" />
                  ) : (
                    <DelegationIcon className="w-4 h-4" />
                  )}
                  In Progress
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto w-full">
            {/* Farm Image Grid */}
            <div className="rounded-2xl overflow-hidden border border-border/20">
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
              {!isInProgress && !isPendingStart && !isOther && (
                <Card className="bg-muted/30 border-border/20">
                  <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div
                        className={cn(
                          "p-1.5 rounded-lg",
                          isMiner
                            ? "bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner)]"
                            : "bg-delegation-purple/10 text-delegation-purple",
                        )}
                      >
                        {isMiner ? (
                          <CashMinerIcon className="w-5 h-5" />
                        ) : (
                          <DelegationIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                        {isMiner ? "Initial Cost" : "Total Delegated"}
                      </div>
                    </div>
                    <div className="text-3xl font-semibold font-mono tracking-tight text-foreground">
                      {investedLabel}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Total Earned */}
              <Card
                className={cn(
                  "bg-muted/30 border-border/20 relative overflow-hidden",
                  (isInProgress || isPendingStart || isOther) &&
                    "md:col-span-2",
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
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                        {isInProgress || isPendingStart
                          ? "Est. Weekly Rewards"
                          : "Lifetime Earnings"}
                      </div>
                    </div>
                    {!isInProgress && !isPendingStart && !isOther && (
                      <div className="text-xs font-mono font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-lg">
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
                      "text-3xl font-semibold font-mono tracking-tight",
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
                <Card className="bg-muted/30 border-border/20">
                  <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="p-1.5 rounded-lg bg-muted/50">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                          Timeline
                        </div>
                      </div>
                      <div className="text-xs font-mono font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-lg">
                        {Math.round(progressPercent)}%
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-semibold font-mono tracking-tight">
                          {farm.weeksActive}
                          <span className="text-muted-foreground/60 text-sm ml-1 font-normal">
                            wks
                          </span>
                        </div>
                        <div className="text-sm font-mono text-muted-foreground/60">
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
                <Card className="bg-muted/30 border-border/20">
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
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                        Funding Progress
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

              {/* Pending Start Status */}
              {isPendingStart && (
                <Card className="bg-muted/30 border-border/20">
                  <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="p-1.5 rounded-lg bg-muted/50">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                        Status
                      </div>
                    </div>
                    <div className="text-2xl font-semibold font-mono tracking-tight text-foreground">
                      Starts Soon
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Breakdown Section */}
            {!isInProgress && !isPendingStart && (
              <div className="space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 px-1">
                  Rewards Breakdown
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
                              Protocol Deposit
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {isOther
                                ? `Recovered in ${
                                    formatProtocolDepositAsset(
                                      farm.protocolDepositAsset
                                    ) ?? "—"
                                  }`
                                : "Recovered capital"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono font-bold text-delegation-purple">
                          {farm.isProtocolDepositUsd
                            ? `${fmtUsdAmount(farm.recovered)} ${formatProtocolDepositAsset(
                                farm.protocolDepositAsset
                              )}`
                            : `${fmtGlw(farm.recovered)} ${formatProtocolDepositAsset(
                                farm.protocolDepositAsset
                              )}`}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[color:var(--color-miner)]/10 flex items-center justify-center text-[color:var(--color-miner-contrast)]">
                          <EmissionsIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Emissions</div>
                          <div className="text-xs text-muted-foreground">
                            Production rewards
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-[color:var(--color-miner-contrast)]">
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
            {!isInProgress &&
              !isPendingStart &&
              farm.weeklyBreakdown.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 px-1">
                    Weekly History
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
                          {farm.weeklyBreakdown
                            .slice()
                            .reverse()
                            .map((week) => {
                              const pdAmount = farm.isProtocolDepositUsd
                                ? parsePdRewardsUsd({
                                    value: week.protocolDepositRewards,
                                    asset: farm.protocolDepositAsset ?? null,
                                  })
                                : parseProtocolDepositTokenAmount(
                                    week.protocolDepositRewards,
                                    protocolDepositAsset,
                                  );
                              const inflationGlw = parseGlwFromWei(
                                week.inflationRewards,
                              );
                              const totalGlw =
                                protocolDepositAsset === "GLW"
                                  ? parseGlwFromWei(week.totalRewards)
                                  : null;

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
                                      {farm.isProtocolDepositUsd
                                        ? fmtUsdAmount(pdAmount)
                                        : fmtGlw(pdAmount)}
                                      <span className="text-[10px] font-normal text-muted-foreground ml-1">
                                        {protocolDepositAsset}
                                      </span>
                                    </td>
                                  )}
                                  <td className="py-3.5 px-6 text-right font-mono text-[color:var(--color-miner-contrast)] text-sm tabular-nums">
                                    {fmtGlw(inflationGlw)}
                                    <span className="text-[10px] font-normal text-muted-foreground ml-1">
                                      GLW
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-6 text-right font-mono font-bold text-sm tabular-nums text-foreground">
                                    {totalGlw != null ? (
                                      <>
                                        {fmtGlw(totalGlw)}
                                        <span className="text-[10px] font-normal text-muted-foreground ml-1">
                                          GLW
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        {fmtGlw(inflationGlw)} GLW +{" "}
                                        {farm.isProtocolDepositUsd
                                          ? fmtUsdAmount(pdAmount)
                                          : fmtGlw(pdAmount)}{" "}
                                        {protocolDepositAsset}
                                      </>
                                    )}
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

  const { applications: sponsorListings, isLoading: isSponsorListingsLoading } =
    useGlowLaunchpad({
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
          }`,
      ),
    );
  }, [rewardsBreakdown]);

  const unsortedFarmCards = React.useMemo<FarmCardData[]>(() => {
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
        });
      }
    });

    (rewardsBreakdown.otherFarmsWithRewards?.farms ?? []).forEach((farm) => {
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
      // Try to find images from purchasedFarms first, then sponsorListings/miningCenterListings
      const farmMetadata = purchasedFarms.find((f) => f.farmId === item.farmId);
      const imageUrls =
        farmMetadata?.afterInstallPictures?.map((p) => p.url) || [];

      // If no images from purchasedFarms, try listings
      if (imageUrls.length === 0) {
        if (item.fractionType === "launchpad") {
          const app = sponsorListings?.find((a) => a.id === item.farmId);
          if (app?.afterInstallPictures?.length) {
            app.afterInstallPictures.forEach((p) => imageUrls.push(p.url));
          }
        } else {
          const app = miningCenterListings?.find((a) => a.id === item.farmId);
          if (app?.afterInstallPictures?.length) {
            app.afterInstallPictures.forEach((p) => imageUrls.push(p.url));
          }
        }
      }

      if (imageUrls.length === 0) {
        imageUrls.push("/images/sections/residential.jpg");
      }

      let estimatedUserWeeklyGlw: number | undefined = undefined;
      if (farmMetadata?.userWeeklyRewards) {
        // Use source-specific breakdown if available (prevents double-counting for farms with both delegation + miner)
        const isMiningCenter = item.fractionType === "mining-center";

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
          const pdAsset = formatProtocolDepositAsset(
            farmMetadata.userWeeklyRewards.protocolDepositAsset
          );
          const pdGlw =
            pdAsset === "GLW"
              ? parseProtocolDepositTokenAmount(
                  farmMetadata.userWeeklyRewards.protocolDepositRewards,
                  pdAsset
                )
              : 0;
          estimatedUserWeeklyGlw = delegationInflationGlw + pdGlw;
        } else {
          // Fallback for old API response (no breakdown fields)
          const inflationGlw = parseGlwFromWei(
            farmMetadata.userWeeklyRewards.glwInflationRewards,
          );
          const pdAsset = formatProtocolDepositAsset(
            farmMetadata.userWeeklyRewards.protocolDepositAsset
          );
          const isPdGlw = pdAsset === "GLW";
          const pdGlw = isPdGlw
            ? parseProtocolDepositTokenAmount(
                farmMetadata.userWeeklyRewards.protocolDepositRewards,
                pdAsset
              )
            : 0;
          estimatedUserWeeklyGlw = inflationGlw + pdGlw;
        }
      }

      if (item.fractionType === "launchpad") {
        const launchpadApp = sponsorListings?.find((a) => a.id === item.farmId);
        const launchpadCurrency = resolveDelegationCurrency(launchpadApp);
        const initialCost = parseDelegationAmountFromBaseUnits(
          item.totalAmount.toString(),
          launchpadCurrency
        );
        cards.push({
          farmKey: `${item.farmId}:delegation:pending-start`,
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
          protocolDepositAsset: launchpadCurrency,
          isProtocolDepositUsd: false,
          weeksActive: 0,
          totalWeeks: 100,
          weeklyBreakdown: [],
          lastWeekRewardsGlw: 0,
          estimatedUserWeeklyGlw,
        });
      } else {
        const initialCostUsd = parseUsdcFromBaseUnits(
          item.totalAmount.toString(),
        );
        cards.push({
          farmKey: `${item.farmId}:miner:pending-start`,
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
          lastWeekRewardsGlw: 0,
          estimatedUserWeeklyGlw,
        });
      }
    });

    [
      ...sponsorshipsInProgressWithEstimates,
      ...miningCenterInProgressWithEstimates,
    ].forEach((item) => {
      const app = item.application;
      const zoneName = app?.zone?.name || "Launchpad";
      const launchpadCurrency =
        item.fractionType === "launchpad"
          ? resolveDelegationCurrency(app)
          : "USDC";
      const displayName =
        app?.farmName || `Farm ${item.applicationId.substring(0, 8)}`;
      const imageUrls = app?.afterInstallPictures?.map((p) => p.url) || [];
      if (imageUrls.length === 0) {
        imageUrls.push("/images/sections/residential.jpg");
      }

      cards.push({
        farmKey: `${item.applicationId}:in-progress:${item.fractionType}`,
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
        protocolDepositAsset: launchpadCurrency,
        isProtocolDepositUsd: item.fractionType === "mining-center",
        weeksActive: 0,
        totalWeeks: 1,
        weeklyBreakdown: [],
        inProgressPercent: item.progressPercent ?? 0,
        estimatedUserWeeklyGlw: item.estimatedUserWeeklyGlw ?? 0,
        estimatedUserWeeklyUsd: item.estimatedUserWeeklyUsd ?? 0,
        lastWeekRewardsGlw: 0,
      });
    });

    return cards;
  }, [
    farmNameByFarmId,
    glwSpotPriceUsd,
    miningCenterInProgressWithEstimates,
    otherFarmsMap,
    purchasedFarms,
    regions,
    rewardsBreakdown,
    rewardedFarmTypeKeys,
    splitsActivity,
    sponsorListings,
    miningCenterListings,
    sponsorshipsInProgressWithEstimates,
  ]);

  const farmCards = React.useMemo(() => {
    const cards = [...unsortedFarmCards];

    const getSize = (f: FarmCardData) => {
      const price = glwSpotPriceUsd || 0;
      // If miner, initialCost is USD
      if (f.type === "miner") {
        return f.initialCost;
      }
      // Delegation/Pending Launchpad is GLW
      // Convert GLW to USD for comparison if price exists, else treat as raw number
      // (This assumes parity if price is 0 which is wrong but safe fallback)
      return f.initialCost * (price > 0 ? price : 0);
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
          const isAPending = a.isPendingStart || a.type === "in-progress";
          const isBPending = b.isPendingStart || b.type === "in-progress";

          if (isAPending && !isBPending) return -1;
          if (!isAPending && isBPending) return 1;

          if (isAPending && isBPending) {
            return (b.inProgressPercent || 0) - (a.inProgressPercent || 0);
          }

          return a.weeksActive - b.weeksActive;
        });
      default:
        return cards.sort((a, b) => {
          if (a.isPendingStart && !b.isPendingStart) return -1;
          if (!a.isPendingStart && b.isPendingStart) return 1;
          if (a.type === "in-progress" && b.type !== "in-progress") return -1;
          if (a.type !== "in-progress" && b.type === "in-progress") return 1;
          const totalA = a.recovered + a.inflationGlw;
          const totalB = b.recovered + b.inflationGlw;
          return totalB - totalA;
        });
    }
  }, [unsortedFarmCards, sortBy, glwSpotPriceUsd]);

  const isLoading =
    isRewardsLoading ||
    isFarmsLoading ||
    isRegionsLoading ||
    isSplitsActivityLoading ||
    isSponsorListingsLoading ||
    isMiningCenterListingsLoading ||
    isRewardScoresLoading ||
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
              ? "Unable to load farms"
              : "No farms found for this wallet"}
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
            Sort by
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
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="date">Newest</SelectItem>
              <SelectItem value="alphabetical">Name (A-Z)</SelectItem>
              <SelectItem value="size">Size (Highest)</SelectItem>
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
            <span className="hidden md:inline">Default</span>
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
            <span className="hidden md:inline">Compact</span>
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
            <span className="hidden md:inline">Mosaic</span>
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
            <span className="hidden md:inline">List</span>
          </Button>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 overflow-hidden mb-8">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/20 dark:border-border/40">
                <TableHead className="w-[300px] text-[10px] uppercase tracking-wider font-mono font-bold">
                  Item
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-mono font-bold">
                  Status
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-mono font-bold text-right">
                  Active
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-mono font-bold text-right">
                  Cost
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-mono font-bold text-right">
                  Earned
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-mono font-bold text-right">
                  Last Week
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-mono font-bold text-right">
                  Progress
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {farmCards.map((farm) => {
                const isInProgress = farm.type === "in-progress";
                const isMiner = farm.type === "miner";
                const isDelegation = farm.type === "delegation";
                const isPendingStart = Boolean(farm.isPendingStart);
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
                    className="cursor-pointer border-border/20 dark:border-border/40 hover:bg-muted/50 dark:hover:bg-muted/60 transition-colors group"
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
                          In Progress
                        </div>
                      ) : isPendingStart ? (
                        <div className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold font-mono uppercase tracking-wider border bg-muted/50 text-muted-foreground border-border/40">
                          Starts Soon
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
                            ? "Miner"
                            : isDelegation
                              ? "Delegation"
                              : "Rewards"}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {isPendingStart
                        ? "Pending"
                        : isInProgress
                          ? "—"
                          : `${farm.weeksActive} / ${farm.totalWeeks} wks`}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {isInProgress
                        ? "—"
                        : isMiner
                          ? fmtUsd(farm.initialCost)
                          : `${fmtGlw(farm.initialCost)} ${formatProtocolDepositAsset(
                              farm.protocolDepositAsset
                            )}`}
                    </TableCell>
                    <TableCell className="text-right">
                      {isInProgress ? (
                        <span className="font-mono text-xs tabular-nums font-bold text-muted-foreground">
                          {farm.estimatedUserWeeklyUsd &&
                          farm.estimatedUserWeeklyUsd > 0
                            ? `~$${fmtUsdAmount(farm.estimatedUserWeeklyUsd)}/wk`
                            : `~${fmtGlw(farm.estimatedUserWeeklyGlw ?? 0)} GLW/wk`}
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
                            ? farm.estimatedUserWeeklyGlw
                              ? farm.estimatedUserWeeklyUsd &&
                                farm.estimatedUserWeeklyUsd > 0
                                ? `~$${fmtUsdAmount(farm.estimatedUserWeeklyUsd)}/wk`
                                : `~${fmtGlw(farm.estimatedUserWeeklyGlw)} GLW/wk`
                              : "Pending"
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
                          {fmtGlw(farm.lastWeekRewardsGlw ?? 0)} GLW
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
                          Pending
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
