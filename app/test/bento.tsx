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
} from "@/hooks";
import { RefundClaimsPanel } from "@/app/wallet/refund-claims-panel";
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

interface GlowSoftDashboardProps {
  walletAddressOverride?: string | null;
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
  const { address: connectedAddress, isConnected } = useAccount();
  const walletAddress = walletAddressOverride ?? connectedAddress ?? null;
  const hasWallet = Boolean(walletAddress);
  const { isConnecting, isReconnecting } = useAccount();
  const { signer } = useEthersSigner();
  const { usdcBalance, usdgBalance } = useER20Balances({ signer });
  const [isMintAndStakeOpen, setIsMintAndStakeOpen] = React.useState(false);
  const [mintAndStakeForceStep1, setMintAndStakeForceStep1] =
    React.useState(false);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = React.useState(false);
  const [isDepositDialogOpen, setIsDepositDialogOpen] = React.useState(false);
  const [isBuyGlowDialogOpen, setIsBuyGlowDialogOpen] = React.useState(false);
  const [selectedApplicationForDeposit, setSelectedApplicationForDeposit] =
    React.useState<TaggedAuctionApplication | null>(null);
  const [selectedRewardScore, setSelectedRewardScore] = React.useState<
    LaunchpadRewardScore | MiningCenterScore | null
  >(null);
  const refundToastIdRef = React.useRef<string | number | null>(null);
  const didTrackViewRef = React.useRef(false);
  const queryClient = useQueryClient();
  const { spotPriceUsd: glwSpotPrice } = useGlowSpotPriceSummary();

  const hasAnyDialogOpen =
    isRefundDialogOpen ||
    isMintAndStakeOpen ||
    isDepositDialogOpen ||
    isBuyGlowDialogOpen;

  const isWalletSettling =
    !walletAddressOverride &&
    !hasWallet &&
    (isConnecting || isReconnecting) &&
    !hasAnyDialogOpen;

  React.useEffect(() => {
    if (didTrackViewRef.current) return;
    didTrackViewRef.current = true;
    trackEvent("dashboard_view", {
      source: "bento",
      wallet_connected: Boolean(walletAddress),
      wallet_address: walletAddress?.toLowerCase() ?? null,
    });
  }, [walletAddress]);

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

