"use client";

import * as React from "react";
import { useReferral, type ValidateCodeResult } from "@/hooks/use-referral";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Check,
  Users,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { trackEvent } from "@/lib/telemetry";
import { GlowSymbol } from "@/components/glow-symbol";
import { hubPost } from "@/lib/api/hub-client";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useReferralLaunch } from "@/hooks/use-referral-launch";

interface SuccessReceipt {
  referralCode: string;
  referrerWallet?: string;
  referrerEns?: string;
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
  const [step, setStep] = React.useState<"form" | "success">("form");
  const [successReceipt, setSuccessReceipt] =
    React.useState<SuccessReceipt | null>(null);
  const hasTrackedViewRef = React.useRef(false);
  const { isLive: isReferralLive } = useReferralLaunch();

  // Derive error message from linkError or localError
  const errorMessage = localError || (linkError as Error | null)?.message;

  const hasSeen = !!status?.featureLaunchModal?.seen || isDismissed;
  const isControlled = mock?.open !== undefined;

  if (!isReferralLive) {
    return null;
  }

  // Modal should show if: eligible + no referrer + not seen, OR in success state
  const computedShouldShow =
    step === "success" ||
    (status?.canClaim && !status?.hasReferrer && !hasSeen);
  const shouldShow = isControlled ? Boolean(mock?.open) : computedShouldShow;

  // Track modal view once
  if (shouldShow && step === "form" && !hasTrackedViewRef.current) {
    hasTrackedViewRef.current = true;
    trackEvent("referral_feature_launch_modal_view");
  }

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

  const handleDismiss = React.useCallback(() => {
    setIsDismissed(true);
    setLocalError(null);
    setStep("form");
    setSuccessReceipt(null);
    trackEvent("referral_feature_launch_modal_dismiss");
    markFeatureLaunchSeen();
    if (mock?.onOpenChange) mock.onOpenChange(false);
  }, [markFeatureLaunchSeen, mock?.onOpenChange]);

