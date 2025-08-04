import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NumberTicker } from "@/components/ui/number-ticker";
import { useGctlApi } from "@/hooks/useGctlApi";

interface StatsSidebarProps {
  glowPrice: string;
  marketCap: string;
  ethPriceInUSD: number | null;
  usdcRewardPool: string;
  usdcInRedemption: number;
  statsLoading: boolean;
  isUsdcInRedemptionLoading: boolean;
  isWalletLoading: boolean;
}

export function StatsSidebar({
  glowPrice,
  marketCap,
  ethPriceInUSD,
  usdcRewardPool,
  usdcInRedemption,
  statsLoading,
  isUsdcInRedemptionLoading,
  isWalletLoading,
}: StatsSidebarProps) {
  const { gctlPrice, isGctlPriceLoading } = useGctlApi();

  return (
    <div className="w-full lg:max-w-64 xl:max-w-72 flex-shrink-0">
      <div className="bg-background rounded-md border border-border p-4 lg:p-6 md:space-y-4">
        {/* Sidebar Header */}
        <div className="pb-4 border-b border-border/30 hidden lg:block">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Market Overview
          </h3>
        </div>

        {/* Stats Items */}
        <div className="flex flex-col justify-between gap-0 md:gap-4">
          <div className="group hover:bg-muted/20 rounded-md p-3 transition-all duration-200 cursor-default hidden lg:block">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">
                GLW Market Cap
              </div>
            </div>
            <div className="text-lg lg:text-xl font-bold">
              ${" "}
              {statsLoading ? (
                <Skeleton className="w-24 h-6 inline-block" />
              ) : (
                <NumberTicker value={Number(marketCap)} />
              )}
            </div>
          </div>

          <div className="group hover:bg-muted/20 rounded-md p-3 transition-all duration-200 cursor-default">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">GLW Price</div>
            </div>
            <div className="text-lg lg:text-xl font-bold">
              ${" "}
              {statsLoading ? (
                <Skeleton className="w-20 h-6 inline-block" />
              ) : (
                Number(glowPrice).toFixed(2)
              )}
            </div>
          </div>

          <div className="group hover:bg-muted/20 rounded-md p-3 transition-all duration-200 cursor-default">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">GCTL Price</div>
            </div>
            <div className="text-lg lg:text-xl font-bold">
              ${" "}
              {isGctlPriceLoading ? (
                <Skeleton className="w-20 h-6 inline-block" />
              ) : (
                Number(gctlPrice).toFixed(2)
              )}
            </div>
          </div>

          <div className="group hover:bg-muted/20 rounded-md p-3 transition-all duration-200 cursor-default hidden lg:block">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">Reward Pool</div>
            </div>
            <div className="text-lg lg:text-xl font-bold">
              ${" "}
              {statsLoading ? (
                <Skeleton className="w-24 h-6 inline-block" />
              ) : (
                <NumberTicker value={Number(usdcRewardPool)} />
              )}
            </div>
          </div>

          <div className="group hover:bg-muted/20 rounded-md p-3 transition-all duration-200 cursor-default">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">
                USDC Available
              </div>
            </div>
            <div className="text-lg lg:text-xl font-bold">
              ${" "}
              {isUsdcInRedemptionLoading || isWalletLoading ? (
                <Skeleton className="w-24 h-6 inline-block" />
              ) : (
                <NumberTicker value={usdcInRedemption} />
              )}
            </div>
            {isUsdcInRedemptionLoading && !isWalletLoading && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Updating...
              </div>
            )}
          </div>
        </div>

        {/* Additional Info Section */}
        <div className="pt-4 border-t border-border/30 hidden lg:block">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">ETH Price</span>
              <span className="font-medium">
                ${ethPriceInUSD ? ethPriceInUSD.toFixed(0) : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
