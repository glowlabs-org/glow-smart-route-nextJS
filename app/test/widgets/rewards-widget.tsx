"use client";

import React from "react";
import { Timer } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ClaimsPanel } from "@/app/wallet/claims-panel";
import {
  AnimatedCountdown,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import { useClaimableRewards, useWalletV2Claims } from "@/hooks";
import { useRewardsKernelWrapper } from "@/hooks/useRewardsKernelWrapper";
import { weekToNonce } from "@/hooks/useMerkleProofs";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { GENESIS_TIMESTAMP, getCurrentEpoch } from "@/utils/getCurrentEpoch";
import { cn } from "@/lib/utils";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";

const DEFAULT_INITIAL_DURATION_MS = (4 * 60 * 60 + 12 * 60 + 33) * 1000;

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatUsdWhole(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function estimateUsdTotal(params: {
  totalsByCurrency: Record<string, number>;
  glwSpotPriceUsd: number;
}) {
  const { totalsByCurrency, glwSpotPriceUsd } = params;
  let total = 0;
  for (const [currency, amount] of Object.entries(totalsByCurrency)) {
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (currency === "USDC" || currency === "USDG") {
      total += amount;
      continue;
    }
    if (currency === "GLW") {
      if (Number.isFinite(glwSpotPriceUsd) && glwSpotPriceUsd > 0) {
        total += amount * glwSpotPriceUsd;
      }
    }
  }
  return total;
}

function safeGetCurrentEpoch() {
  try {
    return getCurrentEpoch();
  } catch {
    return undefined;
  }
}

function formatTokenAmount(
  value: number,
  params?: { maximumFractionDigits?: number }
) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: params?.maximumFractionDigits ?? 0,
  }).format(value);
}

function getClaimableBreakdown(params: {
  claimableTotalsByCurrency: Record<string, number> | undefined;
}) {
  const { claimableTotalsByCurrency } = params;
  const totals = claimableTotalsByCurrency ?? {};

  const glw = totals.GLW ?? 0;
  const usdg = totals.USDG ?? 0;
  const sgctl = totals.SGCTL ?? 0;

  const entries = [
    {
      currency: "GLW",
      value: glw,
      label: `${formatTokenAmount(glw, { maximumFractionDigits: 0 })} GLW`,
      isPrimary: true,
    },
    {
      currency: "USDG",
      value: usdg,
      label: formatUsdWhole(usdg),
      subLabel: "USDG",
      isPrimary: false,
    },
    {
      currency: "SGCTL",
      value: sgctl,
      label: `${formatTokenAmount(sgctl, { maximumFractionDigits: 0 })} SGCTL`,
      isPrimary: false,
    },
  ].filter((entry) => Number.isFinite(entry.value) && entry.value > 0);

  if (entries.length > 0) return entries;

  return [
    {
      currency: "GLW",
      value: 0,
      label: "0 GLW",
      isPrimary: true,
    },
  ];
}

function RewardsCountdown(props: { initialDurationMs: number }) {
  const { initialDurationMs } = props;

  const remainingMs = useCountdownTo({
    targetAtMs: React.useMemo(() => {
      try {
        const nextEpoch = getCurrentEpoch() + 1;
        const weekSeconds = 7 * 86_400;
        return (GENESIS_TIMESTAMP + nextEpoch * weekSeconds) * 1000;
      } catch {
        return Date.now() + Math.max(0, initialDurationMs);
      }
    }, [initialDurationMs]),
  });

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/20 py-2 px-3">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-16 opacity-30 dark:opacity-20"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{
          background:
            "conic-gradient(from 0deg, transparent, hsl(var(--primary) / 0.15), transparent)",
        }}
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80">
          <Timer className="h-3.5 w-3.5" />
          <span>Next Claim</span>
        </div>
        <div className="flex justify-end">
          <AnimatedCountdown remainingMs={remainingMs} size="sm" />
        </div>
      </div>
    </div>
  );
}

interface RewardsWidgetProps {
  walletAddress?: string | null;
  hideIfEmpty?: boolean;
  initialDurationMs?: number;
}

