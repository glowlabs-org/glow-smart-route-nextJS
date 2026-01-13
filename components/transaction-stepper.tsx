"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { X, Loader2, ExternalLink, Wallet, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus =
  | "idle"
  | "waiting_signature"
  | "confirming"
  | "completed"
  | "error";

export interface TransactionStep {
  id: string;
  title: string;
  description?: string;
  tokenFrom?: "ETH" | "USDC" | "USDG" | "GLW";
  tokenTo?: "ETH" | "USDC" | "USDG" | "GLW";
  status: StepStatus;
  txHash?: string;
  startedAt?: number;
  errorMessage?: string;
}

interface TransactionStepperProps {
  steps: TransactionStep[];
  chainId?: number;
  className?: string;
}

function getEtherscanUrl(txHash: string, chainId: number = 1): string {
  const baseUrls: Record<number, string> = {
    1: "https://etherscan.io",
    11155111: "https://sepolia.etherscan.io",
  };
  const baseUrl = baseUrls[chainId] || baseUrls[1];
  return `${baseUrl}/tx/${txHash}`;
}

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
      <Clock className="w-3 h-3" />
      <span>{elapsed}s</span>
    </div>
  );
}

const checkmarkPathVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.3, ease: "easeOut" },
      opacity: { duration: 0.1 },
    },
  },
};

// Animation variants for staggered children
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 12, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return (
        <svg
          className="w-4 h-4 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            d="M5 12l5 5L19 7"
            variants={checkmarkPathVariants}
            initial="hidden"
            animate="visible"
          />
        </svg>
      );
    case "waiting_signature":
      return <Wallet className="w-4 h-4 text-primary" />;
    case "confirming":
      return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    case "error":
      return <X className="w-4 h-4 text-white" />;
    default:
      return <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />;
  }
}

function TimelineItem({
  step,
  chainId,
  isLast,
}: {
  step: TransactionStep;
  chainId: number;
  isLast: boolean;
}) {
  const isActive =
    step.status === "waiting_signature" || step.status === "confirming";
  const showTimer = isActive && step.startedAt;

  const statusLabel: Record<StepStatus, string> = {
    idle: "Pending",
    waiting_signature: "Waiting for signature...",
    confirming: "Confirming on-chain...",
    completed: "Completed",
    error: "Failed",
  };

  return (
    <motion.li
      className={cn("ml-8 relative", !isLast && "pb-6")}
      variants={itemVariants}
      aria-current={isActive ? "step" : undefined}
    >
      {/* The icon circle - positioned over the border line */}
      <span
        className={cn(
          "absolute -left-[2.55rem] flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-background transition-all duration-300",
          step.status === "completed" && "bg-green-500 dark:bg-green-400",
          step.status === "error" && "bg-red-500",
          isActive && "bg-primary/20",
          step.status === "idle" && "bg-muted"
        )}
      >
        {/* Pulsing animation for active states */}
        {isActive && (
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/40 opacity-75" />
        )}
        <span className="relative z-10">
          <StepIcon status={step.status} />
        </span>
      </span>

      {/* Content: Title, Status, Timer */}
      <div className="flex flex-col min-h-[32px] justify-center text-left">
        <div className="flex items-center justify-between gap-2">
          <h3
            className={cn(
              "text-sm font-medium transition-colors duration-200",
              step.status === "completed" && "text-foreground",
              isActive && "text-foreground",
              step.status === "idle" && "text-muted-foreground",
              step.status === "error" && "text-red-500"
            )}
          >
            {step.title}
          </h3>

          {/* Right side: Timer or Etherscan link */}
          <div className="flex items-center gap-2 shrink-0">
            {showTimer && <ElapsedTimer startedAt={step.startedAt!} />}
            {step.status === "completed" && step.txHash && (
              <a
                href={getEtherscanUrl(step.txHash, chainId)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Status text - hide for errors since we show error box */}
        {step.status !== "error" && (
          <p
            className={cn(
              "text-xs text-left transition-colors duration-200",
              step.status === "completed" &&
                "text-green-600 dark:text-green-400",
              step.status === "waiting_signature" && "text-primary",
              step.status === "confirming" && "text-muted-foreground",
              step.status === "idle" && "text-muted-foreground/60"
            )}
          >
            {statusLabel[step.status]}
          </p>
        )}

        {/* Error message */}
        {step.status === "error" && (
          <p className="text-xs text-left text-red-500">
            {step.errorMessage?.includes("User rejected") ||
            step.errorMessage?.includes("user rejected")
              ? "Transaction rejected"
              : step.errorMessage || "Transaction failed"}
          </p>
        )}
      </div>
    </motion.li>
  );
}

function ProgressHeader({
  steps,
  currentStepIndex,
}: {
  steps: TransactionStep[];
  currentStepIndex: number;
}) {
  const currentStep = steps[currentStepIndex];

  return (
    <div className="mb-5">
      {/* Segmented progress bar */}
      <div className="flex items-center gap-1 mb-3">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            className={cn(
              "h-1 rounded-full flex-1 transition-all duration-300",
              step.status === "completed" && "bg-green-500 dark:bg-green-400",
              (step.status === "waiting_signature" ||
                step.status === "confirming") &&
                "bg-primary",
              step.status === "idle" && "bg-muted",
              step.status === "error" && "bg-red-500"
            )}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
          />
        ))}
      </div>

      {/* Step counter and title */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground font-medium tabular-nums">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <span className="text-muted-foreground/30">•</span>
          <span className="text-foreground font-medium">
            {currentStep?.title || "Processing"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function TransactionStepper({
  steps,
  chainId = 1,
  className,
}: TransactionStepperProps) {
  const currentStepIndex = React.useMemo(() => {
    if (steps.length === 0) return 0;
    const activeIndex = steps.findIndex(
      (s) => s.status === "waiting_signature" || s.status === "confirming"
    );
    if (activeIndex >= 0) return activeIndex;

    const lastCompleted = steps.reduce(
      (acc, s, i) => (s.status === "completed" ? i : acc),
      -1
    );
    return Math.min(lastCompleted + 1, steps.length - 1);
  }, [steps]);

  const allCompleted =
    steps.length > 0 && steps.every((s) => s.status === "completed");
  const hasError = steps.some((s) => s.status === "error");

  // Empty state - no steps yet
  if (steps.length === 0) {
    return (
      <div className={cn("w-full", className)}>
        <div className="flex items-center justify-center py-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">
              Preparing transaction...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Progress header */}
      {!allCompleted && !hasError && (
        <ProgressHeader steps={steps} currentStepIndex={currentStepIndex} />
      )}

      {/* Timeline with left border */}
      <motion.ol
        className="relative border-l-2 border-border/40 ml-4"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {steps.map((step, index) => (
          <TimelineItem
            key={step.id}
            step={step}
            chainId={chainId}
            isLast={index === steps.length - 1}
          />
        ))}
      </motion.ol>
    </div>
  );
}

export default TransactionStepper;
