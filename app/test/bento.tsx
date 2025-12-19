"use client";

import React from "react";
import { HeaderHamburgerMenu } from "@/components/header";
import { useAccount } from "wagmi";
import { WalletStatus } from "@/components/wallet-status";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import SolarFarmWidget from "./widgets/solar-farm-widget";
import NetWorthWidget from "./widgets/net-worth";
import RankWidget from "./widgets/rank-widget";
import RewardsWidget from "./widgets/rewards-widget";
import WeeklyActivityWidget from "./widgets/weekly-activity-widget";
import GctlHeatmapWidget from "./widgets/gctl-heatmap-widget";
import GlowFaqWidget from "./widgets/glow-faq-widget";
import QuickActionsWidget from "./widgets/quick-actions-widget";
import RecentActivityWidget from "./widgets/recent-activity-widget";
import { GlowSymbol } from "@/components/glow-symbol";
import { MintAndStakeGctlDialog } from "@/components/dialogs/mint-and-stake-gctl-dialog";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";

interface GlowSoftDashboardProps {
  walletAddressOverride?: string | null;
}

export default function GlowSoftDashboard({
  walletAddressOverride,
}: GlowSoftDashboardProps) {
  const { address: connectedAddress } = useAccount();
  const walletAddress = walletAddressOverride ?? connectedAddress ?? null;
  const hasWallet = Boolean(walletAddress);
  const { signer } = useEthersSigner();
  const { usdcBalance, usdgBalance } = useER20Balances({ signer });
  const [isMintAndStakeOpen, setIsMintAndStakeOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-muted dark:bg-background text-foreground p-6 md:p-10 selection:bg-[color:var(--color-glow-yellow)] selection:text-foreground">
      {/* Header */}
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center text-background">
            <GlowSymbol className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight">
              Power Wallet
            </span>
            <span className="text-xs text-muted-foreground">
              Your all-in-one wallet for Glow
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <WalletStatus />
          <HeaderHamburgerMenu triggerClassName="h-10 w-10 rounded-full p-0 flex items-center justify-center ml-1" />
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto">
        <div className="grid grid-cols-12 gap-4 grid-flow-row-dense">
          <div className="col-span-12 lg:col-span-6">
            <NetWorthWidget walletAddress={walletAddress} />
          </div>
          <div className="col-span-12 lg:col-span-3">
            <RankWidget walletAddress={walletAddress} />
          </div>
          <RewardsWidget walletAddress={walletAddress} />

          <div className="col-span-12 lg:col-span-7">
            <SolarFarmWidget walletAddress={walletAddress ?? undefined} />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <QuickActionsWidget
              walletAddress={walletAddress}
              onMintAndStakeClick={() => setIsMintAndStakeOpen(true)}
            />
          </div>

          {hasWallet ? (
            <GctlHeatmapWidget
              walletAddress={walletAddress}
              onMintAndStakeClick={() => setIsMintAndStakeOpen(true)}
            />
          ) : (
            <GlowFaqWidget />
          )}
          <RecentActivityWidget walletAddress={walletAddress} />
          <WeeklyActivityWidget walletAddress={walletAddress} />
        </div>
      </div>

      <MintAndStakeGctlDialog
        key={
          isMintAndStakeOpen ? "mint-and-stake-open" : "mint-and-stake-closed"
        }
        open={isMintAndStakeOpen}
        onOpenChange={setIsMintAndStakeOpen}
        usdcBalance={usdcBalance}
        usdgBalance={usdgBalance}
      />
    </div>
  );
}
