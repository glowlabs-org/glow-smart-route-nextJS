"use client";

import React, { useMemo } from "react";
import { Droplets, Lock, Wallet, Rocket } from "lucide-react";
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
import { formatUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { cn } from "@/lib/utils";
import { useGctlApi } from "@/hooks/useGctlApi";
import { useWallets } from "@/hooks/useWallets";
import { useRegions } from "@/hooks/useRegions";
import { ConnectButton } from "@/components/connect-button";

interface RegionStakeTile {
  regionId: number;
  regionName: string;
  amountGctl: number;
}

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
  return value.toFixed(value >= 10 ? 2 : 4).replace(/\.?0+$/, "");
}

function GctlHeatmapSkeleton() {
  return (
    <Card className="col-span-12 lg:col-span-5 h-full max-h-[380px] overflow-hidden flex flex-col bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
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
          <div className="flex items-start justify-between gap-4 shrink-0">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-8 w-40 rounded-xl" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>
          </div>

          <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-border bg-muted/10 flex flex-col">
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/60 shrink-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Staked across projects
              </span>
              <Droplets className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-h-0 p-3">
              <div className="h-full w-full rounded-xl bg-muted/30" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GctlHeatmapWidget({
  walletAddress,
  onMintAndStakeClick,
}: {
  walletAddress?: string | null;
  onMintAndStakeClick?: () => void;
}) {
  const { isConnecting, isReconnecting } = useAccount();
  const isEnabled = Boolean(walletAddress);
  const isWalletConnecting = isConnecting || isReconnecting;

  const { gctlBalance, isGctlBalanceLoading } = useGctlApi(
    walletAddress ?? undefined,
    {
      enabled: isEnabled,
    }
  );
  const { walletDetails, isWalletDetailsLoading } = useWallets({
    walletAddress: walletAddress ?? undefined,
    enabled: isEnabled,
  });
  const { regions, isRegionsLoading } = useRegions();

  const walletBalanceGctl = useMemo(() => {
    if (!isEnabled) return 0;
    return gctlAmountFromRaw(gctlBalance);
  }, [gctlBalance, isEnabled]);

  const stakes = useMemo((): RegionStakeTile[] => {
    if (!isEnabled) return [];

    const tiles =
      walletDetails?.regions
        ?.filter((regionStake) => {
          try {
            return BigInt(regionStake.totalStaked || "0") > BigInt(0);
          } catch {
            return false;
          }
        })
        .map((regionStake) => {
          const fallbackName =
            regions.find((r) => r.id === regionStake.regionId)?.name ??
            `Region ${regionStake.regionId}`;

          return {
            regionId: regionStake.regionId,
            regionName: regionStake.region?.name || fallbackName,
            amountGctl: gctlAmountFromRaw(regionStake.totalStaked),
          };
        }) ?? [];

    return tiles.sort((a, b) => b.amountGctl - a.amountGctl).slice(0, 8);
  }, [isEnabled, regions, walletDetails?.regions]);

  const stakedTotalGctl = useMemo(() => {
    return stakes.reduce((sum, tile) => sum + tile.amountGctl, 0);
  }, [stakes]);
  const totalBalanceGctl = walletBalanceGctl + stakedTotalGctl;
  const liquidPercent =
    totalBalanceGctl > 0 ? walletBalanceGctl / totalBalanceGctl : 0;
  const stakedPercent =
    totalBalanceGctl > 0 ? stakedTotalGctl / totalBalanceGctl : 0;

  const mockStakes: RegionStakeTile[] = useMemo(
    () => [
      { regionId: 1, regionName: "Utah", amountGctl: 45000 },
      { regionId: 2, regionName: "Nevada", amountGctl: 28000 },
      { regionId: 3, regionName: "Arizona", amountGctl: 15000 },
      { regionId: 4, regionName: "Texas", amountGctl: 12000 },
    ],
    []
  );

  const mockTotalBalance = 100000;
  const mockLiquidPercent = 0.25;
  const mockStakedPercent = 0.75;
  const mockStakedTotal = 75000;

  if (isWalletConnecting && !isEnabled) return <GctlHeatmapSkeleton />;

  if (!isEnabled) {
    return (
      <Card className="col-span-12 lg:col-span-5 h-full max-h-[380px] overflow-hidden flex flex-col bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="tracking-tight">GCTL</CardTitle>
            <span className="text-[10px] font-mono uppercase text-muted-foreground">
              Treemap
            </span>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 flex flex-col p-4 pt-3 relative">
          <div className="flex-1 min-h-0 blur-[8px] opacity-40 pointer-events-none select-none flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4 shrink-0">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Total balance
                </span>
                <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-foreground">
                  {formatCompact(mockTotalBalance)}{" "}
                  <span className="text-xs font-mono text-muted-foreground">
                    GCTL
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end text-[10px] font-mono uppercase text-muted-foreground leading-tight">
                <div className="inline-flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>{Math.round(mockLiquidPercent * 100)}% Liquid</span>
                </div>
                <div className="inline-flex items-center gap-1 mt-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{Math.round(mockStakedPercent * 100)}% Staked</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-border bg-muted/10 flex flex-col">
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/60 shrink-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Staked across projects
                </span>
                <Droplets className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 w-full flex">
                  {mockStakes.map((tile, i) => {
                    const share = tile.amountGctl / mockStakedTotal;
                    const fill = `rgba(34, 211, 238, ${0.2 + (i / 4) * 0.5})`;
                    return (
                      <div
                        key={tile.regionId}
                        className="h-full"
                        style={{
                          flexGrow: tile.amountGctl,
                          flexBasis: 0,
                          backgroundColor: fill,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="bg-background/80 backdrop-blur-md border border-border rounded-2xl p-6 shadow-2xl max-w-[280px] text-center space-y-4">
              <div className="space-y-1">
                <div className="text-sm font-bold text-foreground">
                  Connect your wallet
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  Connect your wallet to see how your GCTL steers Infrastructure
                  Projects.
                </div>
              </div>
              <div className="flex justify-center">
                <ConnectButton variant="default" size="large" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isLoading =
    isGctlBalanceLoading || isWalletDetailsLoading || isRegionsLoading;

  if (!isLoading && totalBalanceGctl <= 0) {
    return (
      <Card className="col-span-12 lg:col-span-3 h-full max-h-[380px] overflow-hidden flex flex-col pb-0 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
        <CardContent className="min-h-0 flex-1 flex flex-col p-0">
          <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden p-6 flex flex-col">
            <div className="relative flex flex-col items-center justify-center text-center flex-1 gap-6">
              <div className="space-y-2">
                <div className="text-lg font-bold text-foreground">
                  Glow Control
                </div>
                <div className="mx-auto max-w-[400px] text-sm text-zinc-400">
                  GCTL (Glow Control) directs Glow’s 175,000 GLW/week subsidy
                  across Infrastructure Projects.
                </div>
              </div>

              <div className="w-full max-w-md space-y-2">
                <Button
                  className="h-12 w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-mono dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  onClick={onMintAndStakeClick}
                >
                  <Rocket className="mr-2 h-4 w-4" />
                  Mint &amp; stake GCTL
                </Button>
              </div>

              <div className="w-full max-w-lg">
                <Link
                  href="https://glow.org/blog/beginner-guide-to-gctl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-2xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-cyan-500/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/50">
                      <Droplets className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground transition-colors group-hover:text-cyan-400">
                        Beginner&apos;s Guide to GCTL
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        Learn how to steer Glow&apos;s economy.
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxStake = Math.max(1, ...stakes.map((t) => t.amountGctl));

  return (
    <Card className="col-span-12 lg:col-span-5 h-full max-h-[380px] overflow-hidden flex flex-col bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
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
                {isLoading ? "—" : formatCompact(totalBalanceGctl)}{" "}
                <span className="text-xs font-mono text-muted-foreground">
                  GCTL
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end text-[10px] font-mono uppercase text-muted-foreground leading-tight">
              <div className="inline-flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" />
                <span>
                  {isLoading ? "—" : Math.round(liquidPercent * 100)}% Liquid
                </span>
              </div>
              <div className="inline-flex items-center gap-1 mt-1">
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {isLoading ? "—" : Math.round(stakedPercent * 100)}% Staked
                </span>
              </div>
            </div>
          </div>

          {/* Treemap */}
          <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-border bg-muted/10 flex flex-col">
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/60 shrink-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Staked across projects
              </span>
              <Droplets className="w-3.5 h-3.5 text-muted-foreground" />
            </div>

            {isLoading ? (
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <span className="text-xs text-muted-foreground font-mono">
                  Loading…
                </span>
              </div>
            ) : stakes.length === 0 ? (
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
                    {stakes.map((tile) => {
                      const share =
                        stakedTotalGctl > 0
                          ? tile.amountGctl / stakedTotalGctl
                          : 0;
                      const showInlineLabel = share >= 0.2;

                      const intensity = tile.amountGctl / maxStake;
                      const alpha = 0.15 + intensity * 0.55;
                      const fill = `rgba(34, 211, 238, ${alpha})`;
                      const dotAlpha = 0.35 + intensity * 0.55;
                      const dot = `rgba(34, 211, 238, ${dotAlpha})`;

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
                    {stakes.map((tile) => {
                      const share =
                        stakedTotalGctl > 0
                          ? tile.amountGctl / stakedTotalGctl
                          : 0;
                      const intensity = tile.amountGctl / maxStake;
                      const dotAlpha = 0.35 + intensity * 0.55;
                      const dot = `rgba(34, 211, 238, ${dotAlpha})`;

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
