"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SwapInterface } from "@/app/buy/swap-interface";
import { getHeadlineStats } from "@/web3/web3/queries/getHeadlineStats";
import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { HeadlineStats } from "@/hooks/useSwapDialogData";

interface SwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headlineStats?: HeadlineStats;
  ethPriceInUSD?: number | null;
}

export function SwapDialog({
  open,
  onOpenChange,
  headlineStats,
  ethPriceInUSD,
}: SwapDialogProps) {
  const shouldFetchInternally = open && !headlineStats;

  const {
    data: fetchedStats,
    isLoading: isStatsLoading,
    isError: isStatsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["headline-stats"],
    queryFn: getHeadlineStats,
    enabled: shouldFetchInternally,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: fetchedEthPrice,
    isLoading: isEthPriceLoading,
    isError: isEthPriceError,
    refetch: refetchEthPrice,
  } = useQuery({
    queryKey: ["eth-price"],
    queryFn: getEthPriceInUSD,
    enabled: shouldFetchInternally && ethPriceInUSD === undefined,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const resolvedStats = headlineStats ?? fetchedStats;
  const resolvedEthPrice = ethPriceInUSD ?? fetchedEthPrice ?? null;

  const isLoading = !resolvedStats && isStatsLoading;
  const hasError = !resolvedStats && (isStatsError || isEthPriceError);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-background rounded-3xl border-border shadow-2xl">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Swap Tokens</DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-2 overflow-y-auto max-h-[85vh]">
          {hasError ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Unable to load swap data. Please try again.
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isStatsLoading || isEthPriceLoading}
                onClick={async () => {
                  await Promise.all([refetchStats(), refetchEthPrice()]);
                }}
              >
                Retry
              </Button>
            </div>
          ) : isLoading || !resolvedStats ? (
            <div className="space-y-4">
              <Skeleton className="h-[400px] w-full rounded-2xl" />
            </div>
          ) : (
            <SwapInterface
              isDialog
              glowPrice={resolvedStats.lowestGlowPrice.toString()}
              earlyLiquidityCurrentPrice={resolvedStats.earlyLiquidityPrice.toString()}
              marketCap={resolvedStats.marketCap.toString()}
              ethPriceInUSD={resolvedEthPrice}
              usdcRewardPool={resolvedStats.usdcRewardPool}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
