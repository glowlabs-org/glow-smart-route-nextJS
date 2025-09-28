"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useQueryState } from "nuqs";
import {
  type PaymentCurrency,
  type SortBy,
  type SortOrder,
  type AuctionApplication,
} from "@/hooks/useGlowLaunchpad";
import { DepositDialog } from "./glow-launchpad/deposit-dialog";
import { SponsoredFarmsActivity } from "./glow-launchpad/sponsored-farms-activity";
import { MiningCenterView } from "./glow-launchpad/mining-center-view";
import { LaunchpadView } from "./glow-launchpad/launchpad-view";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/header";
import Link from "next/link";

export default function GlowLaunchpadPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedApplicationForDeposit, setSelectedApplicationForDeposit] =
    React.useState<AuctionApplication | null>(null);
  const [selectedApplicationType, setSelectedApplicationType] = React.useState<
    "launchpad" | "mining-center"
  >("launchpad");
  const [selectedRewardScore, setSelectedRewardScore] = React.useState<
    | {
        userWeeklyGlwRewards: string;
        userWeeklyPdRewards: string;
        userEstimatedWeeklyCash: string;
      }
    | {
        miningScore: number;
        weeklyGlwRewards?: string;
        weeklyGlwRewardsUsd?: string;
      }
    | null
  >(null);

  // Use query state for tab management with default to "launchpad"
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "launchpad",
    clearOnDefault: false,
  });

  function onPayDeposit(
    application: AuctionApplication,
    type: "launchpad" | "mining-center",
    scoreData?:
      | {
          userWeeklyGlwRewards: string;
          userWeeklyPdRewards: string;
          userEstimatedWeeklyCash: string;
        }
      | {
          miningScore: number;
          weeklyGlwRewards?: string;
          weeklyGlwRewardsUsd?: string;
        }
      | null
  ) {
    setSelectedApplicationForDeposit(application);
    setSelectedApplicationType(type);
    setSelectedRewardScore(scoreData || null);
    setDialogOpen(true);
  }

  return (
    <>
      <Header />
      {/* Schema.org structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Glow Mining Platform",
            description:
              "Decentralized solar mining ecosystem for sponsoring solar farms and earning GLW tokens",
            url: "https://app.glow.org",
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web Browser",
            offers: {
              "@type": "Offer",
              category: "Solar Mining",
              description:
                "Sponsor solar farms and earn GLW token rewards through specialized mining roles",
            },
            provider: {
              "@type": "Organization",
              name: "Glow Labs",
              url: "https://glow.org",
            },
            mainEntity: [
              {
                "@type": "Service",
                name: "Glow Launchpad",
                description:
                  "Platform for deposit miners to sponsor competitive solar farms and earn GLW tokens",
              },
              {
                "@type": "Service",
                name: "Mining Center",
                description:
                  "Pre-balanced mining opportunities with fixed costs and transparent GLW token returns",
              },
            ],
          }),
        }}
      />
      <div className="min-h-screen relative overflow-hidden pt-20">
        <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto lg:px-8 py-8">
          <div className="bg-muted/30 backdrop-blur-xl rounded-3xl border border-border overflow-hidden mb-6">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold">Glow Mining Platform</h1>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    Sponsor competitive solar farms, earn GLW tokens, and
                    support renewable energy infrastructure through specialized
                    mining roles designed for maximum efficiency and returns.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" asChild>
                    <Link href="https://impact.glow.org" target="_blank">
                      See Regions Dashboard
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/token">Swap</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <div className="p-6">
                <TabsList className="grid w-fit grid-cols-3">
                  <TabsTrigger value="launchpad">Launchpad</TabsTrigger>
                  <TabsTrigger value="mining-center">Mining Center</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="launchpad" className="mt-0">
                <LaunchpadView
                  onPayDeposit={(app, rewardScore) =>
                    onPayDeposit(app, "launchpad", rewardScore)
                  }
                />
              </TabsContent>

              <TabsContent value="mining-center" className="mt-0">
                <MiningCenterView
                  onPayDeposit={(app, miningScoreData) =>
                    onPayDeposit(app, "mining-center", miningScoreData)
                  }
                />
              </TabsContent>

              <TabsContent value="activity" className="mt-0">
                <SponsoredFarmsActivity />
              </TabsContent>
            </Tabs>
          </div>

          {/* Deposit Dialog */}
          <DepositDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            application={selectedApplicationForDeposit}
            selectedCurrency={
              selectedApplicationType === "mining-center"
                ? "USDC" // Mining center uses USDC
                : "GLW" // Launchpad uses GLW
            }
            rewardScore={selectedRewardScore}
          />
        </div>
      </div>
    </>
  );
}
