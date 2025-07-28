import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface SuccessModalProps {
  isOpen: boolean;
  processedAmount: string;
  onClose: () => void;
  trackingTxHash?: string | null;
  gctlPrice?: number;
  usdcAmount?: string;
}

export function SuccessModal({
  isOpen,
  processedAmount,
  onClose,
  trackingTxHash,
  gctlPrice,
  usdcAmount,
}: SuccessModalProps) {
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

  const currentDate = new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="bg-card rounded-3xl p-0 md:max-w-sm w-full border-border shadow-2xl overflow-hidden">
        <div className="px-8 py-12 text-center">
          {/* Amount Display */}
          <div className="mb-6">
            <div className="text-4xl font-bold text-foreground mb-2">
              + {parseFloat(processedAmount).toLocaleString()} GCTL
            </div>
            {usdcAmount && gctlPrice && (
              <div className="text-muted-foreground text-sm">
                Including network fee: ~$
                {(parseFloat(usdcAmount) * 0.001).toFixed(6)} USDC
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-chart-4 rounded-full mb-8">
            <div className="w-4 h-4 bg-background rounded-full flex items-center justify-center mr-2">
              <svg
                className="w-2.5 h-2.5 text-chart-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <span className="text-background text-sm font-medium">
              Completed • {currentDate}, {currentTime}
            </span>
          </div>

          {/* Transaction Details */}
          <div className="space-y-4 mb-8 text-left">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">From</span>
              <span className="text-foreground text-sm font-medium">
                USDC Wallet
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">To</span>
              <span className="text-foreground text-sm font-medium">
                GCTL Balance
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Network</span>
              <span className="text-foreground text-sm font-medium">
                Ethereum Sepolia
              </span>
            </div>

            {trackingTxHash && (
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
            )}
          </div>

          {/* Close Button */}
          <Button
            onClick={onClose}
            className="w-full h-12 text-base font-medium bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-xl border-0"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
