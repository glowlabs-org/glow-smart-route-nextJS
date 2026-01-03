/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import React, { useEffect, useState } from "react";
import { useAccount, useDisconnect, useConnect } from "wagmi";
import { getAddresses } from "@glowlabs-org/utils/browser";
import { CHAIN_ID } from "@/web3/constants";
import { useRouter } from "next/navigation";
import { useUSDGRedemption } from "@/hooks/useUSDGRedemption";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SendTab } from "./send-tab";
import { useQueryState } from "nuqs";
import { SDKAddresses } from "@/web3/constants/addresses";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { StatsSidebar } from "./stats-sidebar";
import { tokens } from "./constants";
import { SwapInterface } from "./swap-interface";
import { formatUnits } from "viem";

export default function View({
  glowPrice,
  earlyLiquidityCurrentPrice,
  marketCap,
  ethPriceInUSD,
  usdcRewardPool,
  isDialog = false, // Kept for backward compatibility if needed, though likely unused now
}: {
  glowPrice: string;
  earlyLiquidityCurrentPrice: string;
  marketCap: string;
  ethPriceInUSD: number | null;
  usdcRewardPool: string;
  isDialog?: boolean;
}) {
  const router = useRouter();
  const { isConnected, isConnecting } = useAccount();

  // Add a general loading state check
  const isWalletLoading = isConnecting;

  const [isUsdcInRedemptionLoading, setIsUsdcInRedemptionLoading] =
    useState(false);
  const [usdcInRedemption, setUsdcInRedemption] = useState<number>(0);

  const { getUSDCBalanceOfRedemptionContract } = useUSDGRedemption();

  // Tab state synced with URL (?tab=swap|send|liquidity)
  const [tab, setTab] = useQueryState("tab", {
    defaultValue: "swap",
    clearOnDefault: true,
  });

  // Add effect to fetch USDC balance when wallet connects (for Send tab sidebar)
  useEffect(() => {
    const fetchUsdcInRedemption = async () => {
      if (isConnected && !isWalletLoading) {
        setIsUsdcInRedemptionLoading(true);
        const balance = await getUSDCBalanceOfRedemptionContract();
        if (balance) {
          setUsdcInRedemption(Number(formatUnits(balance, 6)));
        }
        setIsUsdcInRedemptionLoading(false);
      }
    };
    fetchUsdcInRedemption();
  }, [isConnected, isWalletLoading]);

  // Intercept top-level tab changes to navigate to the homepage tabs
  const handleTopTabsChange = (value: string) => {
    if (value === "launchpad" || value === "mining-center") {
      router.push(`/?tab=${value}`);
      return;
    }
    setTab(value);
  };

  return (
    <div className={cn("bg-background relative", !isDialog && "min-h-screen")}>
      {!isDialog && (
        <Image
          src="/images/sections/beam.png"
          alt="Background"
          fill
          className="object-cover dark:hidden"
        />
      )}

      {/* Hero Section with Enhanced Gradient */}

      <div
        className={cn(
          "relative overflow-hidden flex flex-col justify-center items-center",
          !isDialog && "min-h-screen"
        )}
      >
        <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 lg:px-6 py-4 w-full">
          <Tabs
            value={tab}
            onValueChange={handleTopTabsChange}
            className="lg:items-center"
          >
            <TabsList className="self-center bg-background backdrop-blur-xl rounded-full p-6 border border-border overflow-hidden mx-auto w-fit flex">
              <TabsTrigger value="swap">Swap</TabsTrigger>
              <TabsTrigger value="send">Send</TabsTrigger>
            </TabsList>

            <TabsContent value="swap">
              <SwapInterface
                glowPrice={glowPrice}
                earlyLiquidityCurrentPrice={earlyLiquidityCurrentPrice}
                marketCap={marketCap}
                ethPriceInUSD={ethPriceInUSD}
                usdcRewardPool={usdcRewardPool}
                isDialog={isDialog}
              />
            </TabsContent>

            <TabsContent value="send">
              <div
                className={cn(
                  "grid grid-cols-1 gap-4 mt-2 lg:mt-4",
                  !isDialog && "lg:grid-cols-[1fr_320px]"
                )}
              >
                <div
                  className={cn(
                    "bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden w-full h-fit mx-auto",
                    isDialog
                      ? "p-0 border-0"
                      : "p-4 lg:p-6 max-w-[600px] lg:max-w-none"
                  )}
                >
                  <SendTab
                    tokens={{
                      GLOW: tokens.GLOW,
                      USDG: tokens.USDG,
                      USDC: tokens.USDC,
                    }}
                  />
                </div>
                {/* Desktop Sidebar for Send Tab - Hidden on mobile */}
                {!isDialog && (
                  <aside className="lg:sticky lg:top-4 h-fit space-y-4">
                    <StatsSidebar
                      marketCap={marketCap}
                      usdcInRedemption={usdcInRedemption}
                      statsLoading={false}
                      isUsdcInRedemptionLoading={isUsdcInRedemptionLoading}
                      isWalletLoading={isWalletLoading}
                    />
                  </aside>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}