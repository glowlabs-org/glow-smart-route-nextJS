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
import { useGctlApi, useWallets, useRegions, useActiveRegionsSummary } from "@/hooks";
import { ConnectButton } from "@/components/connect-button";
import { trackEvent } from "@/lib/telemetry";

interface RegionStakeTile {
  regionId: number;
  regionName: string;
  amountGctl: number;
  glwSteered: number;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stableUnitFromNumber(value: number) {
  const x = Math.sin(value * 999 + 0.12345) * 10000;
  return x - Math.floor(x);
}

function getTreemapTileColors({
  regionId,
  intensity,
}: {
  regionId: number;
  intensity: number;
}) {
  const unit = stableUnitFromNumber(regionId);
  const hue = 188 + (unit - 0.5) * 12; // subtle variation around cyan
  const saturation = 86;
  const baseLightness = 52 + intensity * 10 + (unit - 0.5) * 6;
  const fillLightness = clamp(baseLightness, 40, 70);
  const dotLightness = clamp(baseLightness + 6, 40, 76);

  const fillAlpha = 0.18 + intensity * 0.45;
  const dotAlpha = 0.35 + intensity * 0.55;

  return {
    fill: `hsla(${hue.toFixed(1)}, ${saturation}%, ${fillLightness.toFixed(
      1
    )}%, ${fillAlpha.toFixed(3)})`,
    dot: `hsla(${hue.toFixed(1)}, ${saturation}%, ${dotLightness.toFixed(
      1
    )}%, ${dotAlpha.toFixed(3)})`,
  };
}

function GctlHeatmapSkeleton() {
  return (
    <Card className="h-full lg:max-h-[380px] overflow-hidden flex flex-col bg-card dark:bg-muted/30 border-foreground/10 dark:border-border pt-0">
      <CardHeader className="pb-0 pt-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
            GCTL
          </CardTitle>
          <Button
            size="sm"
            className="h-8 rounded-full px-3 text-[11px] font-mono tracking-wider gap-2"
            disabled
          >
            <Rocket className="h-3.5 w-3.5" />
            <span>Mint &amp; Stake</span>
          </Button>
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

          <div className="flex-1 min-h-[200px]  rounded-2xl overflow-hidden border border-border bg-muted/10 flex flex-col">
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
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "gctl_heatmap_widget";
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
  const { data: activeSummary, isLoading: isActiveSummaryLoading } =
    useActiveRegionsSummary({ enabled: isEnabled });

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

          const userGctl = gctlAmountFromRaw(regionStake.totalStaked);
          const regionSummary = activeSummary?.regions.find(
            (r) => r.id === regionStake.regionId
          );
          const totalRegionGctl = regionSummary?.stakedGctl ?? 0;
          const regionGlwPerWeek = regionSummary?.glwPerWeek ?? 0;
          const userShare = totalRegionGctl > 0 ? userGctl / totalRegionGctl : 0;
          const glwSteered = userShare * regionGlwPerWeek;

          return {
            regionId: regionStake.regionId,
            regionName: regionStake.region?.name || fallbackName,
            amountGctl: userGctl,
            glwSteered,
          };
        }) ?? [];

