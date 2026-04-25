"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, X, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { GlowSymbolAnimated } from "@/components/glow-symbol-animated";
import { cn } from "@/lib/utils";
import { GlwWorthIcon, SteeringIcon } from "@/components/impact-icons";
import { useLang } from "@/lib/i18n";

export interface TransactionDetail {
  label: string;
  value: string | React.ReactNode;
  unit?: string;
}

export interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Transaction states
  isSubmitting?: boolean;
  isSuccess?: boolean;
  isError?: boolean;

  // Layout overrides
  contentClassName?: string;
  bodyClassName?: string;

  // Content customization
  title?: string;
  successTitle?: string;
  errorTitle?: string;
  processingTitle?: string;
  description?: string;
  processingDescription?: string;
  errorDescription?: string;

  // Transaction details
  transactionDetails: TransactionDetail[];
  successDetails?: TransactionDetail[];

  // Transaction hash
  txHash?: string | null;

  // Network fee
  networkFee?: string;
  isNetworkFeeLoading?: boolean;

  // Custom content
  reviewContent?: React.ReactNode;
  successContent?: React.ReactNode;
  errorContent?: React.ReactNode;
  footer?: React.ReactNode;
  successFooter?: React.ReactNode;

  // Features
  showImpactScoreBoost?: boolean;
  impactScoreBoostMessage?: React.ReactNode;
  impactScoreBoostIconType?: "glw" | "gctl" | "default";

  // Processing progress
  showProcessingProgress?: boolean;
  processingMaxSeconds?: number;

  // Actions
  onConfirm?: () => void | Promise<void>;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

function TransactionDetailRow({ label, value, unit }: TransactionDetail) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground text-sm">{label}</span>
      {unit ? (
        <div className="text-right">
          <span className="text-foreground text-sm font-mono">{value}</span>
          <span className="text-xs text-muted-foreground ml-2">{unit}</span>
        </div>
      ) : (
        <span className="text-foreground text-sm font-mono">{value}</span>
      )}
    </div>
  );
}

