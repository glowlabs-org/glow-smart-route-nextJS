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
import GlowFaqWidget from "./widgets/glow-faq-widget";
import CommunityActivityWidget from "./widgets/community-activity-widget";
import BlogFeaturedWidget from "./widgets/blog-featured-widget";
import OnboardingHeroWidget from "./widgets/onboarding-hero-widget";
import LaunchpadStatusWidget from "./widgets/launchpad-status-widget";
import GlobalLeaderboardWidget from "./widgets/global-leaderboard-widget";
import MyFarmsGridSection from "./widgets/my-farms-grid-section";
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
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { getLaunchpadNowMs } from "@/utils/launchpad-now";
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
import { ActivationCelebrationModal } from "@/components/referral/activation-celebration-modal";
import { useReferralLaunch } from "@/hooks/use-referral-launch";
import { useEnsNames } from "@/hooks/useEnsNames";
import { shortAddress } from "@/utils/impact";
import { GlowSymbolAnimated } from "@/components/glow-symbol-animated";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

interface GlowSoftDashboardProps {
  walletAddressOverride?: string | null;
}

const WALLET_SETTLING_TIMEOUT_MS = 8_000;

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
    getServerSnapshot,
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
      {title}
    </h2>
  );
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getDeferredAnalyticsDelayMs(params: {
  walletAddress: string | null;
  salt: string;
  baseMs: number;
  spreadMs: number;
}) {
  const { walletAddress, salt, baseMs, spreadMs } = params;
  const digest = hashString(`${walletAddress ?? "anon"}:${salt}`);
  return baseMs + (spreadMs > 0 ? digest % spreadMs : 0);
}

function DeferredAnalyticsCard(props: {
  title: string;
  description: string;
  className?: string;
}) {
  const { title, description, className } = props;

  return (
    <div
      className={cn(
        "w-full h-full rounded-2xl border border-border/10 dark:border-white/10 bg-muted/20 dark:bg-zinc-800 p-6 flex flex-col justify-between",
        className,
      )}
    >
      <div className="space-y-2">
        <div className="text-sm md:text-lg font-semibold tracking-tight text-foreground">
          {title}
        </div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 max-w-sm">
          {description}
        </p>
      </div>
      <div className="space-y-3">
        <div className="h-10 rounded-xl bg-muted/70" />
        <div className="h-20 rounded-xl bg-muted/50" />
      </div>
    </div>
  );
}

