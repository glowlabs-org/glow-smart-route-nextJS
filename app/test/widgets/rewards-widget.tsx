"use client";

import React from "react";
import { Timer } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  AnimatedCountdown,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import { ClaimsPanel } from "@/app/wallet/claims-panel";
import { useClaimableRewards } from "@/hooks";
import { useRewardsKernelWrapper } from "@/hooks/useRewardsKernelWrapper";
import { weekToNonce } from "@/hooks/useMerkleProofs";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useWalletV2Claims } from "@/hooks";
import { GENESIS_TIMESTAMP, getCurrentEpoch } from "@/utils/getCurrentEpoch";
import { useAccount } from "wagmi";

const STICKY_QUERY_BEHAVIOR = {
  staleTime: 24 * 60 * 60_000,
  gcTime: 24 * 60 * 60_000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function estimateUsdTotal(params: {
  totalsByCurrency: Record<string, number>;
  glwSpotPriceUsd: number;
}) {
  const { totalsByCurrency, glwSpotPriceUsd } = params;
  if (!Number.isFinite(glwSpotPriceUsd) || glwSpotPriceUsd <= 0) {
    // Still allow stablecoins to count toward the estimate
    // (GLW will be ignored until we have a price).
  }

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

interface RewardsWidgetProps {
  walletAddress?: string | null;
  initialDurationMs?: number;
  hideIfEmpty?: boolean;
}

const DEFAULT_INITIAL_DURATION_MS = (4 * 60 * 60 + 12 * 60 + 33) * 1000;

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
    <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30 p-3">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-16 opacity-45"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        style={{
          background:
            "conic-gradient(from 0deg, transparent, hsl(var(--primary) / 0.25), transparent)",
        }}
      />
      <div className="relative flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Next distribution in
          </span>
        </div>
        <div className="flex justify-center">
          <AnimatedCountdown remainingMs={remainingMs} size="sm" />
        </div>
      </div>
    </div>
  );
}

export default function RewardsWidget({
  walletAddress,
  initialDurationMs = DEFAULT_INITIAL_DURATION_MS,
  hideIfEmpty = true,
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
    query: STICKY_QUERY_BEHAVIOR,
  });
  const { checkIfClaimed, checkIfGlwClaimed } = useRewardsKernelWrapper();
  const { spotPrice: glwSpotPriceUsd } = useGlowSpotPrice({
    refreshKey,
    query: {
      ...STICKY_QUERY_BEHAVIOR,
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
    query: STICKY_QUERY_BEHAVIOR,
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
    queryKey: [
      "wallet-claimable-totals",
      address,
      finalizedWeeksKey,
      refreshKey,
    ],
    enabled: Boolean(hasWallet && address && finalizedWeeks.length > 0),
    staleTime: STICKY_QUERY_BEHAVIOR.staleTime,
    gcTime: STICKY_QUERY_BEHAVIOR.gcTime,
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

  const claimableUsd = React.useMemo(() => {
    if (!hasWallet) return null;
    if (!claimableTotalsByCurrency) return 0;
    return estimateUsdTotal({
      totalsByCurrency: claimableTotalsByCurrency,
      glwSpotPriceUsd,
    });
  }, [claimableTotalsByCurrency, glwSpotPriceUsd, hasWallet]);

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

  const handleClaimSuccess = React.useCallback(() => {
    if (!address) return;
    queryClient.invalidateQueries({ queryKey: ["wallet-rewards", address] });
    queryClient.invalidateQueries({ queryKey: ["wallet-v2-claims", address] });
    queryClient.invalidateQueries({
      queryKey: ["wallet-claimable-totals", address],
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

  const shouldShowCountdown =
    hasWallet &&
    !isWalletConnecting &&
    !isWidgetLoading &&
    !isWidgetError &&
    !shouldHide;

  return (
    <Card className="h-full overflow-hidden flex flex-col bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="text-center">Rewards</CardTitle>

        {shouldShowCountdown ? (
          <RewardsCountdown initialDurationMs={initialDurationMs} />
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 gap-4 pt-0">
        <div className="relative flex flex-1 min-h-0 flex-col items-center justify-center text-center px-1">
          {!hasWallet ? (
            isWalletConnecting ? (
              <>
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Claimable
                </div>
                <div className="mt-2">
                  <Skeleton className="h-10 w-36 rounded-xl mx-auto" />
                </div>
                <div className="mt-3">
                  <Skeleton className="h-4 w-48 rounded-md mx-auto" />
                </div>
              </>
            ) : (
              <>
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Claimable
                </div>
                <div className="mt-2 font-mono text-4xl font-bold tracking-tighter text-foreground tabular-nums">
                  {formatUsd(0)}
                </div>
                <div className="mt-3 font-mono text-xs text-muted-foreground">
                  Lifetime earned: {formatUsd(0)}
                </div>
              </>
            )
          ) : (
            <>
              <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Claimable
              </div>
              <div className="mt-2 font-mono text-4xl font-bold tracking-tighter text-foreground tabular-nums">
                {isWidgetLoading ? (
                  <Skeleton className="h-10 w-36 rounded-xl" />
                ) : isWidgetError ? (
                  "$—"
                ) : (
                  formatUsd(claimableUsd ?? 0)
                )}
              </div>
              <div className="mt-3 font-mono text-xs text-muted-foreground">
                {isWidgetLoading ? (
                  <Skeleton className="h-4 w-48 rounded-md" />
                ) : isWidgetError ? (
                  "Unable to load rewards"
                ) : shouldHide ? (
                  "No rewards yet"
                ) : (
                  <>Lifetime earned: {formatUsd(lifetimeUsd ?? 0)}</>
                )}
              </div>
            </>
          )}
        </div>

        {hasWallet && !shouldHide ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full h-12 font-mono font-bold text-base shrink-0">
                Claim
              </Button>
            </DialogTrigger>
            <DialogContent
              className="bg-background rounded-3xl p-0 sm:max-w-[980px] w-full border-border shadow-2xl overflow-hidden"
              onInteractOutside={(e) => e.preventDefault()}
            >
              <div className="max-h-[85vh] overflow-y-auto p-6">
                <ClaimsPanel onClaimSuccess={handleClaimSuccess} />
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <>
            {isWalletConnecting ? (
              <Skeleton className="h-12 w-full rounded-2xl shrink-0" />
            ) : (
              <Button
                className="w-full h-12 font-mono font-bold text-base shrink-0"
                disabled
              >
                Claim
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
