"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useFmiPressure } from "@/hooks/useFmiPressure";

type PoolReserves = { usdg: number; glw: number };

export type FmiWidgetProps = {
  poolReserves: PoolReserves;
  hasPoolReserves: boolean;

  hasLivePrice: boolean;
  currentPrice: number;

  hasLiveSupply: boolean;
  currentCirculating: number;
  priceDetail: string;

  hasLiveMarketCap: boolean;
  currentMarketCap: number;

  totalPolLq: number | null;
  totalPolBreakdown: { usd: number; breakdown: string } | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    value
  );
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCompactNumberPrecise(value: number) {
  const abs = Math.abs(value);
  if (abs >= 100_000 && abs < 1_000_000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
      value
    );
  }
  if (abs >= 1_000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: abs < 10 ? 2 : 1,
  }).format(value);
}

function formatUsdCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatUsdCompactNullable(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return formatUsdCompact(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function reservesToLiquidity(usdg: number, glw: number) {
  return Math.sqrt(Math.abs(usdg) * Math.abs(glw));
}

function getLiquidityFromReserves(usdg: number, glw: number) {
  const liquidity = reservesToLiquidity(usdg, glw);
  return {
    liquidity,
    value: `${formatCompactNumber(liquidity)} lq`,
    breakdown: `$${formatCompactNumber(usdg)} / ${formatCompactNumber(glw)} GLW`,
  };
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
      {title}
    </div>
  );
}

function MiniStat({
  label,
  value,
  helper,
  valueClassName,
}: {
  label: string;
  value: string;
  helper?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
        {label}
      </div>
      <div
        className={cn(
          "text-2xl sm:text-3xl font-semibold font-mono tabular-nums",
          valueClassName
        )}
      >
        {value}
      </div>
      {helper ? <div className="text-xs text-muted-foreground">{helper}</div> : null}
    </div>
  );
}

function FlyNode({
  label,
  value,
  detail,
  accent,
  className,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "green" | "red";
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-center cursor-default transition-colors",
            "border-border/20 dark:border-border/40 bg-card hover:bg-muted/40 dark:hover:bg-background/60",
            className
          )}
        >
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
            {label}
          </div>
          <div
            className={cn(
              "mt-1.5 text-2xl font-semibold font-mono tabular-nums tracking-tight",
              accent === "green" && "text-green-600 dark:text-green-400",
              accent === "red" && "text-red-600 dark:text-red-400"
            )}
          >
            {value}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] text-xs">
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}

