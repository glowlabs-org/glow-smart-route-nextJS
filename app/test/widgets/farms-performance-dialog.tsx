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
} from "lucide-react";
import { cn } from "@/lib/utils";

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

import { useRewardsBreakdown, useWalletFarms, useRegions } from "@/hooks";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";

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

const FILTER_VALUES = ["all", "miners", "delegations", "other"] as const;
type FilterValue = (typeof FILTER_VALUES)[number];

function isFilterValue(value: string): value is FilterValue {
  return (FILTER_VALUES as readonly string[]).includes(value);
}

interface PerformanceRowData {
  farmId: string;
  id: string;
  region: string;
  type: "miner" | "delegation" | "other";
  initialCost: number;
  recovered: number;
  inflation: number;
  inflationGlw: number;
  protocolDepositAsset: string | null;
  isProtocolDepositUsd: boolean;
  weeksActive: number;
  totalWeeks: number;
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
  const totalValue = data.recovered + data.inflation;
  const isMiner = data.type === "miner";
  const isOther = data.type === "other";
  const isProtocolDepositUsd = data.isProtocolDepositUsd;
  const isUsdRow = isMiner || (isOther && isProtocolDepositUsd);

  // Percentages (0-100 for bar width)
  const timePct = Math.min((data.weeksActive / data.totalWeeks) * 100, 100);

  // Stacking Logic:
  const denom = isOther
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
  const isProfit = !isOther && totalValuePct >= 100;
  const isLagging = !isOther && totalValuePct < timePct - 10; // Buffer of 10% before warning

  return (
    <div className="grid grid-cols-12 items-center p-4 rounded-xl border border-border bg-muted/10 hover:bg-muted/20 hover:border-border/80 transition-colors group">
      {/* COLUMN 1: IDENTITY (3 Cols) */}
      <div className="col-span-3 flex items-center gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center border",
            data.type === "miner"
              ? "bg-[color:var(--color-miner-yellow)]/15 border-[color:var(--color-miner-yellow)]/30 text-[color:var(--color-miner-yellow-contrast)]"
              : data.type === "delegation"
              ? "bg-[#C084FC]/15 border-[#C084FC]/30 text-[#C084FC]"
              : "bg-[color:var(--color-glow-green)]/15 border-[color:var(--color-glow-green)]/30 text-[color:var(--color-glow-green)]"
          )}
        >
          {data.type === "miner" ? (
            <Cpu className="w-5 h-5" />
          ) : data.type === "delegation" ? (
            <Layers className="w-5 h-5" />
          ) : (
            <Gift className="w-5 h-5" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base text-foreground leading-tight">
            {data.id}
          </span>
          <span className="text-sm font-mono text-muted-foreground">
            {data.region}
          </span>
        </div>
      </div>

      {/* COLUMN 2: DUAL TRACKS (7 Cols) */}
      <div className="col-span-7 px-4 flex flex-col justify-center gap-3">
        {/* Track A: TIME */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground w-10 text-right uppercase tracking-wider">
            Time
          </span>
          <div className="flex-1 relative group/tooltip">
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
            {data.totalWeeks - data.weeksActive} Left
          </span>
        </div>

        {/* Track B: MONEY */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground w-10 text-right uppercase tracking-wider">
            Value
          </span>
          <div className="flex-1 relative">
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
                      <span className="text-muted-foreground">Initial:</span>
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
                        ? `${fmtGlw(data.inflationGlw)} GLW + ${fmtUsdAmount(
                            data.recovered
                          )} USDG`
                        : `${fmtGlw(data.inflationGlw + data.recovered)} GLW`
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
      </div>

      {/* COLUMN 3: STATUS (2 Cols) */}
      <div className="col-span-2 flex justify-end">
        {isOther ? (
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
          farmMetadata?.name || `Farm ${farm.farmId.substring(0, 8)}`;

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
  }, [purchasedFarms, regions, rewardsBreakdown, glwSpotPriceUsd]);

  const visibleRows = React.useMemo(() => {
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

  return (
    <DialogContent className="max-w-4xl h-[80vh] min-h-0 flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
      {/* Header */}
      <DialogHeader className="px-6 py-5 border-b border-border bg-muted/20 flex-shrink-0 flex-row items-center justify-between space-y-0">
        <DialogTitle className="text-2xl font-bold font-mono uppercase tracking-wide">
          Farm Performance
        </DialogTitle>

        <Tabs
          value={filter}
          onValueChange={(value) =>
            setFilter(isFilterValue(value) ? value : "all")
          }
        >
          <TabsList className="bg-muted/30 border border-border h-12 p-1">
            <TabsTrigger
              value="all"
              className="h-7 text-xs font-mono px-4 text-muted-foreground"
            >
              ALL
            </TabsTrigger>
            <TabsTrigger
              value="miners"
              className="h-7 text-xs font-mono px-4 text-muted-foreground data-[state=active]:text-miner-yellow"
            >
              MINERS
            </TabsTrigger>
            <TabsTrigger
              value="delegations"
              className="h-7 text-xs font-mono px-4 text-muted-foreground data-[state=active]:text-[#C084FC]"
            >
              DELEGATIONS
            </TabsTrigger>
            <TabsTrigger
              value="other"
              className="h-7 text-xs font-mono px-4 text-muted-foreground data-[state=active]:text-[color:var(--color-glow-green)]"
            >
              OTHER
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </DialogHeader>

      {/* Legend / Columns */}
      <div className="grid grid-cols-12 px-6 py-3 border-b border-border/60 bg-muted/10 text-xs font-mono uppercase text-muted-foreground tracking-wider flex-shrink-0">
        <div className="col-span-3">Identity</div>
        <div className="col-span-7 pl-4 flex gap-4">
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
          <div className="p-6 space-y-3 pb-12 min-h-0">
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
            ) : isRewardsLoading || isFarmsLoading || isRegionsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : isRewardsError || isFarmsError ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Unable to load farm performance
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono"
                  onClick={() => refetchRewards()}
                >
                  Retry
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center text-xs font-mono text-muted-foreground uppercase tracking-wider">
                No farms found for this wallet
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
                {visibleRows.map((row) => (
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
