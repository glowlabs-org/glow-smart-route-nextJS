"use client";

import * as React from "react";
import Link from "next/link";
import {
  Wallet,
  ChevronDown,
  Copy,
  LogOut,
  User,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ConnectButton } from "./connect-button";
import { Button } from "./ui/button";

export function WalletStatus({ className }: { className?: string }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const { signer } = useEthersSigner();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const { hasError, hasSigner } = useER20Balances({ signer });

  const hasNetworkIssues = hasError || (!hasSigner && isConnected);
  const isWrongNetwork =
    isConnected && chainId !== parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!);

  const handleForceDisconnect = () => {
    forceDisconnect(disconnect, connectors);
  };

  const handleSwitchToMainnet = async () => {
    try {
      if (process.env.NEXT_PUBLIC_CHAIN_ID === "1") {
        await switchChain({ chainId: mainnet.id });
        toast.success("Switched to Ethereum Mainnet");
      } else {
        await switchChain({ chainId: sepolia.id });
        toast.success("Switched to Sepolia Testnet");
      }
    } catch (error: any) {
      console.error("Failed to switch network:", error);
      toast.error(error?.message || "Failed to switch network");
    }
  };

  if (!isConnected || !address) {
    return (
      <ConnectButton
        variant="default"
        className={cn("w-auto", className)}
        size="small"
      />
    );
  }

  if (hasNetworkIssues) {
    return (
      <Button
        size={"sm"}
        variant={"orange"}
        onClick={handleForceDisconnect}
        className={cn("w-full", className)}
      >
        Reconnect Wallet
      </Button>
    );
  }

  if (isWrongNetwork) {
    return (
      <Button
        size={"sm"}
        variant={"orange"}
        onClick={handleSwitchToMainnet}
        disabled={isSwitchingChain}
        className={cn("flex items-center gap-2 w-full", className)}
      >
        <AlertTriangle className="w-4 h-4" />
        {isSwitchingChain
          ? "Switching..."
          : `Switch to ${
              process.env.NEXT_PUBLIC_CHAIN_ID === "11155111"
                ? "Sepolia"
                : "Mainnet"
            }`}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm transition-all duration-200 bg-background/95 backdrop-blur-xl border-border hover:bg-muted/30 hover:border-border/60 text-zinc-900 dark:text-zinc-100 h-10",
            className
          )}
          aria-label="Wallet menu"
          title={address}
        >
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-foreground/10 backdrop-blur-sm shrink-0">
            <Wallet className="w-3.5 h-3.5" />
          </span>
          <span className="font-medium truncate">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 backdrop-blur-xl bg-background/95 border-border"
      >
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault();
            try {
              await navigator.clipboard.writeText(address);
              toast.success("Address copied");
            } catch {
              toast.error("Failed to copy");
            }
          }}
          className="cursor-pointer"
        >
          <Copy className="w-4 h-4 mr-2" /> Copy address
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href={`/wallet`} rel="noreferrer">
            <User className="w-4 h-4 mr-2" /> My Wallet
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            disconnect();
          }}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="w-4 h-4 mr-2" /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