export function TransactionDialog({
  open,
  onOpenChange,
  isSubmitting,
  isSuccess,
  isError,
  contentClassName,
  bodyClassName,
  title,
  successTitle,
  errorTitle,
  processingTitle,
  description,
  processingDescription,
  errorDescription,
  transactionDetails,
  successDetails,
  txHash,
  networkFee,
  isNetworkFeeLoading,
  reviewContent,
  successContent,
  errorContent,
  footer,
  successFooter,
  showImpactScoreBoost = false,
  impactScoreBoostMessage,
  impactScoreBoostIconType = "default",
  showProcessingProgress = false,
  processingMaxSeconds = 60,
  onConfirm,
  confirmDisabled,
  confirmLabel,
  cancelLabel,
}: TransactionDialogProps) {
  const { t } = useLang();
  const tdStrings = t.transactionDialog;
  const resolvedTitle = title ?? tdStrings.defaultTitle;
  const resolvedSuccessTitle = successTitle ?? tdStrings.defaultSuccessTitle;
  const resolvedErrorTitle = errorTitle ?? tdStrings.defaultErrorTitle;
  const resolvedProcessingTitle =
    processingTitle ?? tdStrings.defaultProcessingTitle;
  const resolvedDescription = description ?? tdStrings.defaultDescription;
  const resolvedProcessingDescription =
    processingDescription ?? tdStrings.defaultProcessingDescription;
  const resolvedErrorDescription =
    errorDescription ?? tdStrings.defaultErrorDescription;
  const resolvedConfirmLabel = confirmLabel ?? tdStrings.confirm;
  const resolvedCancelLabel = cancelLabel ?? tdStrings.cancel;

  function copyTxHash() {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
      toast.success(tdStrings.toastTxCopied);
    }
  }

  const displayDetails =
    isSuccess && successDetails ? successDetails : transactionDetails;

  // Processing progress state (minimal effects; derived values via useMemo)
  const [processingStartMs, setProcessingStartMs] = React.useState<
    number | null
  >(null);
  const [nowMs, setNowMs] = React.useState<number>(Date.now());

  React.useEffect(() => {
    if (isSubmitting && showProcessingProgress) {
      setProcessingStartMs((prev) => (prev === null ? Date.now() : prev));
    } else {
      setProcessingStartMs(null);
    }
  }, [isSubmitting, showProcessingProgress]);

  React.useEffect(() => {
    if (!open || !isSubmitting || !showProcessingProgress) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [open, isSubmitting, showProcessingProgress]);

  const processingElapsedSeconds = React.useMemo(() => {
    if (!processingStartMs) return 0;
    return Math.max(0, Math.floor((nowMs - processingStartMs) / 1000));
  }, [nowMs, processingStartMs]);

  const processingCountdown = React.useMemo(
    () => Math.max(0, processingMaxSeconds - processingElapsedSeconds),
    [processingElapsedSeconds, processingMaxSeconds]
  );

  const processingProgressPercentage = React.useMemo(
    () =>
      Math.max(
        0,
        Math.min(
          100,
          ((processingMaxSeconds - processingCountdown) /
            processingMaxSeconds) *
            100
        )
      ),
    [processingCountdown, processingMaxSeconds]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "bg-card rounded-[24px] p-0 sm:max-w-sm w-full border border-border/40 overflow-hidden gap-0",
          contentClassName
        )}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {isSuccess
              ? resolvedSuccessTitle
              : isError
              ? resolvedErrorTitle
              : resolvedTitle}
          </DialogTitle>
        </DialogHeader>

        <div
          className={cn(
            "px-8 py-12 max-h-[80vh] overflow-y-auto",
            bodyClassName
          )}
        >
          {isSuccess ? (
            <div className="text-center">
              {/* Success Header */}
              <div className="mb-6">
                {/* Success Icon */}
                <div className="w-16 h-16 bg-[#4ADE80]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-[#4ADE80]"
                    fill="none"
                    strokeWidth="2"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="text-3xl font-semibold text-foreground tracking-tight mb-1">
                  {resolvedSuccessTitle}
                </div>
                {showImpactScoreBoost && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-[#4ADE80]/10 px-3 py-1.5 text-xs font-medium text-[#4ADE80]">
                      {impactScoreBoostIconType === "glw" ? (
                        <GlwWorthIcon className="h-3.5 w-3.5" />
                      ) : impactScoreBoostIconType === "gctl" ? (
                        <SteeringIcon className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5" />
                      )}
                      {tdStrings.impactScoreBoosted}
                    </div>
                    {impactScoreBoostMessage && (
                      <div className="text-xs text-muted-foreground max-w-[260px] mx-auto">
                        {impactScoreBoostMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Success Content (custom or default) */}
              {successContent || (
                <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 mb-6 text-left space-y-3">
                  {displayDetails.map((detail, index) => (
                    <TransactionDetailRow key={index} {...detail} />
                  ))}

                  {txHash && (
                    <>
                      <div className="pt-3 border-t border-border/20 dark:border-border/40">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground text-sm">
                            {tdStrings.transactionLabel}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-foreground text-sm font-mono">
                              {`${txHash.slice(0, 6)}...${txHash.slice(-4)}`}
                            </span>
                            <button
                              onClick={copyTxHash}
                              className="p-1 hover:bg-muted/50 rounded transition-colors"
                            >
                              <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                            </button>
                            <a
                              href={`https://etherscan.io/tx/${txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-muted/50 rounded transition-colors"
                            >
                              <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Success Footer / Actions */}
              {successFooter ? (
                <div className="flex gap-3">
                  {successFooter}
                  <Button
                    onClick={() => onOpenChange(false)}
                    className="flex-1"
                    variant="outline"
                  >
                    {tdStrings.close}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                  variant="outline"
                >
                  {tdStrings.close}
                </Button>
              )}
            </div>
          ) : isError ? (
            <div className="px-1 text-center space-y-8">
              {errorContent || (
                <>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <X className="w-10 h-10 text-destructive" />
                    </div>
                    <div className="text-2xl font-bold text-destructive mb-2 text-center">
                      {resolvedErrorTitle}
                    </div>
                    <div className="text-muted-foreground text-sm max-w-sm break-all whitespace-pre-wrap mx-auto text-center">
                      {resolvedErrorDescription}
                    </div>
                  </div>

                  {txHash && (
                    <div className="space-y-4 text-left">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-sm">
                          {tdStrings.transactionId}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-foreground text-sm font-mono">
                            {`${txHash.slice(0, 6)}...${txHash.slice(-6)}`}
                          </span>
                          <button
                            onClick={copyTxHash}
                            className="p-1 hover:bg-muted rounded transition-colors"
                          >
                            <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-sm">
                          {tdStrings.explorer}
                        </span>
                        <a
                          href={`https://etherscan.io/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          <span>{tdStrings.viewOnEtherscan}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </>
              )}

              <Button onClick={() => onOpenChange(false)} className="w-full">
                {tdStrings.close}
              </Button>
            </div>
          ) : (
            <div className="text-center">
              {/* Processing Icon */}
              <div className="mb-6">
                {isSubmitting && (
                  <div className="flex items-center justify-center mx-auto mb-4">
                    <GlowSymbolAnimated className="size-14" />
                  </div>
                )}
                <div className="text-2xl font-bold text-foreground mb-2">
                  {isSubmitting ? resolvedProcessingTitle : resolvedTitle}
                </div>
                <div className="text-muted-foreground text-sm">
                  {isSubmitting
                    ? resolvedProcessingDescription
                    : resolvedDescription}
                </div>
              </div>

              {/* Status Badge for processing */}
              {isSubmitting && (
                <div className="inline-flex items-center px-4 py-2 bg-muted/50 border border-border/40 rounded-full mb-8">
                  <span className="text-foreground text-sm font-medium animate-pulse">
                    {tdStrings.submitting}
                  </span>
                </div>
              )}

              {/* Processing ETA + Progress Bar */}
              {isSubmitting && showProcessingProgress && (
                <div className="mb-8">
                  <div className="inline-flex items-center px-4 py-2 bg-muted/50 border border-border/40 rounded-full mb-6">
                    <span className="text-foreground text-sm font-medium">
                      {processingCountdown > 0
                        ? tdStrings.eta(processingCountdown)
                        : tdStrings.processingShouldComplete}
                    </span>
                  </div>
                  <div>
                    <div className="w-full bg-muted/50 dark:bg-muted/70 rounded-full h-2 mb-4 overflow-hidden border border-border/20 dark:border-border/40">
                      <div
                        className="h-full glow-gradient-a transition-all duration-300 ease-out"
                        style={{ width: `${processingProgressPercentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tdStrings.percentComplete(
                        Math.round(processingProgressPercentage),
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Review Content (custom or default) */}
              {reviewContent || (
                <div className="space-y-4 mb-8 text-left">
                  {transactionDetails.map((detail, index) => (
                    <TransactionDetailRow key={index} {...detail} />
                  ))}

                  {networkFee && (
                    <div className="pt-3 border-t border-border/20 dark:border-border/40">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-sm">
                          {tdStrings.networkFee}
                        </span>
                        {isNetworkFeeLoading ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                            {tdStrings.calculating}
                          </span>
                        ) : (
                          <span className="text-foreground text-sm font-mono">
                            {networkFee}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Custom Footer or Default Action Buttons */}
              {footer || (
                <div className="flex gap-3 mt-4">
                  {!isSubmitting ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="flex-1"
                      >
                        {resolvedCancelLabel}
                      </Button>
                      {onConfirm && (
                        <Button
                          onClick={onConfirm}
                          disabled={confirmDisabled}
                          className="flex-1"
                        >
                          {resolvedConfirmLabel}
                        </Button>
                      )}
                    </>
                  ) : null}
                </div>
              )}

              {isSubmitting && (
                <div className="text-xs text-muted-foreground mt-4">
                  {tdStrings.doNotClose}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
