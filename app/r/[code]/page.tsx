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
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isChangeSuccess, setIsChangeSuccess] = React.useState(false);

  const validateQuery = useQuery({
    queryKey: ["validate-referral-code", code],
    queryFn: () => hubGet<ValidateCodeResponse>(`/referral/validate/${code}`),
    enabled: !!code,
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

  return (
    <div className="min-h-screen bg-white">
      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen flex items-center justify-center p-8"
          >
            <div className="max-w-md w-full">
              <div className="rounded-3xl border border-gray-200 bg-white px-8 py-10 text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.2, ease: "easeOut" }}
                  className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white"
                >
                  <GlowSymbol className="h-7 w-7" />
                </motion.div>

                <h1 className="mb-2 text-2xl font-bold tracking-tight text-black">
                  Referral Linked
                </h1>
                <p className="text-sm text-gray-600">
                  Linked to{" "}
                  <span className="font-semibold text-[color:var(--color-glow-orange)]">
                    {referrerDisplayName}
                  </span>
                  .
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  {isChangeSuccess
                    ? "Your boost stays on its original schedule; +100 unlocks after you reach 100 points."
                    : "Your 12-week boost starts now; +100 unlocks after you reach 100 points."}
                </p>

                <div className="mt-8 rounded-2xl border border-gray-200">
                  <div className="grid grid-cols-2 divide-x divide-gray-200">
                    <div className="p-4 text-left">
                      <div className="text-2xl font-bold text-black">+10%</div>
                      <div className="text-xs text-gray-600">
                        Weekly point boost
                      </div>
                    </div>
                    <div className="p-4 text-left">
                      <div className="text-2xl font-bold text-black">+100</div>
                      <div className="text-xs text-gray-600">At 100 points</div>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Button size="lg" onClick={() => router.push("/")}>
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
            className="min-h-screen flex flex-col lg:flex-row"
          >
            {/* Left Side - Content */}
            <div className="flex-1 flex flex-col justify-between p-8 lg:p-16">
              <div>
                <GlowLockup className="h-8 w-auto" />
              </div>

              <div className="flex-1 flex flex-col justify-center max-w-md py-12 lg:py-0">
                <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Personal Invitation
                </div>

                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-black mb-6">
                  {validateQuery.isLoading ? (
                    <Skeleton className="h-10 w-72 bg-gray-200" />
                  ) : (
                    <>
                      Join{" "}
                      <span className="text-black">{referrerDisplayName}</span>
                    </>
                  )}
                </h1>

                <p className="text-gray-600 mb-8 leading-relaxed">
                  I'm supporting scaling solar where it's needed most and
                  earning rewards for doing so, and now you can too. Sign up
                  below and let's build a brighter future together.
                </p>

                <div className="space-y-4">
                  {!isConnected ? (
                    <ConnectButton
                      variant="default"
                      size="large"
                      className="max-w-xs"
                    />
                  ) : isValidationLoading ? (
                    <Button disabled className="h-14 max-w-xs w-full ">
                      Checking link...
                    </Button>
                  ) : hasValidationError ? (
                    <Button
                      className="h-14 max-w-xs w-full "
                      onClick={() => validateQuery.refetch()}
                    >
                      Retry Verification
                    </Button>
                  ) : isValid === false ? (
                    <Button disabled className="h-14 max-w-xs w-full">
                      Invalid Link
                    </Button>
                  ) : canChangeReferrer ? (
                    <Button
                      className="h-14 max-w-xs w-full "
                      onClick={handleChangeReferrer}
                      disabled={isChanging}
                    >
                      {isChanging ? "Changing..." : "Switch to This Referrer"}
                      {!isChanging && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  ) : isAlreadyLinked ? (
                    <Button
                      className="h-14 max-w-xs w-full "
                      onClick={() => router.push("/")}
                    >
                      Already Linked | Go to Dashboard
                    </Button>
                  ) : (
                    <Button
                      className="h-14 max-w-xs w-full "
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

              <div className="text-sm text-gray-400">
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

            {/* Right Side - Hero Image */}
            <div className="flex-1 p-4 lg:p-8 min-h-[400px] lg:min-h-screen">
              <div className="relative h-full w-full rounded-2xl overflow-hidden">
                <Image
                  src="/images/referral-hero.jpg"
                  alt="Solar panels with worker"
                  fill
                  className="object-cover object-center"
                  priority
                />

                {/* Gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />

                {/* Bonus badges */}
                <div className="absolute top-8 lg:top-12 left-0 right-0 px-8 lg:px-12">
                  <div className="flex justify-center gap-12 lg:gap-24">
                    <div className="text-center text-white">
                      <div className="text-5xl lg:text-7xl font-bold tracking-tight">
                        +10%
                      </div>
                      <div className="mt-2 text-sm lg:text-base font-semibold">
                        Impact Points Bonus
                      </div>
                      <div className="text-xs lg:text-sm text-white/80">
                        Added to your base points
                        <br />
                        for 12 weeks
                      </div>
                    </div>

                    <div className="text-center text-white">
                      <div className="text-5xl lg:text-7xl font-bold tracking-tight">
                        +100
                      </div>
                      <div className="mt-2 text-sm lg:text-base font-semibold">
                        Bonus Points
                      </div>
                      <div className="text-xs lg:text-sm text-white/80">
                        Unlocked after your first
                        <br />
                        100 post-link points
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