  const handleCodeChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCode(e.target.value);
      if (localError) setLocalError(null);
    },
    [localError]
  );

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
      setLocalError(message);
    }
  };

  const handleSuccessDone = React.useCallback(() => {
    setIsDismissed(true);
    setStep("form");
    setSuccessReceipt(null);
    trackEvent("referral_feature_launch_success_done");
    markFeatureLaunchSeen();
    if (mock?.onOpenChange) mock.onOpenChange(false);
  }, [markFeatureLaunchSeen, mock?.onOpenChange]);

  return (
    <Dialog
      open={shouldShow}
      onOpenChange={(open) => {
        if (!open) {
          if (step === "success") {
            handleSuccessDone();
          } else {
            handleDismiss();
          }
        }
        if (mock?.onOpenChange) mock.onOpenChange(open);
      }}
    >
      <DialogContent
        className="sm:max-w-sm p-0 overflow-hidden border border-border/50 gap-0"
        showCloseButton={step !== "success"}
      >
        {step === "success" ? (
          <SuccessScreen receipt={successReceipt} onDone={handleSuccessDone} />
        ) : (
          <>
            {/* Hero Section with Glow Gradient */}
            <div className="relative overflow-hidden">
              <div className="relative px-8 pt-10 pb-8 text-center space-y-5">
                <div className="inline-flex relative">
                  <div className="absolute -inset-3 rounded-full glow-gradient opacity-60 blur-xl" />
                  <div className="relative p-5 rounded-full glow-gradient">
                    <GlowSymbol className="w-9 h-9 !text-glow-black" />
                  </div>
                </div>

                <div className="space-y-3">
                  <DialogTitle className="text-2xl sm:text-[1.7rem] font-bold tracking-tight leading-tight">
                    Referral Program is Live
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                    Were you invited by someone? Claim your referrer to unlock
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
            <div className="px-8 pb-6">
              <div className="grid grid-cols-2 gap-3">
                <motion.div
                  className="group rounded-2xl border border-border/60 bg-background p-4 transition-colors hover:border-[color:var(--color-glow-green)]/40"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    shouldReduceMotion ? { duration: 0 } : { delay: 0.05 }
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--color-glow-green)]/25 bg-[color:var(--color-glow-green)]/5">
                      <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex flex-col gap-0.5 text-left">
                      <motion.div
                        className="font-bold text-sm"
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
                          suffix=" Points"
                          className="font-mono text-lg font-bold tracking-tight text-foreground"
                        />
                      </motion.div>
                      <div className="text-[10px] text-muted-foreground leading-tight">
                        At 100 pts milestone
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="group rounded-2xl border border-border/60 bg-background p-4 transition-colors hover:border-[color:var(--color-glow-purple)]/40"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    shouldReduceMotion ? { duration: 0 } : { delay: 0.1 }
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--color-glow-purple)]/25 bg-[color:var(--color-glow-purple)]/5">
                      <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex flex-col gap-0.5 text-left">
                      <motion.div
                        className="font-bold text-sm"
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
                          className="font-mono text-lg font-bold tracking-tight text-foreground"
                        />
                      </motion.div>
                      <div className="text-[10px] text-muted-foreground leading-tight">
                        For 12 weeks
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Form Section */}
            <div className="px-8 pb-8">
              <form onSubmit={handleClaim} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="modal-ref-code"
                    className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground pl-1"
                  >
                    Referral Code
                  </label>
                  <Input
                    id="modal-ref-code"
                    name="referralCode"
                    placeholder="alice.eth or 0x…"
                    value={code}
                    onChange={handleCodeChange}
                    className={`h-12 rounded-xl font-mono text-center text-base transition-colors ${
                      errorMessage
                        ? "border-destructive focus-visible:ring-destructive/30 focus-visible:border-destructive"
                        : "border-border/60 focus-visible:ring-[color:var(--color-glow-green)]/30 focus-visible:border-[color:var(--color-glow-green)]/50"
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
                      className="flex items-center gap-1.5 text-destructive text-xs pl-1"
                      role="alert"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    type="submit"
                    className="relative h-12 rounded-xl font-bold text-base gap-2 overflow-hidden bg-foreground hover:bg-foreground/90 text-background transition-all hover:scale-[1.01] active:scale-[0.99]"
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
                    variant="ghost"
                    className="h-9 text-muted-foreground hover:text-foreground text-xs font-medium"
                    onClick={handleDismiss}
                  >
                    I wasn't referred · Skip
                  </Button>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-border/50 bg-muted/20">
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
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
}: {
  receipt: SuccessReceipt | null;
  onDone: () => void;
}) {
  const [displayPercent, setDisplayPercent] = React.useState(0);
  const shouldReduceMotion = useReducedMotion();

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
    shouldReduceMotion
      ? { duration: 0 }
      : { delay, duration: 0.2 };
  const slideFill = (delay: number) =>
    shouldReduceMotion
      ? { duration: 0 }
      : { delay, duration: 0.5, ease: "easeOut" };

  const referrerDisplay =
    receipt?.referrerEns ||
    (receipt?.referrerWallet
      ? `${receipt.referrerWallet.slice(0, 6)}...${receipt.referrerWallet.slice(
          -4
        )}`
      : receipt?.referralCode);

  return (
    <div className="relative overflow-hidden">
      <div className="relative px-8 py-10 flex flex-col items-center text-center space-y-6">
        {/* Success checkmark with pulse animation */}
        <motion.div
          className="relative"
          initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springIn}
        >
          <div className="absolute -inset-4 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
          <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <motion.div
              initial={shouldReduceMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={springInner}
            >
              <Check className="h-10 w-10 text-white stroke-[3]" />
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
          <DialogTitle className="text-2xl sm:text-[1.7rem] font-bold tracking-tight">
            You're Connected!
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Your 10% boost is active. +100 unlocks after you reach 100 points.
          </p>
        </motion.div>

        {/* Referrer info card */}
        {referrerDisplay && (
          <motion.div
            className="w-full rounded-2xl border border-border/60 bg-muted/30 p-4"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeUp(0.3)}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Your Referrer
                </div>
                <div className="text-sm font-mono font-semibold truncate">
                  {referrerDisplay}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Unlocked bonuses */}
        <motion.div
          className="w-full space-y-3"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeUp(0.4)}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Bonus Details
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative overflow-hidden p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
              <motion.div
                className="absolute inset-0 bg-emerald-500/5"
                initial={shouldReduceMotion ? false : { x: "-100%" }}
                animate={{ x: "0%" }}
                transition={slideFill(0.5)}
              />
              <div className="relative flex flex-col items-center text-center gap-1.5">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                <div className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                  +100 pts
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Unlocks at 100 points
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden p-4 rounded-2xl border border-purple-500/30 bg-purple-500/10">
              <motion.div
                className="absolute inset-0 bg-purple-500/5"
                initial={shouldReduceMotion ? false : { x: "-100%" }}
                animate={{ x: "0%" }}
                transition={slideFill(0.6)}
              />
              <div className="relative flex flex-col items-center text-center gap-1.5">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <div className="font-bold text-base text-purple-600 dark:text-purple-400">
                  +10%
                </div>
                <div className="text-[10px] text-muted-foreground">
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
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Setup progress</span>
            <span className="font-mono font-bold text-foreground tabular-nums">
              {displayPercent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full glow-gradient"
              initial={shouldReduceMotion ? false : { width: "0%" }}
              animate={{ width: "100%" }}
              transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.2, duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* Done button */}
        <motion.div
          className="w-full pt-2"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeUp(0.8)}
        >
          <Button onClick={onDone} className="w-full ">
            Start Earning
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
