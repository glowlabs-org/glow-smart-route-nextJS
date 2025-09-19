"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Send, ChevronRight, RefreshCw, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClaimsPanel } from "@/app/wallet/claims-panel";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { useGctlApi } from "@/hooks/useGctlApi";
import { formatUnits } from "ethers";
import { Header } from "@/components/header";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { SendDialog } from "@/components/send-dialog";
import { UsdcToTokenDialog } from "@/components/usdc-to-token-dialog";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { addresses } from "@/web3/constants/addresses";
import { useWalletFarms } from "@/hooks/useWalletFarms";
import { Skeleton } from "@/components/ui/skeleton";
import { useRegions } from "@/hooks/useRegions";
import { RecentActivity } from "./recent-activity";
import { RefundClaimsPanel } from "./refund-claims-panel";
import { forceDisconnect } from "@/utils/forceDisconnect";

// Token definitions matching buy view structure
export const tokens = {
  USDC: {
    label: "USDC",
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" as `0x${string}`,
    decimals: 6,
    allowedPairs: ["GLOW", "USDG"],
    toFixed: 6,
  },
  USDG: {
    label: "USDG",
    address: addresses.usdg,
    decimals: 6,
    allowedPairs: ["GLOW", "USDC"],
    toFixed: 6,
  },
} as const;

export type Token = (typeof tokens)[keyof typeof tokens];