export function FmiWidget(props: FmiWidgetProps) {
  const {
    poolReserves,
    hasPoolReserves,
    hasLivePrice,
    currentPrice,
    hasLiveSupply,
    currentCirculating,
    priceDetail,
    hasLiveMarketCap,
    currentMarketCap,
    totalPolLq,
    totalPolBreakdown,
  } = props;

  const marketCapDisplayCompact = hasLiveMarketCap
    ? formatUsdCompact(currentMarketCap)
    : "—";

  const poolUsdg = poolReserves.usdg ?? 0;
  const poolGlw = poolReserves.glw ?? 0;
  const poolLiquidityBreakdown = hasPoolReserves
    ? getLiquidityFromReserves(poolUsdg, poolGlw)
    : { liquidity: 0, value: "—", breakdown: "—" };

  const poolLiquidityDisplay = hasPoolReserves ? poolLiquidityBreakdown.value : "—";
  const poolLiquidityDetail = hasPoolReserves
    ? `${formatCompactNumber(poolUsdg)} USDG + ${formatCompactNumber(
        poolGlw
      )} GLW absorbing pressure`
    : "Live data unavailable";

  const polBackstopUsdDisplay =
    totalPolBreakdown?.usd !== null &&
    totalPolBreakdown?.usd !== undefined &&
    Number.isFinite(totalPolBreakdown.usd)
      ? formatUsdCompact(totalPolBreakdown.usd)
      : "—";

  const { data: fmiPressure } = useFmiPressure();
  const fmiBuyUsd = React.useMemo(() => {
    const raw = fmiPressure?.buy?.usdg;
    if (raw === null || raw === undefined) return null;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return null;
    return numeric / 1e6;
  }, [fmiPressure]);

  const fmiSellUsd = React.useMemo(() => {
    const raw = fmiPressure?.sell?.usdg;
    if (raw === null || raw === undefined) return null;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return null;
    return numeric / 1e6;
  }, [fmiPressure]);

  const hasFmiPressure = fmiBuyUsd !== null && fmiSellUsd !== null;
  const poolPriceForDepth = hasLivePrice
    ? currentPrice
    : hasPoolReserves && poolGlw > 0
      ? poolUsdg / poolGlw
      : 0;
  const fmiPoolUsd =
    hasPoolReserves && poolPriceForDepth > 0
      ? poolUsdg + poolGlw * poolPriceForDepth
      : 0;

  const fmiNetPressure =
    hasFmiPressure && fmiBuyUsd !== null && fmiSellUsd !== null
      ? fmiBuyUsd - fmiSellUsd
      : null;
  const fmiRatio =
    hasFmiPressure && fmiBuyUsd + fmiSellUsd > 0
      ? fmiBuyUsd / (fmiBuyUsd + fmiSellUsd)
      : null;
  const fmiScore = fmiRatio !== null ? Math.round(fmiRatio * 100) : null;
  const fmiLabel =
    fmiScore === null
      ? "—"
      : fmiScore >= 55
        ? "Accumulating"
        : fmiScore >= 45
          ? "Neutral"
          : "Distributing";
  const fmiAccentClass =
    fmiScore === null
      ? "text-muted-foreground"
      : fmiScore >= 55
        ? "text-green-600 dark:text-green-400"
        : fmiScore >= 45
          ? "text-yellow-600 dark:text-yellow-400"
          : "text-red-600 dark:text-red-400";
  const fmiBadgeBorder =
    fmiScore === null
      ? "border-border/40 bg-muted/40"
      : fmiScore >= 55
        ? "border-green-500/30 bg-green-500/5"
        : fmiScore >= 45
          ? "border-yellow-500/30 bg-yellow-500/5"
          : "border-red-500/30 bg-red-500/5";

  const fmiPoolUsdSafe = fmiPoolUsd > 0 ? fmiPoolUsd : null;
  const fmiNetToPool =
    fmiNetPressure !== null && fmiPoolUsdSafe
      ? (fmiNetPressure / fmiPoolUsdSafe) * 100
      : null;
  const fmiSellToPool =
    fmiSellUsd !== null && fmiPoolUsdSafe ? fmiSellUsd / fmiPoolUsdSafe : null;

  const fmiBuyUsdDisplay = formatUsdCompactNullable(fmiBuyUsd);
  const fmiSellUsdDisplay = formatUsdCompactNullable(fmiSellUsd);
  const fmiNetPressureDisplay = formatUsdCompactNullable(fmiNetPressure);
  const fmiScoreDisplay = fmiScore !== null ? fmiScore : "—";
  const fmiBuySellRatio =
    hasFmiPressure && fmiSellUsd !== null && fmiSellUsd > 0 && fmiBuyUsd !== null
      ? fmiBuyUsd / fmiSellUsd
      : null;
  const fmiBuySellRatioDisplay =
    fmiBuySellRatio !== null ? fmiBuySellRatio.toFixed(2) : "—";
  const fmiNetPressureSignedDisplay =
    fmiNetPressure !== null && Number.isFinite(fmiNetPressure)
      ? `${fmiNetPressure >= 0 ? "+" : ""}${formatUsdCompact(fmiNetPressure)}`
      : "—";
  const fmiNetPressurePerWeekDisplay =
    fmiNetPressure !== null && Number.isFinite(fmiNetPressure)
      ? `${fmiNetPressure >= 0 ? "+" : ""}${formatUsdCompact(fmiNetPressure)}/wk`
      : "—";
  const fmiSellToPoolDisplay =
    fmiSellToPool !== null ? fmiSellToPool.toFixed(1) : "—";
  const fmiNetToPoolDisplay =
    fmiNetToPool !== null ? fmiNetToPool.toFixed(1) : "—";

  return (
    <section className="flex flex-col gap-6 pt-16">
      <SectionHeader title="FMI" />
      <Card className="!gap-6">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold">Flywheel Market Index</div>
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
                  fmiBadgeBorder
                )}
              >
                <span
                  className={cn(
                    "text-xs font-semibold font-mono tabular-nums",
                    fmiAccentClass
                  )}
                >
                  {fmiScoreDisplay}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono uppercase tracking-widest",
                    fmiAccentClass
                  )}
                >
                  {fmiLabel}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Mobile */}
          <div className="flex flex-col items-center gap-2 md:hidden">
            <FlyNode
              label="Buy Pressure"
              value={fmiBuyUsdDisplay === "—" ? "—" : `+${fmiBuyUsdDisplay}/wk`}
              detail="PoL yield + GCTL minting + miner sales flowing into the protocol weekly"
              accent="green"
              className="w-full"
            />
            <div className="text-muted-foreground/30">
              <ChevronDown className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-3 w-full">
              <FlyNode
                label="Liquidity Pool"
                value={poolLiquidityDisplay}
                detail={poolLiquidityDetail}
                className="flex-1"
              />
              <div
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-2xl border px-3 py-2.5 shrink-0",
                  fmiBadgeBorder
                )}
              >
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                  Net
                </span>
                <span
                  className={cn(
                    "text-lg font-semibold font-mono tabular-nums",
                    fmiAccentClass
                  )}
                >
                  {fmiNetPressureSignedDisplay}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground/50">
                  /week
                </span>
              </div>
            </div>
            <div className="text-muted-foreground/30">
              <ChevronDown className="h-5 w-5" />
            </div>
            <FlyNode
              label="Sell Pressure"
              value={fmiSellUsdDisplay === "—" ? "—" : `-${fmiSellUsdDisplay}/wk`}
              detail="Vesting unlocks and secondary market seller flow per week"
              accent="red"
              className="w-full"
            />
            <div className="text-muted-foreground/30">
              <ChevronDown className="h-5 w-5" />
            </div>
            <FlyNode
              label="Market Cap"
              value={marketCapDisplayCompact}
              detail={
                hasLivePrice && hasLiveSupply
                  ? `${formatCompactNumber(currentCirculating)} GLW at $${priceDetail}`
                  : "Live data unavailable"
              }
              className="w-full"
            />
          </div>

          {/* Desktop */}
          <div className="hidden md:block">
            <div className="relative w-full" style={{ height: 340 }}>
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 800 340"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <marker
                    id="arrow-green"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <path
                      d="M0,0 L8,3 L0,6"
                      fill="hsl(142, 71%, 45%)"
                      fillOpacity="0.5"
                    />
                  </marker>
                  <marker
                    id="arrow-red"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <path
                      d="M0,0 L8,3 L0,6"
                      fill="hsl(0, 84%, 60%)"
                      fillOpacity="0.5"
                    />
                  </marker>
                  <marker
                    id="arrow-muted"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L8,3 L0,6" fill="currentColor" fillOpacity="0.2" />
                  </marker>
                </defs>
                <path
                  d="M 650,200 Q 650,60 400,60"
                  fill="none"
                  stroke="hsl(142, 71%, 45%)"
                  strokeOpacity="0.25"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  markerEnd="url(#arrow-green)"
                />
                <path
                  d="M 400,60 Q 150,60 150,200"
                  fill="none"
                  stroke="hsl(0, 84%, 60%)"
                  strokeOpacity="0.25"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  markerEnd="url(#arrow-red)"
                />
                <path
                  d="M 150,200 Q 150,280 400,280"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.12"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  markerEnd="url(#arrow-muted)"
                />
                <path
                  d="M 400,280 Q 650,280 650,200"
                  fill="none"
                  stroke="hsl(142, 71%, 45%)"
                  strokeOpacity="0.15"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  markerEnd="url(#arrow-green)"
                />
              </svg>

              <div className="absolute left-1/2 top-0 -translate-x-1/2">
                <FlyNode
                  label="Market Cap"
                  value={marketCapDisplayCompact}
                  detail={
                    hasLivePrice && hasLiveSupply
                      ? `${formatCompactNumber(currentCirculating)} GLW at $${priceDetail}`
                      : "Live data unavailable"
                  }
                  className="w-56"
                />
              </div>

              <div className="absolute left-0 top-1/2 -translate-y-1/2">
                <FlyNode
                  label="Sell Pressure"
                  value={
                    fmiSellUsdDisplay === "—" ? "—" : `-${fmiSellUsdDisplay}/wk`
                  }
                  detail="Vesting unlocks and secondary market seller flow per week"
                  accent="red"
                  className="w-52"
                />
              </div>

              <div className="absolute right-0 top-1/2 -translate-y-1/2">
                <FlyNode
                  label="Buy Pressure"
                  value={fmiBuyUsdDisplay === "—" ? "—" : `+${fmiBuyUsdDisplay}/wk`}
                  detail="PoL yield + GCTL minting + miner sales flowing into the protocol weekly"
                  accent="green"
                  className="w-52"
                />
              </div>

              <div className="absolute left-1/2 bottom-0 -translate-x-1/2">
                <FlyNode
                  label="Liquidity Pool"
                  value={poolLiquidityDisplay}
                  detail={poolLiquidityDetail}
                  className="w-56"
                />
              </div>

              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl border px-6 py-4",
                    fmiBadgeBorder
                  )}
                >
                  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                    FMI Score
                  </span>
                  <span
                    className={cn(
                      "text-3xl font-semibold font-mono tabular-nums",
                      fmiAccentClass
                    )}
                  >
                    {fmiScoreDisplay}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono uppercase tracking-widest",
                      fmiAccentClass
                    )}
                  >
                    {fmiLabel}
                  </span>
                  <div className="mt-1.5 flex items-center gap-1">
                    <span className="text-[9px] font-mono text-muted-foreground/50">
                      Net
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold font-mono tabular-nums",
                        fmiAccentClass
                      )}
                    >
                      {fmiNetPressurePerWeekDisplay}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-2">
              <span>Sell pressure</span>
              <span>Buy pressure</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden flex">
              <div
                className="h-full"
                style={{
                  width: `${fmiRatio !== null ? (1 - fmiRatio) * 100 : 50}%`,
                  background: "hsl(0, 84%, 60%)",
                }}
              />
              <div
                className="h-full"
                style={{
                  width: `${fmiRatio !== null ? fmiRatio * 100 : 50}%`,
                  background: "hsl(142, 71%, 45%)",
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">
                {fmiSellUsdDisplay === "—" ? "—" : `-${fmiSellUsdDisplay}/wk`}
              </span>
              <span className="font-mono tabular-nums">
                {fmiBuyUsdDisplay === "—" ? "—" : `+${fmiBuyUsdDisplay}/wk`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MiniStat
              label="Pool depth"
              value={poolLiquidityDisplay}
              helper={
                hasPoolReserves && fmiSellToPoolDisplay !== "—"
                  ? `${fmiSellToPoolDisplay}x weekly sell pressure`
                  : "Live data unavailable"
              }
              valueClassName="text-base sm:text-lg tracking-tight"
            />
            <MiniStat
              label="Total PoL"
              value={
                totalPolLq !== null ? `${formatCompactNumberPrecise(totalPolLq)} lq` : "—"
              }
              helper={
                totalPolBreakdown?.breakdown ? `(${totalPolBreakdown.breakdown})` : "Live data unavailable"
              }
              valueClassName="text-base sm:text-lg tracking-tight"
            />
            <MiniStat
              label="Net / week"
              value={fmiNetPressureSignedDisplay}
              helper={
                fmiNetToPoolDisplay !== "—"
                  ? `+${fmiNetToPoolDisplay}% pool growth`
                  : "Live data unavailable"
              }
              valueClassName={cn("text-base sm:text-lg tracking-tight", fmiAccentClass)}
            />
            <MiniStat
              label="Buy / Sell ratio"
              value={fmiBuySellRatioDisplay === "—" ? "—" : `${fmiBuySellRatioDisplay}x`}
              helper={`${fmiBuyUsdDisplay} in, ${fmiSellUsdDisplay} out`}
              valueClassName={cn("text-base sm:text-lg tracking-tight", fmiAccentClass)}
            />
          </div>
          <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-muted/20 dark:bg-background/40 px-4 py-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Weekly buy pressure ({fmiBuyUsdDisplay}) exceeds sell pressure ({fmiSellUsdDisplay}) by{" "}
              <span className={cn("font-semibold", fmiAccentClass)}>{fmiNetPressureDisplay}</span>,
              yielding a {fmiBuySellRatioDisplay}x buy/sell ratio. The pool absorbs{" "}
              {fmiSellToPoolDisplay}x its depth in sell flow weekly, with PoL backstop at{" "}
              {polBackstopUsdDisplay}.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

