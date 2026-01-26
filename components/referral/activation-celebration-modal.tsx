"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ActivationBonusIcon } from "@/components/impact-icons";
import { hubPost } from "@/lib/api/hub-client";
import { useReferral } from "@/hooks/use-referral";
import { motion, useReducedMotion } from "framer-motion";
import { useReferralLaunch } from "@/hooks/use-referral-launch";
import { trackEvent } from "@/lib/telemetry";
import * as Sentry from "@sentry/nextjs";

const SPARKLES = [
  { top: "18%", left: "16%", size: "6px", delay: 0 },
  { top: "12%", left: "62%", size: "5px", delay: 0.2 },
  { top: "28%", left: "78%", size: "4px", delay: 0.4 },
  { top: "34%", left: "26%", size: "4px", delay: 0.6 },
  { top: "48%", left: "70%", size: "6px", delay: 0.8 },
  { top: "52%", left: "36%", size: "5px", delay: 1 },
];

interface ActivationCelebrationModalMock {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  status?: {
    activationBonus?: {
      awarded?: boolean;
      celebrationSeen?: boolean;
    };
  };
  walletAddress?: string | null;
  onSeen?: () => void;
}

interface ActivationCelebrationModalProps {
  mock?: ActivationCelebrationModalMock;
}

export function ActivationCelebrationModal({
  mock,
}: ActivationCelebrationModalProps) {
  const { address: connectedAddress } = useAccount();
  const queryClient = useQueryClient();
  const { status: referralStatus } = useReferral();
  const shouldReduceMotion = useReducedMotion();
  const address = mock?.walletAddress ?? connectedAddress;
  const status = mock?.status ?? referralStatus;
  const [isDismissed, setIsDismissed] = React.useState(false);
  const { isLive: isReferralLive } = useReferralLaunch();

  const shouldShow =
    mock?.open ??
    Boolean(
      address &&
        !isDismissed &&
        status?.activationBonus?.awarded &&
        !status?.activationBonus?.celebrationSeen
    );

  // Track view when modal is shown
  const hasTrackedViewRef = React.useRef(false);
  React.useEffect(() => {
    if (shouldShow && !hasTrackedViewRef.current && !mock) {
      trackEvent("referral_activation_celebration_view", {
        wallet_address: address ?? null,
      });
      hasTrackedViewRef.current = true;
    }
  }, [shouldShow, address, mock]);

  const markActivationSeen = React.useCallback(async () => {
    if (mock) {
      mock.onSeen?.();
      return;
    }
    if (!address) return;
    try {
      await hubPost("/referral/activation-seen", {
        walletAddress: address,
      });
      queryClient.invalidateQueries({
        queryKey: ["referral-status", address],
      });
    } catch (err) {
      const normalizedError =
        err instanceof Error ? err : new Error(String(err));
      Sentry.captureException(normalizedError, {
        tags: { referralStage: "activation_seen" },
        extra: { walletAddress: address },
      });
    }
  }, [address, mock, queryClient]);

  const handleClose = React.useCallback(() => {
    setIsDismissed(true);
    markActivationSeen();
    mock?.onOpenChange?.(false);
  }, [markActivationSeen, mock]);

  if (!isReferralLive) {
    return null;
  }

  return (
    <Dialog
      open={shouldShow}
      onOpenChange={(open) => {
        if (!open) handleClose();
        if (mock?.onOpenChange) mock.onOpenChange(open);
      }}
    >
      <DialogContent className="md:max-w-[480px] p-0 overflow-hidden border border-border/60 shadow-2xl">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#16a34a]/10 via-transparent to-transparent dark:from-[#4ade80]/10" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#16a34a]/10 to-transparent dark:from-[#4ade80]/10" />
          <motion.div
            aria-hidden
            className="absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[#16a34a]/10 blur-2xl dark:bg-[#4ade80]/10"
            animate={
              shouldReduceMotion
                ? { opacity: 0.4 }
                : { opacity: [0.3, 0.7, 0.3], scale: [0.9, 1.05, 0.9] }
            }
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
            }
          />
          {!shouldReduceMotion &&
            SPARKLES.map((sparkle) => (
              <motion.span
                key={`${sparkle.left}-${sparkle.top}`}
                aria-hidden
                className="absolute rounded-full bg-[#16a34a]/40 dark:bg-[#4ade80]/40"
                style={{
                  top: sparkle.top,
                  left: sparkle.left,
                  width: sparkle.size,
                  height: sparkle.size,
                }}
                animate={{ opacity: [0, 0.7, 0], scale: [0.6, 1.2, 0.6] }}
                transition={{
                  duration: 2.4,
                  delay: sparkle.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          <div className="relative p-8 text-center space-y-5">
            <motion.div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#16a34a]/10 text-[#16a34a] shadow-[0_0_20px_-6px_rgba(22,163,74,0.6)] dark:bg-[#4ade80]/10 dark:text-[#4ade80] dark:shadow-[0_0_20px_-6px_rgba(74,222,128,0.6)]"
              initial={shouldReduceMotion ? false : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 240, damping: 16 }
              }
            >
              <ActivationBonusIcon className="w-6 h-6" />
            </motion.div>
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Activation Bonus Unlocked
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                You just earned a one-time +100 Impact Points bonus.
              </DialogDescription>
            </div>
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.1 }}
            >
              <Button onClick={handleClose} className="w-full">
                Awesome
              </Button>
            </motion.div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
