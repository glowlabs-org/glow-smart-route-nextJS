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
import {
  DepositDialog,
  type LaunchpadRewardScore,
  type MiningCenterScore,
} from "./marketplace/deposit-dialog";
import { SponsoredFarmsActivity } from "./marketplace/sponsored-farms-activity";
import { MiningCenterView } from "./marketplace/mining-center-view";
import { LaunchpadView } from "./marketplace/launchpad-view";

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
    LaunchpadRewardScore | MiningCenterScore | null
  >(null);

  // Use query state for tab management with default to "launchpad"
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "launchpad",
    clearOnDefault: false,
  });

  const tabContent = {
    launchpad: {
      title: "Glow Launchpad",
      description:
        "Delegate GLW to competitive solar farms in exchange for a portion of their rewards.",
    },
    "mining-center": {
      title: "Mining Center",
      description:
        "Pre-balanced mining opportunities with fixed costs and transparent GLW token returns. Buy miners and earn passive rewards.",
    },
    activity: {
      title: "Activity",
      description:
        "View all sales from the launchpad and see average reward scores to help you evaluate what's a good score to buy or list at.",
    },
  };

  const currentContent =
    tabContent[activeTab as keyof typeof tabContent] || tabContent.launchpad;

  function onPayDeposit(
    application: AuctionApplication,
    type: "launchpad" | "mining-center",
    scoreData?: LaunchpadRewardScore | MiningCenterScore | null
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
        <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4 lg:px-8 py-4 md:py-8">
          <div className="bg-muted/30 backdrop-blur-xl rounded-2xl md:rounded-3xl border border-border overflow-hidden mb-4 md:mb-6">
            <div className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-xl md:text-2xl font-bold">
                    {currentContent.title}
                  </h1>
                  <p className="text-xs md:text-sm text-muted-foreground mt-2 max-w-md">
                    {currentContent.description}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="md:h-10"
                    onClick={() =>
                      window.open("https://impact.glow.org", "_blank")
                    }
                  >
                    <span className="hidden sm:inline">
                      See Regions Dashboard
                    </span>
                    <span className="sm:hidden">Regions</span>
                  </Button>
                  <Link href="/glow-swap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="md:h-10 w-full"
                    >
                      GlowSwap
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-background backdrop-blur-xl rounded-2xl md:rounded-3xl border border-border overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <div className="p-3 md:p-6">
                <TabsList className="grid w-full sm:w-fit grid-cols-3 h-9 md:h-10">
                  <TabsTrigger value="launchpad" className="text-xs md:text-sm">
                    Launchpad
                  </TabsTrigger>
                  <TabsTrigger
                    value="mining-center"
                    className="text-xs md:text-sm"
                  >
                    <span className="hidden sm:inline">Mining Center</span>
                    <span className="sm:hidden">Mining</span>
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="text-xs md:text-sm">
                    Activity
                  </TabsTrigger>
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
          {selectedApplicationType === "mining-center" ? (
            <DepositDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              application={selectedApplicationForDeposit}
              selectedCurrency="USDC"
              rewardScore={selectedRewardScore as MiningCenterScore | null}
            />
          ) : (
            <DepositDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              application={selectedApplicationForDeposit}
              selectedCurrency="GLW"
              rewardScore={selectedRewardScore as LaunchpadRewardScore | null}
            />
          )}
        </div>
      </div>
    </>
  );
}
