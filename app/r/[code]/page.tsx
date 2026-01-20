"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { hubGet } from "@/lib/api/hub-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, ArrowRight, CheckCircle2, Sparkles, Gift } from "lucide-react";
import { ConnectButton } from "@/components/connect-button";
import { useReferral } from "@/hooks/use-referral";
import { trackEvent } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import { PageWrapper } from "@/app/components/page-wrapper";
import { motion, AnimatePresence } from "framer-motion";
import { GlowSymbol } from "@/components/glow-symbol";

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
    validateQuery.isLoading || (validateQuery.isFetching && !validateQuery.data);
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
  const isDifferentReferrer = currentReferrerWallet && newReferrerWallet && currentReferrerWallet !== newReferrerWallet;
  const canChangeReferrer =
    isAlreadyLinked && canChangeReferrerFlag && isDifferentReferrer;

  return (
    <PageWrapper>
      <div className="relative min-h-screen bg-background">
        <div className="absolute inset-0 glow-grid opacity-30 pointer-events-none" />

        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <Card className="overflow-hidden border-border bg-card">
                  <div className="h-1 w-full bg-[color:var(--color-glow-green)]" />
                  <CardContent className="p-8 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, duration: 0.15, ease: "easeOut" }}
                      className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-glow-green)]/10"
                    >
                      <CheckCircle2 className="h-8 w-8 text-[color:var(--color-glow-green)]" />
                    </motion.div>

                    <h1 className="mb-2 text-2xl font-bold tracking-tight">
                      Referral Linked
                    </h1>
                    <p className="mb-8 text-muted-foreground">
                      Linked to{" "}
                      <span className="font-medium text-foreground">
                        {referrerDisplayName}
                      </span>
                      .{" "}
                      {isChangeSuccess
                        ? "Your boost stays on its original schedule; +100 unlocks after you reach 100 points."
                        : "Your 12-week boost starts now; +100 unlocks after you reach 100 points."}
                    </p>

                    <div className="mb-8 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/50 p-4 text-left">
                        <div className="mb-1 flex items-center gap-1.5 text-[color:var(--color-glow-green)]">
                          <Zap className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wider">
                            Weekly
                          </span>
                        </div>
                        <div className="text-xl font-bold">+10%</div>
                        <div className="text-xs text-muted-foreground">
                          Point boost
                        </div>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-4 text-left">
                        <div className="mb-1 flex items-center gap-1.5 text-[color:var(--color-glow-orange)]">
                          <Sparkles className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wider">
                            Milestone
                          </span>
                        </div>
                        <div className="text-xl font-bold">+100</div>
                        <div className="text-xs text-muted-foreground">
                          Unlocks at 100 points
                        </div>
                      </div>
                    </div>

                    <Button
                      size="lg"
                      className="h-12 w-full font-bold"
                      onClick={() => router.push("/")}
                    >
                      Go to Dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="overflow-hidden border-border bg-card pt-0">
                  <CardContent className="p-0 ">
                    <div className="relative border-b border-border bg-muted/30 p-8">
                      <div className="absolute right-4 top-4 opacity-[0.03]">
                        <GlowSymbol className="h-32 w-32" />
                      </div>

                      <div className="relative flex flex-col items-center text-center">
                        {validateQuery.isLoading ? (
                          <Skeleton className="mb-4 h-16 w-16 rounded-full" />
                        ) : (
                          <div className="relative mb-4">
                            <Avatar className="h-16 w-16 border-2 border-background shadow-lg">
                              <AvatarImage
                                src={`https://ens.elo.le/avatar/${referrerEns}`}
                              />
                              <AvatarFallback className="bg-foreground text-background text-lg font-bold">
                                {referrerDisplayName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-[color:var(--color-glow-green)]">
                              <Gift className="h-3 w-3 text-black" />
                            </div>
                          </div>
                        )}

                        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1 text-xs font-medium text-muted-foreground">
                          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--color-glow-green)]" />
                          Personal Invitation
                        </div>

                        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                          {validateQuery.isLoading ? (
                            <Skeleton className="mx-auto h-7 w-48" />
                          ) : (
                            <>
                              Join{" "}
                              <span className="text-[color:var(--color-glow-orange)]">
                                {referrerDisplayName}
                              </span>{" "}
                              on Glow
                            </>
                          )}
                        </h1>
                      </div>
                    </div>

                    <div className="space-y-4 p-6">
                      <div className="space-y-3">
                        <BenefitRow
                          icon={<Zap className="h-4 w-4" />}
                          iconColor="text-[color:var(--color-glow-green)]"
                          iconBg="bg-[color:var(--color-glow-green)]/10"
                          title="+10% Impact Points Bonus"
                          subtitle="Added to your base points for 12 weeks"
                        />
                        <BenefitRow
                          icon={<Sparkles className="h-4 w-4" />}
                          iconColor="text-[color:var(--color-glow-orange)]"
                          iconBg="bg-[color:var(--color-glow-orange)]/10"
                          title="+100 Bonus Points"
                          subtitle="Unlocked after your first 100 post-link points"
                        />
                      </div>

                      <div className="pt-2">
                        {!isConnected ? (
                          <div className="space-y-3">
                            <ConnectButton
                              variant="default"
                        
                            />
                            <p className="text-center text-xs text-muted-foreground">
                              Connect wallet to verify eligibility
                            </p>
                          </div>
                        ) : isValidationLoading ? (
                          <Button
                            disabled
                            className="h-12 w-full"
                            variant="secondary"
                          >
                            Checking link...
                          </Button>
                        ) : hasValidationError ? (
                          <div className="space-y-3">
                            <Button
                              className="h-12 w-full"
                              variant="secondary"
                              onClick={() => validateQuery.refetch()}
                            >
                              Retry Verification
                            </Button>
                            <p className="text-center text-xs text-muted-foreground">
                              Unable to verify this referral right now.
                            </p>
                          </div>
                        ) : isValid === false ? (
                          <Button
                            disabled
                            className="h-12 w-full"
                            variant="secondary"
                          >
                            Invalid Link
                          </Button>
                        ) : canChangeReferrer ? (
                          <div className="space-y-3">
                            <Button
                              className="h-12 w-full font-bold"
                              onClick={handleChangeReferrer}
                              disabled={isChanging}
                            >
                              {isChanging ? "Changing..." : "Switch to This Referrer"}
                              {!isChanging && <ArrowRight className="ml-2 h-4 w-4" />}
                            </Button>
                            <p className="text-center text-xs text-muted-foreground">
                              You can switch referrers while your referral is pending.
                            </p>
                          </div>
                        ) : isAlreadyLinked ? (
                          <Button
                            className="h-12 w-full font-bold"
                            variant="outline"
                            onClick={() => router.push("/")}
                          >
                            Already Linked | Go to Dashboard
                          </Button>
                        ) : (
                          <div className="space-y-3">
                            <Button
                              className="h-12 w-full font-bold"
                              onClick={handleLink}
                              disabled={isLinking || canClaim === false || isEligibilityLoading}
                            >
                              {isLinking ? "Verifying..." : "Claim Bonus"}
                              {!isLinking && <ArrowRight className="ml-2 h-4 w-4" />}
                            </Button>
                            {isEligibilityLoading ? (
                              <p className="text-center text-xs text-muted-foreground">
                                Checking eligibility...
                              </p>
                            ) : canClaim === false ? (
                              <p className="text-center text-xs text-muted-foreground">
                                {claimReason || "You're not eligible to claim right now."}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                  <a
                    href="https://glow.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground"
                  >
                    Learn more about Glow Protocol
                  </a>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
    </PageWrapper>
  );
}

function BenefitRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-4">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          iconBg,
          iconColor
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}