  React.useEffect(() => {
    const existingToastId = refundToastIdRef.current;

    if (!hasRefunds) {
      if (existingToastId != null) toast.dismiss(existingToastId);
      refundToastIdRef.current = null;
      setIsRefundDialogOpen(false);
      return;
    }

    if (existingToastId != null) return;

    const toastId = toast("You have refunds available", {
      description: `${summary.totalRefundableFractions} listings · ${formatGlw(
        summary.totalRefundableAmount
      )} GLW`,
      duration: Infinity,
      dismissible: false,
      closeButton: false,
      action: {
        label: "Claim refunds",
        onClick: () => setIsRefundDialogOpen(true),
      },
    });

    refundToastIdRef.current = toastId;

    return () => {
      toast.dismiss(toastId);
    };
  }, [
    hasRefunds,
    summary.totalRefundableAmount,
    summary.totalRefundableFractions,
  ]);

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
        wallet_address: walletAddress?.toLowerCase() ?? null,
        application_id: application.id,
        listing_type: application._type,
        payment_currency: application._type === "miners" ? "USDC" : "GLW",
      });
      setSelectedApplicationForDeposit(application);
      setSelectedRewardScore(scoreData ?? null);
      setIsDepositDialogOpen(true);
    },
    [isConnected, walletAddress]
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
      wallet_address: walletAddress?.toLowerCase() ?? null,
    });
    setIsBuyGlowDialogOpen(true);
  }, [isConnected, walletAddress]);

  return (
    <div className="min-h-screen bg-muted dark:bg-background text-foreground p-6  selection:bg-[color:var(--color-glow-yellow)] selection:text-foreground">
      <div className="max-w-screen-2xl mx-auto">
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
              {/* Dashboard Header Band */}
              <section className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-4 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-stretch">
                  <div className="lg:col-span-3 flex">
                    <RankWidget
                      walletAddress={walletAddress}
                      variant="hero"
                      onMintAndStakeClick={(forceStep1) => {
                        setMintAndStakeForceStep1(Boolean(forceStep1));
                        setIsMintAndStakeOpen(true);
                      }}
                    />
                  </div>

                  <div className="lg:col-span-5 flex">
                    <NetWorthWidget
                      walletAddress={walletAddress}
                      variant="minimal"
                      onBuyGlowClick={handleBuyGlowClick}
                    />
                  </div>

                  <div className="lg:col-span-2 flex">
                    <WalletWidget
                      walletAddress={walletAddress}
                      variant="minimal"
                    />
                  </div>
                </div>
              </section>

              {/* Launchpad Live Section */}
              {shouldShowLaunchpadLiveSection && (
                <section className="flex flex-col gap-4">
                  <SectionHeader title="Launchpad Live" />
                  <LaunchpadStatusWidget
                    variant="full-row"
                    onPayDeposit={handlePayDeposit}
                  />
                </section>
              )}

              {/* Mining & Rewards Section */}
              <section className="flex flex-col gap-4">
                <SectionHeader title="Mining & Rewards" />
                <div className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/50 items-stretch">
                    <div
                      id="bento-solar-farm"
                      className="pb-6 lg:pb-0 lg:pr-8 lg:col-span-2 flex min-h-[320px]"
                    >
                      <SolarFarmWidget
                        walletAddress={walletAddress ?? undefined}
                        variant="minimal"
                      />
                    </div>
                    <div className="pt-6 lg:pt-0 lg:pl-8 flex">
                      <RewardsWidget
                        walletAddress={walletAddress}
                        hideIfEmpty={false}
                        variant="minimal"
                      />
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
                      <LaunchpadStatusWidget
                        variant="minimal"
                        onPayDeposit={handlePayDeposit}
                      />
                    </div>
                    <div className="pt-6 lg:pt-0 lg:pl-8 flex">
                      <GctlHeatmapWidget
                        walletAddress={walletAddress}
                        variant="minimal"
                        onMintAndStakeClick={() => {
                          setMintAndStakeForceStep1(false);
                          setIsMintAndStakeOpen(true);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Journey Section */}
              <section className="flex flex-col gap-4 pt-12">
                <SectionHeader title="Your Journey" />
                <div className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/50 items-stretch pb-8 mb-8 border-b border-border/50">
                    <div className="pb-6 lg:pb-0 lg:pr-8 flex lg:col-span-1">
                      <WeeklyActivityWidget
                        walletAddress={walletAddress}
                        hideIfEmpty={false}
                        variant="minimal"
                      />
                    </div>

                    <div className="pt-6 lg:pt-0 lg:pl-8 flex lg:col-span-2">
                      <RecentActivityWidget
                        walletAddress={walletAddress}
                        hideIfEmpty={false}
                        variant="minimal"
                      />
                    </div>
                    <div className="py-6 lg:py-0 lg:px-8 flex lg:col-span-1">
                      <PortfolioSummaryWidget
                        walletAddress={walletAddress}
                        variant="minimal"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-6">
                      My Farms
                    </h3>
                    <MyFarmsGridSection walletAddress={walletAddress} />
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
              {/* Hero Section */}
              <section className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-0  items-stretch">
                  <div className="pb-6 lg:pb-0 lg:pr-8 flex min-h-[340px]">
                    <OnboardingHeroWidget
                      className="w-full h-full"
                      variant="minimal"
                      onBuyGlowClick={handleBuyGlowClick}
                    />
                  </div>
                  <div className="pt-6 lg:pt-0 lg:pl-8 flex min-h-[340px]">
                    <LaunchpadStatusWidget
                      className="w-full h-full"
                      variant="minimal"
                      onPayDeposit={handlePayDeposit}
                    />
                  </div>
                </div>
              </section>

              {/* Launchpad Live Section */}
              {shouldShowLaunchpadLiveSection && (
                <section className="flex flex-col gap-4">
                  <SectionHeader title="Launchpad Live" />
                  <LaunchpadStatusWidget
                    variant="full-row"
                    onPayDeposit={handlePayDeposit}
                  />
                </section>
              )}

              {/* Community & Leaderboard Section */}
              <section className="flex flex-col gap-4">
                <SectionHeader title="Community & Leaderboard" />
                <div className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/50 items-stretch">
                    <div className="pb-6 lg:pb-0 lg:pr-8 lg:col-span-8 flex min-h-[400px]">
                      <CommunityActivityWidget
                        className="w-full h-full"
                        variant="minimal"
                      />
                    </div>
                    <div className="pt-6 lg:pt-0 lg:pl-8 lg:col-span-4 flex min-h-[400px]">
                      <GlobalLeaderboardWidget
                        className="h-full w-full"
                        variant="minimal"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Protocol Metrics Section */}
              <section className="flex flex-col gap-4">
                <SectionHeader title="Protocol Metrics" />
                <div className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                  <ProtocolMetricsWidget />
                </div>
              </section>

              {/* Education Section */}
              <section className="flex flex-col gap-4">
                <SectionHeader title="Education" />
                <div className="rounded-2xl bg-card dark:bg-muted/20 border border-border/50 p-6 lg:p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/50 items-stretch">
                    <div className="pb-6 lg:pb-0 lg:pr-8 lg:col-span-7 flex min-h-[400px]">
                      <GlowFaqWidget
                        className="w-full h-full"
                        variant="minimal"
                      />
                    </div>
                    <div className="pt-6 lg:pt-0 lg:pl-8 lg:col-span-5 flex min-h-[400px]">
                      <BlogFeaturedWidget className="w-full h-full" />
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
                      <NewsletterWidget
                        className="w-full h-full"
                        variant="minimal"
                      />
                    </div>
                    <div className="pt-6 lg:pt-0 lg:pl-8 lg:col-span-7 flex min-h-[340px]">
                      <DiscordWidget
                        className="w-full h-full"
                        variant="minimal"
                      />
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
        defaultUsdcAmount="20"
      />
    </div>
  );
}
