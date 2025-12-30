"use client";

import React from "react";
import { useAccount } from "wagmi";
import { AnimatePresence, motion } from "framer-motion";

import SolarFarmWidget from "./widgets/solar-farm-widget";
import NetWorthWidget from "./widgets/net-worth";
import RankWidget from "./widgets/rank-widget";
import RewardsWidget from "./widgets/rewards-widget";
import WeeklyActivityWidget from "./widgets/weekly-activity-widget";
import GctlHeatmapWidget from "./widgets/gctl-heatmap-widget";
import GlowFaqWidget from "./widgets/glow-faq-widget";
import QuickActionsWidget from "./widgets/quick-actions-widget";
import RecentActivityWidget from "./widgets/recent-activity-widget";
import OnboardingHeroWidget from "./widgets/onboarding-hero-widget";
import LaunchpadStatusWidget from "./widgets/launchpad-status-widget";
import GlobalLeaderboardWidget from "./widgets/global-leaderboard-widget";
import { MintAndStakeGctlDialog } from "@/components/dialogs/mint-and-stake-gctl-dialog";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import DiscordWidget from "./widgets/discord-widget";
import NewsletterWidget from "./widgets/newsletter-widget";

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
    <div className="min-h-screen bg-muted dark:bg-background text-foreground p-6 pt-4 selection:bg-[color:var(--color-glow-yellow)] selection:text-foreground">
      <div className="max-w-screen-2xl mx-auto">
        {hasWallet ? (
          <div className="grid grid-cols-12 gap-4 grid-flow-row-dense [&:has(.solar-farm-next-batch-countdown)_.quick-actions-launchpad-next-batch-countdown]:hidden">
            <div className="col-span-12 lg:col-span-6 min-h-0 lg:h-[340px]">
              <NetWorthWidget walletAddress={walletAddress} />
            </div>
            <div className="col-span-12 lg:col-span-3 min-h-0 lg:h-[340px]">
              <RankWidget walletAddress={walletAddress} />
            </div>

            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key="rewards"
                className="col-span-12 lg:col-span-3 min-h-0 lg:h-[340px]"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <RewardsWidget
                  walletAddress={walletAddress}
                  hideIfEmpty={false}
                />
              </motion.div>
            </AnimatePresence>

            <div
              id="bento-solar-farm"
              className="col-span-12 lg:col-span-7 min-h-0 lg:h-[380px]"
            >
              <motion.div
                key="solar-farm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="h-full min-h-0"
              >
                <SolarFarmWidget walletAddress={walletAddress ?? undefined} />
              </motion.div>
            </div>

            <div className="col-span-12 lg:col-span-5 min-h-0 lg:h-[380px]">
              <QuickActionsWidget
                walletAddress={walletAddress}
                onMintAndStakeClick={() => setIsMintAndStakeOpen(true)}
              />
            </div>

            <AnimatePresence>
              <motion.div
                key="gctl-heatmap"
                className="col-span-12 lg:col-span-5 min-h-0 lg:h-[380px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <GctlHeatmapWidget
                  walletAddress={walletAddress}
                  onMintAndStakeClick={() => setIsMintAndStakeOpen(true)}
                />
              </motion.div>
            </AnimatePresence>

            <div
              className={[
                "col-span-12 lg:col-span-7 min-h-0 lg:h-[380px]",
                "grid grid-cols-7 gap-4",
                "[&:has(.activity-slot:not(:empty))_.faq-fallback]:hidden",
              ].join(" ")}
            >
              <AnimatePresence mode="popLayout">
                <motion.div
                  key="recent-activity"
                  className="activity-slot col-span-7 lg:col-span-4 min-h-0 lg:h-[380px] empty:hidden"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <RecentActivityWidget walletAddress={walletAddress} />
                </motion.div>
              </AnimatePresence>

              <AnimatePresence mode="popLayout">
                <motion.div
                  key="weekly-activity-bottom"
                  className="activity-slot col-span-7 lg:col-span-3 min-h-0 lg:h-[380px] empty:hidden"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <WeeklyActivityWidget walletAddress={walletAddress} />
                </motion.div>
              </AnimatePresence>

              <motion.div
                key="faq-fallback"
                className="faq-fallback col-span-7 min-h-0 lg:h-[380px]"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <GlowFaqWidget className="w-full h-full lg:max-h-[380px]" />
              </motion.div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4 grid-flow-row-dense">
            <div className="col-span-12 lg:col-span-6 min-h-0 lg:h-[340px]">
              <OnboardingHeroWidget className="h-full" />
            </div>
            <div className="col-span-12 lg:col-span-6 min-h-0 lg:h-[340px]">
              <LaunchpadStatusWidget className="h-full" />
            </div>

            <div className="col-span-12 lg:col-span-8 min-h-0 lg:h-[400px]">
              <GlowFaqWidget className="w-full h-full" />
            </div>
            <div className="col-span-12 lg:col-span-4 min-h-0 lg:h-[400px]">
              <GlobalLeaderboardWidget className="h-full" />
            </div>
            <div className="col-span-12 lg:col-span-5 min-h-0 lg:h-[340px]">
              <NewsletterWidget className="w-full h-full" />
            </div>
            <div className="col-span-12 lg:col-span-7 min-h-0 lg:h-[340px]">
              <DiscordWidget className="w-full h-full" />
            </div>
          </div>
        )}
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
