"use client";

import React from "react";
import { useAccount } from "wagmi";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits } from "viem";

import SolarFarmWidget from "./widgets/solar-farm-widget";
import NetWorthWidget from "./widgets/net-worth";
import PortfolioAllocationWidget from "./widgets/portfolio-allocation";
import RankWidget from "./widgets/rank-widget";
import RewardsWidget from "./widgets/rewards-widget";
import WeeklyActivityWidget from "./widgets/weekly-activity-widget";
import GctlHeatmapWidget from "./widgets/gctl-heatmap-widget";
import GlowFaqWidget from "./widgets/glow-faq-widget";
import QuickActionsWidget from "./widgets/quick-actions-widget";
import RecentActivityWidget from "./widgets/recent-activity-widget";
import OnboardingHeroWidget from "./widgets/onboarding-hero-widget";
import LaunchpadStatusWidget from "./widgets/launchpad-status-widget";
import GlobalLeaderboardWidget from "./widgets/global-leaderboard-widget";
import { MintAndStakeGctlDialog } from "@/components/dialogs/mint-and-stake-gctl-dialog";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import DiscordWidget from "./widgets/discord-widget";
import NewsletterWidget from "./widgets/newsletter-widget";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useRefundableFractions } from "@/hooks";
import { RefundClaimsPanel } from "@/app/wallet/refund-claims-panel";
import { useLaunchpadStatus } from "@/hooks/useLaunchpadStatus";
import { useGlowLaunchpad, useMiningCenter } from "@/hooks";
import { Skeleton } from "@/components/ui/skeleton";

interface GlowSoftDashboardProps {
  walletAddressOverride?: string | null;
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
        <Skeleton className="h-full w-full rounded-3xl bg-card dark:bg-muted/30" />
      </div>
      <div className="col-span-12 lg:col-span-4 min-h-0 lg:h-[330px]">
        <Skeleton className="h-full w-full rounded-3xl bg-card dark:bg-muted/30" />
      </div>
      <div className="col-span-12 lg:col-span-3 min-h-0 lg:h-[330px]">
        <Skeleton className="h-full w-full rounded-3xl bg-card dark:bg-muted/30" />
      </div>

      <div className="col-span-12 lg:col-span-5 min-h-0 lg:h-[380px]">
        <Skeleton className="h-full w-full rounded-3xl bg-card dark:bg-muted/30" />
      </div>
      <div className="col-span-12 lg:col-span-4 min-h-0 lg:h-[380px]">
        <Skeleton className="h-full w-full rounded-3xl bg-card dark:bg-muted/30" />
      </div>
      <div className="col-span-12 lg:col-span-3 min-h-0 lg:h-[380px]">
        <Skeleton className="h-full w-full rounded-3xl bg-card dark:bg-muted/30" />
      </div>

      <div className="col-span-12 lg:col-span-5 min-h-0 lg:h-[380px]">
        <Skeleton className="h-full w-full rounded-3xl bg-card dark:bg-muted/30" />
      </div>
      <div className="col-span-12 lg:col-span-7 min-h-0 lg:h-[380px]">
        <Skeleton className="h-full w-full rounded-3xl bg-card dark:bg-muted/30" />
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
  const isWalletSettling =
    !walletAddressOverride && !hasWallet && (isConnecting || isReconnecting);
  const { signer } = useEthersSigner();
  const { usdcBalance, usdgBalance } = useER20Balances({ signer });
  const [isMintAndStakeOpen, setIsMintAndStakeOpen] = React.useState(false);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = React.useState(false);
  const refundToastIdRef = React.useRef<string | number | null>(null);
  const queryClient = useQueryClient();

  const { isLive: isLaunchpadLive } = useLaunchpadStatus();
  const launchpadListingsEnabled = isConnected && isLaunchpadLive;
  const {
    applications: delegationApplications,
    isLoading: isDelegationsLoading,
  } = useGlowLaunchpad({
    filters: { paymentCurrency: "GLW" },
    enabled: launchpadListingsEnabled,
  });
  const { applications: minerApplications, isLoading: isMinersLoading } =
    useMiningCenter({
      filters: { paymentCurrency: "USDC" },
      enabled: launchpadListingsEnabled,
    });

  const hasLaunchpadListings = React.useMemo(() => {
    if (!launchpadListingsEnabled) return false;
    const delegationsAvailable = countAvailableApplications(
      delegationApplications
    );
    const minersAvailable = countAvailableApplications(minerApplications);
    return delegationsAvailable + minersAvailable > 0;
  }, [delegationApplications, launchpadListingsEnabled, minerApplications]);

  const shouldShowLaunchpadStatusRow =
    isConnected &&
    isLaunchpadLive &&
    (isDelegationsLoading || isMinersLoading || hasLaunchpadListings);

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

