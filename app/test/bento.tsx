"use client";

import React from "react";
import { useAccount } from "wagmi";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits } from "viem";

import SolarFarmWidget from "./widgets/solar-farm-widget";
import NetWorthWidget from "./widgets/net-worth";
import WalletWidget from "./widgets/wallet-widget";
import RankWidget from "./widgets/rank-widget";
import RewardsWidget from "./widgets/rewards-widget";
import WeeklyActivityWidget from "./widgets/weekly-activity-widget";
import GlowFaqWidget from "./widgets/glow-faq-widget";
import GctlHeatmapWidget from "./widgets/gctl-heatmap-widget";
import RecentActivityWidget from "./widgets/recent-activity-widget";
import CommunityActivityWidget from "./widgets/community-activity-widget";
import BlogFeaturedWidget from "./widgets/blog-featured-widget";
import OnboardingHeroWidget from "./widgets/onboarding-hero-widget";
import LaunchpadStatusWidget from "./widgets/launchpad-status-widget";
import GlobalLeaderboardWidget from "./widgets/global-leaderboard-widget";
import MyFarmsGridSection from "./widgets/my-farms-grid-section";
import PortfolioSummaryWidget from "./widgets/portfolio-summary-widget";
import ProtocolMetricsWidget from "./widgets/protocol-metrics-widget";
import { MintAndStakeGctlDialog } from "@/components/dialogs/mint-and-stake-gctl-dialog";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import DiscordWidget from "./widgets/discord-widget";
import NewsletterWidget from "./widgets/newsletter-widget";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  useRefundableFractions,
  useGlowLaunchpad,
  useMiningCenter,
  useWallets,
} from "@/hooks";
import { RefundClaimsPanel } from "@/app/wallet/refund-claims-panel";
import { MigrationClaimPanel } from "@/app/wallet/migration-claim-panel";
import { useLaunchpadStatus } from "@/hooks/useLaunchpadStatus";
import { Skeleton } from "@/components/ui/skeleton";
import { trackEvent } from "@/lib/telemetry";
import { useCountdownTo } from "@/app/components/animated-countdown";
import {
  DepositDialog,
  type LaunchpadRewardScore,
  type MiningCenterScore,
} from "@/app/marketplace/deposit-dialog";
import type { TaggedAuctionApplication } from "@/app/marketplace/launchpad-view";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import ImpactAccumulatorWidget from "./widgets/impact-accumulator-widget";
import SolarCollectorWidget from "./widgets/solar-collector";
import { WidgetErrorBoundary } from "@/components/widget-error-boundary";
import { FeatureLaunchModal } from "@/components/referral/feature-launch-modal";
import { ActivationCelebrationModal } from "@/components/referral/activation-celebration-modal";

interface GlowSoftDashboardProps {
  walletAddressOverride?: string | null;
}

function subscribeToNothing() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

function useIsClient() {
  return React.useSyncExternalStore(
    subscribeToNothing,
    getClientSnapshot,
    getServerSnapshot
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
      {title}
    </h2>
  );
}

function formatGlw(amount: string): string {
  try {
    const formatted = formatUnits(BigInt(amount), 18);
    const num = Number.parseFloat(formatted);
    if (!Number.isFinite(num) || num <= 0) return "0";
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0";
  }
}

function formatGctl(amount: string): string {
  try {
    const formatted = formatUnits(BigInt(amount), 6);
    const num = Number.parseFloat(formatted);
    if (!Number.isFinite(num) || num <= 0) return "0";
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0";
  }
}

function countAvailableApplications(
  applications: Array<{
    activeFraction: { isFilled: boolean; remainingSteps: number | null } | null;
  }>
) {
  return applications.reduce((count, app) => {
    const fraction = app.activeFraction;
    if (!fraction) return count;
    const remainingSteps = fraction.remainingSteps ?? 0;
    const hasAvailability = !fraction.isFilled && remainingSteps > 0;
    return hasAvailability ? count + 1 : count;
  }, 0);
}

function DashboardConnectingSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4 grid-flow-row-dense">
      <div className="col-span-12 lg:col-span-5 min-h-0 lg:h-[330px]">
        <Skeleton className="h-full w-full rounded-2xl bg-card dark:bg-muted/30" />
      </div>
      <div className="col-span-12 lg:col-span-4 min-h-0 lg:h-[330px]">
        <Skeleton className="h-full w-full rounded-2xl bg-card dark:bg-muted/30" />
      </div>
      <div className="col-span-12 lg:col-span-3 min-h-0 lg:h-[330px]">
        <Skeleton className="h-full w-full rounded-2xl bg-card dark:bg-muted/30" />
      </div>

      <div className="col-span-12 lg:col-span-5 min-h-0 lg:h-[380px]">
        <Skeleton className="h-full w-full rounded-2xl bg-card dark:bg-muted/30" />
      </div>
      <div className="col-span-12 lg:col-span-4 min-h-0 lg:h-[380px]">
        <Skeleton className="h-full w-full rounded-2xl bg-card dark:bg-muted/30" />
      </div>
      <div className="col-span-12 lg:col-span-3 min-h-0 lg:h-[380px]">
        <Skeleton className="h-full w-full rounded-2xl bg-card dark:bg-muted/30" />
      </div>

      <div className="col-span-12 lg:col-span-5 min-h-0 lg:h-[380px]">
        <Skeleton className="h-full w-full rounded-2xl bg-card dark:bg-muted/30" />
      </div>
      <div className="col-span-12 lg:col-span-7 min-h-0 lg:h-[380px]">
        <Skeleton className="h-full w-full rounded-2xl bg-card dark:bg-muted/30" />
      </div>
    </div>
  );
}

