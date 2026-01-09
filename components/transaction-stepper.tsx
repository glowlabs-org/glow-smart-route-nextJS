"use client";

import React from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Check, X, Loader2, ExternalLink, Wallet, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlowSymbol } from "@/components/glow-symbol";

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

const TOKEN_ICONS: Record<string, string> = {
  ETH: "/images/tokens/eth.svg",
  USDC: "/images/tokens/usdc.svg",
  USDG: "/images/tokens/usdg.svg",
};

function TokenIcon({ symbol, size = 20 }: { symbol: string; size?: number }) {
  if (symbol === "GLW") {
    return (
      <div
        className="rounded-full bg-muted border border-border flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <GlowSymbol className="w-3 h-3" />
      </div>
    );
  }

  const iconSrc = TOKEN_ICONS[symbol];
  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt={symbol}
        className="rounded-full"
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-muted border border-border flex items-center justify-center text-xs font-medium"
      style={{ width: size, height: size }}
    >
      {symbol.slice(0, 2)}
    </div>
  );
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

const stepNodeVariants: Variants = {
  idle: { scale: 1, opacity: 0.5 },
  active: { scale: 1, opacity: 1 },
  completed: { scale: 1, opacity: 1 },
  error: { scale: 1, opacity: 1 },
};

const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.15, 1],
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

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

const stepContentVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: { opacity: 0, x: 8, transition: { duration: 0.2 } },
};

function StepNode({ status }: { status: StepStatus }) {
  const isActive = status === "waiting_signature" || status === "confirming";
  const isCompleted = status === "completed";
  const isError = status === "error";

  return (
    <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
      {/* Pulse ring for active states */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary"
          variants={pulseVariants}
          animate="pulse"
        />
      )}

      {/* Main node circle */}
      <motion.div
        className={cn(
          "relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300",
          status === "idle" && "border-border bg-background",
          status === "waiting_signature" &&
            "border-primary bg-primary/10 shadow-[0_0_12px_rgba(var(--primary-rgb),0.3)]",
          status === "confirming" && "border-primary bg-primary/10",
          status === "completed" &&
            "border-green-500 bg-green-500 dark:border-green-400 dark:bg-green-400",
          status === "error" && "border-red-500 bg-red-500"
        )}
        variants={stepNodeVariants}
        initial="idle"
        animate={
          isActive ? "active" : isCompleted || isError ? "completed" : "idle"
        }
      >
        {status === "idle" && (
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        )}

        {status === "waiting_signature" && (
          <Wallet className="w-4 h-4 text-primary animate-pulse" />
        )}

        {status === "confirming" && (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        )}

        {status === "completed" && (
          <svg
            className="w-4 h-4 text-white dark:text-black"
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
        )}

        {status === "error" && <X className="w-4 h-4 text-white" />}
      </motion.div>
    </div>
  );
}

function TransactionStepCard({
  step,
  isLast,
  chainId,
}: {
  step: TransactionStep;
  isLast: boolean;
  chainId?: number;
}) {
  const isActive =
    step.status === "waiting_signature" || step.status === "confirming";
  const showTimer = isActive && step.startedAt;

  const statusText: Record<StepStatus, string> = {
    idle: "Pending",
    waiting_signature: "Waiting for signature...",
    confirming: "Confirming on-chain...",
    completed: "Completed",
    error: step.errorMessage || "Failed",
  };

  return (
    <div className="flex gap-3 min-h-[56px]">
      {/* Timeline column */}
      <div className="flex flex-col items-center">
        <StepNode status={step.status} />
        {/* Connecting line */}
        {!isLast && (
          <div className="relative w-0.5 flex-1 min-h-[24px] my-1">
            <div className="absolute inset-0 bg-border" />
            <motion.div
              className="absolute inset-0 bg-green-500 dark:bg-green-400 origin-top"
              initial={{ scaleY: 0 }}
              animate={{
                scaleY: step.status === "completed" ? 1 : 0,
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        )}
      </div>

      {/* Content column */}
      <motion.div
        className={cn("flex-1 pb-4", isLast && "pb-0")}
        variants={stepContentVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Token pair icons */}
            {step.tokenFrom && step.tokenTo && (
              <div className="flex items-center gap-1 mr-1">
                <TokenIcon symbol={step.tokenFrom} size={18} />
                <span className="text-muted-foreground text-xs">→</span>
                <TokenIcon symbol={step.tokenTo} size={18} />
              </div>
            )}

            {/* Title */}
            <span
              className={cn(
                "text-sm font-medium transition-colors duration-200",
                step.status === "idle" && "text-muted-foreground",
                isActive && "text-foreground",
                step.status === "completed" && "text-foreground",
                step.status === "error" && "text-red-500"
              )}
            >
              {step.title}
            </span>
          </div>

          {/* Right side: Timer or Etherscan link */}
          <div className="flex items-center gap-2">
            {showTimer && <ElapsedTimer startedAt={step.startedAt!} />}
            {step.status === "completed" && step.txHash && (
              <a
                href={getEtherscanUrl(step.txHash, chainId)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="hidden sm:inline">View</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Status text */}
        <AnimatePresence mode="wait">
          <motion.p
            key={step.status}
            className={cn(
              "text-xs mt-0.5 transition-colors duration-200",
              step.status === "idle" && "text-muted-foreground/60",
              step.status === "waiting_signature" && "text-primary",
              step.status === "confirming" && "text-muted-foreground",
              step.status === "completed" &&
                "text-green-600 dark:text-green-400",
              step.status === "error" && "text-red-500"
            )}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
          >
            {step.description || statusText[step.status]}
          </motion.p>
        </AnimatePresence>

        {/* Error details */}
        {step.status === "error" && step.errorMessage && (
          <motion.div
            className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
          >
            <p className="text-xs text-red-500 break-all line-clamp-2">
              {step.errorMessage}
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function ProgressHeader({
  steps,
  currentStepIndex,
}: {
  steps: TransactionStep[];
  currentStepIndex: number;
}) {
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const currentStep = steps[currentStepIndex];

  return (
    <div className="mb-6">
      {/* Segmented progress dots */}
      <div className="flex items-center justify-center gap-1.5 mb-3">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              index < steps.length - 1
                ? "flex-1 max-w-[40px]"
                : "flex-1 max-w-[40px]",
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
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <span className="text-border">•</span>
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
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Preparing transaction...</span>
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

      {/* Steps timeline */}
      <div className="space-y-0">
        <AnimatePresence mode="sync">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.3 }}
            >
              <TransactionStepCard
                step={step}
                isLast={index === steps.length - 1}
                chainId={chainId}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default TransactionStepper;
