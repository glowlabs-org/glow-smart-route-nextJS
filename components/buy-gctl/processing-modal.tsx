import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface ProcessingModalProps {
  isOpen: boolean;
  timeRemaining: number;
  trackingTxHash: string | null;
  formatTime: (ms: number) => string;
  onClose: () => void;
}

export function ProcessingModal({
  isOpen,
  timeRemaining,
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

  const formatTimeRemaining = (ms: number): string => {
    if (ms <= 0) return "Processing should complete soon";
    const minutes = Math.floor(ms / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const progressPercentage = Math.max(
    0,
    Math.min(100, ((20 * 60 * 1000 - timeRemaining) / (20 * 60 * 1000)) * 100)
  );

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
        <div className="px-8 py-12 text-center">
          {/* Processing Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
            </div>
            <div className="text-2xl font-bold text-foreground mb-2">
              Processing Purchase
            </div>
            <div className="text-muted-foreground text-sm">
              Your USDC has been sent. GCTL will be credited shortly.
            </div>
          </div>

          {/* Status Badge with Timer */}
          <div className="inline-flex items-center px-4 py-2 bg-chart-3 rounded-full mb-8">
            <div className="w-4 h-4 bg-background rounded-full flex items-center justify-center mr-2">
              <Loader2 className="w-2.5 h-2.5 text-chart-3 animate-spin" />
            </div>
            <span className="text-background text-sm font-medium">
              ETA: {formatTimeRemaining(timeRemaining)}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="w-full bg-muted rounded-full h-2 mb-4 overflow-hidden">
              <div
                className="h-full bg-chart-3 transition-all duration-300 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {Math.round(progressPercentage)}% complete • Checking status every
              30s
            </div>
          </div>

          {/* Transaction Details */}
          <div className="space-y-4 mb-8 text-left">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Status</span>
              <span className="text-foreground text-sm font-medium">
                Processing
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Network</span>
              <span className="text-foreground text-sm font-medium">
                Ethereum Sepolia
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
          <Button
            onClick={onClose}
            className="w-full h-12 text-base font-medium bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-xl border-0"
          >
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
