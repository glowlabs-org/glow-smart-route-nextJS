"use client";

import React, { useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ethers, BigNumber } from "ethers";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { useGctlApi } from "@/hooks/useGctlApi";
import { useContracts } from "@/hooks/useContracts";
import { formatPrice } from "@/utils/formatPrice";
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import {
  Copy,
  LogOut,
  Send,
  Download,
  ChevronDown,
  TrendingUp,
  Settings,
  Power,
} from "lucide-react";
import { toast } from "sonner";
import { addresses } from "@glowlabs-org/guarded-launch-ethers-sdk";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SendTab } from "@/app/buy/send-tab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddressToGradient } from "@/utils/address-to-gradient";
import { StringToGradient } from "@/utils/string-to-gradient";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface WalletSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  glowPrice: string;
  marketCap?: string;
  ethPriceInUSD?: number | null;
  usdcRewardPool?: string;
  usdcInRedemption?: number;
  statsLoading?: boolean;
  isUsdcInRedemptionLoading?: boolean;
}

interface TokenBalance {
  symbol: string;
  balance: string;
  balanceUSD: string;
  loading: boolean;
  icon?: string;
  change24h?: number;
  hidden?: boolean;
}

const tokens = {
  GLOW: {
    label: "GLOW",
    address: addresses.glow,
    decimals: 18,
    allowedPairs: ["USDG", "USDC"],
    toFixed: 6,
  },
  USDG: {
    label: "USDG",
    address: addresses.usdg,
    decimals: 6,
    allowedPairs: ["GLOW", "USDC", "GCTL"],
    toFixed: 6,
  },
} as const;

