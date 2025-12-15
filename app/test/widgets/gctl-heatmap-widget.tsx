"use client";

import React, { useMemo } from "react";
import { Droplets, Lock, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RegionStakeTile {
  regionId: number;
  regionName: string;
  amountGctl: number;
}

const MOCK_HAS_GCTL = true;
const MOCK_WALLET_BALANCE_GCTL = 1423.52;
const MOCK_STAKES_BY_REGION: RegionStakeTile[] = [
  { regionId: 1, regionName: "US-West", amountGctl: 820.12 },
  { regionId: 2, regionName: "US-East", amountGctl: 540.55 },
  { regionId: 3, regionName: "EU", amountGctl: 210.9 },
  { regionId: 4, regionName: "LATAM", amountGctl: 120.0 },
] as const;

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(value >= 10 ? 2 : 4).replace(/\.?0+$/, "");
}

export default function GctlHeatmapWidget() {
  const hasGctl = MOCK_HAS_GCTL;
  const walletBalanceGctl = MOCK_WALLET_BALANCE_GCTL;
  const stakes = useMemo(() => {
    return MOCK_STAKES_BY_REGION.slice()
      .sort((a, b) => b.amountGctl - a.amountGctl)
      .slice(0, 8);
  }, []);
  const stakedTotalGctl = useMemo(() => {
    return stakes.reduce((sum, tile) => sum + tile.amountGctl, 0);
  }, [stakes]);
  const totalBalanceGctl = walletBalanceGctl + stakedTotalGctl;
  const liquidPercent =
    totalBalanceGctl > 0 ? walletBalanceGctl / totalBalanceGctl : 0;
  const stakedPercent =
    totalBalanceGctl > 0 ? stakedTotalGctl / totalBalanceGctl : 0;

  if (!hasGctl) return null;

  const maxStake = Math.max(1, ...stakes.map((t) => t.amountGctl));

  return (
    <Card className="h-full max-h-[360px] overflow-hidden flex flex-col">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="tracking-tight">GCTL</CardTitle>
          <span className="text-[10px] font-mono uppercase text-muted-foreground">
            Treemap
          </span>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 flex flex-col p-4 pt-3">
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          {/* Summary row */}
          <div className="flex items-start justify-between gap-4 shrink-0">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Total balance
              </span>
              <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-foreground">
                {formatCompact(totalBalanceGctl)}{" "}
                <span className="text-xs font-mono text-muted-foreground">
                  GCTL
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end text-[10px] font-mono uppercase text-muted-foreground leading-tight">
              <div className="inline-flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" />
                <span>{Math.round(liquidPercent * 100)}% Liquid</span>
              </div>
              <div className="inline-flex items-center gap-1 mt-1">
                <Lock className="w-3.5 h-3.5" />
                <span>{Math.round(stakedPercent * 100)}% Staked</span>
              </div>
            </div>
          </div>

          {/* Treemap */}
          <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-border bg-muted/10 flex flex-col">
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/60 shrink-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Staked by region
              </span>
              <Droplets className="w-3.5 h-3.5 text-muted-foreground" />
            </div>

            {stakes.length === 0 ? (
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">
                  No active GCTL stakes
                </span>
              </div>
            ) : (
              <TooltipProvider delayDuration={150}>
                <div className="flex-1 min-h-0 flex flex-col">
                  {/* Row 1: proportional bar */}
                  <div className="flex-1 min-h-0 w-full flex">
                    {stakes.map((tile, index) => {
                      const share =
                        stakedTotalGctl > 0
                          ? tile.amountGctl / stakedTotalGctl
                          : 0;
                      const showInlineLabel = share >= 0.2;

                      const intensity = tile.amountGctl / maxStake;
                      const alpha = 0.18 + intensity * 0.32;
                      const hue = 155 + index * 8;
                      const fill = `hsla(${hue}, 70%, 45%, ${alpha})`;
                      const dot = `hsl(${hue}, 70%, 50%)`;

                      const tooltipText = `${tile.regionName} • ${formatCompact(
                        tile.amountGctl
                      )} GCTL • ${Math.round(share * 100)}%`;

                      return (
                        <Tooltip key={tile.regionId}>
                          <TooltipTrigger asChild>
                            <div
                              className="relative h-full overflow-hidden"
                              style={
                                {
                                  flexGrow: tile.amountGctl,
                                  flexBasis: 0,
                                  backgroundColor: fill,
                                } as React.CSSProperties
                              }
                              aria-label={tooltipText}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent dark:from-black/20" />

                              {showInlineLabel ? (
                                <div className="relative h-full w-full p-2.5 flex flex-col justify-between">
                                  <div className="font-mono text-xs font-bold text-white/95 drop-shadow-sm truncate">
                                    {tile.regionName}
                                  </div>
                                  <div className="font-mono text-sm font-bold text-white drop-shadow-sm">
                                    {formatCompact(tile.amountGctl)}{" "}
                                    <span className="text-[10px] font-mono font-semibold text-white/80">
                                      GCTL
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="sr-only">{tooltipText}</div>
                              )}

                              <div
                                className="absolute bottom-2 right-2 h-2 w-2 rounded-full border border-white/20"
                                style={
                                  {
                                    backgroundColor: dot,
                                  } as React.CSSProperties
                                }
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="center"
                            sideOffset={10}
                          >
                            <div className="font-mono text-[10px]">
                              {tooltipText}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>

                  {/* Row 2: clean legend */}
                  <div className="shrink-0 flex flex-nowrap overflow-x-auto gap-3 px-2.5 py-1.5 border-t border-border/60">
                    {stakes.map((tile, index) => {
                      const share =
                        stakedTotalGctl > 0
                          ? tile.amountGctl / stakedTotalGctl
                          : 0;
                      const hue = 155 + index * 8;
                      const dot = `hsl(${hue}, 70%, 50%)`;

                      return (
                        <div
                          key={tile.regionId}
                          className="inline-flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground"
                        >
                          <span
                            className="h-2 w-2 rounded-sm"
                            style={
                              { backgroundColor: dot } as React.CSSProperties
                            }
                          />
                          <span className="text-foreground/90">
                            {tile.regionName}
                          </span>
                          <span className="text-muted-foreground">
                            ({Math.round(share * 100)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
