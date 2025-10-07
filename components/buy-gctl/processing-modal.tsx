"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useGctlApi } from "@/hooks/useGctlApi";
import { SuccessState } from "@/components/buy-gctl/success-state";
import { useQueryState } from "nuqs";
import { GlowSymbolAnimated } from "../glow-symbol-animated";
import { usePolling } from "@/utils/use-polling";
import type { PendingTransfer } from "@glowlabs-org/utils/browser";

interface ProcessingModalProps {
  isOpen: boolean;
  trackingTxHash: string | null;
  onClose: () => void;
}

const POLL_INTERVAL = 10_000;
const MAX_DURATION = 80; // 80 seconds

export function ProcessingModal({
  isOpen,
  trackingTxHash,
  onClose,
}: ProcessingModalProps) {
  const copyTxHash = () => {
    if (trackingTxHash) {
      navigator.clipboard.writeText(trackingTxHash);
      toast.success("Transaction ID copied to clipboard");
    }
  };

  const formatTxHash = (hash: string) => {
    if (!hash) return "";
    return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
  };

  // ---------------------- API & polling ----------------------
  const { fetchTransferDetails, gctlPriceNumber, gctlPrice } = useGctlApi();

  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing"
  );
  const [processedAmount, setProcessedAmount] = useState<string>("0");
  const failureInfoRef = useRef<PendingTransfer | null>(null);

  const [txIdParam, setTxIdParam] = useQueryState("txId", {
    defaultValue: "",
    clearOnDefault: true,
  });

  // Use polling hook
  const {
    data: transferData,
    isPolling,
    countdown,
    startPolling,
    stopPolling,
    reset: resetPolling,
  } = usePolling<PendingTransfer>({
    pollFn: async () => {
      if (!trackingTxHash) throw new Error("No transaction hash");
      const result = await fetchTransferDetails(trackingTxHash);
      if (result.ok) {
        return result.val;
      }
      throw new Error("Failed to fetch transfer details");
    },
    pollInterval: POLL_INTERVAL,
    maxDuration: MAX_DURATION,
    enabled: isOpen && !!trackingTxHash,
    shouldStopPolling: (data) => {
      return data.status === "confirmed" || data.status === "failed";
    },
    onSuccess: (data) => {
      if (data.status === "confirmed") {
        setStatus("success");
        setProcessedAmount(
          (BigInt(data.amountRaw) / BigInt(gctlPrice)).toString()
        );
      } else if (data.status === "failed") {
        setStatus("error");
        failureInfoRef.current = data;
      }
    },
    onError: (error) => {
      console.error("Polling error:", error);
    },
  });

  // Reset state when modal opens with new transaction
  useEffect(() => {
    if (isOpen && trackingTxHash) {
      setTxIdParam(trackingTxHash);
      setStatus("processing");
      setProcessedAmount("0");
      failureInfoRef.current = null;
      resetPolling();
      startPolling();
    } else if (!isOpen) {
      setTxIdParam("");
      stopPolling();
    }
  }, [
    isOpen,
    trackingTxHash,
    setTxIdParam,
    resetPolling,
    startPolling,
    stopPolling,
  ]);

  const progressPercentage = Math.max(
    0,
    Math.min(100, ((MAX_DURATION - countdown) / MAX_DURATION) * 100)
  );

  // ---------------------- Render shortcuts ------------------

  if (status === "success") {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="bg-card/90 backdrop-blur-sm rounded-3xl p-0 md:max-w-sm w-full border-border shadow-2xl overflow-hidden">
          {/* Visually hidden title for accessibility */}
          <DialogHeader>
            <DialogTitle className="sr-only">Transaction Success</DialogTitle>
          </DialogHeader>
          <SuccessState
            handleClose={onClose}
            processedAmount={processedAmount}
            trackingTxHash={trackingTxHash ?? undefined}
            gctlPrice={gctlPriceNumber}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (status === "error") {
    const failureInfo = failureInfoRef.current;
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="bg-card/90 backdrop-blur-sm rounded-3xl p-0 md:max-w-sm w-full border-border shadow-2xl overflow-hidden">
          {/* Visually hidden title for accessibility */}
          <DialogHeader>
            <DialogTitle className="sr-only">Transaction Failed</DialogTitle>
          </DialogHeader>
          <div className="px-8 py-12 text-center space-y-8">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-destructive-foreground" />
              </div>
              <div className="text-2xl font-bold text-foreground mb-2">
                Transaction Failed
              </div>
              <div className="text-muted-foreground text-sm max-w-sm">
                {(failureInfo as any)?.errorMessage ||
                  (failureInfo as any)?.errorDetails ||
                  "We were unable to process your transaction. Please try again or contact support."}
              </div>
            </div>

            {trackingTxHash && (
              <div className="space-y-4 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    Transaction ID
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-foreground text-sm font-mono">
                      {formatTxHash(trackingTxHash)}
                    </span>
                    <button
                      onClick={copyTxHash}
                      className="p-1 hover:bg-muted rounded transition-colors"
                    >
                      <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={onClose}
              className="w-full h-12 text-base font-medium rounded-xl border-0"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="bg-card rounded-3xl p-0 md:max-w-md w-full border-border shadow-2xl overflow-hidden">
        {/* Visually hidden title for accessibility */}
        <DialogHeader>
          <DialogTitle className="sr-only">Processing Purchase</DialogTitle>
        </DialogHeader>
        <div className="px-8 py-12 text-center">
          {/* Processing Icon */}
          <div className="mb-6">
            <div className="flex items-center justify-center mx-auto mb-4">
              <GlowSymbolAnimated className="size-14" />
            </div>
            <div className="text-2xl font-bold text-foreground mb-2">
              Processing Purchase
            </div>
            <div className="text-muted-foreground text-sm">
              {!transferData && isPolling
                ? "Checking transaction status..."
                : "Your USDC has been sent. GCTL will be credited shortly."}
            </div>
          </div>

          {/* Status Badge with Timer */}
          {isPolling && (
            <div className="inline-flex items-center px-4 py-2 bg-secondary/50 backdrop-blur-sm border border-border rounded-full mb-8">
              <span className="text-foreground text-sm font-medium">
                ETA:{" "}
                {countdown > 0
                  ? `${countdown}s`
                  : "Processing should complete soon"}
              </span>
            </div>
          )}

          {/* Progress Bar */}
          {isPolling && (
            <div className="mb-8">
              <div className="w-full bg-muted rounded-full h-2 mb-4 overflow-hidden">
                <div
                  className="h-full glow-gradient-a transition-all duration-300 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {Math.round(progressPercentage)}% complete • Checking status
                every 10s
              </div>
            </div>
          )}

          {/* Transaction Details */}
          <div className="space-y-4 mb-8 text-left">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Status</span>
              <span className="text-foreground text-sm font-medium">
                {!transferData && isPolling ? "Checking..." : "Processing"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Network</span>
              <span className="text-foreground text-sm font-medium">
                Ethereum Mainnet
              </span>
            </div>

            {trackingTxHash && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    Transaction ID
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-foreground text-sm font-mono">
                      {formatTxHash(trackingTxHash)}
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
                    Explorer
                  </span>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${trackingTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <span>View on Etherscan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </>
            )}
          </div>

          {/* Continue Button */}
          <Button onClick={onClose} variant="secondary" className="w-full">
            Continue in Background
          </Button>

          <div className="text-xs text-muted-foreground mt-4">
            You can safely close this window. We&apos;ll continue processing and
            update your balance automatically.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