export default function View() {
  const { address, isConnected, connector: activeConnector } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const { signer } = useEthersSigner();
  const [sendDialogOpen, setSendDialogOpen] = React.useState(false);
  const [usdcToUsdgDialogOpen, setUsdcToUsdgDialogOpen] = React.useState(false);
  const [amountInputDialogOpen, setAmountInputDialogOpen] =
    React.useState(false);
  const [amountToConvert, setAmountToConvert] = React.useState<string>("");
  const [inputAmount, setInputAmount] = React.useState<string>("");

  // USDC to USDG swap hook
  const { swapUSDCToUSDG } = useSwapUSDCToUSDG();

  // ERC20 balances (GLOW, USDC, USDG)
  const {
    usdcBalance,
    usdgBalance,
    glowBalance,
    isReady: erc20Ready,
    isLoading: erc20Loading,
    hasError: erc20HasError,
    hasSigner,
    refreshBalances,
  } = useER20Balances({ signer });

  // GCTL balance and API
  const { gctlBalance, isGctlBalanceLoading } = useGctlApi(address);

  // Wallet farms (purchased farms)
  const {
    farms: purchasedFarms,
    isLoading: isPurchasedFarmsLoading,
    isError: isPurchasedFarmsError,
  } = useWalletFarms({
    walletAddress: address,
    enabled: isConnected,
  });

  // Regions data for mapping region IDs to names
  const { regions } = useRegions();

  // Helper functions to format balances
  function formatBalance(
    balance: bigint | null,
    decimals: number = 18
  ): string {
    if (!balance) return "0.00";
    try {
      const formatted = formatUnits(balance, decimals);
      const num = parseFloat(formatted);
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    } catch {
      return "0.00";
    }
  }

  function formatGctlBalance(balance: string): string {
    try {
      const balanceBigInt = BigInt(balance);
      const formatted = formatUnits(balanceBigInt, DECIMALS_BY_TOKEN.GCTL);
      const num = parseFloat(formatted);
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    } catch {
      return "0.00";
    }
  }

  // Format balances for display
  const formattedBalances = {
    usdc: formatBalance(usdcBalance, DECIMALS_BY_TOKEN.USDC),
    usdg: formatBalance(usdgBalance, DECIMALS_BY_TOKEN.USDG),
    glow: formatBalance(glowBalance, DECIMALS_BY_TOKEN.GLW),
    gctl: formatGctlBalance(gctlBalance),
  };

  // Progressive disclosure helpers
  const hasUsdc = usdcBalance && usdcBalance > BigInt(0);
  const hasUsdg = usdgBalance && usdgBalance > BigInt(0);
  const hasGlow = glowBalance && glowBalance > BigInt(0);
  const hasGctl = gctlBalance && BigInt(gctlBalance) > BigInt(0);

  // Mock claimable data for now (TODO: implement real claimable data)
  const claimable = {
    usdg: "0",
    glow: "0",
    impactVested: "0",
  };

  // Format farm data for display
  const formatFarmData = (farm: any) => {
    // Get the protocol deposit asset and determine decimals
    const protocolAsset =
      farm.userWeeklyRewards?.protocolDepositAsset || "USDC";
    const assetDecimals =
      DECIMALS_BY_TOKEN[protocolAsset as keyof typeof DECIMALS_BY_TOKEN] || 6;

    const glwRewards = farm.userWeeklyRewards?.glwInflationRewards
      ? Number(farm.userWeeklyRewards.glwInflationRewards) / 1e18
      : 0;

    const pdRewards = farm.userWeeklyRewards?.protocolDepositRewards
      ? Number(farm.userWeeklyRewards.protocolDepositRewards) /
        Math.pow(10, assetDecimals)
      : 0;

    // If PD rewards are in GLW, combine them with GLW rewards
    const isPdRewardsGlw = protocolAsset === "GLW";
    const totalGlwRewards = isPdRewardsGlw
      ? glwRewards + pdRewards
      : glwRewards;

    // Find the region name from regions data
    const region = regions.find((r) => r.id === farm.regionId);
    const regionName = region?.name || `Region ${farm.regionId}`;

    return {
      farm: farm.name,
      region: regionName,
      split: farm.userWeeklyRewards?.userGlowSplitPercent
        ? `${(
            (Number(farm.userWeeklyRewards.userGlowSplitPercent) / 1000000) *
            100
          ).toFixed(1)}%`
        : "N/A",
      weeklyGlow: totalGlwRewards.toFixed(2),
      otherRewards: isPdRewardsGlw ? "0" : pdRewards.toFixed(2),
      otherRewardsAmount: protocolAsset,
    };
  };

  const handleClaim = (token: string) => {
    toast.success(`Claiming ${token}`, {
      description: "Your tokens will be available shortly",
    });
  };

  const handleClaimAll = () => {
    toast.success("Claiming all available tokens", {
      description: "Multiple transactions initiated",
    });
  };

  const handleSwapUsdgToUsdc = () => {
    try {
      if (!hasUsdg) {
        toast.info("No USDG available to swap");
        return;
      }
      //TODO: open swap modal
      toast.info("Swap modal would open");
      toast.success("Prepared USDG → USDC swap (1:1)");
    } catch (error: any) {
      toast.error(error?.message || "Failed to prepare swap");
    }
  };

  const handleSwapUsdcToUsdg = () => {
    try {
      if (!hasUsdc) {
        toast.info("No USDC available to swap");
        return;
      }

      // Clear input and open amount input dialog
      setInputAmount("");
      setAmountInputDialogOpen(true);
    } catch (error: any) {
      toast.error(error?.message || "Failed to prepare USDC to USDG swap");
    }
  };

  const handleConfirmAmount = () => {
    if (!inputAmount || Number(inputAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const usdcBalanceFormatted = usdcBalance
      ? formatUnits(usdcBalance, DECIMALS_BY_TOKEN.USDC)
      : "0";

    if (Number(inputAmount) > Number(usdcBalanceFormatted)) {
      toast.error("Amount exceeds USDC balance");
      return;
    }

    setAmountToConvert(inputAmount);
    setAmountInputDialogOpen(false);
    setUsdcToUsdgDialogOpen(true);
  };

  const handleForceDisconnect = () => {
    forceDisconnect(disconnect, connectors, activeConnector);
  };

  // Network status check
  const hasNetworkIssues = erc20HasError || (!hasSigner && isConnected);

  return (
    <div className="min-h-screen bg-background ">
      <Header />
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 xl:px-16 py-8 pt-24">
        {/* Page Header with Scenario Selector */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Power Wallet</h1>
            <p className="text-muted-foreground mt-2">
              Your all-in-one wallet for Glow
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log("Manual refresh triggered");
              refreshBalances();
            }}
            disabled={erc20Loading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${erc20Loading ? "animate-spin" : ""}`}
            />
            Refresh Balances
          </Button>
        </div>

        {/* Network banner moved to header; keeping this block empty intentionally */}

        {/* A. Balances & Claims Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* USDC Card - Always show when connected */}
          <Card className="relative overflow-hidden bg-muted/30 border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">USDC</CardTitle>
            </CardHeader>
            <CardContent>
              {erc20Loading && erc20Ready ? (
                <div>
                  <Skeleton className="h-8 w-24 mb-3" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-32" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    ${hasNetworkIssues ? "0.00" : formattedBalances.usdc}
                    {hasNetworkIssues && (
                      <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2">
                        (Network Issue)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSendDialogOpen(true)}
                    >
                      <Send className="w-3 h-3 mr-1" />
                      Send
                    </Button>
                    {hasUsdc && (
                      <Button size="sm" onClick={handleSwapUsdcToUsdg}>
                        Convert to USDG
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* USDG Card - Show if has balance, claimable, or still loading */}
          {(hasUsdg ||
            claimable.usdg !== "0" ||
            erc20Loading ||
            !erc20Ready) && (
            <Card className="relative overflow-hidden bg-muted/30 border border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">USDG</CardTitle>
              </CardHeader>
              <CardContent>
                {erc20Loading && erc20Ready ? (
                  <div>
                    <Skeleton className="h-8 w-24 mb-3" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-9 w-20" />
                      <Skeleton className="h-9 w-32" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      ${hasNetworkIssues ? "0.00" : formattedBalances.usdg}
                      {hasNetworkIssues && (
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2">
                          (Network Issue)
                        </span>
                      )}
                    </div>
                    {claimable.usdg !== "0" && (
                      <div className="mt-2">
                        <div className="text-xs text-muted-foreground">
                          Claimable: ${claimable.usdg}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      {claimable.usdg !== "0" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleClaim("USDG")}
                        >
                          Claim
                        </Button>
                      )}
                      {hasUsdg && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSendDialogOpen(true)}
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Send
                          </Button>
                          <Button size="sm" onClick={handleSwapUsdgToUsdc}>
                            Swap for USDC
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* GLOW Card - Show if has balance, claimable, or still loading */}
          {(hasGlow ||
            claimable.glow !== "0" ||
            erc20Loading ||
            !erc20Ready) && (
            <Card className="relative overflow-hidden bg-muted/30 border border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">GLOW</CardTitle>
              </CardHeader>
              <CardContent>
                {erc20Loading && erc20Ready ? (
                  <div>
                    <Skeleton className="h-8 w-24 mb-3" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-9 w-20" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {hasNetworkIssues ? "0.00" : formattedBalances.glow}
                      {hasNetworkIssues && (
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2">
                          (Network Issue)
                        </span>
                      )}
                    </div>
                    {claimable.glow !== "0" && (
                      <div className="mt-2">
                        <div className="text-xs text-muted-foreground">
                          Claimable: {claimable.glow}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      {claimable.glow !== "0" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleClaim("GLOW")}
                        >
                          Claim
                        </Button>
                      )}
                      {hasGlow && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSendDialogOpen(true)}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Send
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* GCTL Card - Always show when connected */}
          {hasGctl ||
            (isGctlBalanceLoading && (
              <Card className="relative overflow-hidden bg-muted/30 border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">GCTL</CardTitle>
                </CardHeader>
                <CardContent>
                  {isGctlBalanceLoading ? (
                    <div>
                      <Skeleton className="h-8 w-24 mb-3" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-9 w-32" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {hasNetworkIssues ? "0.00" : formattedBalances.gctl}
                        {hasNetworkIssues && (
                          <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2">
                            (Network Issue)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            window.open(
                              "https://impact.glow.org",
                              "_blank",
                              "noopener,noreferrer"
                            );
                          }}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Manage Staking
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>

        {/* D. Claims Panel */}
        <ClaimsPanel
          claimable={claimable}
          onClaim={handleClaim}
          onClaimAll={handleClaimAll}
        />

        {/* E. Refund Claims Panel */}
        <RefundClaimsPanel walletAddress={address} />

        {/* F. Farms Earning Rewards */}
        {(purchasedFarms.length > 0 || isPurchasedFarmsLoading) && (
          <Card className="mb-8 bg-transparent">
            <CardHeader>
              <CardTitle>Farms Earning Rewards</CardTitle>
              <CardDescription>
                Solar farms where you're earning weekly rewards
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isPurchasedFarmsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-background/50 border border-border"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <div className="text-right space-y-2">
                          <Skeleton className="h-5 w-20 ml-auto" />
                          <Skeleton className="h-4 w-16 ml-auto" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : isPurchasedFarmsError ? (
                <div className="text-center py-12 px-4 rounded-xl bg-destructive/5 border border-destructive/20">
                  <p className="text-muted-foreground">
                    Failed to load your farms. Please try refreshing the page.
                  </p>
                </div>
              ) : purchasedFarms.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-xl bg-muted/50 border border-border">
                  <p className="text-muted-foreground mb-4">
                    You're not earning rewards from any farms yet
                  </p>
                  <Button
                    size="sm"
                    onClick={() => (window.location.href = "/glow-launchpad")}
                  >
                    Explore Farms
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {purchasedFarms.map((farm, idx) => {
                    const formattedFarm = formatFarmData(farm);
                    return (
                      <Card
                        key={farm.farmId || idx}
                        className="bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 overflow-hidden cursor-pointer group pt-0"
                        onClick={() =>
                          (window.location.href = `https://glow.org/audits/${farm.farmId}`)
                        }
                      >
                        <CardContent className="p-0">
                          {/* Farm Images */}
                          <div className="relative">
                            {/* Region Badge */}
                            <div className="absolute top-3 left-3 z-10">
                              <div className="bg-black/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium">
                                {formattedFarm.region}
                              </div>
                            </div>

                            {farm.afterInstallPictures &&
                            farm.afterInstallPictures.length > 0 ? (
                              <div className="grid grid-cols-2 gap-1">
                                <div className="col-span-2 relative">
                                  <img
                                    src={
                                      farm.afterInstallPictures[0]?.url ||
                                      "/images/sections/residential.jpg"
                                    }
                                    alt={`${formattedFarm.farm} main`}
                                    className="w-full h-48 object-cover"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                                </div>
                                <img
                                  src={
                                    farm.afterInstallPictures[1]?.url ||
                                    "/images/sections/residential.jpg"
                                  }
                                  alt={`${formattedFarm.farm} alt 1`}
                                  className="w-full h-24 object-cover"
                                />
                                <img
                                  src={
                                    farm.afterInstallPictures[2]?.url ||
                                    "/images/sections/residential.jpg"
                                  }
                                  alt={`${formattedFarm.farm} alt 2`}
                                  className="w-full h-24 object-cover"
                                />
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-1">
                                <div className="col-span-2 relative">
                                  <div className="w-full h-48 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                                    <span className="text-gray-400 text-sm">
                                      No images available
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full h-24 bg-gray-100 dark:bg-gray-900"></div>
                                <div className="w-full h-24 bg-gray-100 dark:bg-gray-900"></div>
                              </div>
                            )}
                          </div>

                          {/* Farm Details */}
                          <div className="p-5 space-y-4">
                            {/* Farm Name and Location */}
                            <div className="space-y-1">
                              <h3 className="font-semibold text-lg text-foreground leading-tight">
                                {formattedFarm.farm}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {formattedFarm.region}
                              </p>
                            </div>

                            {/* Rewards Display */}
                            <div className="bg-muted/50 rounded-xl p-4">
                              <div className="text-center">
                                <div className="flex items-baseline justify-center gap-1 mb-1">
                                  <span className="text-2xl font-bold text-foreground">
                                    {formattedFarm.weeklyGlow}
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    GLW/week
                                  </span>
                                </div>
                                {formattedFarm.otherRewards !== "0" && (
                                  <div className="text-sm text-muted-foreground">
                                    + {formattedFarm.otherRewards}{" "}
                                    {formattedFarm.otherRewardsAmount}/week
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground mt-1">
                                  Weekly Rewards
                                </div>
                              </div>
                            </div>

                            {/* Action Area */}
                            <div className="flex items-center justify-between pt-2">
                              <div className="text-sm text-muted-foreground">
                                View Audit
                              </div>
                              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* G. Recent Activity */}
        <RecentActivity walletAddress={address} />
      </div>

      {/* Amount Input Dialog */}
      <Dialog
        open={amountInputDialogOpen}
        onOpenChange={setAmountInputDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Convert USDC to USDG</DialogTitle>
            <DialogDescription>
              Enter the amount of USDC you want to convert to USDG (1:1 ratio).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount (USDC)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                min="0"
                step="0.000001"
              />
              <div className="text-sm text-muted-foreground">
                Available: ${formattedBalances.usdc} USDC
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAmountInputDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const maxAmount = usdcBalance
                  ? formatUnits(usdcBalance, DECIMALS_BY_TOKEN.USDC)
                  : "0";
                setInputAmount(maxAmount);
              }}
            >
              Max
            </Button>
            <Button onClick={handleConfirmAmount}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <SendDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen} />

      {/* USDC to USDG Dialog */}
      <UsdcToTokenDialog
        isOpen={usdcToUsdgDialogOpen}
        amount={amountToConvert} // 1:1 conversion for USDC to USDG
        amountToSell={amountToConvert}
        selectedTokenSell={tokens.USDC}
        selectedTokenBuy={tokens.USDG}
        smartBalancingAmounts={undefined} // Not needed for USDC -> USDG
        swapUSDCToUSDG={swapUSDCToUSDG}
        slippagePointsTenThousandths={BigInt(100)} // 1% slippage
        onOpenChange={(open) => {
          setUsdcToUsdgDialogOpen(open);
          if (!open) {
            // Reset states and refresh balances when dialog closes
            setAmountToConvert("");
            setInputAmount("");
            refreshBalances();
          }
        }}
      />
    </div>
  );
}
