"use client";

import * as React from "react";
import { useReferral, type ValidateCodeResult } from "@/hooks/use-referral";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Check,
  Users,
  Copy,
  QrCode,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { trackEvent } from "@/lib/telemetry";
import * as Sentry from "@sentry/nextjs";
import { GlowSymbol } from "@/components/glow-symbol";
import { hubGet, hubPost } from "@/lib/api/hub-client";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useReferralLaunch } from "@/hooks/use-referral-launch";
import { QRCodeDialog } from "@/components/referral/qr-code-dialog";

interface SuccessReceipt {
  referralCode: string;
  referrerWallet?: string;
  referrerEns?: string;
}

interface ReferralCodeResponse {
  code: string;
  shareableLink: string;
}

interface FeatureLaunchModalMock {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  status?: {
    canClaim?: boolean;
    hasReferrer?: boolean;
    featureLaunchModal?: { seen?: boolean };
  };
  validateCode?: (code: string) => Promise<ValidateCodeResult>;
  linkReferrer?: (code: string) => Promise<void>;
  isLinking?: boolean;
  linkError?: Error | null;
  walletAddress?: string | null;
  onSeen?: () => void;
}

interface FeatureLaunchModalProps {
  mock?: FeatureLaunchModalMock;
}

export function FeatureLaunchModal({ mock }: FeatureLaunchModalProps) {
  const referral = useReferral();
  const { address: connectedAddress } = useAccount();
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();
  const address = mock?.walletAddress ?? connectedAddress;
  const status = mock?.status ?? referral.status;
  const linkReferrer = mock?.linkReferrer ?? referral.linkReferrer;
  const isLinking = mock?.isLinking ?? referral.isLinking;
  const linkError = mock?.linkError ?? referral.linkError;
  const validateCode = mock?.validateCode ?? referral.validateCode;
  const [code, setCode] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [isDismissed, setIsDismissed] = React.useState(false);
  const [step, setStep] = React.useState<"form" | "success" | "invite">("form");
  const [successReceipt, setSuccessReceipt] =
    React.useState<SuccessReceipt | null>(null);
  const hasTrackedViewRef = React.useRef(false);
  const { isLive: isReferralLive } = useReferralLaunch();

  // Derive error message from linkError or localError
  const errorMessage = localError || (linkError as Error | null)?.message;

  const hasSeen = !!status?.featureLaunchModal?.seen;
  const isControlled = mock?.open !== undefined;

  // Modal should show if: eligible + no referrer + not seen (backend), OR in success/invite state
  // isDismissed is session-only (resets on page refresh) - allows closing without permanent dismiss
  const computedShouldShow =
    step === "success" ||
    step === "invite" ||
    (status?.canClaim && !status?.hasReferrer && !hasSeen && !isDismissed);
  const shouldShow = isControlled ? Boolean(mock?.open) : computedShouldShow;

  const markFeatureLaunchSeen = React.useCallback(async () => {
    if (mock) {
      mock.onSeen?.();
      return;
    }
    if (!address) return;
    try {
      await hubPost("/referral/feature-launch-seen", {
        walletAddress: address,
      });
      queryClient.invalidateQueries({
        queryKey: ["referral-status", address],
      });
    } catch {
      // No-op; modal can still be dismissed locally.
    }
  }, [address, mock, queryClient]);

  // Close modal without marking as seen (click outside, X button)
  const handleClose = React.useCallback(() => {
    setIsDismissed(true);
    setLocalError(null);
    setStep("form");
    setSuccessReceipt(null);
    trackEvent("referral_feature_launch_modal_close");
    mock?.onOpenChange?.(false);
  }, [mock]);

  // User clicked "I wasn't referred" - show invite screen instead of closing
  const handleSkip = React.useCallback(() => {
    setLocalError(null);
    trackEvent("referral_feature_launch_modal_skip");
    markFeatureLaunchSeen();
    setStep("invite");
  }, [markFeatureLaunchSeen]);

  // Close from invite screen
  const handleInviteDone = React.useCallback(() => {
    setIsDismissed(true);
    setStep("form");
    trackEvent("referral_feature_launch_invite_done");
    mock?.onOpenChange?.(false);
  }, [mock]);

  const handleCodeChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCode(e.target.value);
      if (localError) setLocalError(null);
    },
    [localError],
  );

  const handleSuccessDone = React.useCallback(() => {
    setIsDismissed(true);
    setStep("form");
    setSuccessReceipt(null);
    trackEvent("referral_feature_launch_success_done");
    markFeatureLaunchSeen();
    mock?.onOpenChange?.(false);
  }, [markFeatureLaunchSeen, mock]);

  // Track modal view once
  React.useEffect(() => {
    if (
      isReferralLive &&
      shouldShow &&
      step === "form" &&
      !hasTrackedViewRef.current
    ) {
      hasTrackedViewRef.current = true;
      trackEvent("referral_feature_launch_modal_view");
    }
  }, [isReferralLive, shouldShow, step]);

  if (!isReferralLive) {
    return null;
  }

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) return;

    if (trimmedCode.length < 3) {
      setLocalError("Code must be at least 3 characters");
      return;
    }

    setLocalError(null);

    try {
      trackEvent("referral_feature_launch_claim_submit", { code: trimmedCode });

      // Pre-validate to get referrer info for success screen
      const validation: ValidateCodeResult = await validateCode(trimmedCode);

      await linkReferrer(trimmedCode);

      trackEvent("referral_feature_launch_claim_success", {
        code: trimmedCode,
      });

      // Show success state instead of closing
      setSuccessReceipt({
        referralCode: trimmedCode,
        referrerWallet: validation.referrerWallet,
        referrerEns: validation.referrerEns,
      });
      setStep("success");
    } catch (err) {
      const message = (err as Error)?.message || "Something went wrong";
      // Don't report user rejections to Sentry
      const isUserRejection =
        message?.includes("User rejected") || (err as any)?.code === 4001;
      if (!isUserRejection) {
        const normalizedError =
          err instanceof Error ? err : new Error(String(message));
        Sentry.captureException(normalizedError, {
          tags: { referralStage: "feature_launch_claim" },
          extra: { code: trimmedCode, walletAddress: address },
        });
      }
      setLocalError(message);
    }
  };

  return (
    <Dialog
      open={shouldShow}
      onOpenChange={(open) => {
        if (!open) {
          if (step === "success") {
            handleSuccessDone();
          } else if (step === "invite") {
            handleInviteDone();
          } else {
            handleClose();
          }
        }
        if (mock?.onOpenChange) mock.onOpenChange(open);
      }}
    >
      <DialogContent
        className="sm:max-w-sm p-0 overflow-hidden border border-border/20 dark:border-border/40 bg-card gap-0 rounded-[24px]"
        showCloseButton={step === "form"}
      >
        {step === "success" ? (
          <SuccessScreen
            receipt={successReceipt}
            onDone={handleSuccessDone}
            walletAddress={address}
            isReferralLive={isReferralLive}
          />
        ) : step === "invite" ? (
          <InviteScreen
            onDone={handleInviteDone}
            walletAddress={address}
            isReferralLive={isReferralLive}
          />
        ) : (
          <>
            {/* Hero Section */}
            <div className="relative overflow-hidden">
              <div className="relative px-5 sm:px-8 pt-8 sm:pt-10 pb-6 sm:pb-8 text-center space-y-4 sm:space-y-5">
                <div className="inline-flex relative">
                  <div className="relative p-4 sm:p-5 rounded-full bg-muted/50 dark:bg-muted/60 border border-border/20 dark:border-border/40">
                    <GlowSymbol className="w-7 h-7 sm:w-9 sm:h-9 text-foreground" />
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">
                    Referral Program is Live
                  </DialogTitle>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                    Were you invited by someone? Enter their code to unlock
                    bonus{" "}
                    <span className="font-semibold text-foreground">
                      Impact Points
                    </span>{" "}
                    for the next 12 weeks.
                  </p>
                </div>
              </div>
            </div>

            {/* Benefits Cards */}
            <div className="px-5 sm:px-8 pb-5 sm:pb-6">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <motion.div
                  className="group rounded-xl sm:rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3 sm:p-4 transition-colors hover:border-border/40 dark:hover:border-border/60"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    shouldReduceMotion ? { duration: 0 } : { delay: 0.05 }
                  }
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-[#4ADE80]/10 shrink-0">
                      <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#4ADE80]" />
                    </div>
                    <div className="flex flex-col gap-0.5 text-left min-w-0">
                      <motion.div
                        initial={
                          shouldReduceMotion ? false : { opacity: 0, y: 4 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        transition={
                          shouldReduceMotion ? { duration: 0 } : { delay: 0.12 }
                        }
                      >
                        <AnimatedStat
                          value={100}
                          prefix="+"
                          suffix=" pts"
                          className="font-mono text-base sm:text-lg font-semibold tracking-tight text-foreground"
                        />
                      </motion.div>
                      <div className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 leading-tight">
                        At 100 pts milestone
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="group rounded-xl sm:rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3 sm:p-4 transition-colors hover:border-border/40 dark:hover:border-border/60"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    shouldReduceMotion ? { duration: 0 } : { delay: 0.1 }
                  }
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-[color:var(--delegation-purple)]/10 shrink-0">
                      <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[color:var(--delegation-purple)]" />
                    </div>
                    <div className="flex flex-col gap-0.5 text-left min-w-0">
                      <motion.div
                        initial={
                          shouldReduceMotion ? false : { opacity: 0, y: 4 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        transition={
                          shouldReduceMotion ? { duration: 0 } : { delay: 0.18 }
                        }
                      >
                        <AnimatedStat
                          value={10}
                          prefix="+"
                          suffix="% Boost"
                          className="font-mono text-base sm:text-lg font-semibold tracking-tight text-foreground"
                        />
                      </motion.div>
                      <div className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 leading-tight">
                        For 12 weeks
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Form Section */}
            <div className="px-5 sm:px-8 pb-6 sm:pb-8">
              <form onSubmit={handleClaim} className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="modal-ref-code"
                    className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 pl-1"
                  >
                    Referral Code
                  </label>
                  <Input
                    id="modal-ref-code"
                    name="referralCode"
                    placeholder="alice.eth or 0x…"
                    value={code}
                    onChange={handleCodeChange}
                    className={`h-11 sm:h-12 rounded-xl font-mono text-center text-sm sm:text-base transition-colors ${
                      errorMessage
                        ? "border-destructive focus-visible:ring-destructive/30 focus-visible:border-destructive"
                        : "border-border/20 dark:border-border/40 focus-visible:ring-border/30 focus-visible:border-border/40"
                    }`}
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="off"
                    disabled={isLinking}
                    aria-invalid={!!errorMessage}
                    aria-describedby={
                      errorMessage ? "ref-code-error" : undefined
                    }
                  />
                  {errorMessage && (
                    <div
                      id="ref-code-error"
                      className="flex items-center gap-1.5 text-destructive text-[11px] sm:text-xs pl-1"
                      role="alert"
                    >
                      <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    type="submit"
                    className="relative h-11 sm:h-12 rounded-xl font-bold text-sm sm:text-base gap-2 overflow-hidden bg-foreground hover:bg-foreground/90 text-background transition-all hover:scale-[1.01] active:scale-[0.99]"
                    disabled={isLinking || !code.trim()}
                  >
                    {isLinking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {isLinking ? "Verifying…" : "Claim My Bonus"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 sm:h-11 text-sm"
                    onClick={handleSkip}
                  >
                    I wasn&apos;t referred
                  </Button>
                </div>
              </form>
            </div>

            {/* FAQ Section */}
            <div className="px-5 sm:px-8 pb-4 sm:pb-5">
              <Accordion
                type="single"
                collapsible
                className="space-y-1.5"
                onValueChange={(value) => {
                  if (value) {
                    trackEvent("referral_feature_launch_faq_expand", {
                      faq_id: value,
                    });
                  }
                }}
              >
                <AccordionItem
                  value="what-is-referral"
                  className="border-b-0 rounded-lg bg-muted/30 dark:bg-muted/50 px-3"
                >
                  <AccordionTrigger className="py-2.5 text-[10px] sm:text-[11px] font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:rotate-180">
                    What do I get as a referee?
                  </AccordionTrigger>
                  <AccordionContent className="pb-2.5 text-[10px] sm:text-[11px] text-muted-foreground/70 dark:text-muted-foreground/80 leading-relaxed">
                    You receive a{" "}
                    <span className="text-foreground font-semibold">
                      +100 point bonus
                    </span>{" "}
                    when you reach 100 total points, plus a{" "}
                    <span className="text-foreground font-semibold">
                      10% boost on your base points for 12 weeks
                    </span>
                    .
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem
                  value="how-activate"
                  className="border-b-0 rounded-lg bg-muted/30 dark:bg-muted/50 px-3"
                >
                  <AccordionTrigger className="py-2.5 text-[10px] sm:text-[11px] font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:rotate-180">
                    How do I earn Impact Points?
                  </AccordionTrigger>
                  <AccordionContent className="pb-2.5 text-[10px] sm:text-[11px] text-muted-foreground/70 dark:text-muted-foreground/80 leading-relaxed">
                    Earn points by holding GLW, delegating to farms, staking
                    GCTL, and more. Points are calculated weekly and finalize
                    every{" "}
                    <span className="text-foreground font-semibold font-mono">
                      Sunday at 00:00 UTC
                    </span>
                    .
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem
                  value="change-referrer"
                  className="border-b-0 rounded-lg bg-muted/30 dark:bg-muted/50 px-3"
                >
                  <AccordionTrigger className="py-2.5 text-[10px] sm:text-[11px] font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:rotate-180">
                    Can I change my referrer later?
                  </AccordionTrigger>
                  <AccordionContent className="pb-2.5 text-[10px] sm:text-[11px] text-muted-foreground/70 dark:text-muted-foreground/80 leading-relaxed">
                    You have a{" "}
                    <span className="text-foreground font-semibold">
                      7-day grace period
                    </span>{" "}
                    after linking to change your referrer. After that, the link
                    becomes permanent.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-8 py-3 sm:py-4 border-t border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50">
              <p className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 text-center leading-relaxed">
                Existing users have 14 days to claim their initial referrer.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AnimatedStat({
  value,
  prefix = "",
  suffix = "",
  duration = 900,
  delay = 0,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }
    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start - delay;
      if (elapsed < 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration, delay, shouldReduceMotion]);

  return (
    <span className={`tabular-nums ${className ?? ""}`.trim()}>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}

function SuccessScreen({
  receipt,
  onDone,
  walletAddress,
  isReferralLive,
}: {
  receipt: SuccessReceipt | null;
  onDone: () => void;
  walletAddress?: string | null;
  isReferralLive: boolean;
}) {
  const [displayPercent, setDisplayPercent] = React.useState(0);
  const [isOwnLinkCopied, setIsOwnLinkCopied] = React.useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Fetch user's own referral code for viral loop
  const ownCodeQuery = useQuery({
    queryKey: ["referral-code", walletAddress],
    queryFn: () =>
      hubGet<ReferralCodeResponse>("/referral/code", {
        params: { walletAddress },
      }),
    enabled: isReferralLive && !!walletAddress,
  });

  const copyOwnLink = React.useCallback(() => {
    if (!ownCodeQuery.data?.shareableLink) return;
    navigator.clipboard.writeText(ownCodeQuery.data.shareableLink);
    setIsOwnLinkCopied(true);
    toast.success("Your referral link copied!");
    trackEvent("referral_feature_launch_copy_own_link", {
      wallet: walletAddress,
      own_code: ownCodeQuery.data.code,
    });
    setTimeout(() => setIsOwnLinkCopied(false), 2000);
  }, [ownCodeQuery.data, walletAddress]);

  React.useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayPercent(100);
      return;
    }
    const duration = 1200;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPercent(Math.round(eased * 100));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [shouldReduceMotion]);

  const springIn = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 200, damping: 15, delay: 0.1 };
  const springInner = shouldReduceMotion
    ? { duration: 0 }
    : { delay: 0.3, type: "spring", stiffness: 300 };
  const fadeUp = (delay: number) =>
    shouldReduceMotion ? { duration: 0 } : { delay, duration: 0.2 };

  const referrerDisplay =
    receipt?.referrerEns ||
    (receipt?.referrerWallet
      ? `${receipt.referrerWallet.slice(0, 6)}...${receipt.referrerWallet.slice(
          -4,
        )}`
      : receipt?.referralCode);

  return (
    <div className="relative overflow-hidden">
      <div className="relative px-5 sm:px-8 py-8 sm:py-10 flex flex-col items-center text-center space-y-5 sm:space-y-6">
        {/* Success checkmark */}
        <motion.div
          className="relative"
          initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springIn}
        >
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-[#4ADE80]/10 border border-[#4ADE80]/20 flex items-center justify-center">
            <motion.div
              initial={shouldReduceMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={springInner}
            >
              <Check className="h-8 w-8 sm:h-10 sm:w-10 text-[#4ADE80] stroke-[2.5]" />
            </motion.div>
          </div>
        </motion.div>

        {/* Title and subtitle */}
        <motion.div
          className="space-y-2"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeUp(0.2)}
        >
          <DialogTitle className="text-xl sm:text-2xl font-semibold tracking-tight">
            You&apos;re Connected!
          </DialogTitle>
          <p className="text-xs sm:text-sm text-muted-foreground/60 dark:text-muted-foreground/80">
            Your 10% boost is active. +100 unlocks after you reach 100 points.
          </p>
        </motion.div>

        {/* Referrer info card */}
        {referrerDisplay && (
          <motion.div
            className="w-full rounded-xl sm:rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3 sm:p-4"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeUp(0.3)}
          >
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-muted/50 dark:bg-muted/60 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                  Your Referrer
                </div>
                <div className="text-xs sm:text-sm font-mono font-semibold truncate">
                  {referrerDisplay}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Unlocked bonuses */}
        <motion.div
          className="w-full space-y-2 sm:space-y-3"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeUp(0.4)}
        >
          <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
            Bonus Details
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50">
              <div className="flex flex-col items-center text-center gap-1 sm:gap-1.5">
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-[#4ADE80]/10 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#4ADE80]" />
                </div>
                <div className="font-mono font-semibold text-sm sm:text-base text-foreground">
                  +100 pts
                </div>
                <div className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80">
                  Unlocks at 100 points
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50">
              <div className="flex flex-col items-center text-center gap-1 sm:gap-1.5">
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-[color:var(--delegation-purple)]/10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[color:var(--delegation-purple)]" />
                </div>
                <div className="font-mono font-semibold text-sm sm:text-base text-foreground">
                  +10%
                </div>
                <div className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80">
                  12-week boost
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Progress indicator */}
        <motion.div
          className="w-full space-y-2"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fadeUp(0.7)}
        >
          <div className="flex items-center justify-between text-[11px] sm:text-xs">
            <span className="font-mono text-muted-foreground/60 dark:text-muted-foreground/80">
              Setup progress
            </span>
            <span className="font-mono font-semibold text-foreground tabular-nums">
              {displayPercent}%
            </span>
          </div>
          <div className="h-1.5 sm:h-2 rounded-full bg-muted/50 dark:bg-muted/60 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-foreground"
              initial={shouldReduceMotion ? false : { width: "0%" }}
              animate={{ width: "100%" }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { delay: 0.2, duration: 1.2, ease: "easeOut" }
              }
            />
          </div>
        </motion.div>

        {/* Viral loop - invite others */}
        {ownCodeQuery.data?.shareableLink && (
          <motion.div
            className="w-full space-y-2 sm:space-y-3"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeUp(0.85)}
          >
            <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              Start Your Network
            </div>
            <button
              type="button"
              onClick={copyOwnLink}
              className="w-full flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 hover:border-border/40 dark:hover:border-border/60 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-[#4ADE80]/10 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#4ADE80]" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-foreground">
                    Invite friends, earn more
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 truncate">
                    {ownCodeQuery.data.shareableLink}
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                {isOwnLinkCopied ? (
                  <Check className="w-4 h-4 text-[#4ADE80]" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>
          </motion.div>
        )}

        {/* Done button */}
        <motion.div
          className="w-full pt-1 sm:pt-2"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeUp(0.9)}
        >
          <Button onClick={onDone} className="w-full h-10 sm:h-11">
            Start Earning
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function InviteScreen({
  onDone,
  walletAddress,
  isReferralLive,
}: {
  onDone: () => void;
  walletAddress?: string | null;
  isReferralLive: boolean;
}) {
  const [isLinkCopied, setIsLinkCopied] = React.useState(false);
  const [isQROpen, setIsQROpen] = React.useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Fetch user's referral code
  const ownCodeQuery = useQuery({
    queryKey: ["referral-code", walletAddress],
    queryFn: () =>
      hubGet<ReferralCodeResponse>("/referral/code", {
        params: { walletAddress },
      }),
    enabled: isReferralLive && !!walletAddress,
  });

  const copyLink = React.useCallback(() => {
    if (!ownCodeQuery.data?.shareableLink) return;
    navigator.clipboard.writeText(ownCodeQuery.data.shareableLink);
    setIsLinkCopied(true);
    toast.success("Your referral link copied!");
    trackEvent("referral_feature_launch_invite_copy_link", {
      wallet: walletAddress,
      code: ownCodeQuery.data.code,
    });
    setTimeout(() => setIsLinkCopied(false), 2000);
  }, [ownCodeQuery.data, walletAddress]);

  const springIn = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 200, damping: 15, delay: 0.1 };
  const fadeUp = (delay: number) =>
    shouldReduceMotion ? { duration: 0 } : { delay, duration: 0.2 };

  return (
    <div className="relative overflow-hidden">
      <div className="relative px-5 sm:px-8 py-8 sm:py-10 flex flex-col items-center text-center space-y-5 sm:space-y-6">
        {/* Icon */}
        <motion.div
          className="relative"
          initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springIn}
        >
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-[#4ADE80]/10 border border-[#4ADE80]/20 flex items-center justify-center">
            <Users className="h-8 w-8 sm:h-10 sm:w-10 text-[#4ADE80]" />
          </div>
        </motion.div>

        {/* Title and subtitle */}
        <motion.div
          className="space-y-2"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeUp(0.2)}
        >
          <DialogTitle className="text-xl sm:text-2xl font-semibold tracking-tight">
            Become a Referrer
          </DialogTitle>
          <p className="text-xs sm:text-sm text-muted-foreground/60 dark:text-muted-foreground/80 max-w-xs mx-auto">
            No worries! You can still earn bonus points by inviting others to
            Glow.
          </p>
        </motion.div>

        {/* Benefits preview */}
        <motion.div
          className="w-full rounded-xl sm:rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3 sm:p-4"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeUp(0.3)}
        >
          <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 mb-2 sm:mb-3">
            What You Earn
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-left">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-[#4ADE80]/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#4ADE80]" />
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">5-20%</span> of
                your referees Impact Points
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-left">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-[color:var(--delegation-purple)]/10 flex items-center justify-center shrink-0">
                <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[color:var(--delegation-purple)]" />
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground">
                Grow your tier:{" "}
                <span className="font-semibold text-foreground">
                  1 ref → 7+
                </span>{" "}
                for max rewards
              </div>
            </div>
          </div>
        </motion.div>

        {/* Copy link section */}
        {ownCodeQuery.data?.shareableLink && (
          <motion.div
            className="w-full space-y-2 sm:space-y-3"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeUp(0.4)}
          >
            <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              Your Referral Link
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="flex-1 flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#4ADE80]/30 bg-[#4ADE80]/5 hover:bg-[#4ADE80]/10 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-mono text-foreground truncate">
                    {ownCodeQuery.data.shareableLink}
                  </div>
                </div>
                <div className="shrink-0">
                  {isLinkCopied ? (
                    <Check className="w-4 h-4 text-[#4ADE80]" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#4ADE80]" />
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setIsQROpen(true)}
                className="shrink-0 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 hover:bg-muted/50 dark:hover:bg-muted/70 transition-colors"
                aria-label="Show QR code"
              >
                <QrCode className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <QRCodeDialog
              open={isQROpen}
              onOpenChange={setIsQROpen}
              url={ownCodeQuery.data.shareableLink}
              title="Your Referral QR"
            />
          </motion.div>
        )}

        {ownCodeQuery.isLoading && (
          <motion.div
            className="w-full flex justify-center py-4"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={fadeUp(0.4)}
          >
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </motion.div>
        )}

        {/* Done button */}
        <motion.div
          className="w-full pt-1 sm:pt-2"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeUp(0.5)}
        >
          <Button onClick={onDone} className="w-full h-10 sm:h-11">
            Done
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
