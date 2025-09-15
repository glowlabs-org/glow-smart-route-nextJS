"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Send, ChevronRight, RefreshCw, ExternalLink } from "lucide-react";
import { ClaimsPanel } from "@/app/wallet/claims-panel";
import { useAccount } from "wagmi";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { useGctlApi } from "@/hooks/useGctlApi";
import { formatUnits } from "ethers";
import { Header } from "@/components/header";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { SendDialog } from "@/components/send-dialog";

export default function View() {
  const { address, isConnected } = useAccount();
  const { signer } = useEthersSigner();
  const [sendDialogOpen, setSendDialogOpen] = React.useState(false);

  // ERC20 balances (GLOW, USDC, USDG)
  const {
    usdcBalance,
    usdgBalance,
    glowBalance,
    isReady: erc20Ready,
    isLoading: erc20Loading,
    refreshBalances,
  } = useER20Balances({ signer });

  // GCTL balance and API
  const { gctlBalance, isGctlBalanceLoading } = useGctlApi(address);

  // Helper functions to format balances
  function formatBalance(
    balance: bigint | null,
    decimals: number = 18
  ): string {
    if (!balance) return "0.00";
    try {
      const formatted = formatUnits(balance, decimals);
      const num = parseFloat(formatted);
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    } catch {
      return "0.00";
    }
  }

  function formatGctlBalance(balance: string): string {
    try {
      const balanceBigInt = BigInt(balance);
      const formatted = formatUnits(balanceBigInt, DECIMALS_BY_TOKEN.GCTL);
      const num = parseFloat(formatted);
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    } catch {
      return "0.00";
    }
  }

  // Format balances for display
  const formattedBalances = {
    usdc: formatBalance(usdcBalance, DECIMALS_BY_TOKEN.USDC),
    usdg: formatBalance(usdgBalance, DECIMALS_BY_TOKEN.USDG),
    glow: formatBalance(glowBalance, DECIMALS_BY_TOKEN.GLW),
    gctl: formatGctlBalance(gctlBalance),
  };

  // Progressive disclosure helpers
  const hasUsdc = usdcBalance && usdcBalance > BigInt(0);
  const hasUsdg = usdgBalance && usdgBalance > BigInt(0);
  const hasGlow = glowBalance && glowBalance > BigInt(0);
  const hasGctl = gctlBalance && BigInt(gctlBalance) > BigInt(0);

  console.log({ usdgBalance });
  console.log({ gctlBalance });

  // Mock claimable data for now (TODO: implement real claimable data)
  const claimable = {
    usdg: "0",
    glow: "0",
    impactVested: "0",
  };

  // Mock purchased farms for now (TODO: implement real farm data)
  const purchasedFarms: any[] = [];

  const handleClaim = (token: string) => {
    toast.success(`Claiming ${token}`, {
      description: "Your tokens will be available shortly",
    });
  };

  const handleClaimAll = () => {
    toast.success("Claiming all available tokens", {
      description: "Multiple transactions initiated",
    });
  };

  const handleSwapUsdgToUsdc = () => {
    try {
      if (!hasUsdg) {
        toast.info("No USDG available to swap");
        return;
      }
      //TODO: open swap modal
      toast.info("Swap modal would open");
      toast.success("Prepared USDG → USDC swap (1:1)");
    } catch (error: any) {
      toast.error(error?.message || "Failed to prepare swap");
    }
  };

  const handleSwapUsdcToUsdg = () => {
    if (!hasUsdc) {
      toast.info("No USDC available to swap");
      return;
    }
    //TODO: open swap modal
    toast.info("Swap modal would open");
  };

  // Show connection prompt if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-6">
            Please connect your wallet to view your balances and manage your
            assets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background ">
      <Header withIsScrolled={false} />
      <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 xl:px-16 py-8 pt-24">
        {/* Page Header with Scenario Selector */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Power Wallet</h1>
            <p className="text-muted-foreground mt-2">
              Your all-in-one wallet for Glow
            </p>
          </div>
        </div>

        {/* A. Balances & Claims Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* USDC Card - Always show when connected */}
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">USDC</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${erc20Loading || !erc20Ready ? "..." : formattedBalances.usdc}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSendDialogOpen(true)}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Send
                </Button>
                {hasUsdc && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSwapUsdcToUsdg}
                  >
                    Convert to USDG
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* USDG Card - Show if has balance, claimable, or still loading */}
          {(hasUsdg ||
            claimable.usdg !== "0" ||
            erc20Loading ||
            !erc20Ready) && (
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">USDG</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  $
                  {erc20Loading || !erc20Ready ? "..." : formattedBalances.usdg}
                </div>
                {claimable.usdg !== "0" && (
                  <div className="mt-2">
                    <div className="text-xs text-muted-foreground">
                      Claimable: ${claimable.usdg}
                    </div>
                    <div className="flex items-center gap-2 mt-2    s">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleClaim("USDG")}
                      >
                        Claim
                      </Button>
                      {hasUsdg && (
                        <div className="">
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={handleSwapUsdgToUsdc}>
                              Swap for USDC
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* GLOW Card - Show if has balance, claimable, or still loading */}
          {(hasGlow ||
            claimable.glow !== "0" ||
            erc20Loading ||
            !erc20Ready) && (
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">GLOW</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {erc20Loading || !erc20Ready ? "..." : formattedBalances.glow}
                </div>
                {claimable.glow !== "0" && (
                  <div className="mt-2">
                    <div className="text-xs text-muted-foreground">
                      Claimable: {claimable.glow}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => handleClaim("GLOW")}
                    >
                      Claim
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* GCTL Card - Always show when connected */}
          {hasGctl ||
            (isGctlBalanceLoading && (
              <Card className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">GCTL</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isGctlBalanceLoading ? "..." : formattedBalances.gctl}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        window.open(
                          "https://impact.glow.org",
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Manage Staking
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        {/* D. Claims Panel */}
        <ClaimsPanel
          claimable={claimable}
          onClaim={handleClaim}
          onClaimAll={handleClaimAll}
        />

        {/* E. Purchased Farms */}
        {purchasedFarms.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Purchased Farms</CardTitle>
              <CardDescription>
                Farms where you've paid participation dividends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {purchasedFarms.map((farm, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{farm.farm}</div>
                      <div className="text-sm text-muted-foreground">
                        {farm.region} • {farm.split} GLW split
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {farm.weeklyGlow} GLOW/week
                      </div>
                      <div className="text-sm text-muted-foreground">
                        + {farm.otherRewardsAmount} {farm.otherRewards}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toast.info("Opening glow launchpad")}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* F. Recent Activity */}
        {/* <RecentActivity activities={recentActivity} /> */}
      </div>

      {/* Send Dialog */}
      <SendDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen} />
    </div>
  );
}
