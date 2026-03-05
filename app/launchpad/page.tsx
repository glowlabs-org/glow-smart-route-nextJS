"use client";

import React from "react";

import { useQueryState } from "nuqs";
import { type AuctionApplication, useGlowLaunchpad, useMiningCenter } from "@/hooks";
import {
  DepositDialog,
  type LaunchpadRewardScore,
  type MiningCenterScore,
} from "../marketplace/deposit-dialog";
import { SponsoredFarmsActivity } from "../marketplace/sponsored-farms-activity";
import {
  LaunchpadView,
  type TaggedAuctionApplication,
} from "../marketplace/launchpad-view";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/header";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

type TabKey = "launchpad" | "activity";

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
    <div className="px-4 md:px-6 pt-4 pb-6 border-b border-border/60 bg-muted/5">
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
    React.useState<TaggedAuctionApplication | null>(null);
  const [selectedRewardScore, setSelectedRewardScore] = React.useState<
    LaunchpadRewardScore | MiningCenterScore | null
  >(null);

  // Fetch launchpad applications to check if all are sold out
  const { applications: launchpadApplications, isLoading: isLoadingLaunchpad } =
    useGlowLaunchpad({
      filters: {},
    });

  // Fetch miners applications to check if all are sold out
  const { applications: minersApplications, isLoading: isLoadingMiners } =
    useMiningCenter({
      filters: {
        paymentCurrency: "USDC",
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

  // Check if all miners listings are sold out
  const allMinersSoldOut = React.useMemo(() => {
    if (isLoadingMiners) return false;
    if (minersApplications.length === 0) return true;

    return minersApplications.every((app) => {
      if (!app.activeFraction) return true;
      return (
        app.activeFraction.isFilled ||
        (app.activeFraction.remainingSteps || 0) <= 0
      );
    });
  }, [minersApplications, isLoadingMiners]);

  // Use query state for tab management
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "launchpad",
    clearOnDefault: false,
  });

  // Validate and use the active tab directly
  const validTabs = ["launchpad", "activity"];
  const displayTab = validTabs.includes(activeTab) ? activeTab : "launchpad";

  const openLaunchpadListings = React.useMemo(() => {
    if (isLoadingLaunchpad || isLoadingMiners) return undefined;

    const launchpadCount = launchpadApplications.reduce((count, app) => {
      const fraction = app.activeFraction;
      if (!fraction) return count;

      const remainingSteps = fraction.remainingSteps ?? 0;
      const hasAvailability = !fraction.isFilled && remainingSteps > 0;
      return hasAvailability ? count + 1 : count;
    }, 0);

    const minersCount = minersApplications.reduce((count, app) => {
      const fraction = app.activeFraction;
      if (!fraction) return count;

      const remainingSteps = fraction.remainingSteps ?? 0;
      const hasAvailability = !fraction.isFilled && remainingSteps > 0;
      return hasAvailability ? count + 1 : count;
    }, 0);

    return launchpadCount + minersCount;
  }, [
    isLoadingLaunchpad,
    isLoadingMiners,
    launchpadApplications,
    minersApplications,
  ]);

  const tabContent = React.useMemo<
    Record<TabKey, TabSectionHeaderProps>
  >(() => {
    const eyebrow = "Glow Launchpad";

    return {
      launchpad: {
        eyebrow,
        title: "Launchpad",
        description:
          "Delegate GLW to competitive solar farms or buy miners with USDC to earn rewards.",
        helper:
          "Choose a project to sponsor and use the filters to explore different regions and types. Each card highlights how many steps remain before the farm sells out.",
        status:
          isLoadingLaunchpad || isLoadingMiners
            ? {
                label: "Syncing availability…",
                variant: "outline",
              }
            : allLaunchpadSoldOut && allMinersSoldOut
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
      activity: {
        eyebrow,
        title: "Activity",
        description:
          "View all sales from the launchpad and mining-center. Track average reward scores and USDC/GLW payments to help you evaluate market activity.",
        helper:
          "Scan recent purchases to gauge momentum across both delegations and miners. Use the built-in filters to focus on specific regions or sale types.",
        status: {
          label: "Live feed",
          variant: "secondary",
        },
      },
    };
  }, [
    allLaunchpadSoldOut,
    allMinersSoldOut,
    isLoadingLaunchpad,
    isLoadingMiners,
    openLaunchpadListings,
  ]);

  function onPayDeposit(
    application: TaggedAuctionApplication,
    scoreData?: LaunchpadRewardScore | MiningCenterScore | null
  ) {
    setSelectedApplicationForDeposit(application);
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
                <LaunchpadView onPayDeposit={onPayDeposit} />
              </TabsContent>

              <TabsContent value="activity" className="mt-0">
                <TabSectionHeader {...tabContent.activity} />
                <SponsoredFarmsActivity />
              </TabsContent>
            </Tabs>
          </div>

          {/* Deposit Dialog */}
          {selectedApplicationForDeposit?._type === "miners" ? (
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