    return tiles.sort((a, b) => b.amountGctl - a.amountGctl).slice(0, 8);
  }, [isEnabled, regions, walletDetails?.regions, activeSummary?.regions]);

  const stakedTotalGctl = useMemo(() => {
    return stakes.reduce((sum, tile) => sum + tile.amountGctl, 0);
  }, [stakes]);
  const totalGlwSteered = useMemo(() => {
    return stakes.reduce((sum, tile) => sum + tile.glwSteered, 0);
  }, [stakes]);
  const totalBalanceGctl = walletBalanceGctl + stakedTotalGctl;
  const liquidPercent =
    totalBalanceGctl > 0 ? walletBalanceGctl / totalBalanceGctl : 0;
  const stakedPercent =
    totalBalanceGctl > 0 ? stakedTotalGctl / totalBalanceGctl : 0;

  const mockStakes: RegionStakeTile[] = useMemo(
    () => [
      { regionId: 1, regionName: "Utah", amountGctl: 45000, glwSteered: 1200 },
      { regionId: 2, regionName: "Nevada", amountGctl: 28000, glwSteered: 750 },
      { regionId: 3, regionName: "Arizona", amountGctl: 15000, glwSteered: 400 },
      { regionId: 4, regionName: "Texas", amountGctl: 12000, glwSteered: 320 },
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
      <Card className="h-full lg:max-h-[380px] overflow-hidden flex flex-col bg-card dark:bg-muted/30 border-foreground/10 dark:border-border pt-0">
        <CardHeader className="pb-0 pt-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              GCTL
            </CardTitle>
            <Button
              size="sm"
              className="h-8 rounded-full px-3 text-[11px] font-mono tracking-wider gap-2"
              disabled
            >
              <Rocket className="h-3.5 w-3.5" />
              <span>Mint &amp; Stake</span>
            </Button>
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

            <div className="flex-1 min-h-[200px] rounded-2xl overflow-hidden border border-border bg-muted/10 flex flex-col">
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/60 shrink-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Staked across projects
                </span>
                <Droplets className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 w-full flex divide-x divide-black/10 dark:divide-white/15">
                  {mockStakes.map((tile, i) => {
                    const intensity = clamp(
                      tile.amountGctl / Math.max(1, mockStakedTotal),
                      0,
                      1
                    );
                    const { fill } = getTreemapTileColors({
                      regionId: tile.regionId + i * 1000,
                      intensity,
                    });
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
    isGctlBalanceLoading || isWalletDetailsLoading || isRegionsLoading || isActiveSummaryLoading;

  if (!isLoading && totalBalanceGctl <= 0) {
    return (
      <Card className="h-full lg:max-h-[380px] overflow-hidden flex flex-col pb-0 bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
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
                  className="h-12 w-full bg-foreground text-background hover:bg-foreground/90 font-mono dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  onClick={() => {
                    trackEvent("dashboard_gctl_mint_stake_open_click", {
                      source,
                      wallet_connected: Boolean(normalizedWalletAddress),
                      wallet_address: normalizedWalletAddress,
                    });
                    onMintAndStakeClick?.();
                  }}
                  disabled={isLoading}
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
                  onClick={() => {
                    trackEvent("dashboard_education_click", {
                      source,
                      wallet_connected: Boolean(normalizedWalletAddress),
                      wallet_address: normalizedWalletAddress,
                      topic: "gctl",
                      url: "https://glow.org/blog/beginner-guide-to-gctl",
                    });
                  }}
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
    <Card className="h-full lg:max-h-[380px] overflow-hidden flex flex-col bg-card dark:bg-muted/30 border-foreground/10 dark:border-border pt-0">
      <CardHeader className="pb-0 pt-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
            GCTL
          </CardTitle>
          <Button
            size="sm"
            className="h-8 rounded-full px-3 text-[11px] font-mono tracking-wider gap-2"
            onClick={() => {
              trackEvent("dashboard_gctl_mint_stake_open_click", {
                source,
                wallet_connected: Boolean(normalizedWalletAddress),
                wallet_address: normalizedWalletAddress,
              });
              onMintAndStakeClick?.();
            }}
            disabled={isLoading}
          >
            <Rocket className="h-3.5 w-3.5" />
            <span>Mint &amp; Stake</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 flex flex-col p-4 pt-3">
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          {/* Summary row */}
          <div className="flex items-start justify-between gap-4 shrink-0">
            <div className="flex gap-6">
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
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Steering
                </span>
                <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-foreground">
                  {isLoading ? "—" : `+${formatCompact(totalGlwSteered)}`}{" "}
                  <span className="text-xs font-mono text-muted-foreground">
                    GLW/wk
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end text-[10px] font-mono uppercase text-muted-foreground leading-tight">
              <div className="inline-flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" />
                <span>
                  {isLoading
                    ? "—"
                    : `${formatCompact(walletBalanceGctl)} • ${Math.round(
                        liquidPercent * 100
                      )}% Liquid`}
                </span>
              </div>
              <div className="inline-flex items-center gap-1 mt-1">
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {isLoading
                    ? "—"
                    : `${formatCompact(stakedTotalGctl)} • ${Math.round(
                        stakedPercent * 100
                      )}% Staked`}
                </span>
              </div>
            </div>
          </div>

          {/* Treemap */}
          <div className="flex-1 min-h-[200px] rounded-2xl overflow-hidden border border-border bg-muted/10 flex flex-col">
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
                  <div className="flex-1 min-h-0 w-full flex divide-x divide-black/10 dark:divide-white/15">
                    {stakes.map((tile) => {
                      const share =
                        stakedTotalGctl > 0
                          ? tile.amountGctl / stakedTotalGctl
                          : 0;
                      const showInlineLabel = share >= 0.2;

                      const intensity = tile.amountGctl / maxStake;
                      const { fill, dot } = getTreemapTileColors({
                        regionId: tile.regionId,
                        intensity,
                      });

                      const tooltipText = `${tile.regionName} • ${formatCompact(
                        tile.amountGctl
                      )} GCTL • +${formatCompact(tile.glwSteered)} GLW/wk`;

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
                                  <div className="space-y-0.5">
                                    <div className="font-mono text-sm font-bold text-white drop-shadow-sm">
                                      +{formatCompact(tile.glwSteered)}{" "}
                                      <span className="text-[10px] font-mono font-semibold text-white/80">
                                        GLW/wk
                                      </span>
                                    </div>
                                    <div className="font-mono text-[10px] text-white/70">
                                      {formatCompact(tile.amountGctl)} GCTL
                                    </div>
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
                      const intensity = tile.amountGctl / maxStake;
                      const { dot } = getTreemapTileColors({
                        regionId: tile.regionId,
                        intensity,
                      });

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
                            (+{formatCompact(tile.glwSteered)} GLW)
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