function DeferredLaunchWindowAnalytics(props: {
  enabled: boolean;
  delayMs: number;
  fallback: React.ReactNode;
  children: React.ReactNode;
}) {
  const { enabled, delayMs, fallback, children } = props;
  const [isReady, setIsReady] = React.useState(!enabled);

  React.useEffect(() => {
    if (!enabled) {
      setIsReady(true);
      return;
    }

    setIsReady(false);
    const timeoutId = window.setTimeout(() => {
      setIsReady(true);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs, enabled]);

  return isReady ? <>{children}</> : <>{fallback}</>;
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
  }>,
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
  const { t } = useLang();
  return (
    <div className="min-h-[70vh] bg-background flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
        {t.home.connecting.kicker}
      </div>

      <GlowSymbolAnimated className="h-24 w-24 text-foreground" />

      <h2 className="text-4xl lg:text-5xl font-semibold tracking-tight text-foreground">
        {t.home.connecting.title}
      </h2>

      <p className="max-w-xl text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
        {t.home.connecting.description}
      </p>
    </div>
  );
}

export default function GlowSoftDashboard({
  walletAddressOverride,
}: GlowSoftDashboardProps) {
  const { t } = useLang();
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();
  const walletAddress = walletAddressOverride ?? connectedAddress ?? null;
  const hasWallet = Boolean(walletAddress);
  const isOwnWallet =
    !walletAddressOverride ||
    (Boolean(connectedAddress) &&
      walletAddressOverride.toLowerCase() === connectedAddress!.toLowerCase());
  const readOnly = !isOwnWallet;

  const { ensNames } = useEnsNames({
    addresses: walletAddress ? [walletAddress] : [],
    enabled: readOnly && Boolean(walletAddress),
  });
  const profileDisplayName = React.useMemo(() => {
    if (!walletAddress) return null;
    const ens = ensNames[walletAddress];
    return ens || shortAddress(walletAddress);
  }, [walletAddress, ensNames]);

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
  const [dashboardRefreshNonce, setDashboardRefreshNonce] = React.useState(0);
  const refundToastIdRef = React.useRef<string | number | null>(null);
  const migrationToastIdRef = React.useRef<string | number | null>(null);
  const prevHasMigrationClaimRef = React.useRef<boolean | null>(null);
  const trackedWalletsRef = React.useRef(new Set<string | null>());
  const prevHasRefundsRef = React.useRef<boolean | null>(null);
  const queryClient = useQueryClient();
  const { spotPriceUsd: glwSpotPrice } = useGlowSpotPriceSummary();
  const { isLive: isReferralLive } = useReferralLaunch();

  const refreshDashboardWidgets = React.useCallback(() => {
    setDashboardRefreshNonce((value) => value + 1);
  }, []);

  const hasAnyDialogOpen =
    isRefundDialogOpen ||
    isMigrationDialogOpen ||
    isMintAndStakeOpen ||
    isDepositDialogOpen ||
    isBuyGlowDialogOpen;

  const isClient = useIsClient();
  const [hasWalletSettlingTimedOut, setHasWalletSettlingTimedOut] =
    React.useState(false);
  const isWalletSettlingRaw =
    isClient &&
    !walletAddressOverride &&
    !hasWallet &&
    isConnecting &&
    !hasAnyDialogOpen;
  const isWalletSettling = isWalletSettlingRaw && !hasWalletSettlingTimedOut;

  React.useEffect(() => {
    if (!isWalletSettlingRaw) {
      setHasWalletSettlingTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHasWalletSettlingTimedOut(true);
    }, WALLET_SETTLING_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isWalletSettlingRaw]);

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
    filters: {},
    enabled: isLaunchpadLive,
  });
  const { applications: minerApplications, isLoading: minersLoading } =
    useMiningCenter({
      filters: { paymentCurrency: "USDC" },
      enabled: isLaunchpadLive,
    });

  const shouldShowLaunchpadLiveSection = React.useMemo(() => {
    if (!isLaunchpadLive) return false;
    const delegationsCount = countAvailableApplications(delegationApplications);
    const minersCount = countAvailableApplications(minerApplications);
    return delegationsCount > 0 || minersCount > 0;
  }, [isLaunchpadLive, delegationApplications, minerApplications]);

  const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
  const isApproachingLaunchpad = React.useMemo(() => {
    if (isLaunchpadLive) return false;
    const now = getLaunchpadNowMs();
    const timeUntilLive = launchpadNextBatchAtMs - now;
    return timeUntilLive > 0 && timeUntilLive <= THREE_HOURS_MS;
  }, [THREE_HOURS_MS, isLaunchpadLive, launchpadNextBatchAtMs]);

  const shouldShowLaunchpadHeroRow =
    shouldShowLaunchpadLiveSection || isApproachingLaunchpad;
  const shouldDeferHeavyAnalytics =
    hasWallet && (isLaunchpadLive || isApproachingLaunchpad);

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
    includeWalletDetails: false,
    includeMintedEvents: false,
    includeStakeEvents: false,
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
  if (
    !readOnly &&
    prevHasMigrationClaimRef.current !== hasPendingMigrationClaim
  ) {
    prevHasMigrationClaimRef.current = hasPendingMigrationClaim;

    if (!hasPendingMigrationClaim) {
      if (migrationToastIdRef.current != null) {
        toast.dismiss(migrationToastIdRef.current);
        migrationToastIdRef.current = null;
      }
      if (isMigrationDialogOpen) setIsMigrationDialogOpen(false);
    } else if (migrationToastIdRef.current == null) {
      const formattedAmount = formatGctl(migrationData?.migrationAmount || "0");
      migrationToastIdRef.current = toast(t.home.toasts.migrationTitle, {
        description: t.home.toasts.migrationDescription(formattedAmount),
        duration: Infinity,
        dismissible: false,
        closeButton: false,
        action: {
          label: t.home.toasts.migrationAction,
          onClick: () => setIsMigrationDialogOpen(true),
        },
      });
    }
  }

  if (!readOnly && prevHasRefundsRef.current !== hasRefunds) {
    prevHasRefundsRef.current = hasRefunds;
    const existingToastId = refundToastIdRef.current;

    if (!hasRefunds) {
      if (existingToastId != null) toast.dismiss(existingToastId);
      refundToastIdRef.current = null;
      if (isRefundDialogOpen) setIsRefundDialogOpen(false);
    } else if (existingToastId == null) {
      const toastId = toast(t.home.toasts.refundsTitle, {
        description: t.home.toasts.refundsDescription(
          summary.totalRefundableFractions,
          formatGlw(summary.totalRefundableAmount),
        ),
        duration: Infinity,
        dismissible: false,
        closeButton: false,
        action: {
          label: t.home.toasts.refundsAction,
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
      scoreData?: LaunchpadRewardScore | MiningCenterScore | null,
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
    [isConnected, normalizedWalletAddress],
  );

  const handleDepositOpenChange = React.useCallback((nextOpen: boolean) => {
    setIsDepositDialogOpen(nextOpen);
    if (nextOpen) return;
    setSelectedApplicationForDeposit(null);
    setSelectedRewardScore(null);
  }, []);

  // "Earn points" deep-link (?earn=1) from the What's New modal: open the
  // fastest earning path. If the launchpad is live with miners available,
  // open the deposit dialog on the cheapest one; otherwise mint & stake.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const earnIntent = searchParams.get("earn") === "1";
  const earnHandledRef = React.useRef(false);
  React.useEffect(() => {
    if (!earnIntent) {
      earnHandledRef.current = false;
      return;
    }
    if (earnHandledRef.current) return;
    if (!isLaunchpadLive) {
      earnHandledRef.current = true;
      setIsMintAndStakeOpen(true);
      router.replace(pathname);
      return;
    }
    if (minersLoading) return;
    const priceOf = (a: {
      activeFraction?: { stepPrice?: string | null } | null;
    }) => {
      const v = Number(a.activeFraction?.stepPrice);
      return Number.isFinite(v) ? v : Infinity;
    };
    const available = minerApplications.filter((a) => {
      const f = a.activeFraction;
      return Boolean(f && !f.isFilled && (f.remainingSteps ?? 0) > 0);
    });
    earnHandledRef.current = true;
    if (available.length > 0) {
      const cheapest = available.reduce((min, a) =>
        priceOf(a) < priceOf(min) ? a : min,
      );
      handlePayDeposit({
        ...cheapest,
        _type: "miners",
      } as TaggedAuctionApplication);
    } else {
      setIsMintAndStakeOpen(true);
    }
    router.replace(pathname);
  }, [
    earnIntent,
    isLaunchpadLive,
    minersLoading,
    minerApplications,
    handlePayDeposit,
    router,
    pathname,
  ]);

  const handleBuyGlowClick = React.useCallback(() => {
    trackEvent("dashboard_buy_glw_click", {
      source: "bento",
      wallet_connected: isConnected,
      wallet_address: normalizedWalletAddress,
    });
    setIsBuyGlowDialogOpen(true);
  }, [isConnected, normalizedWalletAddress]);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-[color:var(--color-glow-yellow)] selection:text-foreground">
      {isReferralLive ? <ActivationCelebrationModal /> : null}
      <div className="max-w-screen-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
        <AnimatePresence mode="wait" initial={false}>
          {hasWallet ? (
            <motion.div
              key="connected"
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-8"
            >
              {/* Launchpad row — always shown for owners; falls back to the
                  countdown variant when there are no live listings. */}
              {!readOnly && (
                <section className="flex flex-col gap-8">
                  <SectionHeader
                    title={
                      shouldShowLaunchpadLiveSection
                        ? t.home.sections.launchpadLive
                        : isApproachingLaunchpad
                          ? t.home.sections.launchpadOpeningSoon
                          : t.home.sections.growYourImpact
                    }
                  />
                  <div className="rounded-3xl bg-card dark:bg-card border border-border/20 dark:border-white/10 p-4 sm:p-6 lg:p-12">
                    <LaunchpadStatusWidget
                      variant="full-row"
                      onPayDeposit={handlePayDeposit}
                      isApproaching={isApproachingLaunchpad}
                    />
                  </div>
                </section>
              )}

              {/* Dashboard Overview */}
              <section className="flex flex-col gap-8">
                <SectionHeader
                  title={
                    readOnly && profileDisplayName
                      ? t.home.sections.readOnlyDashboard(profileDisplayName)
                      : t.home.sections.overview
                  }
                />
                <div className="rounded-3xl bg-card dark:bg-card border border-border/20 dark:border-white/10 p-4 sm:p-6 lg:p-12">
                  <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-stretch">
                    <div className="lg:col-span-3 flex">
                      <DeferredLaunchWindowAnalytics
                        enabled={shouldDeferHeavyAnalytics}
                        delayMs={getDeferredAnalyticsDelayMs({
                          walletAddress,
                          salt: "rank-widget",
                          baseMs: 4_000,
                          spreadMs: 8_000,
                        })}
                        fallback={
                          <DeferredAnalyticsCard
                            title={t.home.deferred.impactScore.title}
                            description={t.home.deferred.impactScore.description}
                          />
                        }
                      >
                        <WidgetErrorBoundary>
                          <RankWidget
                            walletAddress={walletAddress}
                            variant="hero"
                            readOnly={readOnly}
                            onMintAndStakeClick={
                              readOnly
                                ? undefined
                                : (forceStep1) => {
                                    setMintAndStakeForceStep1(
                                      Boolean(forceStep1),
                                    );
                                    setIsMintAndStakeOpen(true);
                                  }
                            }
                          />
                        </WidgetErrorBoundary>
                      </DeferredLaunchWindowAnalytics>
                    </div>

                    <div
                      className={
                        readOnly ? "lg:col-span-7 flex" : "lg:col-span-5 flex"
                      }
                    >
                      <DeferredLaunchWindowAnalytics
                        enabled={shouldDeferHeavyAnalytics}
                        delayMs={getDeferredAnalyticsDelayMs({
                          walletAddress,
                          salt: "net-worth-widget",
                          baseMs: 6_000,
                          spreadMs: 10_000,
                        })}
                        fallback={
                          <DeferredAnalyticsCard
                            title={t.home.deferred.glowWorth.title}
                            description={t.home.deferred.glowWorth.description}
                          />
                        }
                      >
                        <WidgetErrorBoundary>
                          <NetWorthWidget
                            walletAddress={walletAddress}
                            variant="minimal"
                            onBuyGlowClick={
                              readOnly ? undefined : handleBuyGlowClick
                            }
                          />
                        </WidgetErrorBoundary>
                      </DeferredLaunchWindowAnalytics>
                    </div>

                    {!readOnly && (
                      <div className="lg:col-span-2 flex">
                        <WidgetErrorBoundary>
                          <WalletWidget
                            walletAddress={walletAddress}
                            variant="minimal"
                          />
                        </WidgetErrorBoundary>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* My Impact Section */}
              <section className="flex flex-col gap-8 pt-20">
                <SectionHeader title={t.home.sections.myImpact} />
                <div className="rounded-3xl bg-card dark:bg-card border border-border/20 dark:border-white/10 p-4 sm:p-6 lg:p-12">
                  <WidgetErrorBoundary>
                    <SolarCollectorWidget
                      walletAddress={walletAddress}
                      readOnly={readOnly}
                      onMintAndStakeClick={
                        readOnly ? undefined : () => setIsMintAndStakeOpen(true)
                      }
                      onFarmClick={(farmId) => {
                        // Scroll to the farm card in the grid below
                        const el = document.querySelector(
                          `[data-farm-id="${farmId}"]`,
                        );
                        if (el) {
                          el.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                          el.classList.add("ring-2", "ring-primary");
                          setTimeout(
                            () => el.classList.remove("ring-2", "ring-primary"),
                            2000,
                          );
                        }
                      }}
                    />
                  </WidgetErrorBoundary>
                </div>
              </section>

              {/* Mining & Rewards Section */}
              <section className="flex flex-col gap-8 pt-20">
                <SectionHeader title={t.home.sections.miningAndRewards} />
                <div className="rounded-3xl bg-card dark:bg-card border border-border/20 dark:border-white/10 p-4 sm:p-6 lg:p-12">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/20 dark:divide-white/10 items-stretch">
                    <div
                      id="bento-solar-farm"
                      className="pb-8 lg:pb-0 lg:pr-10 lg:col-span-2 flex min-h-[320px]"
                    >
                      <WidgetErrorBoundary>
                        <SolarFarmWidget
                          key={`solar-farm-${walletAddress ?? "anon"}-${dashboardRefreshNonce}`}
                          walletAddress={walletAddress ?? undefined}
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                    <div className="pt-8 lg:pt-0 lg:pl-10 flex">
                      <DeferredLaunchWindowAnalytics
                        enabled={shouldDeferHeavyAnalytics}
                        delayMs={getDeferredAnalyticsDelayMs({
                          walletAddress,
                          salt: "rewards-widget",
                          baseMs: 8_000,
                          spreadMs: 10_000,
                        })}
                        fallback={
                          <DeferredAnalyticsCard
                            title={t.home.deferred.rewards.title}
                            description={t.home.deferred.rewards.description}
                          />
                        }
                      >
                        <WidgetErrorBoundary>
                          <RewardsWidget
                            walletAddress={walletAddress}
                            hideIfEmpty={false}
                            variant="minimal"
                            readOnly={readOnly}
                          />
                        </WidgetErrorBoundary>
                      </DeferredLaunchWindowAnalytics>
                    </div>
                  </div>
                </div>
              </section>

              {/* My Farms Section */}
              <section className="flex flex-col gap-8 pt-20 pb-20">
                <SectionHeader title={t.home.sections.myFarms} />
                <div className="rounded-3xl bg-card dark:bg-card border border-border/20 dark:border-white/10 p-4 sm:p-6 lg:p-12">
                  <WidgetErrorBoundary>
                    <MyFarmsGridSection
                      key={`my-farms-${walletAddress ?? "anon"}-${dashboardRefreshNonce}`}
                      walletAddress={walletAddress}
                    />
                  </WidgetErrorBoundary>
                </div>
              </section>
            </motion.div>
          ) : isWalletSettling ? (
            <motion.div
              key="connecting"
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <DashboardConnectingSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key="disconnected"
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-16"
            >
              {/* Launchpad Live/Approaching Section - First Row */}
              {shouldShowLaunchpadHeroRow && (
                <section className="flex flex-col gap-8">
                  <SectionHeader
                    title={
                      isApproachingLaunchpad
                        ? t.home.sections.launchpadOpeningSoon
                        : t.home.sections.launchpadLive
                    }
                  />
                  <div className="rounded-3xl bg-card dark:bg-card border border-border/20 dark:border-white/10 p-4 sm:p-6 lg:p-12">
                    <LaunchpadStatusWidget
                      variant="full-row"
                      onPayDeposit={handlePayDeposit}
                      isApproaching={isApproachingLaunchpad}
                    />
                  </div>
                </section>
              )}

              {/* Hero Section */}
              <section className="flex flex-col gap-8">
                <SectionHeader title={t.home.sections.getStarted} />
                <div className="rounded-3xl bg-card dark:bg-card border border-border/20 dark:border-white/10 p-4 sm:p-6 lg:p-12">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-0 items-stretch">
                    <div className="pb-8 lg:pb-0 lg:pr-10 flex min-h-[340px]">
                      <WidgetErrorBoundary>
                        <OnboardingHeroWidget
                          className="w-full h-full"
                          variant="minimal"
                          onBuyGlowClick={handleBuyGlowClick}
                        />
                      </WidgetErrorBoundary>
                    </div>
                    <div className="pt-8 lg:pt-0 lg:pl-10 flex min-h-[340px]">
                      <WidgetErrorBoundary>
                        <LaunchpadStatusWidget
                          key={`launchpad-status-disconnected-${dashboardRefreshNonce}`}
                          className="w-full h-full"
                          variant="minimal"
                          onPayDeposit={handlePayDeposit}
                          isApproaching={isApproachingLaunchpad}
                        />
                      </WidgetErrorBoundary>
                    </div>
                  </div>
                </div>
              </section>

              {/* Community & Leaderboard Section */}
              <section className="flex flex-col gap-8">
                <SectionHeader title={t.home.sections.communityAndLeaderboard} />
                <div className="rounded-3xl bg-card dark:bg-card border border-border/20 dark:border-white/10 p-4 sm:p-6 lg:p-12">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/20 dark:divide-white/10 items-stretch">
                    <div className="pb-8 lg:pb-0 lg:pr-10 lg:col-span-8 flex min-h-[400px]">
                      <WidgetErrorBoundary>
                        <CommunityActivityWidget
                          className="w-full h-full"
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                    <div className="pt-8 lg:pt-0 lg:pl-10 lg:col-span-4 flex min-h-[400px]">
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
              <section className="flex flex-col gap-8">
                <SectionHeader title={t.home.sections.protocolMetrics} />
                <div className="rounded-3xl bg-card dark:bg-card border border-border/20 dark:border-white/10 p-4 sm:p-6 lg:p-12">
                  <WidgetErrorBoundary>
                    <ProtocolMetricsWidget />
                  </WidgetErrorBoundary>
                </div>
              </section>

              {/* Education Section */}
              <section className="flex flex-col gap-8">
                <SectionHeader title={t.home.sections.education} />
                <div className="rounded-3xl bg-card dark:bg-card border border-border/20 dark:border-white/10 p-4 sm:p-6 lg:p-12">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/20 dark:divide-white/10 items-stretch">
                    <div className="pb-8 lg:pb-0 lg:pr-10 lg:col-span-7 flex min-h-[400px]">
                      <WidgetErrorBoundary>
                        <GlowFaqWidget
                          className="w-full h-full"
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                    <div className="pt-8 lg:pt-0 lg:pl-10 lg:col-span-5 flex min-h-[400px]">
                      <WidgetErrorBoundary>
                        <BlogFeaturedWidget className="w-full h-full" />
                      </WidgetErrorBoundary>
                    </div>
                  </div>
                </div>
              </section>

              {/* Stay Connected Section */}
              <section className="flex flex-col gap-8">
                <SectionHeader title={t.home.sections.stayConnected} />
                <div className="rounded-3xl bg-card dark:bg-card border border-border/20 dark:border-white/10 p-4 sm:p-6 lg:p-12">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/20 dark:divide-white/10 items-stretch">
                    <div className="pb-8 lg:pb-0 lg:pr-10 lg:col-span-5 flex min-h-[340px]">
                      <WidgetErrorBoundary>
                        <NewsletterWidget
                          className="w-full h-full"
                          variant="minimal"
                        />
                      </WidgetErrorBoundary>
                    </div>
                    <div className="pt-8 lg:pt-0 lg:pl-10 lg:col-span-7 flex min-h-[340px]">
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

      {!readOnly && (
        <>
          <Dialog
            open={isRefundDialogOpen}
            onOpenChange={setIsRefundDialogOpen}
          >
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
              isMintAndStakeOpen
                ? "mint-and-stake-open"
                : "mint-and-stake-closed"
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
              onSuccess={refreshDashboardWidgets}
            />
          ) : (
            <DepositDialog
              open={isDepositDialogOpen}
              onOpenChange={handleDepositOpenChange}
              application={selectedApplicationForDeposit}
              selectedCurrency="GLW"
              rewardScore={selectedRewardScore as LaunchpadRewardScore | null}
              onSuccess={refreshDashboardWidgets}
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
        </>
      )}
    </div>
  );
}
