"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { hubGet } from "@/lib/api/hub-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { ConnectButton } from "@/components/connect-button";
import { useReferral } from "@/hooks/use-referral";
import { trackEvent } from "@/lib/telemetry";
import { GlowLockup } from "@/components/glow-lockup";
import { GlowSymbol } from "@/components/glow-symbol";
import { motion, AnimatePresence } from "framer-motion";
import { useReferralLaunch } from "@/hooks/use-referral-launch";
import { REFERRAL_LAUNCH_LABEL } from "@/lib/referral-launch";

interface ValidateCodeResponse {
  valid: boolean;
  referrerWallet?: string;
  referrerEns?: string;
  message?: string;
}

export default function ReferralLandingPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const { isConnected, address } = useAccount();
  const {
    status,
    linkReferrer,
    isLinking,
    changeReferrer,
    isChanging,
    isLoadingStatus,
  } = useReferral();
  const { isLive: isReferralLive } = useReferralLaunch();
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isChangeSuccess, setIsChangeSuccess] = React.useState(false);

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
  const referrerEns = validateQuery.data?.referrerEns;
  const referrerWallet = validateQuery.data?.referrerWallet;

  const referrerDisplayName =
    referrerEns ||
    (referrerWallet
      ? `${referrerWallet.slice(0, 6)}...${referrerWallet.slice(-4)}`
      : "A friend");

  const handleLink = async () => {
    if (!isConnected) return;
    try {
      trackEvent("referral_link_click", { code, wallet: address });
      await linkReferrer(code);
      trackEvent("referral_link_success", { code, wallet: address });
      setIsSuccess(true);
    } catch (e) {
      console.error(e);
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
      console.error(e);
    }
  };

  const isAlreadyLinked = status?.hasReferrer;
  const canClaim = status?.canClaim;
  const claimReason = status?.claimReason;
  const isEligibilityLoading = isLoadingStatus;
  const canChangeReferrerFlag = status?.referrer?.canChangeReferrer;
  const currentReferrerWallet = status?.referrer?.wallet?.toLowerCase();
  const newReferrerWallet = referrerWallet?.toLowerCase();
  const isDifferentReferrer =
    currentReferrerWallet &&
    newReferrerWallet &&
    currentReferrerWallet !== newReferrerWallet;
  const canChangeReferrer =
    isAlreadyLinked && canChangeReferrerFlag && isDifferentReferrer;

  if (!isReferralLive) {
    return (
      <div className="min-h-screen bg-white dark:bg-background">
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-md w-full rounded-2xl sm:rounded-3xl border border-border/20 dark:border-border/40 bg-card px-6 py-8 sm:px-8 sm:py-10 text-center space-y-4">
            <div className="mx-auto flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50">
              <GlowSymbol className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Referral Program Launching Soon
            </h1>
            <p className="text-sm text-muted-foreground">
              Referrals open on {REFERRAL_LAUNCH_LABEL}.
            </p>
            <Button
              className="w-full"
              onClick={() => router.push("/test")}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen flex items-center justify-center p-4 sm:p-8"
          >
            <div className="max-w-md w-full">
              <div className="rounded-2xl sm:rounded-3xl border border-border/20 dark:border-border/40 bg-card px-6 py-8 sm:px-8 sm:py-10 text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.2, ease: "easeOut" }}
                  className="mx-auto mb-5 sm:mb-6 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50"
                >
                  <GlowSymbol className="h-6 w-6 sm:h-7 sm:w-7" />
                </motion.div>

                <h1 className="mb-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Referral Linked
                </h1>
                <p className="text-sm text-muted-foreground">
                  Linked to{" "}
                  <span className="font-semibold text-[color:var(--color-glow-orange)]">
                    {referrerDisplayName}
                  </span>
                  .
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isChangeSuccess
                    ? "Your boost stays on its original schedule; +100 unlocks after you reach 100 points."
                    : "Your 12-week boost starts now; +100 unlocks after you reach 100 points."}
                </p>

                <div className="mt-6 sm:mt-8 rounded-xl sm:rounded-2xl border border-border/20 dark:border-border/40">
                  <div className="grid grid-cols-2 divide-x divide-border/20 dark:divide-border/40">
                    <div className="p-3 sm:p-4 text-left">
                      <div className="text-xl sm:text-2xl font-bold text-foreground">+10%</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">
                        Weekly point boost
                      </div>
                    </div>
                    <div className="p-3 sm:p-4 text-left">
                      <div className="text-xl sm:text-2xl font-bold text-foreground">+100</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">At 100 points</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 sm:mt-8">
                  <Button size="lg" className="w-full sm:w-auto" onClick={() => router.push("/")}>
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
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
            <div className="order-2 lg:order-1 lg:flex-1 flex flex-col lg:justify-between p-6 sm:p-8 lg:p-16 lg:min-h-screen">
              <div className="hidden lg:block">
                <GlowLockup className="h-6 sm:h-8 w-auto" />
              </div>

              <div className="lg:flex-1 flex flex-col lg:justify-center max-w-md py-0 lg:py-0">
                <div className="mb-3 sm:mb-4 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Personal Invitation
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-4 sm:mb-6">
                  {validateQuery.isLoading ? (
                    <Skeleton className="h-8 sm:h-10 w-48 sm:w-72 bg-muted" />
                  ) : (
                    <>
                      Join{" "}
                      <span className="text-foreground">{referrerDisplayName}</span>
                    </>
                  )}
                </h1>

                <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
                  I&apos;m supporting scaling solar where it&apos;s needed most and
                  earning rewards for doing so, and now you can too. Sign up
                  below and let&apos;s build a brighter future together.
                </p>

                <div className="space-y-4">
                  {!isConnected ? (
                    <ConnectButton
                      variant="default"
                      size="large"
                      className="w-full sm:max-w-xs"
                    />
                  ) : isValidationLoading ? (
                    <Button disabled className="h-12 sm:h-14 w-full sm:max-w-xs">
                      Checking link...
                    </Button>
                  ) : hasValidationError ? (
                    <Button
                      className="h-12 sm:h-14 w-full sm:max-w-xs"
                      onClick={() => validateQuery.refetch()}
                    >
                      Retry Verification
                    </Button>
                  ) : isValid === false ? (
                    <Button disabled className="h-12 sm:h-14 w-full sm:max-w-xs">
                      Invalid Link
                    </Button>
                  ) : canChangeReferrer ? (
                    <Button
                      className="h-12 sm:h-14 w-full sm:max-w-xs"
                      onClick={handleChangeReferrer}
                      disabled={isChanging}
                    >
                      {isChanging ? "Changing..." : "Switch to This Referrer"}
                      {!isChanging && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  ) : isAlreadyLinked ? (
                    <Button
                      className="h-12 sm:h-14 w-full sm:max-w-xs"
                      onClick={() => router.push("/")}
                    >
                      Already Linked | Go to Dashboard
                    </Button>
                  ) : (
                    <Button
                      className="h-12 sm:h-14 w-full sm:max-w-xs"
                      onClick={handleLink}
                      disabled={
                        isLinking || canClaim === false || isEligibilityLoading
                      }
                    >
                      {isLinking ? "Verifying..." : "Claim Bonus"}
                      {!isLinking && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>

              <div className="text-xs sm:text-sm text-muted-foreground/60">
                {!isConnected
                  ? "Connect wallet to verify eligibility"
                  : isEligibilityLoading
                    ? "Checking eligibility..."
                    : canClaim === false
                      ? claimReason || "You're not eligible to claim right now."
                      : hasValidationError
                        ? "Unable to verify this referral right now."
                        : canChangeReferrer
                          ? "You can switch referrers while your referral is pending."
                          : null}
              </div>
            </div>

            {/* Right Side - Hero Image (shows first on mobile via order) */}
            <div className="order-1 lg:order-2 h-[45vh] lg:h-auto lg:flex-1 p-3 sm:p-4 lg:p-8 lg:min-h-screen">
              <div className="relative h-full w-full rounded-xl sm:rounded-2xl overflow-hidden">
                <Image
                  src="/images/referral-hero.jpg"
                  alt="Solar panels with worker"
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
                <div className="absolute top-12 sm:top-8 lg:top-12 left-0 right-0 px-4 sm:px-8 lg:px-12">
                  <div className="flex justify-center gap-6 sm:gap-12 lg:gap-24">
                    <div className="text-center text-white">
                      <div className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight">
                        +10%
                      </div>
                      <div className="mt-1 sm:mt-2 text-xs sm:text-sm lg:text-base font-semibold">
                        Impact Points Bonus
                      </div>
                      <div className="text-[10px] sm:text-xs lg:text-sm text-white/80 hidden sm:block">
                        Added to your base points
                        <br />
                        for 12 weeks
                      </div>
                      <div className="text-[10px] text-white/80 sm:hidden">
                        12 weeks
                      </div>
                    </div>

                    <div className="text-center text-white">
                      <div className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight">
                        +100
                      </div>
                      <div className="mt-1 sm:mt-2 text-xs sm:text-sm lg:text-base font-semibold">
                        Bonus Points
                      </div>
                      <div className="text-[10px] sm:text-xs lg:text-sm text-white/80 hidden sm:block">
                        Unlocked after your first
                        <br />
                        100 post-link points
                      </div>
                      <div className="text-[10px] text-white/80 sm:hidden">
                        At 100 points
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
