import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NumberTicker } from "@/components/ui/number-ticker";
import { useGctlApi } from "@/hooks";
import { ExternalLink } from "lucide-react";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useLang } from "@/lib/i18n";

interface StatsSidebarProps {
  marketCap: string;
  usdcInRedemption: number;
  statsLoading: boolean;
  isUsdcInRedemptionLoading: boolean;
  isWalletLoading: boolean;
}

export function StatsSidebar({
  marketCap,
  usdcInRedemption,
  statsLoading,
  isUsdcInRedemptionLoading,
  isWalletLoading,
}: StatsSidebarProps) {
  const { t } = useLang();
  const { gctlPriceNumber, isGctlPriceLoading } = useGctlApi();
  const { spotPrice, isLoading: isSpotPriceLoading } = useGlowSpotPrice();

  return (
    <div className="bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden">
      <div className="p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg lg:text-xl font-semibold">
            {t.dialogs.statsSidebar.marketOverview}
          </h3>
        </div>

        {/* Stats Items - 2 columns on mobile, 1 column on desktop sidebar */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <div className="bg-muted/30 rounded-xl border border-border p-3 lg:p-4">
            <div className="text-xs text-muted-foreground mb-1 lg:mb-2">
              {t.dialogs.statsSidebar.glwMarketCap}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base lg:text-xl font-extrabold tabular-nums">
                ${" "}
                {statsLoading ? (
                  <Skeleton className="w-24 h-6 inline-block" />
                ) : (
                  <NumberTicker value={Number(marketCap)} />
                )}
              </span>
            </div>
          </div>

          <div className="bg-muted/30 rounded-xl border border-border p-3 lg:p-4">
            <div className="text-xs text-muted-foreground mb-1 lg:mb-2">
              {t.dialogs.statsSidebar.glwPrice}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base lg:text-xl font-extrabold tabular-nums">
                ${" "}
                {statsLoading || isSpotPriceLoading ? (
                  <Skeleton className="w-20 h-6 inline-block" />
                ) : (
                  <NumberTicker value={Number(spotPrice)} decimalPlaces={2} />
                )}
              </span>
            </div>
          </div>

          <div className="bg-muted/30 rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground mb-2">
              {t.dialogs.statsSidebar.gctlPrice}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold tabular-nums">
                ${" "}
                {isGctlPriceLoading ? (
                  <Skeleton className="w-20 h-6 inline-block" />
                ) : (
                  gctlPriceNumber.toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })
                )}
              </span>
            </div>
          </div>

          {usdcInRedemption > 0 &&
            (!isUsdcInRedemptionLoading || !isWalletLoading) && (
              <div className="bg-muted/30 rounded-xl border border-border p-3 lg:p-4">
                <div className="text-xs text-muted-foreground mb-1 lg:mb-2">
                  {t.dialogs.statsSidebar.usdcAvailable}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-base lg:text-xl font-extrabold tabular-nums">
                    ${" "}
                    {isUsdcInRedemptionLoading || isWalletLoading ? (
                      <Skeleton className="w-24 h-6 inline-block" />
                    ) : (
                      <NumberTicker value={usdcInRedemption} />
                    )}
                  </span>
                </div>
                {isUsdcInRedemptionLoading && !isWalletLoading && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    {t.dialogs.statsSidebar.updating}
                  </div>
                )}
              </div>
            )}

          {/* Trading Activity Link */}
          <div className="bg-muted/30 rounded-xl border border-border p-3 lg:p-4 col-span-2 lg:col-span-1">
            <a
              href="https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
            >
              {t.dialogs.statsSidebar.viewGlwUsdgActivity}
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
