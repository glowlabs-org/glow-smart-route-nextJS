"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useDisconnect } from "wagmi";
import { hubGet } from "@/lib/api/hub-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Copy, Check, Users, ExternalLink } from "lucide-react";
import Image from "next/image";
import { ConnectButton } from "@/components/connect-button";
import { useReferral } from "@/hooks/use-referral";
import { trackEvent } from "@/lib/telemetry";
import { GlowLockup } from "@/components/glow-lockup";
import { GlowSymbol } from "@/components/glow-symbol";
import { motion, AnimatePresence } from "framer-motion";
import { useReferralLaunch } from "@/hooks/use-referral-launch";
import { REFERRAL_LAUNCH_LABEL } from "@/lib/referral-launch";
import { parseReferralError } from "@/lib/referral-errors";
import { toast } from "sonner";
import { storeReferralAttribution } from "@/lib/referral-attribution";
import { LANG_STORAGE_KEY, useLang } from "@/lib/i18n";
import { LangToggle } from "@/components/lang-toggle";

// KR-audience KOLs whose referral landing should default to Korean for fresh
// visitors. Codes are the live referralCodes.code values, not the KOL's name.
//   pkbu9m2k   -> Eungo    (0xd7f5...ecec9)
//   mr.sunshine -> Joshiker (0x8f2c...bb93)
const KR_DEFAULT_REFERRAL_CODES = new Set(["pkbu9m2k", "mr.sunshine"]);

interface ValidateCodeResponse {
  valid: boolean;
  referralCode?: string;
  referrerWallet?: string;
  referrerEns?: string;
  message?: string;
}

interface ReferralCodeResponse {
  code: string;
  shareableLink: string;
}

function formatReferralDisplayName(referralCode?: string) {
  if (!referralCode) return null;
  if (/^[a-z]+$/.test(referralCode)) {
    return `${referralCode.slice(0, 1).toUpperCase()}${referralCode.slice(1)}`;
  }
  return referralCode;
}

const landingPanelClassName =
  "order-2 lg:order-1 lg:flex-1 flex flex-col justify-between px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-6 lg:p-16 lg:min-h-screen";

const heroPanelClassName =
  "order-1 lg:order-2 h-[36svh] min-h-[280px] sm:h-[42svh] lg:h-auto lg:flex-1 p-3 sm:p-4 lg:p-8 lg:min-h-screen";

