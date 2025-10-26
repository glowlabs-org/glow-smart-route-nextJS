"use client";

import React from "react";

import { useQueryState } from "nuqs";
import {
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
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

type TabKey = "launchpad" | "mining-center" | "activity";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface TabSectionHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  helper?: string;
  status?: {
    label: string;
    variant?: BadgeVariant;
  };
}

function TabSectionHeader({
  eyebrow,
  title,
  description,
  helper,
  status,
}: TabSectionHeaderProps) {
  return (
    <div className="px-4 md:px-6 pt-2 pb-6 border-b border-border/60 bg-muted/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <span className="text-xs uppercase tracking-wide text-muted-foreground/70">
              {eyebrow}
            </span>
          ) : null}
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl">
              {description}
            </p>
          </div>
        </div>
        {status ? (
          <Badge variant={status.variant ?? "secondary"} className="self-start">
            {status.label}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

export default function GlowLaunchpadPage() {
  const router = useRouter();
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

  // Set default tab based on whether launchpad is sold out
  const defaultTab = allLaunchpadSoldOut ? "mining-center" : "launchpad";

  // Use query state for tab management with dynamic default
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: defaultTab,
    clearOnDefault: false,
  });

  // Validate and use the active tab directly
  const validTabs = ["launchpad", "mining-center", "activity"];
  const displayTab = validTabs.includes(activeTab) ? activeTab : "launchpad";

  const openLaunchpadListings = React.useMemo(() => {
    if (isLoadingLaunchpad) return undefined;

    return launchpadApplications.reduce((count, app) => {
      const fraction = app.activeFraction;
      if (!fraction) return count;

      const remainingSteps = fraction.remainingSteps ?? 0;
      const hasAvailability = !fraction.isFilled && remainingSteps > 0;
      return hasAvailability ? count + 1 : count;
    }, 0);
  }, [isLoadingLaunchpad, launchpadApplications]);

  const tabContent = React.useMemo<
    Record<TabKey, TabSectionHeaderProps>
  >(() => {
    const eyebrow = "Glow Marketplace";

    return {
      launchpad: {
        eyebrow,
        title: "Launchpad",
        description:
          "Delegate GLW to competitive solar farms in exchange for a portion of their rewards.",
        helper:
          "Choose a project to sponsor and use the zone filter to explore different regions. Each card highlights how many steps remain before the farm sells out.",
        status: isLoadingLaunchpad
          ? {
              label: "Syncing availability…",
              variant: "outline",
            }
          : allLaunchpadSoldOut
          ? {
              label: "All listings sold out",
              variant: "destructive",
            }
          : {
              label: `${openLaunchpadListings ?? 0} active listing${
                (openLaunchpadListings ?? 0) === 1 ? "" : "s"
              }`,
              variant: "secondary",
            },
      },
      "mining-center": {
        eyebrow,
        title: "Mining Center",
        description:
          "Pre-balanced mining opportunities with fixed costs and transparent GLW token returns. Buy miners and earn passive rewards.",
        helper:
          "Compare fixed-cost miners, review their projected token flows, and lock in rewards before supply resets each epoch.",
        status: {
          label: "USDC Miners",
          variant: "outline",
        },
      },
      activity: {
        eyebrow,
        title: "Marketplace Activity",
        description:
          "View all sales from the launchpad and mining center. Track average reward scores and USDC/GLW payments to help you evaluate market activity.",
        helper:
          "Scan recent purchases to gauge momentum across both marketplaces. Use the built-in filters to focus on specific regions or sale types.",
        status: {
          label: "Live feed",
          variant: "secondary",
        },
      },
    };
  }, [allLaunchpadSoldOut, isLoadingLaunchpad, openLaunchpadListings]);

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

  function handleTabChange(value: string) {
    if (value === "wallet") {
      router.push("/wallet");
      return;
    }
    setActiveTab(value);
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
          <div className="bg-background backdrop-blur-xl rounded-2xl md:rounded-3xl border border-border overflow-hidden">
            <Tabs
              value={displayTab}
              onValueChange={handleTabChange}
              className="w-full"
            >
              <div className="p-3 md:p-4">
                <TabsList className="w-full flex-wrap justify-between gap-2 sm:w-auto sm:justify-start">
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
                  <TabsTrigger value="wallet" className="text-xs md:text-sm">
                    <span className="hidden sm:inline">My Wallet</span>
                    <span className="sm:hidden">Wallet</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="launchpad" className="mt-0">
                <TabSectionHeader {...tabContent.launchpad} />
                <LaunchpadView
                  onPayDeposit={(app, rewardScore) =>
                    onPayDeposit(app, "launchpad", rewardScore)
                  }
                />
              </TabsContent>

              <TabsContent value="mining-center" className="mt-0">
                <TabSectionHeader {...tabContent["mining-center"]} />
                <MiningCenterView
                  onPayDeposit={(app, miningScoreData) =>
                    onPayDeposit(app, "mining-center", miningScoreData)
                  }
                />
              </TabsContent>

              <TabsContent value="activity" className="mt-0">
                <TabSectionHeader {...tabContent.activity} />
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