export default function GlowSoftDashboard({
  walletAddressOverride,
}: GlowSoftDashboardProps) {
  const {
    address: connectedAddress,
    isConnected,
    isConnecting,
    isReconnecting,
  } = useAccount();
  const walletAddress = walletAddressOverride ?? connectedAddress ?? null;
  const hasWallet = Boolean(walletAddress);
  const { signer } = useEthersSigner();
  const { usdcBalance, usdgBalance } = useER20Balances({ signer });
  const [isMintAndStakeOpen, setIsMintAndStakeOpen] = React.useState(false);
  const [mintAndStakeForceStep1, setMintAndStakeForceStep1] =
    React.useState(false);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = React.useState(false);
  const [isMigrationDialogOpen, setIsMigrationDialogOpen] =
    React.useState(false);
  const [isDepositDialogOpen, setIsDepositDialogOpen] = React.useState(false);
  const [isBuyGlowDialogOpen, setIsBuyGlowDialogOpen] = React.useState(false);
  const [selectedApplicationForDeposit, setSelectedApplicationForDeposit] =
    React.useState<TaggedAuctionApplication | null>(null);
  const [selectedRewardScore, setSelectedRewardScore] = React.useState<
    LaunchpadRewardScore | MiningCenterScore | null
  >(null);
  const refundToastIdRef = React.useRef<string | number | null>(null);
  const migrationToastIdRef = React.useRef<string | number | null>(null);
  const prevHasMigrationClaimRef = React.useRef<boolean | null>(null);
  const trackedWalletsRef = React.useRef(new Set<string | null>());
  const prevHasRefundsRef = React.useRef<boolean | null>(null);
  const queryClient = useQueryClient();
  const { spotPriceUsd: glwSpotPrice } = useGlowSpotPriceSummary();

  const hasAnyDialogOpen =
    isRefundDialogOpen ||
    isMigrationDialogOpen ||
    isMintAndStakeOpen ||
    isDepositDialogOpen ||
    isBuyGlowDialogOpen;

  const isClient = useIsClient();
  const isWalletSettling =
    isClient &&
    !walletAddressOverride &&
    !hasWallet &&
    (isConnecting || isReconnecting) &&
    !hasAnyDialogOpen;

  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;

  // Track dashboard view once per unique wallet address using a Set.
  // Sets are idempotent - even if React calls render multiple times
  // (Strict Mode, Concurrent Mode), each wallet is only tracked once.
  if (!trackedWalletsRef.current.has(normalizedWalletAddress)) {
    trackedWalletsRef.current.add(normalizedWalletAddress);
    trackEvent("dashboard_view", {
      source: "bento",
      wallet_connected: Boolean(walletAddress),
      wallet_address: normalizedWalletAddress,
    });
  }

  const {
    isLive: isLaunchpadLive,
    nextBatchAtMs: launchpadNextBatchAtMs,
    refreshNextBatchAtMs: refreshLaunchpadNextBatchAtMs,
  } = useLaunchpadStatus();

  const { applications: delegationApplications } = useGlowLaunchpad({
    filters: { paymentCurrency: "GLW" },
    enabled: isLaunchpadLive,
  });
  const { applications: minerApplications } = useMiningCenter({
    filters: { paymentCurrency: "USDC" },
    enabled: isLaunchpadLive,
  });

  const shouldShowLaunchpadLiveSection = React.useMemo(() => {
    if (!isLaunchpadLive) return false;
    const delegationsCount = countAvailableApplications(delegationApplications);
    const minersCount = countAvailableApplications(minerApplications);
    return delegationsCount > 0 || minersCount > 0;
  }, [isLaunchpadLive, delegationApplications, minerApplications]);

  const ONE_HOUR_MS = 60 * 60 * 1000;
  const isApproachingLaunchpad = React.useMemo(() => {
    if (isLaunchpadLive) return false;
    const now = Date.now();
    const timeUntilLive = launchpadNextBatchAtMs - now;
    return timeUntilLive > 0 && timeUntilLive <= ONE_HOUR_MS;
  }, [isLaunchpadLive, launchpadNextBatchAtMs]);

  const shouldShowLaunchpadHeroRow =
    shouldShowLaunchpadLiveSection || isApproachingLaunchpad;

  const handleLaunchpadCountdownComplete = React.useCallback(() => {
    refreshLaunchpadNextBatchAtMs();
    void (async () => {
      try {
        await queryClient.refetchQueries({ queryKey: ["sponsor-listings"] });
      } catch {}
    })();
  }, [queryClient, refreshLaunchpadNextBatchAtMs]);

  useCountdownTo({
    targetAtMs: launchpadNextBatchAtMs,
    onComplete: handleLaunchpadCountdownComplete,
  });

  const { refundableFractions, summary, isLoading, isError } =
    useRefundableFractions({
      walletAddress,
      enabled: hasWallet,
    });

  const hasRefunds =
    hasWallet && !isLoading && !isError && refundableFractions.length > 0;

  const { migrationData, isMigrationLoading, migrationError } = useWallets({
    walletAddress: walletAddress ?? undefined,
    enabled: hasWallet,
  });

  const hasPendingMigrationClaim = React.useMemo(() => {
    if (!hasWallet || isMigrationLoading || migrationError) return false;
    if (!migrationData || migrationData.claimed) return false;
    try {
      return BigInt(migrationData.migrationAmount || "0") > BigInt(0);
    } catch {
      return false;
    }
  }, [hasWallet, isMigrationLoading, migrationError, migrationData]);

  // Handle migration toast inline during render to avoid useEffect
  if (prevHasMigrationClaimRef.current !== hasPendingMigrationClaim) {
    prevHasMigrationClaimRef.current = hasPendingMigrationClaim;

    if (!hasPendingMigrationClaim) {
      if (migrationToastIdRef.current != null) {
        toast.dismiss(migrationToastIdRef.current);
        migrationToastIdRef.current = null;
      }
      if (isMigrationDialogOpen) setIsMigrationDialogOpen(false);
    } else if (migrationToastIdRef.current == null) {
      const formattedAmount = formatGctl(migrationData?.migrationAmount || "0");
      migrationToastIdRef.current = toast("GCTL allocation available", {
        description: `${formattedAmount} GCTL available to claim`,
        duration: Infinity,
        dismissible: false,
        closeButton: false,
        action: {
          label: "Claim GCTL",
          onClick: () => setIsMigrationDialogOpen(true),
        },
      });
    }
  }

  if (prevHasRefundsRef.current !== hasRefunds) {
    prevHasRefundsRef.current = hasRefunds;
    const existingToastId = refundToastIdRef.current;

    if (!hasRefunds) {
      if (existingToastId != null) toast.dismiss(existingToastId);
      refundToastIdRef.current = null;
      if (isRefundDialogOpen) setIsRefundDialogOpen(false);
    } else if (existingToastId == null) {
      const toastId = toast("You have refunds available", {
        description: `${
          summary.totalRefundableFractions
        } listings · ${formatGlw(summary.totalRefundableAmount)} GLW`,
        duration: Infinity,
        dismissible: false,
        closeButton: false,
        action: {
          label: "Claim refunds",
          onClick: () => setIsRefundDialogOpen(true),
        },
      });

      refundToastIdRef.current = toastId;
    }
  }

  const handleMigrationClaimSuccess = React.useCallback(() => {
    if (!walletAddress) return;
    queryClient
      .invalidateQueries({
        queryKey: ["migration-amount", walletAddress],
      })
      .catch(() => {
        // no-op
      });
  }, [queryClient, walletAddress]);

  const handleRefundClaimSuccess = React.useCallback(() => {
    if (!walletAddress) return;
    queryClient
      .invalidateQueries({
        queryKey: ["refundable-fractions", walletAddress],
      })
      .catch(() => {
        // no-op
      });
  }, [queryClient, walletAddress]);

  const handlePayDeposit = React.useCallback(
    (
      application: TaggedAuctionApplication,
      scoreData?: LaunchpadRewardScore | MiningCenterScore | null
    ) => {
      trackEvent("dashboard_launchpad_deposit_open_click", {
        source: "bento",
        wallet_connected: isConnected,
        wallet_address: normalizedWalletAddress,
        application_id: application.id,
        listing_type: application._type,
        payment_currency: application._type === "miners" ? "USDC" : "GLW",
      });
      setSelectedApplicationForDeposit(application);
      setSelectedRewardScore(scoreData ?? null);
      setIsDepositDialogOpen(true);
    },
    [isConnected, normalizedWalletAddress]
  );

  const handleDepositOpenChange = React.useCallback((nextOpen: boolean) => {
    setIsDepositDialogOpen(nextOpen);
    if (nextOpen) return;
    setSelectedApplicationForDeposit(null);
    setSelectedRewardScore(null);
  }, []);

  const handleBuyGlowClick = React.useCallback(() => {
    trackEvent("dashboard_buy_glw_click", {
      source: "bento",
      wallet_connected: isConnected,
      wallet_address: normalizedWalletAddress,
    });
    setIsBuyGlowDialogOpen(true);
  }, [isConnected, normalizedWalletAddress]);

  return (
    <div className="min-h-screen bg-muted dark:bg-background text-foreground selection:bg-[color:var(--color-glow-yellow)] selection:text-foreground">
      <ActivationCelebrationModal />
      <FeatureLaunchModal />
      <div className="max-w-screen-2xl mx-auto p-6">
        <AnimatePresence mode="wait" initial={false}>
          {hasWallet ? (
            <motion.div
              key="connected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-6"
            >
              {/* Launchpad Live/Approaching Section - First Row */}
              {shouldShowLaunchpadHeroRow && (
                <section className="flex flex-col gap-4">
                  <SectionHeader
                    title={
                      isApproachingLaunchpad
                        ? "Launchpad Opening Soon"
                        : "Launchpad Live"
                    }
                  />
                  <LaunchpadStatusWidget
                    variant="full-row"
                    onPayDeposit={handlePayDeposit}
                    isApproaching={isApproachingLaunchpad}
                  />
                </section>
              )}

              {/* Dashboard Header Band */}
              <section className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-4 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-stretch">
                  <div className="lg:col-span-3 flex">
                    <WidgetErrorBoundary>
                      <RankWidget
                        walletAddress={walletAddress}
                        variant="hero"
                        onMintAndStakeClick={(forceStep1) => {
                          setMintAndStakeForceStep1(Boolean(forceStep1));
                          setIsMintAndStakeOpen(true);
                        }}
                      />
                    </WidgetErrorBoundary>
                  </div>

                  <div className="lg:col-span-5 flex">
                    <WidgetErrorBoundary>
                      <NetWorthWidget
                        walletAddress={walletAddress}
                        variant="minimal"
                        onBuyGlowClick={handleBuyGlowClick}
                      />
                    </WidgetErrorBoundary>
                  </div>

                  <div className="lg:col-span-2 flex">
                    <WidgetErrorBoundary>
                      <WalletWidget
                        walletAddress={walletAddress}
                        variant="minimal"
                      />
                    </WidgetErrorBoundary>
                  </div>
                </div>
              </section>

              {/* Mining & Rewards Section */}
              <section className="flex flex-col gap-4">
                <SectionHeader title="Mining & Rewards" />
                <div className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/50 items-stretch">
                    <div
                      id="bento-solar-farm"
                      className="pb-6 lg:pb-0 lg:pr-8 lg:col-span-2 flex min-h-[320px]"
                    >
                      <WidgetErrorBoundary>
                        <SolarFarmWidget
                          walletAddress={walletAddress ?? undefined}
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                    <div className="pt-6 lg:pt-0 lg:pl-8 flex">
                      <WidgetErrorBoundary>
                        <RewardsWidget
                          walletAddress={walletAddress}
                          hideIfEmpty={false}
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                  </div>
                </div>
              </section>

              {/* Action Section: Grow Your Impact */}
              <section className="flex flex-col gap-4 pt-12">
                <SectionHeader title="Grow Your Impact" />
                <div className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/50 items-stretch">
                    <div
                      id="bento-launchpad-status"
                      className="pb-6 lg:pb-0 lg:pr-8 flex"
                    >
                      <WidgetErrorBoundary>
                        <LaunchpadStatusWidget
                          variant="minimal"
                          onPayDeposit={handlePayDeposit}
                        />
                      </WidgetErrorBoundary>
                    </div>
                    <div className="pt-6 lg:pt-0 lg:pl-8 flex">
                      <WidgetErrorBoundary>
                        <GctlHeatmapWidget
                          walletAddress={walletAddress}
                          variant="minimal"
                          onMintAndStakeClick={() =>
                            setIsMintAndStakeOpen(true)
                          }
                        />
                      </WidgetErrorBoundary>
                    </div>
                  </div>
                </div>
              </section>

              {/* Journey Section */}
              <section className="flex flex-col gap-4 pt-12 pb-12">
                <SectionHeader title="Your Journey" />
                <div className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/50 items-stretch pb-8 mb-8 border-b border-border/50">
                    <div className="pb-6 lg:pb-0 lg:pr-8 flex lg:col-span-4">
                      <WidgetErrorBoundary>
                        <WeeklyActivityWidget
                          walletAddress={walletAddress}
                          hideIfEmpty={false}
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>

                    <div className="pt-6 lg:pt-0 lg:pl-8 flex lg:col-span-5">
                      <WidgetErrorBoundary>
                        <RecentActivityWidget
                          walletAddress={walletAddress}
                          hideIfEmpty={false}
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                    <div className="py-6 lg:py-0 lg:px-8 flex lg:col-span-3">
                      <WidgetErrorBoundary>
                        <PortfolioSummaryWidget
                          walletAddress={walletAddress}
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-6">
                      My Impact
                    </h3>
                    <WidgetErrorBoundary>
                      <SolarCollectorWidget
                        walletAddress={walletAddress}
                        onFarmClick={(farmId) => {
                          // Scroll to the farm card in the grid below
                          const el = document.querySelector(
                            `[data-farm-id="${farmId}"]`
                          );
                          if (el) {
                            el.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                            el.classList.add("ring-2", "ring-primary");
                            setTimeout(
                              () =>
                                el.classList.remove("ring-2", "ring-primary"),
                              2000
                            );
                          }
                        }}
                      />
                    </WidgetErrorBoundary>
                    <WidgetErrorBoundary>
                      <MyFarmsGridSection walletAddress={walletAddress} />
                    </WidgetErrorBoundary>
                  </div>
                </div>
              </section>
            </motion.div>
          ) : isWalletSettling ? (
            <motion.div
              key="connecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <DashboardConnectingSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key="disconnected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-12"
            >
              {/* Launchpad Live/Approaching Section - First Row */}
              {shouldShowLaunchpadHeroRow && (
                <section className="flex flex-col gap-4">
                  <SectionHeader
                    title={
                      isApproachingLaunchpad
                        ? "Launchpad Opening Soon"
                        : "Launchpad Live"
                    }
                  />
                  <LaunchpadStatusWidget
                    variant="full-row"
                    onPayDeposit={handlePayDeposit}
                    isApproaching={isApproachingLaunchpad}
                  />
                </section>
              )}

              {/* Hero Section */}
              <section className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-0  items-stretch">
                  <div className="pb-6 lg:pb-0 lg:pr-8 flex min-h-[340px]">
                    <WidgetErrorBoundary>
                      <OnboardingHeroWidget
                        className="w-full h-full"
                        variant="minimal"
                        onBuyGlowClick={handleBuyGlowClick}
                      />
                    </WidgetErrorBoundary>
                  </div>
                  <div className="pt-6 lg:pt-0 lg:pl-8 flex min-h-[340px]">
                    <WidgetErrorBoundary>
                      <LaunchpadStatusWidget
                        className="w-full h-full"
                        variant="minimal"
                        onPayDeposit={handlePayDeposit}
                      />
                    </WidgetErrorBoundary>
                  </div>
                </div>
              </section>

              {/* Community & Leaderboard Section */}
              <section className="flex flex-col gap-4">
                <SectionHeader title="Community & Leaderboard" />
                <div className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/50 items-stretch">
                    <div className="pb-6 lg:pb-0 lg:pr-8 lg:col-span-8 flex min-h-[400px]">
                      <WidgetErrorBoundary>
                        <CommunityActivityWidget
                          className="w-full h-full"
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                    <div className="pt-6 lg:pt-0 lg:pl-8 lg:col-span-4 flex min-h-[400px]">
                      <WidgetErrorBoundary>
                        <GlobalLeaderboardWidget
                          className="h-full w-full"
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                  </div>
                </div>
              </section>

              {/* Protocol Metrics Section */}
              <section className="flex flex-col gap-4">
                <SectionHeader title="Protocol Metrics" />
                <div className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                  <WidgetErrorBoundary>
                    <ProtocolMetricsWidget />
                  </WidgetErrorBoundary>
                </div>
              </section>

              {/* Education Section */}
              <section className="flex flex-col gap-4">
                <SectionHeader title="Education" />
                <div className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/50 items-stretch">
                    <div className="pb-6 lg:pb-0 lg:pr-8 lg:col-span-7 flex min-h-[400px]">
                      <WidgetErrorBoundary>
                        <GlowFaqWidget
                          className="w-full h-full"
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                    <div className="pt-6 lg:pt-0 lg:pl-8 lg:col-span-5 flex min-h-[400px]">
                      <WidgetErrorBoundary>
                        <BlogFeaturedWidget className="w-full h-full" />
                      </WidgetErrorBoundary>
                    </div>
                  </div>
                </div>
              </section>

              {/* Stay Connected Section */}
              <section className="flex flex-col gap-4">
                <SectionHeader title="Stay Connected" />
                <div className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/50 items-stretch">
                    <div className="pb-6 lg:pb-0 lg:pr-8 lg:col-span-5 flex min-h-[340px]">
                      <WidgetErrorBoundary>
                        <NewsletterWidget
                          className="w-full h-full"
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                    <div className="pt-6 lg:pt-0 lg:pl-8 lg:col-span-7 flex min-h-[340px]">
                      <WidgetErrorBoundary>
                        <DiscordWidget
                          className="w-full h-full"
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <DialogContent
          className="bg-background rounded-2xl p-0 sm:max-w-[980px] w-full border-border shadow-2xl overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <RefundClaimsPanel
            variant="dialog"
            walletAddress={walletAddress ?? undefined}
            onClaimSuccess={handleRefundClaimSuccess}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={isMigrationDialogOpen}
        onOpenChange={setIsMigrationDialogOpen}
      >
        <DialogContent
          className="bg-background rounded-2xl p-0 sm:max-w-sm w-full border-border shadow-2xl overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <MigrationClaimPanel
            walletAddress={walletAddress ?? undefined}
            migrationData={migrationData}
            isLoading={isMigrationLoading}
            isError={!!migrationError}
            onClaim={handleMigrationClaimSuccess}
          />
        </DialogContent>
      </Dialog>

      <MintAndStakeGctlDialog
        key={
          isMintAndStakeOpen ? "mint-and-stake-open" : "mint-and-stake-closed"
        }
        open={isMintAndStakeOpen}
        onOpenChange={(open) => {
          setIsMintAndStakeOpen(open);
          if (!open) setMintAndStakeForceStep1(false);
        }}
        usdcBalance={usdcBalance}
        usdgBalance={usdgBalance}
        forceStep1={mintAndStakeForceStep1}
      />

      {selectedApplicationForDeposit?._type === "miners" ? (
        <DepositDialog
          open={isDepositDialogOpen}
          onOpenChange={handleDepositOpenChange}
          application={selectedApplicationForDeposit}
          selectedCurrency="USDC"
          rewardScore={selectedRewardScore as MiningCenterScore | null}
        />
      ) : (
        <DepositDialog
          open={isDepositDialogOpen}
          onOpenChange={handleDepositOpenChange}
          application={selectedApplicationForDeposit}
          selectedCurrency="GLW"
          rewardScore={selectedRewardScore as LaunchpadRewardScore | null}
        />
      )}

      <BuyGlowDialog
        open={isBuyGlowDialogOpen}
        onOpenChange={setIsBuyGlowDialogOpen}
        usdcBalance={usdcBalance ?? null}
        glowSpotPrice={glwSpotPrice}
        source="bento"
        defaultUsdcAmount="20"
      />
    </div>
  );
}
