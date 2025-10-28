"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  Send,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  ArrowDown,
} from "lucide-react";
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
import { formatUnits as formatUnitsViem } from "viem";
import { Header } from "@/components/header";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { SendDialog } from "@/components/send-dialog";
import { UsdcToTokenDialog } from "@/components/usdc-to-token-dialog";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { addresses, SDKAddresses } from "@/web3/constants/addresses";
import { useWalletFarms } from "@/hooks/useWalletFarms";
import { useWallets } from "@/hooks/useWallets";
import { Skeleton } from "@/components/ui/skeleton";
import { useRegions } from "@/hooks/useRegions";
import { RefundClaimsPanel } from "./refund-claims-panel";
import { MigrationClaimPanel } from "./migration-claim-panel";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { FallbackImage } from "@/components/ui/fallback-image";
import { useGlowLaunchpad, useSplitsActivity } from "@/hooks/useGlowLaunchpad";
import {
  useRewardScore,
  getRewardScoreForApplication,
} from "@/hooks/useRewardScore";
import { Badge } from "@/components/ui/badge";

// Lazy-load RecentActivity to defer its network work off the critical path
const RecentActivity = dynamic(
  () => import("./recent-activity").then((m) => m.RecentActivity),
  { ssr: false }
);

// Image proxy helper for optimized caching with compression
function getProxiedImageUrl(url: string, width?: number, quality: number = 75) {
  if (!url || url.startsWith("/images/")) {
    return url;
  }
  const params = new URLSearchParams({
    url,
    ...(width && { w: width.toString() }),
    q: quality.toString(),
  });
  return `/api/image-proxy?${params.toString()}`;
}

// Token definitions matching buy view structure
export const tokens = {
  USDC: {
    label: "USDC",
    address: SDKAddresses.USDC as `0x${string}`,
    decimals: 6,
    allowedPairs: ["GLOW", "USDG", "GCTL"],
    toFixed: 6,
  },
  USDG: {
    label: "USDG",
    address: SDKAddresses.USDG,
    decimals: 6,
    allowedPairs: ["GLOW", "USDC", "GCTL"],
    toFixed: 6,
  },
} as const;

export type Token = (typeof tokens)[keyof typeof tokens];