export default function ReferralLandingPage() {
  const { t, setLang } = useLang();
  const r = t.referralLanding;
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  React.useEffect(() => {
    if (typeof window === "undefined" || !code) return;
    if (window.localStorage.getItem(LANG_STORAGE_KEY)) return;
    if (KR_DEFAULT_REFERRAL_CODES.has(code.toLowerCase())) {
      setLang("ko");
    }
  }, [code, setLang]);
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const {
    status,
    linkReferrer,
    isLinking,
    changeReferrer,
    isChanging,
    isLoadingStatus,
    isAutoLinking,
    autoLinkSucceeded,
  } = useReferral();
  const { isLive: isReferralLive } = useReferralLaunch();
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isChangeSuccess, setIsChangeSuccess] = React.useState(false);
  const [isOwnLinkCopied, setIsOwnLinkCopied] = React.useState(false);
  const handleConnectClick = React.useCallback(() => {
    if (isConnected) return;
    trackEvent("referral_connect_wallet_click", {
      code,
    });
  }, [code, isConnected]);
  const handleConnectSuccess = React.useCallback(() => {
    trackEvent("referral_connect_wallet_success", {
      code,
      wallet: address ?? null,
    });
  }, [code, address]);

  const handleGoToDashboard = React.useCallback(
    (source: "success" | "already_linked" | "launch_soon") => {
      trackEvent("referral_go_to_dashboard_click", {
        code,
        wallet: address ?? null,
        source,
      });
      router.push(source === "launch_soon" ? "/test" : "/");
    },
    [code, address, router]
  );

  // Fetch user's own referral code after successful link
  const ownCodeQuery = useQuery({
    queryKey: ["referral-code", address],
    queryFn: () =>
      hubGet<ReferralCodeResponse>("/referral/code", {
        params: { walletAddress: address },
      }),
    enabled: isReferralLive && isSuccess && !!address,
  });

  const copyOwnLink = React.useCallback(() => {
    if (!ownCodeQuery.data?.shareableLink) return;
    navigator.clipboard.writeText(ownCodeQuery.data.shareableLink);
    setIsOwnLinkCopied(true);
    toast.success(r.toastReferralLinkCopied);
    trackEvent("referral_success_copy_own_link", {
      code,
      wallet: address,
      own_code: ownCodeQuery.data.code,
    });
    setTimeout(() => setIsOwnLinkCopied(false), 2000);
  }, [ownCodeQuery.data, code, address, r.toastReferralLinkCopied]);

  const validateQuery = useQuery({
    queryKey: ["validate-referral-code", code],
    queryFn: () => hubGet<ValidateCodeResponse>(`/referral/validate/${code}`),
    enabled: !!code && isReferralLive,
  });

  const isValid = validateQuery.data?.valid;
  const hasValidationError = validateQuery.isError && !validateQuery.data;
  const isValidationLoading =
    validateQuery.isLoading ||
    (validateQuery.isFetching && !validateQuery.data);
  const referralCode = validateQuery.data?.referralCode;
  const referrerEns = validateQuery.data?.referrerEns;
  const referrerWallet = validateQuery.data?.referrerWallet;

  const referrerDisplayName =
    referrerEns ||
    formatReferralDisplayName(referralCode) ||
    (referrerWallet
      ? `${referrerWallet.slice(0, 6)}...${referrerWallet.slice(-4)}`
      : "A friend");

  React.useEffect(() => {
    if (!isValid) return;
    storeReferralAttribution(referralCode || code);
  }, [isValid, referralCode, code]);

  React.useEffect(() => {
    if (!autoLinkSucceeded) return;
    setIsSuccess(true);
  }, [autoLinkSucceeded]);

  const handleLink = async () => {
    if (!isConnected) return;
    try {
      trackEvent("referral_link_click", { code, wallet: address });
      await linkReferrer(code);
      trackEvent("referral_link_success", { code, wallet: address });
      setIsSuccess(true);
    } catch (e) {
      const parsed = parseReferralError(e);
      if (!parsed.isUserRejection) {
        console.error(parsed.message, e);
      }
    }
  };

  const handleChangeReferrer = async () => {
    if (!isConnected) return;
    try {
      trackEvent("referral_change_click", { code, wallet: address });
      await changeReferrer(code);
      trackEvent("referral_change_success", { code, wallet: address });
      setIsChangeSuccess(true);
      setIsSuccess(true);
    } catch (e) {
      const parsed = parseReferralError(e);
      if (!parsed.isUserRejection) {
        console.error(parsed.message, e);
      }
    }
  };

  // Only use status when wallet is connected to avoid stale data
  const isAlreadyLinked = isConnected && status?.hasReferrer;
  const canClaim = isConnected ? status?.canClaim : undefined;
  const claimReason = status?.claimReason;
  const isEligibilityLoading = isConnected && isLoadingStatus;
  const canChangeReferrerFlag = status?.referrer?.canChangeReferrer;
  const currentReferrerWallet = status?.referrer?.wallet?.toLowerCase();
  const newReferrerWallet = referrerWallet?.toLowerCase();
  const isDifferentReferrer =
    currentReferrerWallet &&
    newReferrerWallet &&
    currentReferrerWallet !== newReferrerWallet;
  const canChangeReferrer =
    isAlreadyLinked && canChangeReferrerFlag && isDifferentReferrer;

  // Track page view when validation completes
  const hasTrackedViewRef = React.useRef(false);
  React.useEffect(() => {
    if (hasTrackedViewRef.current) return;
    if (!validateQuery.isFetched) return;

    if (isValid) {
      trackEvent("referral_landing_view", {
        code,
        referrer_wallet: referrerWallet ?? null,
        referrer_ens: referrerEns ?? null,
      });
    } else if (validateQuery.data?.valid === false || hasValidationError) {
      trackEvent("referral_landing_invalid_code", { code });
    }
    hasTrackedViewRef.current = true;
  }, [
    validateQuery.isFetched,
    validateQuery.data?.valid,
    isValid,
    hasValidationError,
    code,
    referrerWallet,
    referrerEns,
  ]);

  if (!isReferralLive) {
    return (
      <div className="min-h-screen bg-white dark:bg-background">
        <LangToggle className="fixed right-4 top-4 z-30" />
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-md w-full rounded-2xl sm:rounded-3xl border border-border/20 dark:border-border/40 bg-card px-6 py-8 sm:px-8 sm:py-10 text-center space-y-4">
            <div className="mx-auto flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50">
              <GlowSymbol className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              {r.programLaunchingSoon}
            </h1>
            <p className="text-sm text-muted-foreground">
              {r.referralsOpenOn(REFERRAL_LAUNCH_LABEL)}
            </p>
            <Button
              className="w-full"
              onClick={() => handleGoToDashboard("launch_soon")}
            >
              {r.goToDashboard}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      <LangToggle className="fixed right-4 top-4 z-30" />
      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-background"
          >
            {/* Left Side - Content */}
            <div className={landingPanelClassName}>
              <div className="hidden lg:block">
                <GlowLockup className="h-6 sm:h-8 w-auto" />
              </div>

              <div className="flex flex-1 flex-col justify-center gap-6 sm:gap-7 lg:max-w-md lg:gap-0">
                <div className="space-y-3 sm:space-y-4">
                  <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-[#4ade80]">
                    {r.youreIn}
                  </div>

                  <h1 className="max-w-[12ch] text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-4xl">
                    {r.referralLinkedTo}{" "}
                    <span className="text-[color:var(--color-glow-orange)]">
                      {referrerDisplayName}
                    </span>
                  </h1>

                  <p className="max-w-sm text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                    {isChangeSuccess
                      ? r.changeSuccessBody
                      : r.newSuccessBody}
                  </p>
                </div>

                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.2, ease: "easeOut" }}
                  className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-[#4ade80]/20 bg-[#4ade80]/10"
                >
                  <svg className="h-6 w-6 sm:h-7 sm:w-7 text-[#4ade80]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>

                <div className="space-y-3 pt-1 sm:pt-2">
                  <Button
                    className="h-12 sm:h-14 w-full sm:max-w-xs"
                    onClick={() => handleGoToDashboard("success")}
                  >
                    {r.goToDashboardSuccess}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                {/* Viral Loop: Share Your Own Link */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="rounded-2xl border border-dashed border-border/40 bg-muted/[0.18] p-4 sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0 sm:pt-6"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {r.startYourOwnNetwork}
                    </p>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4 leading-relaxed">
                    {r.inviteFriendsBody}
                  </p>
                  {ownCodeQuery.isLoading ? (
                    <Skeleton className="h-10 w-full sm:max-w-xs" />
                  ) : ownCodeQuery.data?.shareableLink ? (
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <div className="flex-1 sm:max-w-xs px-3 py-2 rounded-lg bg-muted/50 border border-border/20 font-mono text-xs text-muted-foreground truncate">
                        {ownCodeQuery.data.shareableLink}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 gap-2 shrink-0"
                        onClick={copyOwnLink}
                      >
                        {isOwnLinkCopied ? (
                          <>
                            <Check className="w-4 h-4" />
                            {r.copied}
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            {r.copyYourLink}
                          </>
                        )}
                      </Button>
                    </div>
                  ) : null}
                </motion.div>
              </div>

              <div className="mt-6 text-xs leading-5 text-muted-foreground/60 sm:text-sm lg:mt-0">
                {r.startEarningPoints}
              </div>
            </div>

            {/* Right Side - Hero Image */}
            <div className={heroPanelClassName}>
              <div className="relative h-full w-full rounded-xl sm:rounded-2xl overflow-hidden">
                <Image
                  src="/images/referral-hero.jpg"
                  alt={r.heroAlt}
                  fill
                  className="object-cover object-center"
                  priority
                />

                {/* Gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-transparent" />

                {/* Mobile logo */}
                <div className="absolute top-4 left-4 lg:hidden">
                  <GlowLockup className="h-6 w-auto brightness-0 invert" />
                </div>

                {/* Bonus badges - now showing as "unlocked" */}
                <div className="absolute left-0 right-0 top-12 px-4 sm:top-8 sm:px-8 lg:top-12 lg:px-12">
                  <div className="flex justify-center gap-5 sm:gap-12 lg:gap-24">
                    <div className="text-center text-white">
                      <div className="text-[2rem] font-bold tracking-tight sm:text-5xl lg:text-7xl">
                        +10%
                      </div>
                      <div className="mt-1 sm:mt-2 text-xs sm:text-sm lg:text-base font-semibold text-[#4ade80]">
                        {r.badgeActiveNow}
                      </div>
                      <div className="text-[10px] sm:text-xs lg:text-sm text-white/80 hidden sm:block">
                        {r.badgeBoostingPoints1}
                        <br />
                        {r.badgeBoostingPoints2}
                      </div>
                      <div className="text-[10px] text-white/80 sm:hidden">
                        {r.badgeBoostingPointsMobile}
                      </div>
                    </div>

                    <div className="text-center text-white">
                      <div className="text-[2rem] font-bold tracking-tight sm:text-5xl lg:text-7xl">
                        +100
                      </div>
                      <div className="mt-1 sm:mt-2 text-xs sm:text-sm lg:text-base font-semibold text-white/80">
                        {r.badgePending}
                      </div>
                      <div className="text-[10px] sm:text-xs lg:text-sm text-white/80 hidden sm:block">
                        {r.badgeUnlocksAfter1}
                        <br />
                        {r.badgeUnlocksAfter2}
                      </div>
                      <div className="text-[10px] text-white/80 sm:hidden">
                        {r.badgeAt100PtsMobile}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-background"
          >
            {/* Left Side - Content */}
            <div className={landingPanelClassName}>
              <div className="hidden lg:block">
                <GlowLockup className="h-6 sm:h-8 w-auto" />
              </div>

              <div className="flex flex-1 flex-col justify-center gap-6 sm:gap-7 lg:max-w-md lg:gap-0">
                <div className="space-y-3 sm:space-y-4">
                  <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {r.personalInvitation}
                  </div>

                  <h1 className="max-w-[11ch] text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-4xl">
                    {validateQuery.isLoading ? (
                      <Skeleton className="h-8 w-44 bg-muted sm:h-10 sm:w-64" />
                    ) : (
                      <>
                        {r.joinPrefix}{" "}
                        <span className="text-foreground">{referrerDisplayName}</span>
                      </>
                    )}
                  </h1>

                  <p className="max-w-sm text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                    {r.inviterMessage}
                  </p>
                </div>

                <a
                  href="https://glow.org/blog/the-simple-way-to-fund-solar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 text-xs sm:text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {r.learnHowItWorks}
                  <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </a>

                <div className="space-y-4 pt-1 sm:pt-2">
                  {!isConnected ? (
                    <div onClickCapture={handleConnectClick}>
                      <ConnectButton
                        variant="default"
                        size="large"
                        className="w-full sm:max-w-xs"
                        onConnect={handleConnectSuccess}
                      />
                    </div>
                  ) : isValidationLoading ? (
                    <Button disabled className="h-12 sm:h-14 w-full sm:max-w-xs">
                      {r.checkingLink}
                    </Button>
                  ) : hasValidationError ? (
                    <Button
                      className="h-12 sm:h-14 w-full sm:max-w-xs"
                      onClick={() => {
                        trackEvent("referral_retry_verification_click", { code });
                        validateQuery.refetch();
                      }}
                    >
                      {r.retryVerification}
                    </Button>
                  ) : isValid === false ? (
                    <Button disabled className="h-12 sm:h-14 w-full sm:max-w-xs">
                      {r.invalidLink}
                    </Button>
                  ) : canChangeReferrer ? (
                    <Button
                      className="h-12 sm:h-14 w-full sm:max-w-xs"
                      onClick={handleChangeReferrer}
                      disabled={isChanging || isAutoLinking}
                    >
                      {isChanging
                        ? r.changing
                        : isAutoLinking
                          ? r.linking
                          : r.switchToThisReferrer}
                      {!isChanging && !isAutoLinking && (
                        <ArrowRight className="ml-2 h-4 w-4" />
                      )}
                    </Button>
                  ) : isAlreadyLinked ? (
                    <div className="space-y-2 w-full sm:max-w-xs">
                      <Button
                        className="h-12 sm:h-14 w-full"
                        onClick={() => handleGoToDashboard("already_linked")}
                      >
                        {r.goToDashboard}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 sm:h-12 w-full"
                        onClick={() => {
                          trackEvent("referral_try_different_wallet_click", {
                            code,
                            wallet: address ?? null,
                          });
                          disconnect();
                        }}
                      >
                        {r.tryDifferentWallet}
                      </Button>
                      <p className="text-xs text-muted-foreground/60 text-center">
                        {r.walletAlreadyLinked}
                      </p>
                    </div>
                  ) : (
                    <Button
                      className="h-12 sm:h-14 w-full sm:max-w-xs"
                      onClick={handleLink}
                      disabled={
                        isLinking ||
                        isAutoLinking ||
                        canClaim === false ||
                        isEligibilityLoading
                      }
                    >
                      {isAutoLinking
                        ? r.linking
                        : isLinking
                          ? r.verifying
                          : r.claimBonus}
                      {!isLinking && !isAutoLinking && (
                        <ArrowRight className="ml-2 h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-6 text-xs leading-5 text-muted-foreground/60 sm:text-sm">
                {!isConnected
                  ? r.connectWalletToVerify
                  : isEligibilityLoading
                    ? r.checkingEligibility
                    : isAutoLinking
                      ? r.linkingStored
                    : canClaim === false
                      ? claimReason || r.notEligible
                      : hasValidationError
                        ? r.unableToVerify
                        : canChangeReferrer
                          ? r.canSwitchPending
                          : null}
              </div>
            </div>

            {/* Right Side - Hero Image (shows first on mobile via order) */}
            <div className={heroPanelClassName}>
              <div className="relative h-full w-full rounded-xl sm:rounded-2xl overflow-hidden">
                <Image
                  src="/images/referral-hero.jpg"
                  alt={r.heroAlt}
                  fill
                  className="object-cover object-center"
                  priority
                />

                {/* Gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-transparent" />

                {/* Mobile logo */}
                <div className="absolute top-4 left-4 lg:hidden">
                  <GlowLockup className="h-6 w-auto brightness-0 invert" />
                </div>

                {/* Bonus badges */}
                <div className="absolute left-0 right-0 top-12 px-4 sm:top-8 sm:px-8 lg:top-12 lg:px-12">
                  <div className="flex justify-center gap-5 sm:gap-12 lg:gap-24">
                    <div className="text-center text-white">
                      <div className="text-[2rem] font-bold tracking-tight sm:text-5xl lg:text-7xl">
                        +10%
                      </div>
                      <div className="mt-1 sm:mt-2 text-xs sm:text-sm lg:text-base font-semibold">
                        {r.badgeImpactPointsBonus}
                      </div>
                      <div className="text-[10px] sm:text-xs lg:text-sm text-white/80 hidden sm:block">
                        {r.badgeAddedToBase1}
                        <br />
                        {r.badgeAddedToBase2}
                      </div>
                      <div className="text-[10px] text-white/80 sm:hidden">
                        {r.badgeBoostingPointsMobile}
                      </div>
                    </div>

                    <div className="text-center text-white">
                      <div className="text-[2rem] font-bold tracking-tight sm:text-5xl lg:text-7xl">
                        +100
                      </div>
                      <div className="mt-1 sm:mt-2 text-xs sm:text-sm lg:text-base font-semibold">
                        {r.badgeBonusPoints}
                      </div>
                      <div className="text-[10px] sm:text-xs lg:text-sm text-white/80 hidden sm:block">
                        {r.badgeUnlocksAfter1}
                        <br />
                        {r.badgeUnlocksAfter2}
                      </div>
                      <div className="text-[10px] text-white/80 sm:hidden">
                        {r.badgeAt100Points}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
