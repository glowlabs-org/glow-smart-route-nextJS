"use client";

import React from "react";
import { Timer } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ClaimsPanel } from "@/app/wallet/claims-panel";
import {
  AnimatedCountdownDhms,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import { useClaimableRewards } from "@/hooks";
import { useRewardsKernelWrapper } from "@/hooks/useRewardsKernelWrapper";
import { weekToNonce } from "@/hooks/useMerkleProofs";
import { GENESIS_TIMESTAMP, getCurrentEpoch } from "@/utils/getCurrentEpoch";
import { cn } from "@/lib/utils";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { QUERY_CONFIG } from "@/hooks/query-config";

const DEFAULT_INITIAL_DURATION_MS = (4 * 60 * 60 + 12 * 60 + 33) * 1000;

function formatUsdWhole(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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
      <div className="relative flex flex-col gap-1.5 min-w-0">
        <div className="flex flex-col items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80 shrink-0">
            <Timer className="h-3.5 w-3.5" />
            <span>Next Claim</span>
          </div>
          <AnimatedCountdownDhms
            remainingMs={remainingMs}
            size="sm"
            showLabels
          />
        </div>
      </div>
    </div>
  );
}

interface RewardsWidgetProps {
  walletAddress?: string | null;
  hideIfEmpty?: boolean;
  initialDurationMs?: number;
  variant?: "default" | "minimal";
}

export default function RewardsWidget({
  walletAddress,
  hideIfEmpty = true,
  initialDurationMs = DEFAULT_INITIAL_DURATION_MS,
  variant = "default",
}: RewardsWidgetProps) {
  const { isConnecting, isReconnecting } = useAccount();
  const isMinimal = variant === "minimal";
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

  const isWidgetLoading =
    hasWallet && (isRewardsLoading || isClaimableTotalsLoading);

  const isWidgetError = hasWallet && (isRewardsError || isClaimableTotalsError);

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
      queryKey: QUERY_KEYS.wallets.claimableTotals(address),
    });
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.unclaimed.glw(address),
    });
  }, [address, queryClient]);

  const hasClaimable = React.useMemo(() => {
    if (!claimableTotalsByCurrency) return false;
    return Object.values(claimableTotalsByCurrency).some(
      (value) => Number.isFinite(value) && value > 0
    );
  }, [claimableTotalsByCurrency]);

  const nonFinalizedTotals = React.useMemo(() => {
    const nonFinalizedWeeks = weeklyBreakdown.filter((w) => !w.isFinalized);
    if (nonFinalizedWeeks.length === 0) return {};

    // Only show the very next claim (earliest week), not all future ones
    const nextWeek = nonFinalizedWeeks.reduce((prev, curr) =>
      prev.week < curr.week ? prev : curr
    );

    const totals: Record<string, number> = {};
    for (const reward of nextWeek.rewards) {
      const amount = Number.parseFloat(reward.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const currency =
        reward.type === "glowInflation" ? "GLW" : reward.currency;
      totals[currency] = (totals[currency] ?? 0) + amount;
    }
    return totals;
  }, [weeklyBreakdown]);

  const nextClaimLabel = React.useMemo(() => {
    const entries: string[] = [];
    const glw = nonFinalizedTotals.GLW ?? 0;
    const usdg = nonFinalizedTotals.USDG ?? 0;
    if (glw > 0) {
      entries.push(`${formatTokenAmount(glw)} GLW`);
    }
    if (usdg > 0) {
      entries.push(`${formatUsdWhole(usdg)} USDG`);
    }
    return entries.length > 0 ? entries.join(" + ") : null;
  }, [nonFinalizedTotals]);

  const hasPending = React.useMemo(() => {
    return hasClaimable || nextClaimLabel !== null;
  }, [hasClaimable, nextClaimLabel]);

  const shouldHide =
    hasWallet &&
    !isWalletConnecting &&
    !isWidgetLoading &&
    !isWidgetError &&
    !hasClaimable &&
    !hasPending;

  if (shouldHide && hideIfEmpty) return null;

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden w-full",
        isMinimal
          ? "bg-transparent border-transparent h-full"
          : "h-full bg-card dark:bg-muted/30 border-foreground/10 dark:border-border"
      )}
    >
      <CardHeader className="py-0 px-4">
        <div className="flex items-center justify-center gap-2">
          <div className="text-sm md:text-lg font-semibold tracking-tight text-foreground">
            Rewards
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 py-0 px-6 gap-4">
        {/* Countdown Area */}
        {hasWallet &&
          !isWalletConnecting &&
          !isWidgetLoading &&
          !isWidgetError &&
          nextClaimLabel && (
            <div className="pt-0">
              <RewardsCountdown initialDurationMs={initialDurationMs} />
            </div>
          )}

        {/* Main Content: Vertically Centered */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[120px]">
          {!hasWallet ? (
            isWalletConnecting ? (
              <div className="space-y-4 w-full flex flex-col items-center">
                <Skeleton className="h-8 w-32 rounded-xl" />
                <Skeleton className="h-4 w-24 rounded-xl opacity-50" />
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
                  <Skeleton className="h-10 w-48 rounded-xl" />
                  <Skeleton className="h-5 w-24 rounded-xl opacity-50" />
                  <Skeleton className="h-6 w-32 rounded-full mt-2" />
                </div>
              ) : isWidgetError ? (
                <div className="text-center text-destructive text-sm font-medium">
                  Unable to load
                </div>
              ) : (
                <>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-1">
                    Available Now
                  </div>
                  <div className="flex flex-col items-center gap-0.5 animate-in fade-in zoom-in-95 duration-300">
                    {claimableBreakdown.map((entry) => (
                      <div
                        key={entry.currency}
                        className={cn(
                          "leading-tight",
                          entry.isPrimary
                            ? "text-4xl lg:text-5xl font-bold tracking-tighter text-foreground"
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

                  {nextClaimLabel && (
                    <div className="pt-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/30 border border-border/50">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                          next claim:
                        </span>
                        <span className="text-[11px] font-mono font-medium text-muted-foreground tabular-nums">
                          {nextClaimLabel}
                        </span>
                      </div>
                    </div>
                  )}
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
                <Button className="w-full ">Claim Rewards</Button>
              </DialogTrigger>
              <DialogContent
                className="bg-background rounded-2xl p-0 sm:max-w-[980px] w-full border-border shadow-2xl overflow-hidden"
                onInteractOutside={(e) => e.preventDefault()}
              >
                <DialogTitle className="sr-only">Claim Rewards</DialogTitle>
                <ClaimsPanel
                  variant="dialog"
                  onClaimSuccess={handleClaimSuccess}
                />
              </DialogContent>
            </Dialog>
          ) : (
            <Button
              variant="outline"
              className="w-full  opacity-50 cursor-not-allowed"
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
