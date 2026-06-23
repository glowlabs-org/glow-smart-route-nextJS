"use client";

import { Wallet, ChevronDown, AlertTriangle } from "lucide-react";
import {
  useAccount,
  useDisconnect,
  useConnect,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { toast } from "sonner";
import { forceDisconnect } from "@/utils/forceDisconnect";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { ConnectButton } from "./connect-button";
import { Button } from "./ui/button";
import { WalletAccountPopover } from "./wallet/wallet-account-popover";

export function WalletStatus({
  className,
  minimal = false,
}: {
  className?: string;
  minimal?: boolean;
}) {
  const { t } = useLang();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const { signer, isLoading: isSignerLoading } = useEthersSigner();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const { hasError, hasSigner } = useER20Balances({ signer });

  const hasNetworkIssues =
    hasError || (!hasSigner && isConnected && !isSignerLoading);
  const isWrongNetwork =
    isConnected && chainId !== parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!);

  const handleForceDisconnect = () => {
    forceDisconnect(disconnect, connectors);
  };

  const handleSwitchToMainnet = async () => {
    try {
      if (process.env.NEXT_PUBLIC_CHAIN_ID === "1") {
        await switchChain({ chainId: mainnet.id });
        toast.success(t.wallet.switchedToMainnet);
      } else {
        await switchChain({ chainId: sepolia.id });
        toast.success(t.wallet.switchedToSepolia);
      }
    } catch (error: any) {
      console.error("Failed to switch network:", error);
      toast.error(error?.message || t.wallet.failedToSwitchNetwork);
    }
  };

  if (!isConnected || !address) {
    return (
      <ConnectButton
        variant="default"
        className={cn("w-auto", className)}
        size="small"
        minimal={minimal}
      />
    );
  }

  if (hasNetworkIssues) {
    return (
      <Button
        size={"sm"}
        variant={"orange"}
        onClick={handleForceDisconnect}
        className={cn(
          minimal ? "w-10 h-10 p-0 rounded-full" : "w-full",
          className
        )}
      >
        {minimal ? <AlertTriangle className="w-4 h-4" /> : t.wallet.reconnectWallet}
      </Button>
    );
  }

  if (isWrongNetwork) {
    const targetNetwork =
      process.env.NEXT_PUBLIC_CHAIN_ID === "11155111" ? "Sepolia" : "Mainnet";
    return (
      <Button
        size={"sm"}
        variant={"orange"}
        onClick={handleSwitchToMainnet}
        disabled={isSwitchingChain}
        className={cn(
          "flex items-center gap-2",
          minimal ? "w-10 h-10 p-0 rounded-full justify-center" : "w-full",
          className
        )}
      >
        <AlertTriangle className="w-4 h-4" />
        {!minimal &&
          (isSwitchingChain ? t.wallet.switching : t.wallet.switchTo(targetNetwork))}
      </Button>
    );
  }

  return (
    <WalletAccountPopover
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex items-center border-border/30 dark:border-border/40 bg-background/70 text-zinc-900 dark:text-zinc-100 backdrop-blur-xl transition-colors",
            "hover:bg-muted/40 dark:hover:bg-muted/50 hover:border-border/50 dark:hover:border-border/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            minimal
              ? "justify-center rounded-full w-full h-full p-0 border-0 bg-transparent hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              : "gap-2 rounded-2xl border px-4 text-sm h-10",
            className
          )}
          aria-label={t.wallet.openWalletAccount}
          title={address}
        >
          <span
            className={cn(
              "relative inline-flex items-center justify-center shrink-0",
              minimal
                ? "w-full h-full bg-transparent"
                : "w-6 h-6 rounded-full bg-foreground/10 backdrop-blur-sm"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute right-0 top-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background",
                minimal && "right-2 top-2"
              )}
            />
            <Wallet
              className={cn(
                minimal
                  ? "size-5 text-muted-foreground hover:text-foreground"
                  : "w-3.5 h-3.5"
              )}
            />
          </span>
          {!minimal && (
            <>
              <span className="min-w-0 font-mono text-xs sm:text-sm font-medium truncate">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </>
          )}
        </button>
      }
    />
  );
}
