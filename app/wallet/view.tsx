"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useQueryState } from "nuqs";
import { useInView } from "motion/react";
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
  ArrowUpRight,
  Plus,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { useGctlApi } from "@/hooks";
import { formatUnits } from "ethers";
import { formatUnits as formatUnitsViem } from "viem";
import { Header } from "@/components/header";
import { useLang } from "@/lib/i18n";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { SendDialog } from "@/components/send-dialog";
import { UsdcToTokenDialog } from "@/components/usdc-to-token-dialog";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { addresses, SDKAddresses } from "@/web3/constants/addresses";
import { useWalletFarms, useWallets } from "@/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { useRegions } from "@/hooks";
import { RefundClaimsPanel } from "./refund-claims-panel";
import { MigrationClaimPanel } from "./migration-claim-panel";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { FallbackImage } from "@/components/ui/fallback-image";
import { useSplitsActivity } from "@/hooks";
import { useWalletSwaps } from "@/hooks/useWalletSwaps";
import type { SwapActivity } from "@/hooks/useRecentActivityFeed";
import { useRewardsBreakdown } from "@/hooks";
import { Badge } from "@/components/ui/badge";
import { RewardsBreakdownPanel } from "./rewards-breakdown-panel";
import Image from "next/image";
import { ConnectButton } from "@/components/connect-button";
import { DiscordLogoIcon } from "@radix-ui/react-icons";
import { trackEvent } from "@/lib/telemetry";
import {
  parseTokenAmountFromBaseUnits,
  resolveDelegationCurrency,
} from "@/utils/launchpad-rewards";
import { useWalletLaunchpadInProgress } from "@/hooks/use-wallet-launchpad-in-progress";
import {
  isSplitActivityStillActive,
  resolveLaunchpadSplitCurrency,
} from "@/utils/wallet-launchpad";

// Lazy-load RecentActivity to defer its network work off the critical path
const RecentActivity = dynamic(
  () => import("./recent-activity").then((m) => m.RecentActivity),
  { ssr: false },
);

const ClaimsPanel = dynamic(
  () => import("./claims-panel").then((m) => m.ClaimsPanel),
  { ssr: false },
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
    allowedPairs: ["GLOW", "USDG"],
    toFixed: 6,
  },
  USDG: {
    label: "USDG",
    address: SDKAddresses.USDG,
    decimals: 6,
    allowedPairs: ["GLOW", "USDC"],
    toFixed: 6,
  },
  GLOW: {
    label: "GLOW",
    address: SDKAddresses.GLW,
    decimals: 18,
    allowedPairs: ["USDG", "USDC"],
    toFixed: 6,
  },
} as const;

type DelegatedAmountsByAsset = Partial<Record<"GLW" | "SGCTL", number>>;

function formatTokenAmountByAsset(
  value: number,
  asset: "GLW" | "SGCTL"
): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: asset === "SGCTL" ? 2 : 0,
  });
}

function formatDelegatedAmountsByAsset(amounts: DelegatedAmountsByAsset) {
  const parts = (["GLW", "SGCTL"] as const)
    .map((asset) => {
      const value = amounts[asset] ?? 0;
      if (!Number.isFinite(value) || value <= 0) return null;
      return `${formatTokenAmountByAsset(value, asset)} ${asset}`;
    })
    .filter((value): value is string => value !== null);

  return parts.join(" + ") || "0 GLW";
}

export type Token = (typeof tokens)[keyof typeof tokens];