export default function View() {
  const { address, isConnected, connector: activeConnector } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const { signer } = useEthersSigner();
  const [password] = useQueryState("password");
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
  const { gctlBalance } = useGctlApi(address);

  // Lightweight GLW spot price
  const { spotPrice: glowSpotPrice } = useGlowSpotPrice();

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

  // Migration data and wallet details (includes staked GCTL)
  const { migrationData, isMigrationLoading, migrationError, walletDetails } =
    useWallets({
      walletAddress: address,
      enabled: isConnected,
    });

  // User launchpad sponsorship activity (fractions) and sponsor listings
  const { activity: splitsActivity, isLoading: isSplitsActivityLoading } =
    useSplitsActivity({
      walletAddress: address,
      enabled: Boolean(isConnected && address),
      limit: 100,
    });

  const { applications: sponsorListings, isLoading: isSponsorListingsLoading } =
    useGlowLaunchpad({
      enabled: Boolean(
        isConnected && address && splitsActivity && splitsActivity.length > 0
      ),
    });

  // Compute sponsorships that are not yet filled, grouped by application
  const sponsorshipsInProgress = React.useMemo(() => {
    if (!splitsActivity || splitsActivity.length === 0)
      return [] as Array<{
        applicationId: string;
        application: any | null;
        userSteps: number;
        progressPercent: number;
      }>;

    const byApp = new Map<
      string,
      { application: any | null; userSteps: number; progressPercent: number }
    >();

    for (const evt of splitsActivity) {
      if (evt.fractionType !== "launchpad") continue;
      const app = sponsorListings.find((a: any) => a.id === evt.applicationId);
      const isFilled = app?.activeFraction?.isFilled ?? evt.isFilled;
      if (isFilled) continue;

      const key = evt.applicationId;
      const existing = byApp.get(key);
      const progress =
        app?.activeFraction?.progressPercent ?? evt.progressPercent ?? 0;
      const next = {
        application: app || null,
        userSteps: (existing?.userSteps || 0) + (evt.stepsPurchased || 0),
        progressPercent: progress,
      };
      byApp.set(key, next);
    }

    return Array.from(byApp.entries())
      .map(([applicationId, data]) => ({
        applicationId,
        ...data,
      }))
      .filter((item) => item.userSteps > 0);
  }, [splitsActivity, sponsorListings]);

  // Get reward scores for applications in progress
  const applicationsForRewards = React.useMemo(() => {
    return sponsorshipsInProgress
      .map((item) => item.application)
      .filter((app): app is any => app !== null);
  }, [sponsorshipsInProgress]);

  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications: applicationsForRewards,
    paymentCurrency: "GLW",
    enabled: applicationsForRewards.length > 0,
    walletAddress: address || null,
  });

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

  // Network status check
  const hasNetworkIssues = erc20HasError || (!hasSigner && isConnected);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 xl:px-16 py-6 md:py-24 pt-20">
        {/* Page Header - 8pt spacing system */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Power Wallet
            </h1>
            <p className="text-muted-foreground mt-2 text-base">
              Your all-in-one wallet for Glow
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="default"
              onClick={refreshBalances}
              disabled={erc20Loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${erc20Loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Link href="/">
              <Button
                size="default"
                disabled={erc20Loading}
                className="w-full sm:w-auto"
              >
                Launchpad
              </Button>
            </Link>
            <Link href="/glow-swap">
              <Button
                variant="outline"
                size="default"
                disabled={erc20Loading}
                className="w-full sm:w-auto"
              >
                GlowSwap
              </Button>
            </Link>
          </div>
        </div>

        {/* A. Balances & Claims Overview - consistent card grid spacing */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
          {/* USDC Card - Always show when connected */}
          <Card className="relative overflow-hidden bg-muted dark:bg-muted/30 border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl md:text-2xl font-semibold">
                USDC
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {erc20Loading ? (
                <>
                  <Skeleton className="h-10 w-32 mb-4" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-36" />
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold tracking-tight">
                    ${hasNetworkIssues ? "0.00" : formattedBalances.usdc}
                    {hasNetworkIssues && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 font-normal">
                          Network Issue
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={refreshBalances}
                          className="h-6 px-2 text-xs"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Retry
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="default"
                      variant="outline"
                      onClick={() => setSendDialogOpen(true)}
                      className="flex-1 sm:flex-initial"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </Button>
                    {hasUsdc && (
                      <Button
                        size="default"
                        variant="outline"
                        onClick={handleSwapUsdcToUsdg}
                        className="flex-1 sm:flex-initial"
                      >
                        Convert to USDG
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* USDG Card - Show if has balance */}
          {(hasUsdg || erc20Loading) && (
            <Card className="relative overflow-hidden bg-muted dark:bg-muted/30 border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl md:text-2xl font-semibold">
                  USDG
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {erc20Loading ? (
                  <>
                    <Skeleton className="h-10 w-32 mb-2" />
                    <Skeleton className="h-4 w-28" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-10 w-20" />
                      <Skeleton className="h-10 w-24" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-3xl font-bold tracking-tight">
                        ${hasNetworkIssues ? "0.00" : formattedBalances.usdg}
                        {hasNetworkIssues && (
                          <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2 font-normal">
                            (Network Issue)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {hasUsdg && (
                        <>
                          <Button
                            size="default"
                            variant="outline"
                            onClick={() => setSendDialogOpen(true)}
                            className="flex-1 sm:flex-initial"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Send
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* GLOW Card - Show if has balance */}
          {(hasGlow || erc20Loading) && (
            <Card className="relative overflow-hidden bg-muted dark:bg-muted/30 border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl md:text-2xl font-semibold">
                  GLW
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {erc20Loading ? (
                  <>
                    <Skeleton className="h-10 w-32 mb-2" />
                    <Skeleton className="h-4 w-28" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-10 w-20" />
                      <Skeleton className="h-10 w-24" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-3xl font-bold tracking-tight">
                        {hasNetworkIssues ? "0.00" : formattedBalances.glow}
                        {hasNetworkIssues && (
                          <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2 font-normal">
                            (Network Issue)
                          </span>
                        )}
                        {/* USD Value Estimate */}
                        {!hasNetworkIssues && glowBalance && (
                          <span className="text-base text-muted-foreground mt-2">
                            {glowSpotPrice > 0 ? (
                              <>
                                {" "}
                                ≈ $
                                {(
                                  parseFloat(formatUnitsViem(glowBalance, 18)) *
                                  glowSpotPrice
                                ).toLocaleString("en-US", {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                })}{" "}
                              </>
                            ) : (
                              "Price unavailable"
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {hasGlow && (
                        <Button
                          size="default"
                          variant="outline"
                          onClick={() => setSendDialogOpen(true)}
                          className="flex-1 sm:flex-initial"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Send
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* GCTL Card - Show if has balance */}
          {(hasGctl ||
            walletDetails?.stakedControl !== "0" ||
            isMigrationLoading) && (
            <Card className="relative overflow-hidden bg-muted dark:bg-muted/30 border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl md:text-2xl font-semibold">
                  GCTL
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isMigrationLoading ? (
                  <>
                    <Skeleton className="h-10 w-32 mb-2" />
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-10 w-40" />
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-3xl font-bold tracking-tight">
                        {hasNetworkIssues ? "0.00" : formattedBalances.gctl}
                        {hasNetworkIssues && (
                          <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2 font-normal">
                            (Network Issue)
                          </span>
                        )}
                      </div>
                      {!hasNetworkIssues &&
                        walletDetails?.regions &&
                        walletDetails.regions.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <div className="text-sm text-muted-foreground">
                              Staked by region:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {walletDetails.regions
                                .filter(
                                  (regionStake) =>
                                    BigInt(regionStake.totalStaked) > BigInt(0)
                                )
                                .map((regionStake) => {
                                  const regionName =
                                    regionStake.region?.name ||
                                    regions.find(
                                      (r) => r.id === regionStake.regionId
                                    )?.name ||
                                    `Region ${regionStake.regionId}`;
                                  const stakedAmount = formatGctlBalance(
                                    regionStake.totalStaked
                                  );

                                  return (
                                    <Badge
                                      key={regionStake.regionId}
                                      variant="secondary"
                                      className="text-lg"
                                    >
                                      {regionName}: {stakedAmount} GCTL
                                    </Badge>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="default"
                        variant="outline"
                        onClick={() => {
                          window.open(
                            "https://impact.glow.org",
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }}
                        className="w-full sm:w-auto"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Manage Staking
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Migration Claims Panel */}
          <MigrationClaimPanel
            walletAddress={address}
            migrationData={migrationData}
            isLoading={isMigrationLoading}
            isError={!!migrationError}
            onClaim={() => {
              // Cache invalidation is handled by the mutation
              // This callback can be used for additional UI updates if needed
              console.log("Migration claim completed");
            }}
          />
        </div>

        {/* D. Claims Panel */}
        {password?.toLowerCase() === "0xsimbo" && <ClaimsPanel />}

        {/* E. Refund Claims Panel */}
        <RefundClaimsPanel walletAddress={address} />

        {/* F. Sponsorships In Progress */}
        {(sponsorshipsInProgress.length > 0 || isSplitsActivityLoading) && (
          <Card className="mb-8">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold">
                Delegations In Progress
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Farms you've delegated GLW to that are waiting for full funding
                to start earning rewards
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSplitsActivityLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card
                      key={i}
                      className="bg-white dark:bg-black rounded-2xl border transition-all duration-200 overflow-hidden"
                    >
                      <CardContent className="p-0">
                        <Skeleton className="w-full h-48" />
                        <div className="p-5 md:p-6 space-y-4">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-2 w-full rounded-full" />
                          <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-28" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {sponsorshipsInProgress.map((item, idx) => {
                    const app = item.application;
                    const zoneName = app?.zone?.name || "Launchpad";
                    const mainImg =
                      app?.afterInstallPictures?.[0]?.url ||
                      "/images/sections/residential.jpg";
                    const remainingSteps =
                      app?.activeFraction?.remainingSteps ?? null;
                    const totalSteps = app?.activeFraction?.totalSteps ?? null;
                    const progress = Math.max(
                      0,
                      Math.min(100, Number(item.progressPercent || 0))
                    );

                    return (
                      <Card
                        key={item.applicationId || idx}
                        className="bg-white dark:bg-black rounded-2xl border transition-all duration-200 overflow-hidden pt-0"
                      >
                        <CardContent className="p-0">
                          <div className="relative">
                            <div className="absolute top-3 left-3 z-10">
                              <div className="bg-black/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium">
                                {zoneName}
                              </div>
                            </div>
                            <FallbackImage
                              src={mainImg}
                              widthForProxy={800}
                              quality={70}
                              alt={`${zoneName} main`}
                              className="w-full h-48 object-cover"
                              loading={idx < 3 ? "eager" : "lazy"}
                              decoding="async"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                          </div>

                          <div className="p-5 md:p-6 space-y-4">
                            <div className="space-y-1">
                              {typeof totalSteps === "number" &&
                                typeof remainingSteps === "number" && (
                                  <p className="text-sm text-muted-foreground">
                                    {totalSteps - remainingSteps} / {totalSteps}{" "}
                                    filled
                                  </p>
                                )}
                            </div>

                            <div className="space-y-2">
                              <Progress value={progress} />
                              <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>{progress}% filled</span>
                                <span>
                                  Est. Weekly Rewards:{" "}
                                  {(() => {
                                    if (!app || !app.id) return "...";

                                    const rewardScore =
                                      getRewardScoreForApplication(
                                        rewardScoreMap,
                                        app.id
                                      );

                                    if (
                                      !rewardScore?.userWeeklyGlwRewards ||
                                      !rewardScore?.userWeeklyPdRewards ||
                                      !app?.activeFraction?.totalSteps
                                    ) {
                                      return isRewardScoresLoading
                                        ? "..."
                                        : "0 GLW";
                                    }

                                    try {
                                      const glwRewards = parseFloat(
                                        formatUnitsViem(
                                          BigInt(
                                            rewardScore.userWeeklyGlwRewards
                                          ),
                                          DECIMALS_BY_TOKEN["GLW"]
                                        )
                                      );

                                      const pdRewards = parseFloat(
                                        formatUnitsViem(
                                          BigInt(
                                            rewardScore.userWeeklyPdRewards
                                          ),
                                          DECIMALS_BY_TOKEN["GLW"]
                                        )
                                      );

                                      const totalRewards =
                                        glwRewards + pdRewards;
                                      const totalShares =
                                        app.activeFraction.totalSteps;
                                      const rewardsPerShare =
                                        totalRewards / totalShares;
                                      const userRewards =
                                        rewardsPerShare * item.userSteps;

                                      return `${userRewards.toLocaleString(
                                        undefined,
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        }
                                      )} GLW`;
                                    } catch {
                                      return "0 GLW";
                                    }
                                  })()}
                                </span>
                              </div>
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

        {/* G. Farms Earning Rewards */}
        {(purchasedFarms.length > 0 || isPurchasedFarmsLoading) && (
          <Card className="mb-8">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold">
                Farms Earning Rewards
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Solar farms where you're earning weekly rewards
              </CardDescription>
              {!isPurchasedFarmsLoading && purchasedFarms.length > 0 && (
                <div className="mt-4 bg-muted/50 rounded-xl p-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-muted-foreground font-medium">
                      Total Est. Weekly Earnings:
                    </span>
                    <span className="text-xl font-bold text-foreground">
                      {(() => {
                        const totals = purchasedFarms.reduce(
                          (acc, farm) => {
                            const formatted = formatFarmData(farm);
                            const glwRewards = parseFloat(formatted.weeklyGlow);
                            const otherRewards = parseFloat(
                              formatted.otherRewards
                            );

                            acc.glw += glwRewards;

                            if (otherRewards > 0) {
                              const asset = formatted.otherRewardsAmount;
                              if (!acc.other[asset]) {
                                acc.other[asset] = 0;
                              }
                              acc.other[asset] += otherRewards;
                            }

                            return acc;
                          },
                          { glw: 0, other: {} as Record<string, number> }
                        );

                        const parts = [
                          `${totals.glw.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} GLW`,
                        ];
                        Object.entries(totals.other).forEach(
                          ([asset, amount]) => {
                            parts.push(
                              `${amount.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} ${asset}`
                            );
                          }
                        );

                        return parts.join(" + ");
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isPurchasedFarmsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card
                      key={i}
                      className="bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800"
                    >
                      <CardContent className="p-0">
                        <Skeleton className="w-full h-48" />
                        <div className="p-5 space-y-4">
                          <div className="space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <Skeleton className="h-20 w-full rounded-xl" />
                          <div className="flex items-center justify-between pt-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-5 w-5" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : isPurchasedFarmsError ? (
                <div className="text-center py-12 px-4 md:px-6 rounded-xl bg-destructive/5 border border-destructive/20">
                  <p className="text-muted-foreground text-base">
                    Failed to load your farms. Please try refreshing the page.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {purchasedFarms.map((farm, idx) => {
                    const formattedFarm = formatFarmData(farm);
                    return (
                      <Card
                        key={farm.farmId || idx}
                        className="bg-white dark:bg-black rounded-2xl border  transition-all duration-200 overflow-hidden cursor-pointer group pt-0"
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
                                  <FallbackImage
                                    src={
                                      farm.afterInstallPictures[0]?.url ||
                                      "/images/sections/residential.jpg"
                                    }
                                    widthForProxy={800}
                                    quality={70}
                                    alt={`${formattedFarm.farm} main`}
                                    className="w-full h-48 object-cover"
                                    loading={idx < 3 ? "eager" : "lazy"}
                                    decoding="async"
                                    fetchPriority={idx < 3 ? "high" : "auto"}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                                </div>
                                <FallbackImage
                                  src={
                                    farm.afterInstallPictures[1]?.url ||
                                    "/images/sections/residential.jpg"
                                  }
                                  widthForProxy={400}
                                  quality={65}
                                  alt={`${formattedFarm.farm} alt 1`}
                                  className="w-full h-24 object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                                <FallbackImage
                                  src={
                                    farm.afterInstallPictures[2]?.url ||
                                    "/images/sections/residential.jpg"
                                  }
                                  widthForProxy={400}
                                  quality={65}
                                  alt={`${formattedFarm.farm} alt 2`}
                                  className="w-full h-24 object-cover"
                                  loading="lazy"
                                  decoding="async"
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
                          <div className="p-5 md:p-6 space-y-4">
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
                                <div className="flex items-baseline justify-center gap-2 mb-1">
                                  <span className="text-2xl font-bold text-foreground tracking-tight">
                                    {formattedFarm.weeklyGlow}
                                  </span>
                                  <span className="text-sm text-muted-foreground font-medium">
                                    GLW/week
                                  </span>
                                </div>
                                {Number(formattedFarm.otherRewards) !== 0 && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    + {formattedFarm.otherRewards}{" "}
                                    {formattedFarm.otherRewardsAmount}/week
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground mt-2">
                                  Weekly Rewards
                                </div>
                              </div>
                            </div>

                            {/* Action Area */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/50">
                              <div className="text-sm text-muted-foreground font-medium">
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

        {/* H. Recent Activity */}
        <RecentActivity
          walletAddress={address}
          splitsActivity={splitsActivity || []}
        />
      </div>

      {/* Amount Input Dialog */}
      <Dialog
        open={amountInputDialogOpen}
        onOpenChange={setAmountInputDialogOpen}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Convert USDC to USDG
            </DialogTitle>
            <DialogDescription className="text-base">
              Enter the amount you want to convert. The exchange rate is 1:1.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {/* Input Section */}
            <div className="space-y-4">
              <div className="bg-secondary/50 backdrop-blur-sm border border-border rounded-2xl p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="amount"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      You pay
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const maxAmount = usdcBalance
                          ? formatUnits(usdcBalance, DECIMALS_BY_TOKEN.USDC)
                          : "0";
                        setInputAmount(maxAmount);
                      }}
                      className="h-auto p-0 text-xs font-medium hover:bg-transparent"
                    >
                      MAX
                    </Button>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={inputAmount}
                      onChange={(e) => setInputAmount(e.target.value)}
                      min="0"
                      step="0.000001"
                      className="text-3xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <span className="text-xl font-medium text-muted-foreground">
                      USDC
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Available: {formattedBalances.usdc} USDC
                  </div>
                </div>
              </div>

              {/* Arrow Down Icon */}
              <div className="flex justify-center">
                <div className="bg-background rounded-full p-2 border border-border shadow-sm">
                  <ArrowDown className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>

              {/* Output Preview */}
              <div className="bg-secondary/50 backdrop-blur-sm border border-border rounded-2xl p-6">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">
                    You receive
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-bold">
                      {inputAmount && Number(inputAmount) > 0
                        ? Number(inputAmount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6,
                          })
                        : "0.00"}
                    </div>
                    <span className="text-xl font-medium text-muted-foreground">
                      USDG
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    1 USDC = 1 USDG
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setAmountInputDialogOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAmount}
              disabled={!inputAmount || Number(inputAmount) <= 0}
              className="flex-1"
            >
              Continue
            </Button>
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
