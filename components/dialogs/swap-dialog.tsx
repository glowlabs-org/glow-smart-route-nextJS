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
import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";

interface SwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  glowPriceUsd?: number;
  marketCapUsd?: number;
  ethPriceInUSD?: number | null;
}

export function SwapDialog({
  open,
  onOpenChange,
  glowPriceUsd,
  marketCapUsd,
  ethPriceInUSD,
}: SwapDialogProps) {
  const shouldFetchMarketData =
    open &&
    (!Number.isFinite(glowPriceUsd ?? NaN) ||
      (glowPriceUsd ?? 0) <= 0 ||
      !Number.isFinite(marketCapUsd ?? NaN) ||
      (marketCapUsd ?? 0) <= 0);

  const {
    glowPrice,
    marketCap,
    isLoading: isMarketLoading,
    error: marketError,
    refetchMarketCap,
  } = useGlowCirculatingSupply({
    enabled: shouldFetchMarketData,
  });

  const {
    data: fetchedEthPrice,
    isLoading: isEthPriceLoading,
    isError: isEthPriceError,
    refetch: refetchEthPrice,
  } = useQuery({
    queryKey: ["eth-price"],
    queryFn: getEthPriceInUSD,
    enabled: open && ethPriceInUSD === undefined,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const resolvedGlowPrice =
    Number.isFinite(glowPriceUsd ?? NaN) && (glowPriceUsd ?? 0) > 0
      ? (glowPriceUsd as number)
      : glowPrice;
  const resolvedMarketCap =
    Number.isFinite(marketCapUsd ?? NaN) && (marketCapUsd ?? 0) > 0
      ? (marketCapUsd as number)
      : marketCap;
  const resolvedEthPrice = ethPriceInUSD ?? fetchedEthPrice ?? null;

  const hasMarketData =
    Number.isFinite(resolvedGlowPrice) &&
    resolvedGlowPrice > 0 &&
    Number.isFinite(resolvedMarketCap) &&
    resolvedMarketCap > 0;
  const isLoading = !hasMarketData && isMarketLoading;
  const hasError =
    !hasMarketData &&
    !isMarketLoading &&
    (isEthPriceError || Boolean(marketError));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden bg-card rounded-[24px] border border-border/40">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
            Swap Tokens
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 overflow-y-auto max-h-[85vh]">
          {hasError ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Unable to load swap data. Please try again.
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isMarketLoading || isEthPriceLoading}
                onClick={async () => {
                  await Promise.all([refetchMarketCap(), refetchEthPrice()]);
                }}
              >
                Retry
              </Button>
            </div>
          ) : isLoading || !hasMarketData ? (
            <div className="space-y-4">
              <Skeleton className="h-[400px] w-full rounded-2xl" />
            </div>
          ) : (
            <SwapInterface
              isDialog
              glowPrice={resolvedGlowPrice.toString()}
              marketCap={resolvedMarketCap.toString()}
              ethPriceInUSD={resolvedEthPrice}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