export function WalletSidebar({
  open,
  onOpenChange,
  glowPrice,
  marketCap,
  ethPriceInUSD,
  usdcRewardPool,
  usdcInRedemption,
  statsLoading,
  isUsdcInRedemptionLoading,
}: WalletSidebarProps) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const signer = useEthersSigner();
  const { earlyLiquidity, isReady: contractsReady } = useContracts(signer);

  const { usdcBalance, usdgBalance, glowBalance, isReady, refreshBalances } =
    useER20Balances({ symbol: "USDC", signer });

  const { gctlBalance, isGctlBalanceLoading, gctlPrice, isGctlPriceLoading } =
    useGctlApi(address);

  const [balancesLoading, setBalancesLoading] = useState(true);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  // Refresh balances when sidebar opens
  useEffect(() => {
    if (isReady && open) {
      refreshBalances();
      setBalancesLoading(false);
    }
  }, [isReady, open, refreshBalances]);

  const formatBalance = (
    balance: BigNumber | null,
    decimals: number
  ): string => {
    if (!balance) return "0";
    const formatted = ethers.utils.formatUnits(balance, decimals);
    return toFixedTruncate(Number(formatted), 4);
  };

  const formatDisplayBalance = (balance: string): string => {
    const num = parseFloat(balance);
    if (isNaN(num)) return "0";

    // Use Intl.NumberFormat for proper formatting with commas
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(num);
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success("Address copied to clipboard");
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onOpenChange(false);
  };

  const balances: TokenBalance[] = [
    {
      symbol: "GLW",
      balance: formatBalance(glowBalance, 18),
      balanceUSD: (
        Number(formatBalance(glowBalance, 18)) * Number(glowPrice)
      ).toFixed(2),
      loading: balancesLoading,
    },
    {
      symbol: "USDG",
      balance: formatBalance(usdgBalance, 6),
      balanceUSD: (Number(formatBalance(usdgBalance, 6)) * 1).toFixed(2),
      loading: balancesLoading,
    },
    {
      symbol: "USDC",
      balance: formatBalance(usdcBalance, 6),
      balanceUSD: (Number(formatBalance(usdcBalance, 6)) * 1).toFixed(2),
      loading: balancesLoading,
    },
    {
      symbol: "GCTL",
      balance: gctlBalance ? toFixedTruncate(Number(gctlBalance), 4) : "0",
      balanceUSD: (Number(gctlBalance || 0) * gctlPrice).toFixed(2),
      loading: isGctlBalanceLoading || isGctlPriceLoading,
    },
  ];

  const visibleBalances = balances.filter((b) => !b.hidden);

  const totalBalanceUSD = balances.reduce((sum, token) => {
    return sum + Number(token.balanceUSD);
  }, 0);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[360px] sm:w-[420px] p-0">
          <SheetTitle className="sr-only">Wallet</SheetTitle>
          {/* Header with wallet info and total balance */}
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <AddressToGradient address={address} />
                <div className="flex items-center gap-2">
                  <span className="glow-eyebrow text-sm">
                    {address
                      ? `${address.slice(0, 6)}...${address.slice(-4)}`
                      : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={copyAddress}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <ThemeToggle />
            </div>

            {/* Total Balance */}
            <div className="mb-4">
              <div className="glow-headline text-4xl mb-1">
                {balancesLoading ? (
                  <Skeleton className="w-32 h-10 inline-block" />
                ) : (
                  `$${new Intl.NumberFormat("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(totalBalanceUSD)}`
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                className="flex items-center gap-2 glow-cta"
                onClick={() => setSendDialogOpen(true)}
              >
                <Send className="w-4 h-4" />
                Send
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2 glow-cta"
                onClick={handleDisconnect}
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </Button>
            </div>
          </div>

          {/* Tabs for Balances and Stats */}
          <Tabs defaultValue="balances">
            <TabsList className="p-4 pb-0">
              <TabsTrigger value="balances" className="glow-cta">
                Balances
              </TabsTrigger>
              <TabsTrigger value="stats" className="glow-cta">
                Stats
              </TabsTrigger>
            </TabsList>

            {/* Balances Tab */}
            <TabsContent value="balances" className="flex-1 flex flex-col m-0">
              <div className="flex flex-col h-full p-6 space-y-6">
                <h3 className="glow-subhead text-2xl">Balances</h3>
                {/* Visible Tokens */}
                <div className="flex-1 space-y-6">
                  {visibleBalances.map((token) => (
                    <div
                      key={token.symbol}
                      className="flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="glow-eyebrow text-sm">
                            {token.symbol}
                          </div>
                          <div className="text-sm text-muted-foreground glow-body">
                            {token.loading ? (
                              <Skeleton className="w-20 h-4" />
                            ) : (
                              `${formatDisplayBalance(token.balance)} ${
                                token.symbol
                              }`
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {token.loading ? (
                          <Skeleton className="w-16 h-5 mb-1" />
                        ) : (
                          <>
                            <div className="font-medium glow-body">
                              $
                              {new Intl.NumberFormat("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(Number(token.balanceUSD))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Stats Tab */}
            <TabsContent value="stats" className="flex-1 flex flex-col m-0">
              <div className="flex flex-col h-full p-6 space-y-6">
                <h3 className="glow-subhead text-2xl">Market Overview</h3>
                <div className="flex-1 space-y-4">
                  {/* GLW Market Cap */}
                  <div className="group rounded-md transition-all duration-200">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-muted-foreground">
                        GLW Market Cap
                      </div>
                    </div>
                    <div className="text-lg font-bold">
                      ${" "}
                      {statsLoading ? (
                        <Skeleton className="w-24 h-6 inline-block" />
                      ) : (
                        new Intl.NumberFormat("en-US").format(
                          Number(marketCap || 0)
                        )
                      )}
                    </div>
                  </div>

                  {/* GLW Price */}
                  <div className="group rounded-md transition-all duration-200">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-muted-foreground">
                        GLW Price
                      </div>
                    </div>
                    <div className="text-lg font-bold">
                      ${" "}
                      {statsLoading ? (
                        <Skeleton className="w-20 h-6 inline-block" />
                      ) : (
                        Number(glowPrice).toFixed(2)
                      )}
                    </div>
                  </div>

                  {/* GCTL Price */}
                  <div className="group rounded-md transition-all duration-200">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-muted-foreground">
                        GCTL Price
                      </div>
                    </div>
                    <div className="text-lg font-bold">
                      ${" "}
                      {isGctlPriceLoading ? (
                        <Skeleton className="w-20 h-6 inline-block" />
                      ) : (
                        Number(gctlPrice).toFixed(2)
                      )}
                    </div>
                  </div>

                  {/* Reward Pool */}
                  <div className="group rounded-md transition-all duration-200">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-muted-foreground">
                        Reward Pool
                      </div>
                    </div>
                    <div className="text-lg font-bold">
                      ${" "}
                      {statsLoading ? (
                        <Skeleton className="w-24 h-6 inline-block" />
                      ) : (
                        new Intl.NumberFormat("en-US").format(
                          Number(usdcRewardPool || 0)
                        )
                      )}
                    </div>
                  </div>

                  {/* USDC Available */}
                  <div className="group rounded-md transition-all duration-200">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-muted-foreground">
                        USDC Available to Redeem
                      </div>
                    </div>
                    <div className="text-lg font-bold">
                      ${" "}
                      {isUsdcInRedemptionLoading || balancesLoading ? (
                        <Skeleton className="w-24 h-6 inline-block" />
                      ) : (
                        new Intl.NumberFormat("en-US").format(
                          usdcInRedemption || 0
                        )
                      )}
                    </div>
                    {isUsdcInRedemptionLoading && !balancesLoading && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                        Updating...
                      </div>
                    )}
                  </div>

                  {/* ETH Price */}
                  <div className="pt-4 border-t border-border/30">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">ETH Price</span>
                      <span className="font-medium">
                        ${ethPriceInUSD ? ethPriceInUSD.toFixed(0) : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="glow-subhead text-2xl">
              Send Tokens
            </DialogTitle>
            <DialogDescription className="glow-body">
              Transfer GLW or USDG tokens to any wallet address
            </DialogDescription>
          </DialogHeader>

          <SendTab
            isConnected={true}
            isWalletLoading={false}
            balancesLoading={balancesLoading}
            glowBalance={glowBalance}
            usdgBalance={usdgBalance}
            signer={signer}
            refreshBalances={refreshBalances}
            tokens={tokens}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
