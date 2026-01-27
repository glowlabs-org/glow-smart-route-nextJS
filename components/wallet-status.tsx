"use client";

import * as React from "react";
import {
  Wallet,
  ChevronDown,
  Copy,
  ExternalLink,
  LogOut,
  AlertTriangle,
  Link,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { hubGet } from "@/lib/api/hub-client";
import { useReferralLaunch } from "@/hooks/use-referral-launch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
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

export function WalletStatus({
  className,
  minimal = false,
}: {
  className?: string;
  minimal?: boolean;
}) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const { signer, isLoading: isSignerLoading } = useEthersSigner();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const { hasError, hasSigner } = useER20Balances({ signer });
  const { isLive: isReferralLive } = useReferralLaunch();

  const referralQuery = useQuery({
    queryKey: ["referral-code", address],
    queryFn: () =>
      hubGet<{ code: string; shareableLink: string }>(
        `/referral/code?walletAddress=${address}`
      ),
    enabled: !!address && isReferralLive,
    staleTime: Infinity,
  });

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
        {minimal ? <AlertTriangle className="w-4 h-4" /> : "Reconnect Wallet"}
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
        className={cn(
          "flex items-center gap-2",
          minimal ? "w-10 h-10 p-0 rounded-full justify-center" : "w-full",
          className
        )}
      >
        <AlertTriangle className="w-4 h-4" />
        {!minimal &&
          (isSwitchingChain
            ? "Switching..."
            : `Switch to ${
                process.env.NEXT_PUBLIC_CHAIN_ID === "11155111"
                  ? "Sepolia"
                  : "Mainnet"
              }`)}
      </Button>
    );
  }

  const explorerBaseUrl =
    chainId === sepolia.id
      ? "https://sepolia.etherscan.io"
      : "https://etherscan.io";
  const addressUrl = `${explorerBaseUrl}/address/${address}`;
  const networkLabel =
    chainId === mainnet.id
      ? "Mainnet"
      : chainId === sepolia.id
      ? "Sepolia"
      : `Chain ${chainId}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center border-border/30 dark:border-border/40 bg-background/70 text-zinc-900 dark:text-zinc-100 backdrop-blur-xl transition-colors",
            "hover:bg-muted/40 dark:hover:bg-muted/50 hover:border-border/50 dark:hover:border-border/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "data-[state=open]:bg-muted/40 dark:data-[state=open]:bg-muted/50",
            minimal
              ? "justify-center rounded-full w-full h-full p-0 border-0 bg-transparent hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              : "gap-2 rounded-2xl border px-4 text-sm h-10",
            className
          )}
          aria-label="Wallet menu"
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
              <span className="font-mono text-xs sm:text-sm font-medium truncate">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-80 p-0 overflow-hidden backdrop-blur-xl bg-card border border-border/30 dark:border-border/40 rounded-2xl"
      >
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                Connected wallet
              </div>
              <div className="font-mono text-sm truncate">{address}</div>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-border/30 dark:border-border/40 bg-muted/40 dark:bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              />
              Connected
              <span aria-hidden className="opacity-50">
                ·
              </span>
              {networkLabel}
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-4">Account</DropdownMenuLabel>
        <DropdownMenuGroup>
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
            className="cursor-pointer px-4"
          >
            <Copy className="w-4 h-4 mr-2" /> Copy address
            <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
          </DropdownMenuItem>
          {isReferralLive && referralQuery.data?.shareableLink && (
            <DropdownMenuItem
              onSelect={async (e) => {
                e.preventDefault();
                try {
                  await navigator.clipboard.writeText(
                    referralQuery.data!.shareableLink
                  );
                  toast.success("Referral link copied");
                } catch {
                  toast.error("Failed to copy");
                }
              }}
              className="cursor-pointer px-4"
            >
              <Link className="w-4 h-4 mr-2" /> Copy referral link
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild className="cursor-pointer px-4">
            <a href={addressUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" /> View on Etherscan
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            disconnect();
          }}
          className="cursor-pointer px-4 text-destructive focus:text-destructive"
        >
          <LogOut className="w-4 h-4 mr-2" /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
