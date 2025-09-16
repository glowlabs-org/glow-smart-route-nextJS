import {
  useAccount,
  useDisconnect,
  useEnsAvatar,
  useEnsName,
  useBalance,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, LogOut, Wallet } from "lucide-react";
import { toast } from "sonner";
import { formatUnits } from "viem";
import { GlowSymbolAnimated } from "@/components/glow-symbol-animated";
import { GlowSymbol } from "./glow-symbol";

export function Account() {
  const { address, chainId, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address });
  const { data: balance } = useBalance({ address });

  const handleCopyAddress = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        toast.success("Address copied to clipboard");
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = address;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        toast.success("Address copied to clipboard");
      }
    }
  };

  const handleViewOnExplorer = () => {
    if (address) {
      const explorerUrl =
        chainId === 1
          ? `https://etherscan.io/address/${address}`
          : `https://sepolia.etherscan.io/address/${address}`;
      window.open(explorerUrl, "_blank", "noopener,noreferrer");
    }
  };

  const getNetworkName = (chainId?: number) => {
    switch (chainId) {
      case 1:
        return "Ethereum Mainnet";
      case 11155111:
        return "Sepolia Testnet";
      default:
        return "Unknown Network";
    }
  };

  const formatBalance = (balance: bigint) => {
    const formatted = formatUnits(balance, 18);
    const num = parseFloat(formatted);
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success("Address copied to clipboard");
    }
  };

  return (
    <div className="px-8 py-12 max-h-[80vh] overflow-y-auto">
      <div className="text-center">
        {/* Success Icon */}
        <div className="mb-6">
          <div className="flex items-center justify-center mx-auto mb-4">
            <GlowSymbol className="size-14" />
          </div>
          <div className="flex items-center justify-center gap-2 text-2xl ">
            <span className="text-foreground font-mono">
              {ensName || `${address?.slice(0, 6)}...${address?.slice(-4)}`}
            </span>
            <button
              onClick={copyAddress}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center px-4 py-2 bg-secondary/50 backdrop-blur-sm border border-border rounded-full mb-8">
          <span className="text-foreground text-sm font-medium">
            {getNetworkName(chainId)}
          </span>
        </div>

        {/* Account Details */}
        <div className="space-y-4 mb-8 text-left">
          {/* Wallet Provider */}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Connected via</span>
            <span className="text-foreground text-sm font-medium">
              {connector?.name || "Unknown"}
            </span>
          </div>

          {/* ETH Balance */}
          {balance && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">ETH Balance</span>
              <span className="text-foreground text-sm font-mono">
                {formatBalance(balance.value)} ETH
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => {
              disconnect();
            }}
            className="w-full"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect Wallet
          </Button>
        </div>
      </div>
    </div>
  );
}
