import React from "react";
import { Button } from "@/components/ui/button";
import { TrendingUp, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SteeringIcon } from "@/components/impact-icons";

interface SuccessStateProps {
  processedAmount: string;
  trackingTxHash?: string | null;
  gctlPrice?: number;
  usdcAmount?: string;
  handleClose: () => void;
}

export function SuccessState({
  processedAmount,
  trackingTxHash,
  gctlPrice,
  usdcAmount,
  handleClose,
}: SuccessStateProps) {
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
    <div className="px-8 py-12 text-center">
      {/* Amount Display */}
      <div className="mb-6">
        <div className="text-4xl font-bold text-[#22D3EE] mb-2">
          + {parseFloat(processedAmount).toLocaleString()} GCTL
        </div>
        <div className="mt-4 flex flex-col items-center gap-2">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
              "border-[#22D3EE] bg-[#22D3EE]/12 text-[#22D3EE]"
            )}
          >
            <SteeringIcon className="h-3 w-3" />
            Impact Score Boosted
          </div>
          <div className="text-sm text-muted-foreground max-w-[280px] mx-auto">
            You&apos;ve acquired and staked GCTL. This boosts your Impact Score
            multiplier.
          </div>
        </div>
        {usdcAmount && (
          <div className="text-muted-foreground text-sm mt-2">
            Including network fee: ~$
            {(parseFloat(usdcAmount) * 0.001).toFixed(6)} USDC
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div className="inline-flex items-center px-4 py-2 bg-secondary/50 backdrop-blur-sm border border-border rounded-full mb-8">
        <span className="text-foreground text-sm font-medium">
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
            Ethereum Mainnet
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
      <Button onClick={handleClose} className="w-full">
        Close
      </Button>
    </div>
  );
}
