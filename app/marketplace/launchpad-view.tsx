"use client";

import React from "react";
import { FallbackImage } from "@/components/ui/fallback-image";

// Image proxy helper for optimized caching with compression
function getProxiedImageUrl(url: string, width?: number, quality: number = 75) {
  if (!url || url.startsWith("/images/")) {
    return url;
  }
  const params = new URLSearchParams({
    url,
    ...(width && { w: width.toString() }),
    q: quality.toString(),
  });
  return `/api/image-proxy?${params.toString()}`;
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useQueryState } from "nuqs";
import { formatNumber } from "./utils";
import {
  useGlowLaunchpad,
  useAvailableZones,
  calculateProtocolDepositAmount,
  getAvailableCurrencies,
  type PaymentCurrency,
  type SortBy,
  type SortOrder,
  type AuctionApplication,
} from "@/hooks/useGlowLaunchpad";
import {
  useRewardScore,
  getRewardScoreForApplication,
} from "@/hooks/useRewardScore";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import {
  useMiningCenter,
  type MiningCenterFilters,
} from "@/hooks/useMiningCenter";
import {
  useMiningScore,
  getMiningScoreForApplication,
} from "@/hooks/useMiningScore";

import { Skeleton } from "@/components/ui/skeleton";
import { GlowSymbol } from "@/components/glow-symbol";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useFractionSplits } from "@/hooks/useFractionSplits";
import { useIsMobile } from "@/hooks/use-mobile";
import { SlidersHorizontal, X, Info } from "lucide-react";
import { HowItWorks } from "@/components/how-it-works";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { LaunchCountdown } from "@/components/launch-countdown";
import { getNextTuesdayAt1pmET } from "@/utils/nextTuesdayET";
import { ArrowRight, HelpCircle } from "lucide-react";
import { LaunchpadStatsDialog } from "./launchpad-stats-dialog";
import { MiningStatsDialog } from "./mining-stats-dialog";
import { trackEvent } from "@/lib/telemetry";

// Extended type for applications with type tagging
export type TaggedAuctionApplication = AuctionApplication & {
  _type: "miners" | "delegations";
};

