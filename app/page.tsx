"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useQueryState } from "nuqs";
import {
  type PaymentCurrency,
  type SortBy,
  type SortOrder,
  type AuctionApplication,
  useGlowLaunchpad,
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

  // Fetch launchpad applications to check if all are sold out
  const { applications: launchpadApplications, isLoading: isLoadingLaunchpad } =
    useGlowLaunchpad({
      filters: {
        paymentCurrency: "GLW",
      },
    });

  // Use query state for tab management
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "launchpad",
    clearOnDefault: false,
  });

  // Check if all launchpad listings are sold out
  const allLaunchpadSoldOut = React.useMemo(() => {
    if (isLoadingLaunchpad) return false;
    if (launchpadApplications.length === 0) return true;

    return launchpadApplications.every((app) => {
      if (!app.activeFraction) return true;
      return (
        app.activeFraction.isFilled ||
        (app.activeFraction.remainingSteps || 0) <= 0
      );
    });
  }, [launchpadApplications, isLoadingLaunchpad]);

  // Determine which tab to display: if all launchpad sold out and user hasn't explicitly chosen a tab, show mining-center
  const displayTab = React.useMemo(() => {
    const validTabs = ["launchpad", "mining-center", "activity"];
    const isValidTab = validTabs.includes(activeTab);
    const currentTab = isValidTab ? activeTab : "launchpad";

    // If on launchpad tab and everything is sold out, show mining-center instead
    if (currentTab === "launchpad" && allLaunchpadSoldOut) {
      return "mining-center";
    }

    return currentTab;
  }, [activeTab, allLaunchpadSoldOut]);

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
        "View all sales from the launchpad and mining center. Track average reward scores and USDC/GLW payments to help you evaluate market activity.",
    },
  };

  const currentContent =
    tabContent[displayTab as keyof typeof tabContent] || tabContent.launchpad;

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
                  <Link href="/wallet" className="hidden md:block">
                    <Button
                      variant="outline"
                      size="sm"
                      className="md:h-10 w-full"
                    >
                      My Wallet
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-background backdrop-blur-xl rounded-2xl md:rounded-3xl border border-border overflow-hidden">
            <Tabs
              value={displayTab}
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