  return (
    <div className="min-h-screen bg-muted dark:bg-background text-foreground p-6 pt-4 selection:bg-[color:var(--color-glow-yellow)] selection:text-foreground">
      <div className="max-w-screen-2xl mx-auto">
        <AnimatePresence mode="wait" initial={false}>
          {hasWallet ? (
            <motion.div
              key="connected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-12 gap-4 grid-flow-row-dense [&:has(.solar-farm-next-batch-countdown)_.quick-actions-launchpad-next-batch-countdown]:hidden"
            >
              {shouldShowLaunchpadStatusRow ? (
                <div className="col-span-12 min-h-0">
                  <LaunchpadStatusWidget
                    variant="full-row"
                    className="w-full"
                  />
                </div>
              ) : null}
              <div className="col-span-12 lg:col-span-5 min-h-0 lg:h-[330px]">
                <NetWorthWidget walletAddress={walletAddress} />
              </div>
              <div className="col-span-12 lg:col-span-4 min-h-0 lg:h-[330px]">
                <PortfolioAllocationWidget walletAddress={walletAddress} />
              </div>
              <div className="col-span-12 lg:col-span-3 min-h-0 lg:h-[330px]">
                <RankWidget
                  walletAddress={walletAddress}
                  onMintAndStakeClick={() => setIsMintAndStakeOpen(true)}
                />
              </div>

              <div
                id="bento-solar-farm"
                className="col-span-12 lg:col-span-5 min-h-0 lg:h-[380px]"
              >
                <motion.div
                  key="solar-farm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="h-full min-h-0"
                >
                  <SolarFarmWidget walletAddress={walletAddress ?? undefined} />
                </motion.div>
              </div>

              <div className="col-span-12 lg:col-span-4 min-h-0 lg:h-[380px]">
                <QuickActionsWidget
                  walletAddress={walletAddress}
                  onMintAndStakeClick={() => setIsMintAndStakeOpen(true)}
                />
              </div>

              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key="rewards"
                  className="col-span-12 lg:col-span-3 min-h-0 lg:h-[380px]"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <RewardsWidget
                    walletAddress={walletAddress}
                    hideIfEmpty={false}
                  />
                </motion.div>
              </AnimatePresence>

              <AnimatePresence>
                <motion.div
                  key="gctl-heatmap"
                  className="col-span-12 lg:col-span-5 min-h-0 lg:h-[380px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <GctlHeatmapWidget
                    walletAddress={walletAddress}
                    onMintAndStakeClick={() => setIsMintAndStakeOpen(true)}
                  />
                </motion.div>
              </AnimatePresence>

              <div
                className={[
                  "col-span-12 lg:col-span-7 min-h-0 lg:h-[380px]",
                  "grid grid-cols-7 gap-4",
                  "[&:has(.activity-slot:not(:empty))_.faq-fallback]:hidden",
                ].join(" ")}
              >
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key="weekly-activity-bottom"
                    className="activity-slot col-span-7 lg:col-span-3 min-h-0 lg:h-[380px] empty:hidden"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <WeeklyActivityWidget walletAddress={walletAddress} />
                  </motion.div>
                </AnimatePresence>
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key="recent-activity"
                    className="activity-slot col-span-7 lg:col-span-4 min-h-0 lg:h-[380px] empty:hidden"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <RecentActivityWidget walletAddress={walletAddress} />
                  </motion.div>
                </AnimatePresence>

                <motion.div
                  key="faq-fallback"
                  className="faq-fallback col-span-7 min-h-0 lg:h-[380px]"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <GlowFaqWidget className="w-full h-full lg:max-h-[380px]" />
                </motion.div>
              </div>
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
              className="grid grid-cols-12 gap-4 grid-flow-row-dense"
            >
              <div className="col-span-12 lg:col-span-6 min-h-0 lg:h-[340px]">
                <OnboardingHeroWidget className="h-full" />
              </div>
              <div className="col-span-12 lg:col-span-6 min-h-0 lg:h-[340px]">
                <LaunchpadStatusWidget className="h-full" />
              </div>

              <div className="col-span-12 lg:col-span-8 min-h-0 lg:h-[400px]">
                <GlowFaqWidget className="w-full h-full" />
              </div>
              <div className="col-span-12 lg:col-span-4 min-h-0 lg:h-[400px]">
                <GlobalLeaderboardWidget className="h-full" />
              </div>
              <div className="col-span-12 lg:col-span-5 min-h-0 lg:h-[340px]">
                <NewsletterWidget className="w-full h-full" />
              </div>
              <div className="col-span-12 lg:col-span-7 min-h-0 lg:h-[340px]">
                <DiscordWidget className="w-full h-full" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <DialogContent
          className="bg-background rounded-3xl p-0 sm:max-w-[980px] w-full border-border shadow-2xl overflow-hidden"
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
        onOpenChange={setIsMintAndStakeOpen}
        usdcBalance={usdcBalance}
        usdgBalance={usdgBalance}
      />
    </div>
  );
}