export default function View() {
  const { t } = useLang();
  const { address, isConnected, connector: activeConnector } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const { signer } = useEthersSigner();
  const [password] = useQueryState("password");
  const [sendDialogOpen, setSendDialogOpen] = React.useState(false);
  const [usdcToUsdgDialogOpen, setUsdcToUsdgDialogOpen] = React.useState(false);
  const [amountInputDialogOpen, setAmountInputDialogOpen] =
    React.useState(false);
  const [regionalBreakdownOpen, setRegionalBreakdownOpen] =
    React.useState(false);
  const [amountToConvert, setAmountToConvert] = React.useState<string>("");
  const [inputAmount, setInputAmount] = React.useState<string>("");

  // Buy Glow flow state
  const [buyGlowDialogOpen, setBuyGlowDialogOpen] = React.useState(false);

  // Newsletter state
  const [newsletterEmail, setNewsletterEmail] = React.useState<string>("");
  const [isNewsletterSubmitting, setIsNewsletterSubmitting] =
    React.useState(false);
  const [hasNewsletterSuccess, setHasNewsletterSuccess] = React.useState(false);
  const [isAlreadySubscribed, setIsAlreadySubscribed] = React.useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] =
    React.useState(false);
  const claimsPanelRef = React.useRef<HTMLDivElement | null>(null);
  const isClaimsPanelInView = useInView(claimsPanelRef, {
    once: true,
    margin: "300px 0px",
  });

  const hasTrackedWalletViewRef = React.useRef(false);
  const hasTrackedGettingStartedViewRef = React.useRef(false);

  // USDC to USDG swap hook
  const { swapUSDCToUSDG, lastTxHashRef: usdcToUsdgWrapTxHashRef } =
    useSwapUSDCToUSDG();

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
      includeMintedEvents: false,
      includeStakeEvents: false,
    });

  // User launchpad sponsorship activity (fractions) and sponsor listings
  const { activity: splitsActivity, isLoading: isSplitsActivityLoading } =
    useSplitsActivity({
      walletAddress: address,
      enabled: Boolean(isConnected && address),
      limit: 200,
    });

  const { swaps, isLoading: isSwapsActivityLoading } = useWalletSwaps(address);

  const swapsActivity = React.useMemo<SwapActivity[]>(() => {
    return swaps.map((swap) => ({
      txHash: swap.txHash,
      timestampMs: swap.timestamp,
      glwIn: swap.glwIn,
      glwOut: swap.glwOut,
      usdgIn: swap.usdgIn,
      usdgOut: swap.usdgOut,
    }));
  }, [swaps]);

  const {
    sponsorListingById,
    sponsorshipsInProgressWithEstimates: launchpadSponsorshipsInProgressWithEstimates,
    isRewardScoresLoading,
    isSgctlRewardScoresLoading,
  } = useWalletLaunchpadInProgress({
    splitsActivity,
    walletAddress: address ?? null,
    enabled: Boolean(isConnected && address),
  });

  const delegatedAmountsByApplication = React.useMemo(() => {
    const byApp = new Map<string, DelegatedAmountsByAsset>();

    for (const evt of splitsActivity) {
      if (evt.fractionType !== "launchpad") continue;

      const app = sponsorListingById.get(evt.applicationId);
      if (!isSplitActivityStillActive({ split: evt, listing: app })) continue;

      const currency = resolveLaunchpadSplitCurrency({
        currency: evt.currency,
        amount: evt.amount,
        stepPrice: evt.stepPrice,
        transactionHash: evt.transactionHash,
        listingCurrency: app ? resolveDelegationCurrency(app) : null,
      });
      const decimals =
        evt.currencyDecimals ??
        (currency === "SGCTL" ? DECIMALS_BY_TOKEN.GCTL : DECIMALS_BY_TOKEN.GLW);
      const amount = parseTokenAmountFromBaseUnits(evt.amount, decimals);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const existing = byApp.get(evt.applicationId) ?? {};
      existing[currency] = (existing[currency] ?? 0) + amount;
      byApp.set(evt.applicationId, existing);
    }

    return byApp;
  }, [splitsActivity, sponsorListingById]);

  const sponsorshipsInProgress = React.useMemo(() => {
    const byApp = new Map<
      string,
      {
        applicationId: string;
        application: any | null;
        userSteps: number;
        progressPercent: number;
        estimatedUserWeeklyGlw: number;
        estimatedUserWeeklyPd: number;
        estimatedUserWeeklyPdAsset: "GLW" | "SGCTL" | null;
        delegatedAmountsByAsset: DelegatedAmountsByAsset;
      }
    >();

    launchpadSponsorshipsInProgressWithEstimates.forEach((item) => {
      const existing = byApp.get(item.applicationId);
      byApp.set(item.applicationId, {
        applicationId: item.applicationId,
        application: item.application,
        userSteps: (existing?.userSteps ?? 0) + item.userSteps,
        progressPercent: Math.max(
          existing?.progressPercent ?? 0,
          item.progressPercent ?? 0
        ),
        estimatedUserWeeklyGlw:
          (existing?.estimatedUserWeeklyGlw ?? 0) +
          (item.estimatedUserWeeklyGlw ?? 0),
        estimatedUserWeeklyPd:
          (existing?.estimatedUserWeeklyPd ?? 0) +
          (item.estimatedUserWeeklyPd ?? 0),
        estimatedUserWeeklyPdAsset:
          existing?.estimatedUserWeeklyPdAsset ??
          item.estimatedUserWeeklyPdAsset ??
          null,
        delegatedAmountsByAsset:
          delegatedAmountsByApplication.get(item.applicationId) ?? {},
      });
    });

    return Array.from(byApp.values()).filter((item) => item.userSteps > 0);
  }, [
    delegatedAmountsByApplication,
    launchpadSponsorshipsInProgressWithEstimates,
  ]);

  const {
    data: rewardsBreakdownData,
    isLoading: isRewardsBreakdownLoading,
    isError: isRewardsBreakdownError,
  } = useRewardsBreakdown({
    walletAddress: address || null,
    enabled: Boolean(isConnected && address),
  });

  // Helper functions to format balances
  function formatBalance(
    balance: bigint | null,
    decimals: number = 18,
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
  const hasGlow = glowBalance && glowBalance > BigInt(1 * 10 ** 18);
  const hasGctl = gctlBalance && BigInt(gctlBalance) > BigInt(0);
  const hasPendingMigrationClaim = (() => {
    if (!migrationData || migrationData.claimed) {
      return false;
    }
    try {
      return BigInt(migrationData.migrationAmount || "0") > BigInt(0);
    } catch {
      return false;
    }
  })();

  const rewardsSignals = React.useMemo(() => {
    if (!rewardsBreakdownData) {
      return {
        hasDelegations: false,
        hasMiners: false,
        hasOtherRewards: false,
        hasPendingRewards: false,
      };
    }

    const farmDetails = rewardsBreakdownData.farmDetails ?? [];
    const otherFarms = rewardsBreakdownData.otherFarmsWithRewards?.farms ?? [];
    const recentPurchases =
      rewardsBreakdownData.recentPurchasesWithoutRewards ?? [];
    const totalGlwDelegatedAfter = Number(
      rewardsBreakdownData.delegatedAfterWeekRange?.totalGlwDelegatedAfter ?? 0,
    );
    const totalUsdcSpentAfter = Number(
      rewardsBreakdownData.delegatedAfterWeekRange?.totalUsdcSpentAfter ?? 0,
    );

    const hasDelegations =
      farmDetails.some((farm) => farm.type === "launchpad") ||
      totalGlwDelegatedAfter > 0;
    const hasMiners =
      farmDetails.some((farm) => farm.type === "mining-center") ||
      totalUsdcSpentAfter > 0;
    const hasOtherRewards = otherFarms.length > 0;
    const hasPendingRewards =
      recentPurchases.length > 0 ||
      totalGlwDelegatedAfter > 0 ||
      totalUsdcSpentAfter > 0;

    return {
      hasDelegations,
      hasMiners,
      hasOtherRewards,
      hasPendingRewards,
    };
  }, [rewardsBreakdownData]);

  const hasAnyFarmsOrRewards =
    purchasedFarms.length > 0 ||
    rewardsSignals.hasDelegations ||
    rewardsSignals.hasMiners ||
    rewardsSignals.hasOtherRewards ||
    rewardsSignals.hasPendingRewards;

  const handleSwapUsdcToUsdg = () => {
    try {
      if (!hasUsdc) {
        toast.info(t.walletView.toastNoUsdc);
        return;
      }

      // Clear input and open amount input dialog
      setInputAmount("");
      trackEvent("wallet_convert_usdc_to_usdg_open");
      setAmountInputDialogOpen(true);
    } catch (error: any) {
      toast.error(error?.message || t.walletView.toastUsdcToUsdgFailed);
    }
  };

  const handleConfirmAmount = () => {
    if (!inputAmount || Number(inputAmount) <= 0) {
      toast.error(t.walletView.toastEnterValidAmount);
      return;
    }

    const usdcBalanceFormatted = usdcBalance
      ? formatUnits(usdcBalance, DECIMALS_BY_TOKEN.USDC)
      : "0";

    if (Number(inputAmount) > Number(usdcBalanceFormatted)) {
      toast.error(t.walletView.toastAmountExceedsUsdc);
      return;
    }

    trackEvent("wallet_convert_usdc_to_usdg_submit", {
      amount: inputAmount,
    });
    setAmountToConvert(inputAmount);
    setAmountInputDialogOpen(false);
    setUsdcToUsdgDialogOpen(true);
  };

  // Network status check
  const isSignerResolving = isConnected && signer === undefined;
  const hasNetworkIssues =
    !erc20Loading &&
    !isSignerResolving &&
    (erc20HasError || (isConnected && !hasSigner));

  // Buy Glow handlers for zero-state
  const handleBuyGlow = () => {
    trackEvent("wallet_buy_glw_open");
    setBuyGlowDialogOpen(true);
  };

  const faqItems: Array<{ q: string; a: React.ReactNode }> = [
    { q: t.walletView.faqQ1, a: <div>{t.walletView.faqA1}</div> },
    { q: t.walletView.faqQ2, a: <div>{t.walletView.faqA2}</div> },
    { q: t.walletView.faqQ3, a: <div>{t.walletView.faqA3}</div> },
    { q: t.walletView.faqQ4, a: <div>{t.walletView.faqA4}</div> },
  ];

  // Debounced subscription check
  const checkSubscriptionTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const checkSubscriptionStatus = React.useCallback(async (email: string) => {
    if (!email || !email.includes("@") || !email.includes(".")) {
      setIsAlreadySubscribed(false);
      return;
    }

    setIsCheckingSubscription(true);
    try {
      const res = await fetch(
        `/api/newsletter?email=${encodeURIComponent(email)}`,
      );
      const data = await res.json().catch(() => ({}));
      setIsAlreadySubscribed(data?.subscribed === true);
      trackEvent("wallet_newsletter_check_result", {
        ok: res.ok,
        status: res.status,
        subscribed: data?.subscribed === true,
      });
    } catch {
      setIsAlreadySubscribed(false);
      trackEvent("wallet_newsletter_check_result", {
        ok: false,
        status: -1,
        subscribed: false,
      });
    } finally {
      setIsCheckingSubscription(false);
    }
  }, []);

  const isWalletDataLoading =
    isConnected &&
    (!address ||
      erc20Loading ||
      isRewardsBreakdownLoading ||
      isPurchasedFarmsLoading ||
      isSplitsActivityLoading);

  // Check if we should show the getting started zero-state
  const shouldShowGettingStarted =
    !isWalletDataLoading &&
    !hasGlow &&
    (!splitsActivity || splitsActivity.length === 0) &&
    !hasAnyFarmsOrRewards &&
    !hasGctl &&
    !hasPendingMigrationClaim;

  React.useEffect(() => {
    if (hasTrackedWalletViewRef.current) return;
    hasTrackedWalletViewRef.current = true;
    trackEvent("wallet_view", {
      connected: isConnected,
      connector: activeConnector?.id || null,
    });
  }, [activeConnector?.id, isConnected]);

  React.useEffect(() => {
    if (!shouldShowGettingStarted) return;
    if (hasTrackedGettingStartedViewRef.current) return;
    hasTrackedGettingStartedViewRef.current = true;
    trackEvent("wallet_getting_started_view", {
      connected: isConnected,
    });
  }, [isConnected, shouldShowGettingStarted]);

  if (isWalletDataLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 xl:px-16 py-6 md:py-24 pt-20 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Skeleton className="h-10 w-full sm:w-32" />
              <Skeleton className="h-10 w-full sm:w-32" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[0, 1, 2].map((idx) => (
              <Card key={idx} className="border bg-muted/40">
                <CardHeader className="pb-3">
                  <Skeleton className="h-6 w-24" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-40" />
                  <div className="flex gap-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border bg-muted/40">
            <CardHeader className="pb-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[0, 1, 2].map((idx) => (
                  <Card
                    key={`delegation-skel-${idx}`}
                    className="border bg-background"
                  >
                    <Skeleton className="h-40 w-full" />
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleNewsletterEmailChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    setNewsletterEmail(value);
    setIsAlreadySubscribed(false);

    if (checkSubscriptionTimeoutRef.current) {
      clearTimeout(checkSubscriptionTimeoutRef.current);
    }

    // Debounce the subscription check by 500ms
    checkSubscriptionTimeoutRef.current = setTimeout(() => {
      checkSubscriptionStatus(value.trim());
    }, 500);
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newsletterEmail.trim();
    if (!email || !email.includes("@")) {
      trackEvent("wallet_newsletter_submit_blocked", {
        reason: "invalid_email",
      });
      toast.error(t.walletView.toastEnterValidEmail);
      return;
    }
    if (isAlreadySubscribed) {
      trackEvent("wallet_newsletter_submit_blocked", {
        reason: "already_subscribed",
      });
      toast.info(t.walletView.toastAlreadySubscribed);
      return;
    }
    try {
      setIsNewsletterSubmitting(true);
      setHasNewsletterSuccess(false);
      trackEvent("wallet_newsletter_submit", { ok: null });
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        trackEvent("wallet_newsletter_submit", {
          ok: false,
          status: res.status,
        });
        throw new Error(data?.error || t.walletView.toastSubscribeFailed);
      }
      toast.success(data?.message || t.walletView.toastSubscribed);
      trackEvent("wallet_newsletter_submit", { ok: true, status: res.status });
      setHasNewsletterSuccess(true);
      setNewsletterEmail("");
    } catch (err: any) {
      toast.error(err?.message || t.walletView.toastSubscribeError);
      trackEvent("wallet_newsletter_error", {
        error_message: err?.message || t.walletView.toastSubscribeError,
      });
    } finally {
      setIsNewsletterSubmitting(false);
    }
  };

  // Zero-state: Getting Started view
  if (shouldShowGettingStarted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 xl:px-16 py-24 md:py-32">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 md:mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                {t.walletView.gettingStarted}
              </h1>
              <p className="text-muted-foreground mt-2 text-base">
                {t.walletView.gettingStartedBody1}
                <br />
                {t.walletView.gettingStartedBody2}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Link href="/">
                <Button
                  size="default"
                  className="w-full sm:w-auto rounded-full px-5"
                >
                  {t.walletView.launchpad}
                </Button>
              </Link>
              <Link href="/">
                <Button
                  variant="outline"
                  size="default"
                  className="w-full sm:w-auto rounded-full px-5"
                >
                  {t.walletView.glowSwap}
                </Button>
              </Link>
            </div>
          </div>

          <div className="border-t border-border/70 mb-6 md:mb-8" />

          {isConnected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-16">
              {/* Buy Glow Card */}
              <button
                onClick={handleBuyGlow}
                className="group relative rounded-3xl overflow-hidden border border-border text-left transition-transform hover:scale-[1.02] cursor-pointer"
              >
                <div className="relative h-72 md:h-80 xl:h-96">
                  <Image
                    src="/images/sunset.jpg"
                    alt={t.walletView.buyGlowImageAlt}
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />
                </div>
                <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
                  <div className="text-white text-sm md:text-lg max-w-sm">
                    {t.walletView.buyGlowBlurb}
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-white text-4xl md:text-5xl font-bold">
                      {t.walletView.buyGlow}
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-4 right-4">
                  <span className="inline-flex items-center justify-center h-11 w-11 rounded-full bg-white text-black border border-black/10 shadow-sm transition-colors group-hover:bg-white">
                    <ArrowUpRight className="w-5 h-5" />
                  </span>
                </div>
              </button>

              {/* I'm New Card */}
              <Link
                href="/"
                target="_blank"
                className="group relative rounded-3xl overflow-hidden border border-border text-left transition-transform hover:scale-[1.02]"
              >
                <div className="relative h-72 md:h-80 xl:h-96">
                  <Image
                    src="/images/bird.jpg"
                    alt={t.walletView.fundSolarImageAlt}
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />
                </div>
                <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
                  <div className="text-white text-sm md:text-lg max-w-sm">
                    {t.walletView.fundSolarBlurb}
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="text-white text-4xl md:text-5xl font-bold">
                      {t.walletView.fundSolar}
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-4 right-4">
                  <span className="inline-flex items-center justify-center h-11 w-11 rounded-full bg-white text-black border border-black/10 shadow-sm transition-colors group-hover:bg-white">
                    <ArrowUpRight className="w-5 h-5" />
                  </span>
                </div>
              </Link>
            </div>
          )}

          {/* Quote + CTA - Gradient light, muted dark */}
          <div className="mt-10 md:mt-14 mb-10 md:mb-14">
            <div className="rounded-3xl glow-gradient p-8 md:p-12 dark:hidden">
              <div className="max-w-[500px] mx-auto text-center text-black">
                <p className="text-3xl leading-tight">{t.walletView.quoteText}</p>
                <p className="text-black/60 mt-4 text-base md:text-lg">
                  {t.walletView.quoteAuthor}
                </p>
                <div className="mt-8 flex justify-center">
                  {isConnected ? (
                    <Button
                      onClick={() =>
                        window.open(
                          "https://discord.gg/glowfnd",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      className="rounded-full h-12 px-6"
                    >
                      <span className="mr-3">{t.walletView.joinDiscord}</span>
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full">
                        <DiscordLogoIcon />
                      </span>
                    </Button>
                  ) : (
                    <div className="w-full max-w-sm">
                      <ConnectButton variant="default" size="large" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="hidden dark:block rounded-3xl bg-muted p-8 md:p-12">
              <div className="max-w-[420px] mx-auto text-center">
                <p className="text-3xl  leading-tight">{t.walletView.quoteText}</p>
                <p className="text-muted-foreground mt-4 text-base md:text-lg">
                  {t.walletView.quoteAuthor}
                </p>
                <div className="mt-8 flex justify-center">
                  {isConnected ? (
                    <Button
                      onClick={() =>
                        window.open(
                          "https://discord.gg/glowfnd",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      className="rounded-full h-12 px-6"
                    >
                      <span className="mr-3">{t.walletView.joinDiscord}</span>
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full">
                        <DiscordLogoIcon />
                      </span>
                    </Button>
                  ) : (
                    <div className="w-full max-w-sm">
                      <ConnectButton variant="default" size="large" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* FAQs */}
          <div className="border-t border-border mt-10 md:mt-14" />
          <div className="max-w-screen-md mx-auto mt-10 md:mt-14">
            <h2 className="text-2xl font-semibold mb-4">{t.walletView.faqsHeading}</h2>
            <div className="space-y-3">
              {faqItems.map((item, idx) => (
                <Collapsible key={idx} className="rounded-2xl border bg-card">
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-4 md:p-5 text-left">
                    <span className="text-base md:text-lg font-medium">
                      {item.q}
                    </span>
                    <span className="ml-4 inline-flex items-center justify-center h-7 w-7 rounded-full bg-muted">
                      <Plus className="h-4 w-4 text-primary" />
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 md:px-5 pb-5 text-muted-foreground">
                    {item.a}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>

          {/* Newsletter */}
          <div className="border-t border-border mt-14 md:mt-16" />
          <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_minmax(360px,520px)] gap-6 items-center mt-8 md:mt-10">
            <div>
              <h3 className="text-xl font-semibold">
                {t.walletView.newsletterHeading}
              </h3>
              <p className="text-muted-foreground mt-1">
                {t.walletView.newsletterSub}
              </p>
            </div>
            <form
              onSubmit={handleNewsletterSubmit}
              className="bg-muted/50 border border-border rounded-2xl p-3 md:p-4 flex items-center gap-3"
            >
              <Input
                type="email"
                inputMode="email"
                placeholder={t.walletView.newsletterPlaceholder}
                value={newsletterEmail}
                onChange={handleNewsletterEmailChange}
                className="flex-1 bg-background"
                required
                disabled={isNewsletterSubmitting || hasNewsletterSuccess}
              />
              {isAlreadySubscribed || hasNewsletterSuccess ? (
                <span className="shrink-0 text-sm text-green-600 dark:text-green-400 font-medium px-3">
                  {t.walletView.newsletterSubscribed}
                </span>
              ) : (
                <Button
                  type="submit"
                  className="shrink-0"
                  disabled={isNewsletterSubmitting || isCheckingSubscription}
                >
                  {isNewsletterSubmitting
                    ? t.walletView.newsletterSigningUp
                    : isCheckingSubscription
                      ? t.walletView.newsletterChecking
                      : t.walletView.newsletterSignUp}
                </Button>
              )}
            </form>
          </div>
        </div>

        {/* Buy Glow Dialog */}
        {buyGlowDialogOpen ? (
          <BuyGlowDialog
            open={buyGlowDialogOpen}
            onOpenChange={(open) => {
              setBuyGlowDialogOpen(open);
              if (!open) {
                refreshBalances();
              }
            }}
            usdcBalance={usdcBalance}
            glowSpotPrice={glowSpotPrice || 0}
            source="wallet_view"
            onSuccess={refreshBalances}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 xl:px-16 py-6 md:py-24 pt-20">
        {/* Page Header - 8pt spacing system */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {t.walletView.powerWallet}
            </h1>
            <p className="text-muted-foreground mt-2 text-base">
              {t.walletView.powerWalletSub}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <Link href="/">
              <Button
                size="default"
                disabled={erc20Loading}
                className="w-full sm:w-auto"
              >
                {t.walletView.launchpad}
              </Button>
            </Link>
            <Link href="/">
              <Button
                variant="outline"
                size="default"
                disabled={erc20Loading}
                className="w-full sm:w-auto"
              >
                {t.walletView.glowSwap}
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
                          {t.walletView.networkIssue}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            trackEvent("wallet_refresh_balances_click");
                            refreshBalances();
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          {t.walletView.retry}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="default"
                      variant="outline"
                      onClick={() => {
                        trackEvent("wallet_send_open");
                        setSendDialogOpen(true);
                      }}
                      className="flex-1 sm:flex-initial"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {t.walletView.send}
                    </Button>
                    {hasUsdc && (
                      <Button
                        size="default"
                        variant="outline"
                        onClick={handleSwapUsdcToUsdg}
                        className="flex-1 sm:flex-initial"
                      >
                        {t.walletView.convertToUsdg}
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
                            onClick={() => {
                              trackEvent("wallet_send_open");
                              setSendDialogOpen(true);
                            }}
                            className="flex-1 sm:flex-initial"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {t.walletView.send}
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
                      <Button
                        size="default"
                        variant="outline"
                        onClick={handleBuyGlow}
                        className="flex-1 sm:flex-initial"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Buy
                      </Button>
                      {hasGlow && (
                        <Button
                          size="default"
                          variant="outline"
                          onClick={() => {
                            trackEvent("wallet_send_open");
                            setSendDialogOpen(true);
                          }}
                          className="flex-1 sm:flex-initial"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {t.walletView.send}
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
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="default"
                        variant="outline"
                        onClick={() => {
                          trackEvent("wallet_manage_staking_click");
                          window.open(
                            "https://impact.glow.org",
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                        className="w-full sm:w-auto"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Manage Staking
                      </Button>
                      {!hasNetworkIssues &&
                        walletDetails?.regions &&
                        walletDetails.regions.length > 0 && (
                          <Button
                            size="default"
                            variant="outline"
                            onClick={() => {
                              trackEvent("wallet_gctl_breakdown_open");
                              setRegionalBreakdownOpen(true);
                            }}
                            className="w-full sm:w-auto"
                          >
                            Breakdown
                          </Button>
                        )}
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
            onClaim={refreshBalances}
          />
        </div>

        {/* E. Refund Claims Panel */}
        <RefundClaimsPanel
          walletAddress={address}
          onClaimSuccess={refreshBalances}
        />

        {/* F. Sponsorships In Progress */}
        {(sponsorshipsInProgress.length > 0 || isSplitsActivityLoading) && (
          <Card className="mb-8">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold">
                Delegations In Progress
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Farms you've delegated to that are waiting for full funding to
                start earning rewards
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
                      Math.min(100, Number(item.progressPercent || 0)),
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
                              <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                                <span>{progress}% filled</span>
                                <span className="text-right">
                                  Delegated:{" "}
                                  {formatDelegatedAmountsByAsset(
                                    item.delegatedAmountsByAsset
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                                <span>{t.walletView.estWeeklyRewards}</span>
                                <span>
                                  {isRewardScoresLoading ||
                                  isSgctlRewardScoresLoading
                                    ? "..."
                                    : item.estimatedUserWeeklyPd &&
                                        item.estimatedUserWeeklyPdAsset ===
                                          "SGCTL"
                                      ? `~${item.estimatedUserWeeklyGlw.toLocaleString(
                                          undefined,
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )} GLW + ${item.estimatedUserWeeklyPd.toLocaleString(
                                          undefined,
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )} SGCTL`
                                      : item.estimatedUserWeeklyGlw > 0
                                        ? `~${item.estimatedUserWeeklyGlw.toLocaleString(
                                            undefined,
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            }
                                          )} GLW`
                                        : "0 GLW"}
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

        <RewardsBreakdownPanel
          walletAddress={address}
          rewardsBreakdownData={rewardsBreakdownData}
          isRewardsBreakdownLoading={isRewardsBreakdownLoading}
          isRewardsBreakdownError={isRewardsBreakdownError}
          splitsActivity={splitsActivity || []}
        />

        {/* D. Claims Panel */}

        <div ref={claimsPanelRef}>
          {isClaimsPanelInView ? (
            <ClaimsPanel variant="card" onClaimSuccess={refreshBalances} />
          ) : (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-2xl font-bold">{t.walletView.claims}</CardTitle>
                <CardDescription>
                  Claimable rewards load when this section comes into view.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-40" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* H. Recent Activity */}
        <RecentActivity
          walletAddress={address}
          splitsActivity={splitsActivity || []}
          swapsActivity={swapsActivity}
          isSplitsActivityLoading={isSplitsActivityLoading}
          isSwapsActivityLoading={isSwapsActivityLoading}
        />
      </div>

      {/* Amount Input Dialog */}
      <Dialog
        open={amountInputDialogOpen}
        onOpenChange={(open) => {
          setAmountInputDialogOpen(open);
          trackEvent("wallet_convert_usdc_to_usdg_amount_dialog", {
            open,
          });
        }}
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
                        trackEvent("wallet_convert_usdc_to_usdg_max_click");
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
              onClick={() => {
                trackEvent("wallet_convert_usdc_to_usdg_cancel");
                setAmountInputDialogOpen(false);
              }}
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
      <SendDialog
        open={sendDialogOpen}
        onOpenChange={(open) => {
          setSendDialogOpen(open);
          trackEvent("wallet_send_dialog", { open });
        }}
      />

      {/* USDC to USDG Dialog */}
      <UsdcToTokenDialog
        isOpen={usdcToUsdgDialogOpen}
        amount={amountToConvert} // 1:1 conversion for USDC to USDG
        amountToSell={amountToConvert}
        selectedTokenSell={tokens.USDC}
        selectedTokenBuy={tokens.USDG}
        smartBalancingAmounts={undefined} // Not needed for USDC -> USDG
        swapUSDCToUSDG={swapUSDCToUSDG}
        lastWrapTxHashRef={usdcToUsdgWrapTxHashRef}
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

      {/* Regional Breakdown Dialog */}
      <Dialog
        open={regionalBreakdownOpen}
        onOpenChange={(open) => {
          setRegionalBreakdownOpen(open);
          if (!open) {
            trackEvent("wallet_gctl_breakdown_close");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.walletView.gctlStakingBreakdown}</DialogTitle>
            <DialogDescription>
              View your GCTL staking distribution across regions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto py-4">
            {walletDetails?.regions
              ?.filter(
                (regionStake) => BigInt(regionStake.totalStaked) > BigInt(0),
              )
              .map((regionStake) => {
                const regionName =
                  regionStake.region?.name ||
                  regions.find((r) => r.id === regionStake.regionId)?.name ||
                  `Region ${regionStake.regionId}`;
                const stakedAmount = formatGctlBalance(regionStake.totalStaked);

                return (
                  <div
                    key={regionStake.regionId}
                    className="flex justify-between items-center p-4 rounded-lg border bg-card"
                  >
                    <div className="font-medium">{regionName}</div>
                    <Badge variant="secondary" className="text-base px-4 py-2">
                      {stakedAmount} GCTL
                    </Badge>
                  </div>
                );
              })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRegionalBreakdownOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buy Glow Dialog */}
      {buyGlowDialogOpen ? (
        <BuyGlowDialog
          open={buyGlowDialogOpen}
          onOpenChange={(open) => {
            setBuyGlowDialogOpen(open);
            trackEvent("wallet_buy_glw_dialog", { open });
            if (!open) {
              refreshBalances();
            }
          }}
          usdcBalance={usdcBalance}
          glowSpotPrice={glowSpotPrice || 0}
          source="wallet_view"
          onSuccess={refreshBalances}
        />
      ) : null}
    </div>
  );
}