// Component to show owned fractions for a specific application
function OwnedFractionsDisplay({
  application,
  walletAddress,
}: {
  application: AuctionApplication;
  walletAddress: string;
}) {
  const { summary, isLoading } = useFractionSplits({
    walletAddress,
    fractionId: application.activeFraction?.id || null,
    enabled: Boolean(walletAddress && application.activeFraction?.id),
  });

  if (isLoading) {
    return (
      <div className="bg-muted/50 border border-border rounded-xl p-4">
        <div
          className="text-sm text-muted-foreground mb-2"
          style={{ fontFamily: "Söhne, sans-serif", fontWeight: 400 }}
        >
          Your balance
        </div>
        <div className="space-y-2">
          <div className="h-5 w-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (summary.totalStepsPurchased === 0) return null;

  const totalSteps = application.activeFraction?.totalSteps || 0;
  const percent =
    totalSteps > 0
      ? ((summary.totalStepsPurchased / totalSteps) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="bg-muted/50 border border-border rounded-xl p-4">
      <div
        className="text-sm text-muted-foreground mb-2"
        style={{ fontFamily: "Söhne, sans-serif", fontWeight: 400 }}
      >
        Your balance
      </div>
      <div
        className="text-lg lg:text-xl text-black dark:text-white"
        style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
      >
        {summary.totalStepsPurchased.toLocaleString()} of{" "}
        {totalSteps.toLocaleString()} ({percent}%)
      </div>
    </div>
  );
}

interface FilterBarProps {
  selectedZoneId?: number;
  selectedType: string;
  zones: any[];
  onZoneChange: (value: string | null) => void;
  onTypeChange: (value: string) => void;
}

function FilterBar({
  selectedZoneId,
  selectedType,
  zones,
  onZoneChange,
  onTypeChange,
}: FilterBarProps) {
  return (
    <div className="space-y-6">
      {/* Type Filter */}
      <div>
        <label
          className="text-sm mb-3 block font-medium"
          style={{
            fontFamily: "Söhne, sans-serif",
            fontWeight: 600,
          }}
        >
          Type
        </label>
        <Select value={selectedType} onValueChange={onTypeChange}>
          <SelectTrigger className="w-full h-11 bg-background border-border/60 hover:border-border transition-colors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="delegations">Delegation</SelectItem>
            <SelectItem value="miners">Miners</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-px bg-border/60" />

      {/* Zone Filter */}
      <div>
        <label
          className="text-sm mb-3 block font-medium"
          style={{
            fontFamily: "Söhne, sans-serif",
            fontWeight: 600,
          }}
        >
          Zone
        </label>
        <Select
          value={selectedZoneId?.toString() || "all"}
          onValueChange={(v) => onZoneChange(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-full h-11 bg-background border-border/60 hover:border-border transition-colors">
            <SelectValue placeholder="All zones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All zones</SelectItem>
            {zones.map((zone: any) => (
              <SelectItem key={zone.id} value={zone.id.toString()}>
                {zone.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface LaunchpadViewProps {
  onPayDeposit: (
    application: TaggedAuctionApplication,
    rewardScore?:
      | {
          userWeeklyGlwRewards: string;
          userWeeklyPdRewards: string;
        }
      | {
          miningScore: number;
          weeklyGlwRewards?: string;
          weeklyGlwRewardsUsd?: string;
        }
      | null
  ) => void;
}

function LaunchpadViewContent({ onPayDeposit }: LaunchpadViewProps) {
  const [zoneParam, setZoneParam] = useQueryState("zone");
  const [typeParam, setTypeParam] = useQueryState("type", {
    defaultValue: "all",
  });
  const [sortParam, setSortParam] = useQueryState("sort", {
    defaultValue: "publishedOnAuctionTimestamp",
  });
  const [sortOrderParam, setSortOrderParam] = useQueryState("order", {
    defaultValue: "desc",
  });
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = React.useState(false);
  const [selectedApplicationForStats, setSelectedApplicationForStats] =
    React.useState<TaggedAuctionApplication | null>(null);
  const [selectedRewardScoreForStats, setSelectedRewardScoreForStats] =
    React.useState<
      | {
          userWeeklyGlwRewards: string;
          userWeeklyPdRewards: string;
        }
      | {
          miningScore: number;
          weeklyGlwRewards?: string;
          weeklyGlwRewardsUsd?: string;
        }
      | null
    >(null);

  const isMobile = useIsMobile();
  const { address, isConnected } = useAccount();

  const selectedZoneId = zoneParam ? parseInt(zoneParam) : undefined;
  const selectedType = typeParam as "all" | "miners" | "delegations";
  const selectedCurrency = "GLW" as PaymentCurrency | undefined;
  const selectedSort = sortParam as SortBy;
  const selectedSortOrder = sortOrderParam as SortOrder;

  // Fetch launchpad (delegation) applications
  const {
    applications: launchpadApplications,
    isLoading: isLoadingLaunchpad,
    isError: isErrorLaunchpad,
    error: errorLaunchpad,
    refetch: refetchLaunchpad,
  } = useGlowLaunchpad({
    filters: {
      zoneId: selectedZoneId,
      sortBy: selectedSort,
      sortOrder: selectedSortOrder,
      paymentCurrency: selectedCurrency,
    },
  });

  // Fetch mining center (miners) applications
  const {
    applications: minersApplications,
    isLoading: isLoadingMiners,
    isError: isErrorMiners,
    error: errorMiners,
    refetch: refetchMiners,
  } = useMiningCenter({
    filters: {
      zoneId: selectedZoneId,
      sortBy: selectedSort,
      sortOrder: selectedSortOrder,
      paymentCurrency: "USDC",
    },
  });

  // Fetch all applications for zone extraction (without zone filter)
  const {
    applications: allLaunchpadApplications,
    refetch: refetchAllLaunchpad,
  } = useGlowLaunchpad({
    filters: {
      sortBy: selectedSort,
      sortOrder: selectedSortOrder,
      paymentCurrency: selectedCurrency,
    },
  });

  const { applications: allMinersApplications, refetch: refetchAllMiners } =
    useMiningCenter({
      filters: {
        sortBy: selectedSort,
        sortOrder: selectedSortOrder,
        paymentCurrency: "USDC",
      },
    });

  // Tag and merge applications
  const taggedLaunchpadApplications: TaggedAuctionApplication[] = React.useMemo(
    () =>
      launchpadApplications.map((app) => ({
        ...app,
        _type: "delegations" as const,
      })),
    [launchpadApplications]
  );

  const taggedMinersApplications: TaggedAuctionApplication[] = React.useMemo(
    () =>
      minersApplications.map((app) => ({
        ...app,
        _type: "miners" as const,
      })),
    [minersApplications]
  );

  // Merge and filter applications based on type
  const applications = React.useMemo(() => {
    const merged = [
      ...taggedLaunchpadApplications,
      ...taggedMinersApplications,
    ];

    if (selectedType === "all") return merged;
    if (selectedType === "miners") return taggedMinersApplications;
    if (selectedType === "delegations") return taggedLaunchpadApplications;
    return merged;
  }, [taggedLaunchpadApplications, taggedMinersApplications, selectedType]);

  // Combine loading and error states
  const isLoading = isLoadingLaunchpad || isLoadingMiners;
  const isError = isErrorLaunchpad || isErrorMiners;
  const error = errorLaunchpad || errorMiners;

  const refetch = React.useCallback(() => {
    refetchLaunchpad();
    refetchMiners();
  }, [refetchLaunchpad, refetchMiners]);

  // Combine all applications for zones
  const allApplications = React.useMemo(
    () => [
      ...allLaunchpadApplications.map((app) => ({
        ...app,
        _type: "delegations" as const,
      })),
      ...allMinersApplications.map((app) => ({
        ...app,
        _type: "miners" as const,
      })),
    ],
    [allLaunchpadApplications, allMinersApplications]
  );

  const { zones } = useAvailableZones(allApplications);

  // Fetch reward scores only for delegations
  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications: taggedLaunchpadApplications,
    paymentCurrency: selectedCurrency || "GLW",
    enabled: taggedLaunchpadApplications.length > 0,
    walletAddress: address || null,
  });

  // Fetch mining scores only for miners
  const { miningScoreMap, isLoading: isMiningScoresLoading } = useMiningScore({
    applications: taggedMinersApplications,
    enabled: taggedMinersApplications.length > 0,
  });

  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();

  // Wallet GLW balance
  const { signer } = useEthersSigner();
  const { glowBalance, isLoading: erc20Loading } = useER20Balances({ signer });
  const glowBalanceFormatted = React.useMemo(() => {
    if (glowBalance == null) return null;
    const amount = parseFloat(
      formatUnits(glowBalance, DECIMALS_BY_TOKEN["GLW"])
    );
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }, [glowBalance]);
  const hasMoreThanOneGlw = React.useMemo(() => {
    if (glowBalance == null) return false;
    const oneGlwInBaseUnits = BigInt(10) ** BigInt(DECIMALS_BY_TOKEN["GLW"]);
    return glowBalance > oneGlwInBaseUnits;
  }, [glowBalance]);

  const handleCountdownComplete = React.useCallback(() => {
    // Refresh all queries when countdown completes
    refetchLaunchpad();
    refetchMiners();
    refetchAllLaunchpad();
    refetchAllMiners();
  }, [refetchLaunchpad, refetchMiners, refetchAllLaunchpad, refetchAllMiners]);

  const filterBarProps = {
    selectedZoneId,
    selectedType,
    zones,
    onZoneChange: (v: string | null) => {
      trackEvent("marketplace_launchpad_filter_change", {
        filter: "zone",
        value: v ?? "all",
      });
      setZoneParam(v);
      setIsDrawerOpen(false);
    },
    onTypeChange: (v: string) => {
      trackEvent("marketplace_launchpad_filter_change", {
        filter: "type",
        value: v,
      });
      setTypeParam(v);
      setIsDrawerOpen(false);
    },
  };
  return (
    <div>
      {selectedApplicationForStats?._type === "miners" ? (
        <MiningStatsDialog
          open={statsDialogOpen}
          onOpenChange={setStatsDialogOpen}
          application={selectedApplicationForStats}
          miningScoreData={
            selectedRewardScoreForStats as {
              miningScore: number;
              weeklyGlwRewards?: string;
              weeklyGlwRewardsUsd?: string;
            } | null
          }
        />
      ) : (
        <LaunchpadStatsDialog
          open={statsDialogOpen}
          onOpenChange={setStatsDialogOpen}
          application={selectedApplicationForStats}
          rewardScore={
            selectedRewardScoreForStats as {
              userWeeklyGlwRewards: string;
              userWeeklyPdRewards: string;
            } | null
          }
        />
      )}
      {/* Mobile Filter Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="md:hidden max-h-[85vh]">
          <DrawerHeader className="border-b border-border/60">
            <div className="flex items-center justify-between">
              <DrawerTitle
                className="text-2xl"
                style={{
                  fontFamily: "Duplicate Slab, serif",
                  fontWeight: 300,
                }}
              >
                Filter
              </DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
            <p
              className="text-sm text-muted-foreground text-left mt-1"
              style={{
                fontFamily: "Söhne, sans-serif",
                fontWeight: 400,
              }}
            >
              Refine your search
            </p>
          </DrawerHeader>
          <div className="overflow-y-auto p-6">
            <FilterBar {...filterBarProps} />
          </div>
        </DrawerContent>
      </Drawer>

      <div className="p-4 md:p-6">
        {/* Filters - Desktop inline, Mobile button */}
        <div className="hidden md:block bg-muted/30 rounded-2xl border border-border p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Filters</h3>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Type
                </span>
                <Select
                  value={selectedType}
                  onValueChange={(v) => {
                    trackEvent("marketplace_launchpad_filter_change", {
                      filter: "type",
                      value: v,
                    });
                    setTypeParam(v);
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="delegations">Delegation</SelectItem>
                    <SelectItem value="miners">Miners</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Zone Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Zone
                </span>
                <Select
                  value={selectedZoneId?.toString() || "all"}
                  onValueChange={(v) => {
                    trackEvent("marketplace_launchpad_filter_change", {
                      filter: "zone",
                      value: v,
                    });
                    setZoneParam(v === "all" ? null : v);
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="All zones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All zones</SelectItem>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id.toString()}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* GLW Balance - Desktop only */}
            {isConnected && hasMoreThanOneGlw && (
              <div className="flex items-center gap-3 bg-background/50 rounded-xl border border-border px-4 py-2">
                <span
                  className="text-sm text-muted-foreground"
                  style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
                >
                  Your GLW
                </span>
                <div
                  className="text-lg text-black dark:text-white"
                  style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
                >
                  {erc20Loading
                    ? "..."
                    : glowBalanceFormatted
                    ? `${glowBalanceFormatted} GLW`
                    : "0 GLW"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Filter Button */}
        <div className="md:hidden mb-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setIsDrawerOpen(true)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            <span
              style={{
                fontFamily: "Söhne, sans-serif",
                fontWeight: 500,
              }}
            >
              Filter & Sort
            </span>
          </Button>
        </div>

        {/* GLW Wallet Balance - Mobile only */}
        {isConnected && hasMoreThanOneGlw && (
          <div className="my-4 md:hidden">
            <div className="bg-muted/30 rounded-2xl border border-border p-4 flex items-center justify-between">
              <span
                className="text-sm text-muted-foreground"
                style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
              >
                Your GLW
              </span>
              <div
                className="text-xl text-black dark:text-white"
                style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
              >
                {erc20Loading
                  ? "..."
                  : glowBalanceFormatted
                  ? `${glowBalanceFormatted} GLW`
                  : "0 GLW"}
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card
                key={i}
                className="bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
              >
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 gap-1">
                    <Skeleton className="col-span-2 w-full h-56" />
                    <Skeleton className="w-full h-28" />
                    <Skeleton className="w-full h-28" />
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-10 w-16 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                    <div className="flex gap-3">
                      <Skeleton className="h-11 flex-1 rounded-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-8">
            <p className="text-destructive text-sm">
              Error loading applications: {error?.message}
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Please try again later
            </p>
          </div>
        ) : applications.length === 0 ? (
          <>
            <LaunchCountdown
              target={getNextTuesdayAt1pmET()}
              title="Launchpad"
              subtitle="The next batch of farms will be available soon"
              onComplete={handleCountdownComplete}
            />
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
            {applications.map((application) => {
              const displayCurrency = selectedCurrency || "USDG";
              const depositAmountInCurrency = calculateProtocolDepositAmount(
                application.finalProtocolFee,
                application.applicationPriceQuotes,
                displayCurrency
              );

              // Get appropriate score based on application type
              const rewardScore =
                application._type === "delegations"
                  ? getRewardScoreForApplication(rewardScoreMap, application.id)
                  : null;

              const miningScore =
                application._type === "miners"
                  ? getMiningScoreForApplication(miningScoreMap, application.id)
                  : null;

              return (
                <Card
                  key={application.id}
                  className="bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 overflow-hidden pt-0"
                >
                  <CardContent className="p-0">
                    {/* Images */}
                    <div className="relative">
                      {/* Zone Badge */}
                      <div className="absolute top-4 left-4 z-10">
                        <div className="bg-background text-foreground backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium">
                          {application.zone.name}
                        </div>
                      </div>

                      {application.afterInstallPictures.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1">
                          <div className="col-span-2 relative">
                            <FallbackImage
                              src={
                                application.afterInstallPictures[0]?.url ||
                                "/images/sections/residential.jpg"
                              }
                              widthForProxy={900}
                              quality={70}
                              alt={`${application.zone.name} main`}
                              className="w-full h-56 object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                          </div>
                          <FallbackImage
                            src={
                              application.afterInstallPictures[1]?.url ||
                              "/images/sections/residential.jpg"
                            }
                            widthForProxy={450}
                            quality={65}
                            alt={`${application.zone.name} alt 1`}
                            className="w-full h-28 object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <FallbackImage
                            src={
                              application.afterInstallPictures[2]?.url ||
                              "/images/sections/residential.jpg"
                            }
                            widthForProxy={450}
                            quality={65}
                            alt={`${application.zone.name} alt 2`}
                            className="w-full h-28 object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1">
                          <div className="col-span-2 relative">
                            <div className="w-full h-56 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                              <span className="text-gray-400">
                                No images available
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-28 bg-gray-100 dark:bg-gray-900"></div>
                          <div className="w-full h-28 bg-gray-100 dark:bg-gray-900"></div>
                        </div>
                      )}
                    </div>

                    <div className="p-6 pb-0 space-y-4">
                      {/* Farm Name with Type Badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {application.farmName && (
                          <h3
                            className="text-xl font-semibold text-foreground"
                            style={{
                              fontFamily: "Söhne, sans-serif",
                              fontWeight: 600,
                            }}
                          >
                            {application.farmName}
                          </h3>
                        )}
                        <Badge
                          variant="secondary"
                          className={
                            application._type === "miners"
                              ? "ml-auto text-xl text-[#5fb56f] dark:text-[#ccffd4] border-[#ccffd4]/20 bg-[#ccffd4]/10 dark:bg-[#5fb56f]/10 font-semibold"
                              : "ml-auto text-xl text-[#9b7ac7] dark:text-[#dcc4ff] border-[#dcc4ff]/20 bg-[#dcc4ff]/10 dark:bg-[#9b7ac7]/10 font-semibold"
                          }
                        >
                          {application._type === "miners"
                            ? "Miner"
                            : "Delegation"}
                        </Badge>
                      </div>

                      {/* Header with Fractions Available and Reward Score (delegations only) */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-3xl lg:text-4xl leading-none mb-2"
                            style={{
                              fontFamily: "Söhne, sans-serif",
                              fontWeight: 600,
                            }}
                          >
                            {application.activeFraction
                              ? `${
                                  application.activeFraction.remainingSteps || 0
                                }/${application.activeFraction.totalSteps}`
                              : "0/0"}
                          </div>
                          <div
                            className="text-xs uppercase tracking-wider text-gray-500"
                            style={{
                              fontFamily: "Söhne, sans-serif",
                              fontWeight: 600,
                            }}
                          >
                            Available
                          </div>
                        </div>
                        {/* Reward Score - Only for delegations */}
                        {application._type === "delegations" && (
                          <div className="text-right ml-6">
                            <div
                              className="text-3xl lg:text-4xl leading-none mb-2"
                              style={{
                                fontFamily: "Söhne, sans-serif",
                                fontWeight: 600,
                              }}
                            >
                              {rewardScore?.rewardScore
                                ? rewardScore.rewardScore.toFixed(0)
                                : isRewardScoresLoading
                                ? "..."
                                : "0"}
                            </div>
                            <div className="flex items-center justify-end gap-1">
                              <div
                                className="text-xs uppercase tracking-wider text-gray-500"
                                style={{
                                  fontFamily: "Söhne, sans-serif",
                                  fontWeight: 600,
                                }}
                              >
                                Reward Score
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href="https://glow.org/blog/guide-to-delegating-glow"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Learn about Reward Score"
                                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>
                                    The Reward Score is a tool that combines
                                    both revenue streams (deposit recovery and
                                    GLW inflation) into a single metric
                                    representing expected rewards per dollar
                                    delegated. Higher Reward Scores generally
                                    indicate better delegation opportunities,
                                    but do not guarantee realized performance,
                                    since a farm's actual competitiveness and
                                    rewards may shift as new farms join its
                                    region
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        {/* Amount per Delegation/Miner - Left Column */}
                        <div className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col">
                          <div
                            className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-3"
                            style={{
                              fontFamily: "Söhne, sans-serif",
                              fontWeight: 600,
                            }}
                          >
                            {application._type === "miners"
                              ? "Price per Miner"
                              : "Delegation Amount"}
                          </div>
                          {application.activeFraction?.stepPrice &&
                          application._type === "miners" ? (
                            <div className="flex-1 flex flex-col justify-center">
                              <div
                                className="text-2xl lg:text-3xl text-black dark:text-white leading-tight"
                                style={{
                                  fontFamily: "Söhne, sans-serif",
                                  fontWeight: 600,
                                }}
                              >
                                $
                                {formatNumber(
                                  parseFloat(
                                    formatUnits(
                                      BigInt(
                                        application.activeFraction.stepPrice
                                      ),
                                      DECIMALS_BY_TOKEN["USDC"]
                                    )
                                  ),
                                  0
                                )}
                                <span
                                  className="text-base text-gray-600 dark:text-gray-400 ml-1"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 500,
                                  }}
                                >
                                  USDC
                                </span>
                              </div>
                              <div
                                className="text-[10px] text-gray-400 dark:text-gray-600 italic mt-3"
                                style={{
                                  fontFamily: "Söhne, sans-serif",
                                  fontWeight: 400,
                                }}
                              >
                                Per Miner.
                              </div>
                            </div>
                          ) : application.activeFraction?.step ? (
                            <div className="flex-1 flex flex-col justify-center">
                              <div
                                className="text-2xl lg:text-3xl text-black dark:text-white leading-tight"
                                style={{
                                  fontFamily: "Söhne, sans-serif",
                                  fontWeight: 600,
                                }}
                              >
                                {formatNumber(
                                  parseFloat(
                                    formatUnits(
                                      BigInt(application.activeFraction.step),
                                      DECIMALS_BY_TOKEN["GLW"]
                                    )
                                  ),
                                  0
                                )}
                                <span
                                  className="text-base text-gray-600 dark:text-gray-400 ml-1"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 500,
                                  }}
                                >
                                  GLW
                                </span>
                              </div>

                              {glwSpotPrice > 0 && (
                                <div
                                  className="text-sm text-gray-500 dark:text-gray-500 mt-2"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 400,
                                  }}
                                >
                                  ≈ $
                                  {formatNumber(
                                    parseFloat(
                                      formatUnits(
                                        BigInt(application.activeFraction.step),
                                        DECIMALS_BY_TOKEN["GLW"]
                                      )
                                    ) * glwSpotPrice,
                                    0
                                  )}{" "}
                                  USD
                                </div>
                              )}
                              <div
                                className="text-[10px] text-gray-400 dark:text-gray-600 italic mt-3"
                                style={{
                                  fontFamily: "Söhne, sans-serif",
                                  fontWeight: 400,
                                }}
                              >
                                Per Fraction.
                              </div>
                            </div>
                          ) : depositAmountInCurrency ? (
                            <div className="flex-1 flex flex-col justify-center">
                              <div
                                className="text-2xl lg:text-3xl text-black dark:text-white"
                                style={{
                                  fontFamily: "Söhne, sans-serif",
                                  fontWeight: 600,
                                }}
                              >
                                {formatNumber(
                                  parseFloat(depositAmountInCurrency),
                                  0
                                )}{" "}
                                <span className="text-lg font-normal">
                                  {displayCurrency}
                                </span>
                              </div>
                              <div
                                className="text-sm text-gray-500 dark:text-gray-500 mt-1"
                                style={{
                                  fontFamily: "Söhne, sans-serif",
                                  fontWeight: 300,
                                }}
                              >
                                Full sponsorship
                              </div>
                            </div>
                          ) : (
                            <div
                              className="text-base text-gray-500 flex-1 flex items-center"
                              style={{
                                fontFamily: "Söhne, sans-serif",
                                fontWeight: 400,
                              }}
                            >
                              Price not available
                            </div>
                          )}
                        </div>

                        {/* Weekly Rewards - Right Column */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="bg-muted/50 border border-border rounded-xl p-4 cursor-help flex flex-col">
                              <div className="flex items-center gap-2 mb-3">
                                <div
                                  className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 600,
                                  }}
                                >
                                  {application._type === "miners"
                                    ? "Weekly Rewards per Miner"
                                    : "Est. Weekly Rewards"}
                                </div>
                                <div className="group/help relative">
                                  <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/help:block z-50 w-64">
                                    <div className="bg-black text-white text-xs rounded-lg py-2 px-3 shadow-lg">
                                      {application._type === "miners"
                                        ? "Current weekly rate based on regional GLW allocation. May decrease as new farms join the region and dilute emissions."
                                        : "Expected weekly rewards based on audited farm performance and regional competitiveness. May vary with network changes."}
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex-1 flex flex-col justify-center">
                                <div
                                  className="text-2xl lg:text-3xl text-black dark:text-white leading-tight"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 600,
                                  }}
                                >
                                  {application._type === "miners"
                                    ? miningScore?.weeklyGlwRewards
                                      ? (() => {
                                          const rewardsPerMiner = parseFloat(
                                            formatUnits(
                                              BigInt(
                                                miningScore.weeklyGlwRewards
                                              ),
                                              DECIMALS_BY_TOKEN["GLW"]
                                            )
                                          );
                                          return `${rewardsPerMiner.toLocaleString(
                                            undefined,
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            }
                                          )}`;
                                        })()
                                      : isMiningScoresLoading
                                      ? "..."
                                      : "0"
                                    : rewardScore?.userWeeklyGlwRewards &&
                                      rewardScore?.userWeeklyPdRewards &&
                                      application.activeFraction?.totalSteps
                                    ? (() => {
                                        const glwRewards = parseFloat(
                                          formatUnits(
                                            BigInt(
                                              rewardScore.userWeeklyGlwRewards
                                            ),
                                            DECIMALS_BY_TOKEN["GLW"]
                                          )
                                        );
                                        const pdRewards = parseFloat(
                                          formatUnits(
                                            BigInt(
                                              rewardScore.userWeeklyPdRewards
                                            ),
                                            DECIMALS_BY_TOKEN["GLW"]
                                          )
                                        );
                                        const totalRewards =
                                          glwRewards + pdRewards;
                                        const totalShares =
                                          application.activeFraction.totalSteps;
                                        const rewardsPerShare =
                                          totalRewards / totalShares;
                                        return rewardsPerShare.toLocaleString(
                                          undefined,
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        );
                                      })()
                                    : isRewardScoresLoading
                                    ? "..."
                                    : "0"}
                                  <span
                                    className="text-base text-gray-600 dark:text-gray-400 ml-1"
                                    style={{
                                      fontFamily: "Söhne, sans-serif",
                                      fontWeight: 500,
                                    }}
                                  >
                                    GLW
                                  </span>
                                </div>

                                {application._type === "miners" ? (
                                  miningScore?.weeklyGlwRewards &&
                                  glwSpotPrice > 0 ? (
                                    <div
                                      className="text-sm text-gray-500 dark:text-gray-500 mt-2"
                                      style={{
                                        fontFamily: "Söhne, sans-serif",
                                        fontWeight: 400,
                                      }}
                                    >
                                      ≈ $
                                      {(() => {
                                        const rewardsPerMiner = parseFloat(
                                          formatUnits(
                                            BigInt(
                                              miningScore.weeklyGlwRewards
                                            ),
                                            DECIMALS_BY_TOKEN["GLW"]
                                          )
                                        );
                                        const usdPerMiner =
                                          rewardsPerMiner * glwSpotPrice;
                                        return usdPerMiner.toLocaleString(
                                          undefined,
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        );
                                      })()}{" "}
                                      USD per week
                                    </div>
                                  ) : null
                                ) : rewardScore?.userWeeklyGlwRewards &&
                                  rewardScore?.userWeeklyPdRewards &&
                                  application.activeFraction?.totalSteps &&
                                  glwSpotPrice > 0 ? (
                                  <div
                                    className="text-sm text-gray-500 dark:text-gray-500 mt-2"
                                    style={{
                                      fontFamily: "Söhne, sans-serif",
                                      fontWeight: 400,
                                    }}
                                  >
                                    ≈ $
                                    {(() => {
                                      const glwRewards = parseFloat(
                                        formatUnits(
                                          BigInt(
                                            rewardScore.userWeeklyGlwRewards
                                          ),
                                          DECIMALS_BY_TOKEN["GLW"]
                                        )
                                      );
                                      const pdRewards = parseFloat(
                                        formatUnits(
                                          BigInt(
                                            rewardScore.userWeeklyPdRewards
                                          ),
                                          DECIMALS_BY_TOKEN["GLW"]
                                        )
                                      );
                                      const totalRewards =
                                        glwRewards + pdRewards;
                                      const totalShares =
                                        application.activeFraction.totalSteps;
                                      const rewardsPerShare =
                                        totalRewards / totalShares;
                                      const cashPerShare =
                                        rewardsPerShare * glwSpotPrice;
                                      return cashPerShare.toLocaleString(
                                        undefined,
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        }
                                      );
                                    })()}{" "}
                                    USD per week
                                  </div>
                                ) : null}
                                <div
                                  className="text-[10px] text-gray-400 dark:text-gray-600 italic mt-3"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 400,
                                  }}
                                >
                                  Estimated returns. See Advanced Stats.
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-sm">
                              <div className="mb-2 text-background/80 text-xs">
                                Estimated weekly rewards per delegation for 100
                                weeks. These estimates may decrease as new farms
                                join the region and dilute the regional GLW
                                allocation. See Advanced Stats for detailed
                                information.
                              </div>
                              {rewardScore?.userWeeklyGlwRewards &&
                              rewardScore?.userWeeklyPdRewards &&
                              application.activeFraction?.totalSteps
                                ? (() => {
                                    const glwRewards = parseFloat(
                                      formatUnits(
                                        BigInt(
                                          rewardScore.userWeeklyGlwRewards
                                        ),
                                        DECIMALS_BY_TOKEN["GLW"]
                                      )
                                    );
                                    const pdRewards = parseFloat(
                                      formatUnits(
                                        BigInt(rewardScore.userWeeklyPdRewards),
                                        DECIMALS_BY_TOKEN["GLW"]
                                      )
                                    );
                                    const totalShares =
                                      application.activeFraction.totalSteps;
                                    const glwPerShare =
                                      glwRewards / totalShares;
                                    const pdPerShare = pdRewards / totalShares;

                                    return (
                                      <div className="space-y-1">
                                        <div>
                                          <strong>
                                            Weekly reward breakdown:
                                          </strong>
                                        </div>
                                        <div>
                                          {pdPerShare.toLocaleString(
                                            undefined,
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            }
                                          )}{" "}
                                          GLW from PDs
                                        </div>
                                        <div>
                                          {glwPerShare.toLocaleString(
                                            undefined,
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            }
                                          )}{" "}
                                          GLW from Inflation
                                        </div>
                                      </div>
                                    );
                                  })()
                                : "Calculating rewards..."}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Owned Fractions Display */}
                      {isConnected && address && (
                        <OwnedFractionsDisplay
                          application={application}
                          walletAddress={address}
                        />
                      )}

                      {/* CTAs */}
                      <div className="space-y-3">
                        <Button
                          className="w-full rounded-full h-11"
                          onClick={() => {
                            trackEvent("marketplace_launchpad_pay_click", {
                              application_id: application.id,
                              app_type: application._type,
                              zone_id: application.zone?.id ?? null,
                            });
                            onPayDeposit(
                              application,
                              application._type === "miners"
                                ? miningScore
                                : rewardScore
                            );
                          }}
                          disabled={
                            application.activeFraction
                              ? application.activeFraction.isFilled ||
                                (application.activeFraction.remainingSteps ||
                                  0) <= 0
                              : !depositAmountInCurrency
                          }
                        >
                          <span
                            style={{
                              fontFamily: "Söhne, sans-serif",
                              fontWeight: 400,
                            }}
                          >
                            {application.activeFraction?.isFilled
                              ? "Fully Funded"
                              : (application.activeFraction?.remainingSteps ||
                                  0) <= 0
                              ? "None Available"
                              : application._type === "miners"
                              ? "Buy Miners"
                              : "Delegate GLW"}
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full rounded-full h-11"
                          onClick={() => {
                            trackEvent(
                              "marketplace_launchpad_advanced_stats_open",
                              {
                                application_id: application.id,
                                app_type: application._type,
                                zone_id: application.zone?.id ?? null,
                              }
                            );
                            setSelectedApplicationForStats(application);
                            setSelectedRewardScoreForStats(
                              application._type === "miners"
                                ? miningScore || null
                                : rewardScore || null
                            );
                            setStatsDialogOpen(true);
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "Söhne, sans-serif",
                              fontWeight: 400,
                            }}
                          >
                            Advanced Stats
                          </span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <HowItWorks
        featuredCasestudy={{
          tags: "GUIDES",
          title: "A Guide to Delegating GLW",
          subtitle:
            "How token holders earn rewards by delegating their GLW to solar farms",
          image: `https://glow.org/_next/image?url=${encodeURIComponent(
            "/images/blog/guide-to-delegating-glow/header.jpg"
          )}&w=3840&q=75`,
          link: "https://glow.org/blog/guide-to-delegating-glow",
        }}
      />
    </div>
  );
}

export function LaunchpadView({ onPayDeposit }: LaunchpadViewProps) {
  return <LaunchpadViewContent onPayDeposit={onPayDeposit} />;
}