export default function RewardsWidget({
  walletAddress,
  hideIfEmpty = true,
  initialDurationMs = DEFAULT_INITIAL_DURATION_MS,
}: RewardsWidgetProps) {
  const { isConnecting, isReconnecting } = useAccount();
  const hasWallet = Boolean(walletAddress);
  const isWalletConnecting = isConnecting || isReconnecting;
  const address = walletAddress ?? undefined;
  const queryClient = useQueryClient();
  const refreshKey = safeGetCurrentEpoch();

  const {
    weeklyBreakdown,
    isLoading: isRewardsLoading,
    isError: isRewardsError,
  } = useClaimableRewards(address, {
    refreshKey,
    query: QUERY_CONFIG.STICKY,
  });

  const { checkIfClaimed, checkIfGlwClaimed } = useRewardsKernelWrapper();
  const { spotPrice: glwSpotPriceUsd } = useGlowSpotPrice({
    refreshKey,
    query: {
      ...QUERY_CONFIG.STICKY,
      refetchInterval: false,
      retry: 0,
    },
  });

  const {
    protocolTotals: lifetimeProtocolTotals,
    inflationTotalGlw: lifetimeInflationGlw,
    isLoading: isLifetimeLoading,
    isError: isLifetimeError,
  } = useWalletV2Claims(address, {
    refreshKey,
    query: QUERY_CONFIG.STICKY,
  });

  const finalizedWeeks = React.useMemo(
    () => weeklyBreakdown.filter((week) => week.isFinalized),
    [weeklyBreakdown]
  );

  const finalizedWeeksKey = React.useMemo(
    () => finalizedWeeks.map((week) => week.week).join(","),
    [finalizedWeeks]
  );

  const {
    data: claimableTotalsByCurrency,
    isLoading: isClaimableTotalsLoading,
    isError: isClaimableTotalsError,
  } = useQuery<Record<string, number>>({
    queryKey: QUERY_KEYS.wallets.claimableTotals(
      address,
      finalizedWeeksKey,
      refreshKey
    ),
    enabled: Boolean(hasWallet && address && finalizedWeeks.length > 0),
    staleTime: QUERY_CONFIG.STICKY.staleTime,
    gcTime: QUERY_CONFIG.STICKY.gcTime,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!address) return {};

      const totals: Record<string, number> = {};

      await Promise.all(
        finalizedWeeks.map(async (weekData) => {
          const hasGlwRewards = weekData.rewards.some(
            (reward) => reward.type === "glowInflation"
          );
          const hasProtocolRewards = weekData.rewards.some(
            (reward) => reward.type === "protocolDeposit"
          );

          const [glwClaimed, protocolClaimed] = await Promise.all([
            hasGlwRewards
              ? checkIfGlwClaimed(weekData.week + 1, address as `0x${string}`)
              : Promise.resolve(true),
            hasProtocolRewards
              ? checkIfClaimed(
                  address as `0x${string}`,
                  weekToNonce(weekData.week)
                )
              : Promise.resolve(true),
          ]);

          for (const reward of weekData.rewards) {
            if (reward.type === "glowInflation" && !glwClaimed) {
              const amount = Number.parseFloat(reward.amount);
              if (!Number.isFinite(amount) || amount <= 0) continue;
              totals.GLW = (totals.GLW ?? 0) + amount;
              continue;
            }
            if (reward.type === "protocolDeposit" && !protocolClaimed) {
              const amount = Number.parseFloat(reward.amount);
              if (!Number.isFinite(amount) || amount <= 0) continue;
              totals[reward.currency] = (totals[reward.currency] ?? 0) + amount;
            }
          }
        })
      );
      return totals;
    },
  });

  const lifetimeUsd = React.useMemo(() => {
    if (!hasWallet) return null;
    const totals: Record<string, number> = {
      ...lifetimeProtocolTotals,
      GLW: lifetimeInflationGlw,
    };
    return estimateUsdTotal({
      totalsByCurrency: totals,
      glwSpotPriceUsd,
    });
  }, [
    glwSpotPriceUsd,
    hasWallet,
    lifetimeInflationGlw,
    lifetimeProtocolTotals,
  ]);

  const isWidgetLoading =
    hasWallet &&
    (isRewardsLoading || isClaimableTotalsLoading || isLifetimeLoading);

  const isWidgetError =
    hasWallet && (isRewardsError || isClaimableTotalsError || isLifetimeError);

  const claimableBreakdown = React.useMemo(
    () => getClaimableBreakdown({ claimableTotalsByCurrency }),
    [claimableTotalsByCurrency]
  );

  const handleClaimSuccess = React.useCallback(() => {
    if (!address) return;
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.wallets.rewards(address),
    });
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.wallets.v2Claims(address),
    });
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.wallets.claimableTotals(address),
    });
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.unclaimed.glw(address),
    });
  }, [address, queryClient]);

  const hasLifetimeEarned = React.useMemo(() => {
    const hasProtocol =
      Object.values(lifetimeProtocolTotals).some(
        (value) => Number.isFinite(value) && value > 0
      ) ?? false;
    const hasGlw =
      Number.isFinite(lifetimeInflationGlw) && lifetimeInflationGlw > 0;
    return hasProtocol || hasGlw;
  }, [lifetimeInflationGlw, lifetimeProtocolTotals]);

  const hasClaimable = React.useMemo(() => {
    if (!claimableTotalsByCurrency) return false;
    return Object.values(claimableTotalsByCurrency).some(
      (value) => Number.isFinite(value) && value > 0
    );
  }, [claimableTotalsByCurrency]);

  const shouldHide =
    hasWallet &&
    !isWalletConnecting &&
    !isWidgetLoading &&
    !isWidgetError &&
    weeklyBreakdown.length === 0 &&
    !hasLifetimeEarned &&
    !hasClaimable;

  if (shouldHide && hideIfEmpty) return null;

  return (
    <Card className="h-full flex flex-col bg-card dark:bg-muted/30 border-foreground/10 dark:border-border overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
        <CardTitle>Rewards</CardTitle>
        {hasWallet && !isWalletConnecting && hasClaimable && (
          <Badge
            variant="secondary"
            className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 h-5 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted"
          >
            Ready to claim
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 py-0 px-6 gap-4">
        {/* Countdown Area */}
        {hasWallet &&
          !isWalletConnecting &&
          !isWidgetLoading &&
          !isWidgetError && (
            <div className="pt-0">
              <RewardsCountdown initialDurationMs={initialDurationMs} />
            </div>
          )}

        {/* Main Content: Vertically Centered */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[120px]">
          {!hasWallet ? (
            isWalletConnecting ? (
              <div className="space-y-4 w-full flex flex-col items-center">
                <Skeleton className="h-8 w-32 rounded-lg" />
                <Skeleton className="h-4 w-24 rounded-md opacity-50" />
              </div>
            ) : (
              <div className="text-center space-y-1">
                <div className="text-3xl font-bold tracking-tighter text-muted-foreground/30">
                  —
                </div>
                <div className="text-xs text-muted-foreground">
                  Connect to view
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-1 w-full items-center text-center">
              {isWidgetLoading ? (
                <div className="space-y-2 w-full flex flex-col items-center">
                  <Skeleton className="h-10 w-48 rounded-lg" />
                  <Skeleton className="h-5 w-24 rounded-md opacity-50" />
                  <Skeleton className="h-6 w-32 rounded-full mt-2" />
                </div>
              ) : isWidgetError ? (
                <div className="text-center text-destructive text-sm font-medium">
                  Unable to load
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-0.5 animate-in fade-in zoom-in-95 duration-300">
                    {claimableBreakdown.map((entry, idx) => (
                      <div
                        key={entry.currency}
                        className={cn(
                          "leading-tight",
                          entry.isPrimary
                            ? "text-4xl font-bold tracking-tighter text-foreground"
                            : "text-lg font-medium text-muted-foreground/80 flex items-center gap-1.5"
                        )}
                      >
                        {entry.label}
                        {entry.subLabel && !entry.isPrimary && (
                          <span className="text-xs font-mono uppercase text-muted-foreground/60 mt-0.5">
                            {entry.subLabel}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/50 border border-border">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                        Lifetime
                      </span>
                      <span className="text-[11px] font-mono font-medium text-foreground tabular-nums">
                        {formatUsd(lifetimeUsd ?? 0)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Action Button */}
        <div className="shrink-0 pt-2">
          {hasWallet && !shouldHide ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full h-10 font-semibold shadow-sm transition-all hover:scale-[1.01]">
                  Claim Rewards
                </Button>
              </DialogTrigger>
              <DialogContent
                className="bg-background rounded-3xl p-0 sm:max-w-[980px] w-full border-border shadow-2xl overflow-hidden"
                onInteractOutside={(e) => e.preventDefault()}
              >
                <ClaimsPanel
                  variant="dialog"
                  onClaimSuccess={handleClaimSuccess}
                />
              </DialogContent>
            </Dialog>
          ) : (
            <Button
              variant="outline"
              className="w-full h-10 opacity-50 cursor-not-allowed"
              disabled
            >
              No Rewards
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
