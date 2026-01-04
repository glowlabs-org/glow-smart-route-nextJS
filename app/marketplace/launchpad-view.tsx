"use client";

import React from "react";
import { FallbackImage } from "@/components/ui/fallback-image";
import { SponsoredFarmsActivity } from "@/app/marketplace/sponsored-farms-activity";

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
} from "@/hooks";
import { useRewardScore, getRewardScoreForApplication } from "@/hooks";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useMiningCenter, type MiningCenterFilters } from "@/hooks";
import { useMiningScore, getMiningScoreForApplication } from "@/hooks";

import { Skeleton } from "@/components/ui/skeleton";
import { GlowSymbol } from "@/components/glow-symbol";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { calculateFarmEfficiency } from "@glowlabs-org/utils/browser";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useFractionSplits } from "@/hooks";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  HelpCircle,
  Info,
  MapPin,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { HowItWorks } from "@/components/how-it-works";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { LaunchCountdown } from "@/components/launch-countdown";
import { getNextTuesdayAt1pmET } from "@/utils/nextTuesdayET";
import { LaunchpadStatsDialog } from "./launchpad-stats-dialog";
import { MiningStatsDialog } from "./mining-stats-dialog";
import { trackEvent } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function countActiveListings(
  applications: Array<{
    activeFraction: { isFilled: boolean; remainingSteps: number | null } | null;
  }>
) {
  return applications.reduce((count, app) => {
    const fraction = app.activeFraction;
    if (!fraction) return count;
    const remainingSteps = fraction.remainingSteps ?? 0;
    const hasAvailability = !fraction.isFilled && remainingSteps > 0;
    return hasAvailability ? count + 1 : count;
  }, 0);
}

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
        className="text-lg lg:text-xl text-foreground"
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
  variant?: "page" | "dialog" | "widget";
  typeFilter?: "all" | "delegations" | "miners";
  widgetLayout?: "stack" | "grid" | "carousel";
}

function LaunchpadViewContent({ onPayDeposit, variant }: LaunchpadViewProps) {
  const isDialog = variant === "dialog";
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

  const shouldShowFilters = React.useMemo(() => {
    const activeDelegations = countActiveListings(allLaunchpadApplications);
    const activeMiners = countActiveListings(allMinersApplications);
    return activeDelegations > 2 && activeMiners > 2;
  }, [allLaunchpadApplications, allMinersApplications]);

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
      {shouldShowFilters ? (
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
      ) : null}

      <div className={isDialog ? "p-4" : "p-4 md:p-6"}>
        {/* Filters - Desktop inline, Mobile button */}
        {shouldShowFilters ? (
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
                    className="text-lg text-foreground"
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
        ) : null}

        {/* Mobile Filter Button */}
        {shouldShowFilters ? (
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
        ) : null}

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
                className="text-xl text-foreground"
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
          <div
            className={
              isDialog
                ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                : "grid grid-cols-1 md:grid-cols-2 gap-6"
            }
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Card
                key={i}
                className="bg-background rounded-2xl border border-border overflow-hidden"
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
          <div
            className={
              isDialog
                ? "grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-2 gap-4"
                : "grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6"
            }
          >
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
                  className="overflow-hidden pt-0 bg-muted"
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
                            <div className="w-full h-56 bg-muted/60 flex items-center justify-center">
                              <span className="text-muted-foreground">
                                No images available
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-28 bg-muted/60"></div>
                          <div className="w-full h-28 bg-muted/60"></div>
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
                          className={cn(
                            "ml-auto text-xl font-semibold border",
                            application._type === "miners"
                              ? "border-[color:var(--color-miner-yellow)]/30 bg-[color:var(--color-miner-yellow)]/10 text-miner-yellow"
                              : "border-purple-500/30 bg-purple-500/10 text-foreground"
                          )}
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
                            className="text-xs uppercase tracking-wider text-muted-foreground"
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
                                className="text-xs uppercase tracking-wider text-muted-foreground"
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
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>
                                    The Reward Score is a tool that combines
                                    both revenue streams (deposit recovery and
                                    GLW emission rewards) into a single metric
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
                            className="text-xs uppercase tracking-wider text-muted-foreground mb-3"
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
                                className="text-2xl lg:text-3xl text-foreground leading-tight"
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
                                  className="text-base text-muted-foreground ml-1"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 500,
                                  }}
                                >
                                  USDC
                                </span>
                              </div>
                              <div
                                className="text-[10px] text-muted-foreground italic mt-3"
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
                                className="text-2xl lg:text-3xl text-foreground leading-tight"
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
                                  className="text-base text-muted-foreground ml-1"
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
                                  className="text-sm text-muted-foreground mt-2"
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
                                className="text-[10px] text-muted-foreground italic mt-3"
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
                                className="text-2xl lg:text-3xl text-foreground"
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
                                className="text-sm text-muted-foreground mt-1"
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
                              className="text-base text-muted-foreground flex-1 flex items-center"
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
                                  className="text-xs uppercase tracking-wider text-muted-foreground"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 600,
                                  }}
                                >
                                  {application._type === "miners"
                                    ? "Weekly Rewards per Miner (99 weeks)"
                                    : "Est. Weekly Rewards (100 weeks)"}
                                </div>
                                <div className="group/help relative">
                                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/help:block z-50 w-64">
                                    <div className="bg-popover text-popover-foreground border border-border text-xs rounded-lg py-2 px-3 shadow-lg">
                                      {application._type === "miners"
                                        ? "Current weekly rate per miner, paid weekly for 99 weeks. May decrease as new farms join the region and dilute emissions."
                                        : "Expected weekly rewards per delegation, paid weekly for 100 weeks. May vary with network changes."}
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[color:var(--color-popover)]"></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex-1 flex flex-col justify-center">
                                <div
                                  className="text-2xl lg:text-3xl text-foreground leading-tight"
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
                                    className="text-base text-muted-foreground ml-1"
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
                                      className="text-sm text-muted-foreground mt-2"
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
                                    className="text-sm text-muted-foreground mt-2"
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
                                  className="text-[10px] text-muted-foreground italic mt-3"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 400,
                                  }}
                                >
                                  {application._type === "miners"
                                    ? "Paid weekly for 99 weeks. See Advanced Stats."
                                    : "Paid weekly for 100 weeks. See Advanced Stats."}
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {application._type === "miners" ? (
                              <div className="text-sm">
                                <div className="mb-2 text-background/80 text-xs">
                                  Estimated weekly rewards per miner, paid
                                  weekly for 99 weeks. This rate may decrease as
                                  new farms join the region and dilute the
                                  regional GLW allocation. See Advanced Stats
                                  for details.
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm">
                                <div className="mb-2 text-background/80 text-xs">
                                  Estimated weekly rewards per delegation, paid
                                  weekly for 100 weeks. These estimates may
                                  decrease as new farms join the region and
                                  dilute the regional GLW allocation. See
                                  Advanced Stats for detailed information.
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
                                          BigInt(
                                            rewardScore.userWeeklyPdRewards
                                          ),
                                          DECIMALS_BY_TOKEN["GLW"]
                                        )
                                      );
                                      const totalShares =
                                        application.activeFraction.totalSteps;
                                      const glwPerShare =
                                        glwRewards / totalShares;
                                      const pdPerShare =
                                        pdRewards / totalShares;

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
                                            GLW from Emissions
                                          </div>
                                        </div>
                                      );
                                    })()
                                  : "Calculating rewards..."}
                              </div>
                            )}
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

      {!isDialog ? (
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
      ) : null}
    </div>
  );
}

export function LaunchpadView({
  onPayDeposit,
  variant,
  typeFilter,
  widgetLayout,
}: LaunchpadViewProps) {
  if (variant === "dialog") {
    return <LaunchpadMarketplaceDialog onPayDeposit={onPayDeposit} />;
  }
  if (variant === "widget") {
    return (
      <LaunchpadMarketplaceWidget
        onPayDeposit={onPayDeposit}
        typeFilter={typeFilter}
        layout={widgetLayout}
      />
    );
  }
  return <LaunchpadViewContent onPayDeposit={onPayDeposit} variant={variant} />;
}

function getActiveFractionAvailability(application: AuctionApplication) {
  const fraction = application.activeFraction;
  if (!fraction) {
    return {
      remaining: 0,
      total: 0,
      isSoldOut: true,
      progressFilledPct: 0,
    };
  }
  const total = fraction.totalSteps ?? 0;
  const remaining = fraction.remainingSteps ?? 0;
  const isSoldOut = fraction.isFilled || remaining <= 0 || total <= 0;
  const sold = Math.max(0, total - Math.max(0, remaining));
  const progressFilledPct =
    total > 0 ? Math.max(0, Math.min(100, (sold / total) * 100)) : 0;
  return {
    remaining: Math.max(0, remaining),
    total,
    isSoldOut,
    progressFilledPct,
  };
}

function getFarmEfficiency(application: AuctionApplication) {
  const weeklyCC = application.auditFields?.netCarbonCreditEarningWeekly ?? 0;
  if (!application.finalProtocolFee || weeklyCC <= 0) return 0;
  try {
    const protocolDepositUsd6 = BigInt(application.finalProtocolFee);
    const weeklyImpactAssetsWad = BigInt(Math.floor(weeklyCC * 10 ** 18));
    return calculateFarmEfficiency(protocolDepositUsd6, weeklyImpactAssetsWad);
  } catch {
    return 0;
  }
}

function LaunchpadMarketplaceWidget({
  onPayDeposit,
  typeFilter,
  layout,
}: Pick<LaunchpadViewProps, "onPayDeposit" | "typeFilter" | "widgetLayout"> & {
  layout?: "stack" | "grid" | "carousel";
}) {
  const { address } = useAccount();
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const [statsDialogOpen, setStatsDialogOpen] = React.useState(false);
  const [selectedApplicationForStats, setSelectedApplicationForStats] =
    React.useState<TaggedAuctionApplication | null>(null);
  const [selectedScoreDataForStats, setSelectedScoreDataForStats] =
    React.useState<
      | { userWeeklyGlwRewards: string; userWeeklyPdRewards: string }
      | {
          miningScore: number;
          weeklyGlwRewards?: string;
          weeklyGlwRewardsUsd?: string;
        }
      | null
    >(null);

  const {
    applications: launchpadApplications,
    isLoading: isLoadingLaunchpad,
    isError: isErrorLaunchpad,
    error: errorLaunchpad,
  } = useGlowLaunchpad({
    filters: { paymentCurrency: "GLW" },
  });

  const {
    applications: minersApplications,
    isLoading: isLoadingMiners,
    isError: isErrorMiners,
    error: errorMiners,
  } = useMiningCenter({
    filters: { paymentCurrency: "USDC" },
  });

  const taggedDelegations = React.useMemo<TaggedAuctionApplication[]>(
    () =>
      launchpadApplications.map((app) => ({
        ...app,
        _type: "delegations" as const,
      })),
    [launchpadApplications]
  );

  const taggedMiners = React.useMemo<TaggedAuctionApplication[]>(
    () =>
      minersApplications.map((app) => ({ ...app, _type: "miners" as const })),
    [minersApplications]
  );

  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications: taggedDelegations,
    paymentCurrency: "GLW",
    enabled: taggedDelegations.length > 0,
    walletAddress: address || null,
  });

  const { miningScoreMap, isLoading: isMiningScoresLoading } = useMiningScore({
    applications: taggedMiners,
    enabled: taggedMiners.length > 0,
  });

  const rows = React.useMemo(() => {
    const filter = typeFilter ?? "all";
    const listAll =
      filter === "delegations"
        ? taggedDelegations
        : filter === "miners"
        ? taggedMiners
        : [...taggedDelegations, ...taggedMiners];
    const withMetrics = listAll.map((application) => {
      const availability = getActiveFractionAvailability(application);
      const efficiency = getFarmEfficiency(application);

      const reward = getRewardScoreForApplication(
        rewardScoreMap,
        application.id
      );
      const mining = getMiningScoreForApplication(
        miningScoreMap,
        application.id
      );

      const score =
        application._type === "delegations"
          ? reward?.rewardScore ?? 0
          : mining?.miningScore ?? 0;

      const scoreData =
        application._type === "delegations"
          ? reward
            ? {
                userWeeklyGlwRewards: reward.userWeeklyGlwRewards,
                userWeeklyPdRewards: reward.userWeeklyPdRewards,
              }
            : null
          : mining
          ? {
              miningScore: mining.miningScore,
              weeklyGlwRewards: mining.weeklyGlwRewards,
              weeklyGlwRewardsUsd: mining.weeklyGlwRewardsUsd,
            }
          : null;

      const cost = (() => {
        try {
          if (!application.activeFraction) return 0;
          if (application._type === "miners") {
            return parseFloat(
              formatUnits(
                BigInt(application.activeFraction.stepPrice || "0"),
                DECIMALS_BY_TOKEN.USDC
              )
            );
          }
          return parseFloat(
            formatUnits(
              BigInt(application.activeFraction.step || "0"),
              DECIMALS_BY_TOKEN.GLW
            )
          );
        } catch {
          return 0;
        }
      })();

      const weeklyYield = (() => {
        try {
          if (application._type === "miners") {
            if (!mining?.weeklyGlwRewards) return 0;
            return parseFloat(
              formatUnits(
                BigInt(mining.weeklyGlwRewards),
                DECIMALS_BY_TOKEN.GLW
              )
            );
          }
          const totalShares = application.activeFraction?.totalSteps || 0;
          if (!reward || !totalShares) return 0;
          const glwRewards = parseFloat(
            formatUnits(
              BigInt(reward.userWeeklyGlwRewards || "0"),
              DECIMALS_BY_TOKEN.GLW
            )
          );
          const pdRewards = parseFloat(
            formatUnits(
              BigInt(reward.userWeeklyPdRewards || "0"),
              DECIMALS_BY_TOKEN.GLW
            )
          );
          return (glwRewards + pdRewards) / totalShares;
        } catch {
          return 0;
        }
      })();

      const yieldUsdPerWeek = glwSpotPrice > 0 ? weeklyYield * glwSpotPrice : 0;
      const yieldPer1000Usd =
        application._type === "miners" && cost > 0 && yieldUsdPerWeek > 0
          ? (yieldUsdPerWeek / cost) * 1000
          : 0;

      return {
        application,
        availability,
        efficiency,
        score,
        scoreData,
        cost,
        weeklyYield,
        yieldUsdPerWeek,
        yieldPer1000Usd,
        rewardScore: application._type === "delegations" ? reward : null,
        miningScore: application._type === "miners" ? mining : null,
      };
    });

    const delegations = withMetrics
      .filter((r) => r.application._type === "delegations")
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const miners = withMetrics
      .filter((r) => r.application._type === "miners")
      .sort((a, b) => (b.yieldPer1000Usd ?? 0) - (a.yieldPer1000Usd ?? 0));

    if ((typeFilter ?? "all") === "delegations") return delegations;
    if ((typeFilter ?? "all") === "miners") return miners;

    const merged: Array<(typeof withMetrics)[number]> = [];
    let i = 0;
    let j = 0;
    const denomD = Math.max(1, delegations.length - 1);
    const denomM = Math.max(1, miners.length - 1);
    while (i < delegations.length || j < miners.length) {
      if (i >= delegations.length) {
        merged.push(miners[j++]);
        continue;
      }
      if (j >= miners.length) {
        merged.push(delegations[i++]);
        continue;
      }
      const nd = i / denomD;
      const nm = j / denomM;
      if (nd <= nm) merged.push(delegations[i++]);
      else merged.push(miners[j++]);
    }

    return merged;
  }, [
    glwSpotPrice,
    miningScoreMap,
    rewardScoreMap,
    taggedDelegations,
    taggedMiners,
    typeFilter,
  ]);

  const isLoading = isLoadingLaunchpad || isLoadingMiners;
  const isError = isErrorLaunchpad || isErrorMiners;
  const error = (errorLaunchpad || errorMiners) as Error | null;
  const resolvedLayout = layout ?? "stack";
  const carouselScrollRef = React.useRef<HTMLDivElement | null>(null);
  const carouselStepPxRef = React.useRef(0);
  const [carouselIndex, setCarouselIndex] = React.useState(0);
  const [carouselCanPrev, setCarouselCanPrev] = React.useState(false);
  const [carouselCanNext, setCarouselCanNext] = React.useState(false);

  const updateCarouselMeta = React.useCallback(() => {
    if (resolvedLayout !== "carousel") return;
    const el = carouselScrollRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const left = el.scrollLeft;
    const step = carouselStepPxRef.current;
    const rawIndex = step > 0 ? Math.round(left / step) : 0;
    const clampedIndex = Math.max(0, Math.min(rows.length - 1, rawIndex));
    setCarouselIndex(clampedIndex);
    setCarouselCanPrev(left > 1);
    setCarouselCanNext(left < max - 1);
  }, [resolvedLayout, rows.length]);

  const scrollCarouselBy = React.useCallback((delta: number) => {
    const el = carouselScrollRef.current;
    if (!el) return;
    const step = carouselStepPxRef.current;
    const fallbackStep = Math.max(320, Math.round(el.clientWidth * 0.9));
    const px = step > 0 ? step * delta : fallbackStep * delta;
    el.scrollBy({ left: px, behavior: "smooth" });
  }, []);

  const scrollCarouselTo = React.useCallback((index: number) => {
    const el = carouselScrollRef.current;
    if (!el) return;
    const step = carouselStepPxRef.current;
    if (step <= 0) return;
    el.scrollTo({ left: step * index, behavior: "smooth" });
  }, []);

  const handleCarouselWheel = React.useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const el = carouselScrollRef.current;
      if (!el) return;
      if (resolvedLayout !== "carousel") return;
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      el.scrollLeft += delta;
      e.preventDefault();
    },
    [resolvedLayout]
  );

  React.useLayoutEffect(() => {
    if (resolvedLayout !== "carousel") return;
    const el = carouselScrollRef.current;
    if (!el) return;
    const measure = () => {
      const items = el.querySelectorAll<HTMLElement>("[data-carousel-item]");
      if (items.length >= 2) {
        carouselStepPxRef.current = items[1].offsetLeft - items[0].offsetLeft;
      } else if (items.length === 1) {
        carouselStepPxRef.current = items[0].offsetWidth + 12;
      } else {
        carouselStepPxRef.current = 0;
      }
      updateCarouselMeta();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [resolvedLayout, rows.length, updateCarouselMeta]);

  return (
    <div className="w-full">
      {selectedApplicationForStats?._type === "miners" ? (
        <MiningStatsDialog
          open={statsDialogOpen}
          onOpenChange={setStatsDialogOpen}
          application={selectedApplicationForStats}
          miningScoreData={
            selectedScoreDataForStats as {
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
            selectedScoreDataForStats as {
              userWeeklyGlwRewards: string;
              userWeeklyPdRewards: string;
            } | null
          }
        />
      )}
      {isLoading ? (
        resolvedLayout === "carousel" ? (
          <div className="w-full">
            <div className="mb-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                disabled
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                disabled
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div
              ref={carouselScrollRef}
              className="w-full overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scroll-smooth touch-pan-x overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex gap-3 pr-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    data-carousel-item
                    className="snap-start shrink-0 w-[520px] max-w-[86vw]"
                  >
                    <div className="h-[168px] w-full rounded-2xl border border-border bg-muted/10" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-1 flex items-center justify-center gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"
                />
              ))}
            </div>
          </div>
        ) : (
          <div
            className={
              resolvedLayout === "grid"
                ? "grid grid-cols-1 xl:grid-cols-2 gap-3"
                : "space-y-3"
            }
          >
            {Array.from({ length: resolvedLayout === "grid" ? 2 : 4 }).map(
              (_, i) => (
                <div
                  key={i}
                  className="h-[168px] w-full rounded-2xl border border-border bg-muted/10"
                />
              )
            )}
          </div>
        )
      ) : isError ? (
        <div className="py-10 text-center">
          <div className="text-sm text-destructive">
            Error loading marketplace: {error?.message}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <LaunchCountdown
          target={getNextTuesdayAt1pmET()}
          title="Launchpad"
          subtitle="The next batch of farms will be available soon"
        />
      ) : resolvedLayout === "carousel" ? (
        <div className="w-full">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "listing" : "listings"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => scrollCarouselBy(-1)}
                disabled={!carouselCanPrev}
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => scrollCarouselBy(1)}
                disabled={!carouselCanNext}
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            ref={carouselScrollRef}
            onScroll={updateCarouselMeta}
            onWheel={handleCarouselWheel}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") scrollCarouselBy(-1);
              if (e.key === "ArrowRight") scrollCarouselBy(1);
            }}
            tabIndex={0}
            className="w-full overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scroll-smooth touch-pan-x overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex gap-3 pr-6">
              {rows.map((row) => (
                <div
                  key={row.application.id}
                  data-carousel-item
                  className="snap-start shrink-0 w-[520px] max-w-[86vw]"
                >
                  <LaunchpadWidgetAssetCard
                    row={row}
                    isScoresLoading={
                      row.application._type === "delegations"
                        ? isRewardScoresLoading
                        : isMiningScoresLoading
                    }
                    glwSpotPrice={glwSpotPrice}
                    onPayDeposit={onPayDeposit}
                    onOpenStats={(application, scoreData) => {
                      setSelectedApplicationForStats(application);
                      setSelectedScoreDataForStats(scoreData ?? null);
                      setStatsDialogOpen(true);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {rows.length > 1 ? (
            <div className="mt-1 flex items-center justify-center gap-2">
              {rows.map((row, i) => (
                <button
                  key={row.application.id}
                  type="button"
                  aria-label={`Go to item ${i + 1}`}
                  onClick={() => scrollCarouselTo(i)}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors",
                    i === carouselIndex
                      ? "bg-foreground"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={
            resolvedLayout === "grid"
              ? "grid grid-cols-1 xl:grid-cols-2 gap-3"
              : "space-y-3"
          }
        >
          {rows.map((row) => (
            <LaunchpadWidgetAssetCard
              key={row.application.id}
              row={row}
              isScoresLoading={
                row.application._type === "delegations"
                  ? isRewardScoresLoading
                  : isMiningScoresLoading
              }
              glwSpotPrice={glwSpotPrice}
              onPayDeposit={onPayDeposit}
              onOpenStats={(application, scoreData) => {
                setSelectedApplicationForStats(application);
                setSelectedScoreDataForStats(scoreData ?? null);
                setStatsDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LaunchpadWidgetAssetCard({
  row,
  isScoresLoading,
  glwSpotPrice,
  onPayDeposit,
  onOpenStats,
}: {
  row: {
    application: TaggedAuctionApplication;
    availability: ReturnType<typeof getActiveFractionAvailability>;
    score: number;
    scoreData:
      | { userWeeklyGlwRewards: string; userWeeklyPdRewards: string }
      | {
          miningScore: number;
          weeklyGlwRewards?: string;
          weeklyGlwRewardsUsd?: string;
        }
      | null;
    cost: number;
    weeklyYield: number;
    rewardScore: { rewardScore: number } | null;
    miningScore: { miningScore: number } | null;
    yieldUsdPerWeek: number;
    yieldPer1000Usd: number;
  };
  isScoresLoading: boolean;
  glwSpotPrice: number;
  onPayDeposit: LaunchpadViewProps["onPayDeposit"];
  onOpenStats: (
    application: TaggedAuctionApplication,
    scoreData:
      | { userWeeklyGlwRewards: string; userWeeklyPdRewards: string }
      | {
          miningScore: number;
          weeklyGlwRewards?: string;
          weeklyGlwRewardsUsd?: string;
        }
      | null
  ) => void;
}) {
  const { application, availability, scoreData, cost, weeklyYield } = row;
  const isDelegation = application._type === "delegations";
  const isSoldOut = availability.isSoldOut;
  const remainingPct = React.useMemo(() => {
    const total = availability.total || 0;
    const remaining = availability.remaining || 0;
    if (isSoldOut || total <= 0) return 0;
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  }, [availability.remaining, availability.total, isSoldOut]);

  const title = application.farmName || "Unnamed Farm";
  const imageSrc = getDialogCardImageSrc(application);

  const costLabel = isDelegation ? "Delegation Amount" : "Price / Miner";
  const costMain = isDelegation
    ? `${Math.round(cost).toLocaleString()} GLW`
    : `$${cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`;
  const costSub = isDelegation
    ? glwSpotPrice > 0
      ? `≈ $${Math.round(cost * glwSpotPrice).toLocaleString()} USD`
      : "—"
    : "Stable price";

  const rewardsMain =
    isScoresLoading && weeklyYield === 0
      ? "…"
      : `+${weeklyYield.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} GLW/wk`;

  const delegationRewardsBreakdown = React.useMemo(() => {
    if (!isDelegation) return null;
    if (!application.activeFraction?.totalSteps) return null;
    if (!scoreData) return null;
    if (!("userWeeklyGlwRewards" in scoreData)) return null;
    if (!("userWeeklyPdRewards" in scoreData)) return null;

    try {
      const totalShares = application.activeFraction.totalSteps;
      const glwRewards = parseFloat(
        formatUnits(
          BigInt(scoreData.userWeeklyGlwRewards || "0"),
          DECIMALS_BY_TOKEN.GLW
        )
      );
      const pdRewards = parseFloat(
        formatUnits(
          BigInt(scoreData.userWeeklyPdRewards || "0"),
          DECIMALS_BY_TOKEN.GLW
        )
      );

      const inflationPerShare = totalShares > 0 ? glwRewards / totalShares : 0;
      const pdPerShare = totalShares > 0 ? pdRewards / totalShares : 0;

      return {
        inflationPerShare,
        pdPerShare,
      };
    } catch {
      return null;
    }
  }, [application.activeFraction?.totalSteps, isDelegation, scoreData]);

  const delegationScoreLabel = React.useMemo(() => {
    if (!isDelegation) return null;
    if (isScoresLoading) return "…";
    return row.rewardScore?.rewardScore
      ? Math.round(row.rewardScore.rewardScore).toLocaleString()
      : "0";
  }, [isDelegation, isScoresLoading, row.rewardScore?.rewardScore]);

  const rewardsSub = isDelegation
    ? null
    : glwSpotPrice > 0
    ? `≈ $${Math.round(weeklyYield * glwSpotPrice).toLocaleString()} USD/wk`
    : "—";

  const accent = isDelegation
    ? {
        badge: "border-purple-500/30 bg-purple-500/10 text-purple-500",
        progress: "bg-purple-500/70",
      }
    : {
        badge:
          "border-[color:var(--color-miner-yellow)]/30 bg-[color:var(--color-miner-yellow)]/10 text-miner-yellow",
        progress: "bg-[color:var(--color-miner-yellow)]/70",
      };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-muted/10 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
          <FallbackImage
            src={imageSrc}
            widthForProxy={280}
            quality={70}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="truncate text-lg font-semibold text-foreground">
              {title}
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "shrink-0 border px-2 py-0.5 text-xs leading-none",
                accent.badge
              )}
            >
              {isDelegation ? "Delegation" : "Miner"}
            </Badge>
          </div>
          <div className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{application.zone.name}</span>
          </div>

          <div className="mt-3 flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="relative h-10 w-full overflow-hidden rounded-full bg-muted/40 border border-border/60">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    accent.progress
                  )}
                  style={{ width: `${remainingPct}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-start px-3">
                  <span className="text-xs font-mono font-medium tabular-nums text-foreground/80">
                    {isSoldOut
                      ? "SOLD OUT"
                      : `${availability.remaining} / ${availability.total} Left`}
                  </span>
                </div>
              </div>
            </div>

            <Button
              className="h-10 shrink-0 rounded-full px-4 text-sm whitespace-nowrap"
              disabled={isSoldOut}
              onClick={() => {
                if (isSoldOut) return;
                onPayDeposit(application, scoreData);
              }}
            >
              {isSoldOut
                ? "Waitlist"
                : isDelegation
                ? "Delegate GLW"
                : "Buy Miners"}
            </Button>
            <Button
              variant="outline"
              className="h-10 shrink-0 rounded-full px-3 text-sm whitespace-nowrap"
              onClick={() => onOpenStats(application, scoreData)}
            >
              Advanced Stats
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 min-w-0">
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-background/30 p-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {costLabel}
            </div>
            <div className="mt-2 text-sm font-semibold text-foreground">
              {costMain}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{costSub}</div>
          </div>
          <div className="rounded-xl border border-border bg-background/30 p-3">
            {isDelegation ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex cursor-help items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Est. Rewards (100 weeks)
                    <Info className="h-3.5 w-3.5 opacity-70" />
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="start"
                  sideOffset={8}
                  className="max-w-[280px] p-3"
                >
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-primary-foreground">
                      Estimated rewards
                    </div>
                    <div className="text-[11px] leading-snug text-primary-foreground/80">
                      Weekly estimate per delegation, paid weekly for 100 weeks.
                      Can decrease as regions fill. See Advanced Stats for
                      details.
                    </div>
                    <div className="h-px bg-primary-foreground/15" />
                    {delegationRewardsBreakdown ? (
                      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[11px]">
                        <div className="text-primary-foreground/80">
                          GLW from PDs
                        </div>
                        <div className="font-mono tabular-nums text-primary-foreground">
                          {delegationRewardsBreakdown.pdPerShare.toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </div>
                        <div className="text-primary-foreground/80">
                          GLW from Inflation
                        </div>
                        <div className="font-mono tabular-nums text-primary-foreground">
                          {delegationRewardsBreakdown.inflationPerShare.toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-primary-foreground/70">
                        Calculating breakdown…
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Weekly Rewards (99 weeks)
              </div>
            )}
            <div className="mt-2 text-sm font-semibold text-foreground">
              {rewardsMain}
            </div>
            {isDelegation ? (
              <div className="mt-1 text-xs">
                <span className="text-muted-foreground">Score:</span>{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {delegationScoreLabel}
                </span>
              </div>
            ) : (
              <div className="mt-1 text-xs text-muted-foreground">
                {rewardsSub}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LaunchpadMarketplaceDialog({
  onPayDeposit,
}: Pick<LaunchpadViewProps, "onPayDeposit">) {
  const { address } = useAccount();
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  type DialogTab = "all" | "delegations" | "miners" | "activity";
  const [tab, setTab] = React.useState<DialogTab>("all");
  const [zoneId, setZoneId] = React.useState<number | null>(null);
  const [sortBy, setSortBy] = React.useState<
    "featured" | "newest" | "rewardScore" | "yieldPer1000"
  >("featured");
  const [statsDialogOpen, setStatsDialogOpen] = React.useState(false);
  const [selectedApplicationForStats, setSelectedApplicationForStats] =
    React.useState<TaggedAuctionApplication | null>(null);
  const [selectedScoreDataForStats, setSelectedScoreDataForStats] =
    React.useState<
      | { userWeeklyGlwRewards: string; userWeeklyPdRewards: string }
      | {
          miningScore: number;
          weeklyGlwRewards?: string;
          weeklyGlwRewardsUsd?: string;
        }
      | null
    >(null);

  const {
    applications: launchpadApplications,
    isLoading: isLoadingLaunchpad,
    isError: isErrorLaunchpad,
    error: errorLaunchpad,
  } = useGlowLaunchpad({
    filters: { paymentCurrency: "GLW" },
  });

  const {
    applications: minersApplications,
    isLoading: isLoadingMiners,
    isError: isErrorMiners,
    error: errorMiners,
  } = useMiningCenter({
    filters: { paymentCurrency: "USDC" },
  });

  const isLive = React.useMemo(() => {
    const activeDelegations = countActiveListings(launchpadApplications);
    const activeMiners = countActiveListings(minersApplications);
    return activeDelegations + activeMiners > 0;
  }, [launchpadApplications, minersApplications]);

  const activeTab: DialogTab = isLive || tab !== "activity" ? tab : "all";

  const allApplications = React.useMemo(
    () => [
      ...launchpadApplications.map((app) => ({
        ...app,
        _type: "delegations" as const,
      })),
      ...minersApplications.map((app) => ({
        ...app,
        _type: "miners" as const,
      })),
    ],
    [launchpadApplications, minersApplications]
  );

  const { zones } = useAvailableZones(allApplications);

  const shouldShowRegionFilter = React.useMemo(() => {
    const activeDelegations = countActiveListings(launchpadApplications);
    const activeMiners = countActiveListings(minersApplications);
    return activeDelegations > 2 && activeMiners > 2;
  }, [launchpadApplications, minersApplications]);

  const filteredDelegations = React.useMemo(() => {
    if (!zoneId) return launchpadApplications;
    return launchpadApplications.filter((a) => a.zone.id === zoneId);
  }, [launchpadApplications, zoneId]);

  const filteredMiners = React.useMemo(() => {
    if (!zoneId) return minersApplications;
    return minersApplications.filter((a) => a.zone.id === zoneId);
  }, [minersApplications, zoneId]);

  const taggedDelegations = React.useMemo<TaggedAuctionApplication[]>(
    () =>
      filteredDelegations.map((app) => ({
        ...app,
        _type: "delegations" as const,
      })),
    [filteredDelegations]
  );

  const taggedMiners = React.useMemo<TaggedAuctionApplication[]>(
    () => filteredMiners.map((app) => ({ ...app, _type: "miners" as const })),
    [filteredMiners]
  );

  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications: taggedDelegations,
    paymentCurrency: "GLW",
    enabled: taggedDelegations.length > 0,
    walletAddress: address || null,
  });

  const { miningScoreMap, isLoading: isMiningScoresLoading } = useMiningScore({
    applications: taggedMiners,
    enabled: taggedMiners.length > 0,
  });

  const sortOptions = React.useMemo(() => {
    if (tab === "activity") {
      return [
        { value: "featured", label: "Featured" },
        { value: "newest", label: "Newest" },
      ] as const;
    }
    if (tab === "delegations") {
      return [
        { value: "featured", label: "Featured" },
        { value: "newest", label: "Newest" },
        { value: "rewardScore", label: "Reward Score" },
      ] as const;
    }
    if (tab === "miners") {
      return [
        { value: "featured", label: "Featured" },
        { value: "newest", label: "Newest" },
        { value: "yieldPer1000", label: "Yield / $1000" },
      ] as const;
    }
    return [
      { value: "featured", label: "Featured" },
      { value: "newest", label: "Newest" },
    ] as const;
  }, [tab]);

  const safeSortBy = React.useMemo(() => {
    const allowed = new Set(sortOptions.map((o) => o.value));
    return allowed.has(sortBy) ? sortBy : "featured";
  }, [sortBy, sortOptions]);

  const rows = React.useMemo(() => {
    const listAll = [...taggedDelegations, ...taggedMiners];
    const list =
      tab === "delegations"
        ? taggedDelegations
        : tab === "miners"
        ? taggedMiners
        : listAll;

    const zoneFiltered =
      zoneId == null ? list : list.filter((a) => a.zone.id === zoneId);

    const withMetrics = zoneFiltered.map((application) => {
      const availability = getActiveFractionAvailability(application);
      const efficiency = getFarmEfficiency(application);

      const reward = getRewardScoreForApplication(
        rewardScoreMap,
        application.id
      );
      const mining = getMiningScoreForApplication(
        miningScoreMap,
        application.id
      );

      const rewardScore = application._type === "delegations" ? reward : null;
      const miningScore = application._type === "miners" ? mining : null;

      const score =
        application._type === "delegations"
          ? reward?.rewardScore ?? 0
          : mining?.miningScore ?? 0;

      const scoreData =
        application._type === "delegations"
          ? reward
            ? {
                userWeeklyGlwRewards: reward.userWeeklyGlwRewards,
                userWeeklyPdRewards: reward.userWeeklyPdRewards,
              }
            : null
          : mining
          ? {
              miningScore: mining.miningScore,
              weeklyGlwRewards: mining.weeklyGlwRewards,
              weeklyGlwRewardsUsd: mining.weeklyGlwRewardsUsd,
            }
          : null;

      const cost = (() => {
        try {
          if (!application.activeFraction) return 0;
          if (application._type === "miners") {
            return parseFloat(
              formatUnits(
                BigInt(application.activeFraction.stepPrice || "0"),
                DECIMALS_BY_TOKEN.USDC
              )
            );
          }
          return parseFloat(
            formatUnits(
              BigInt(application.activeFraction.step || "0"),
              DECIMALS_BY_TOKEN.GLW
            )
          );
        } catch {
          return 0;
        }
      })();

      const weeklyYield = (() => {
        try {
          if (application._type === "miners") {
            if (!miningScore?.weeklyGlwRewards) return 0;
            return parseFloat(
              formatUnits(
                BigInt(miningScore.weeklyGlwRewards),
                DECIMALS_BY_TOKEN.GLW
              )
            );
          }
          const totalShares = application.activeFraction?.totalSteps || 0;
          if (!rewardScore || !totalShares) return 0;
          const glwRewards = parseFloat(
            formatUnits(
              BigInt(rewardScore.userWeeklyGlwRewards || "0"),
              DECIMALS_BY_TOKEN.GLW
            )
          );
          const pdRewards = parseFloat(
            formatUnits(
              BigInt(rewardScore.userWeeklyPdRewards || "0"),
              DECIMALS_BY_TOKEN.GLW
            )
          );
          return (glwRewards + pdRewards) / totalShares;
        } catch {
          return 0;
        }
      })();

      const yieldUsdPerWeek = glwSpotPrice > 0 ? weeklyYield * glwSpotPrice : 0;
      const yieldPer1000Usd =
        application._type === "miners" && cost > 0 && yieldUsdPerWeek > 0
          ? (yieldUsdPerWeek / cost) * 1000
          : 0;

      return {
        application,
        availability,
        efficiency,
        score,
        scoreData,
        cost,
        weeklyYield,
        rewardScore,
        miningScore,
        yieldUsdPerWeek,
        yieldPer1000Usd,
      };
    });

    const byNewest = (a: (typeof withMetrics)[number]) =>
      Date.parse(a.application.publishedOnAuctionTimestamp || "") || 0;

    if (tab === "all" && safeSortBy === "featured") {
      const delegations = withMetrics
        .filter((r) => r.application._type === "delegations")
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const miners = withMetrics
        .filter((r) => r.application._type === "miners")
        .sort((a, b) => (b.yieldPer1000Usd ?? 0) - (a.yieldPer1000Usd ?? 0));

      const merged: Array<(typeof withMetrics)[number]> = [];
      let i = 0;
      let j = 0;
      const denomD = Math.max(1, delegations.length - 1);
      const denomM = Math.max(1, miners.length - 1);
      while (i < delegations.length || j < miners.length) {
        if (i >= delegations.length) {
          merged.push(miners[j++]);
          continue;
        }
        if (j >= miners.length) {
          merged.push(delegations[i++]);
          continue;
        }
        const nd = i / denomD;
        const nm = j / denomM;
        if (nd <= nm) {
          merged.push(delegations[i++]);
        } else {
          merged.push(miners[j++]);
        }
      }
      return merged;
    }

    const sorted = [...withMetrics].sort((a, b) => {
      if (safeSortBy === "newest") return byNewest(b) - byNewest(a);
      if (safeSortBy === "rewardScore") return (b.score ?? 0) - (a.score ?? 0);
      if (safeSortBy === "yieldPer1000")
        return (b.yieldPer1000Usd ?? 0) - (a.yieldPer1000Usd ?? 0);
      if (safeSortBy === "featured") {
        if (tab === "miners")
          return (b.yieldPer1000Usd ?? 0) - (a.yieldPer1000Usd ?? 0);
        return (b.score ?? 0) - (a.score ?? 0);
      }
      return 0;
    });

    return sorted;
  }, [
    glwSpotPrice,
    miningScoreMap,
    rewardScoreMap,
    safeSortBy,
    tab,
    taggedDelegations,
    taggedMiners,
    zoneId,
  ]);

  const globalStats = React.useMemo(() => {
    const list = rows.map((r) => r.application);
    const activeFarms = rows.filter((r) => !r.availability.isSoldOut).length;
    const totals = rows.reduce(
      (acc, r) => {
        acc.remaining += r.availability.remaining;
        acc.total += r.availability.total;
        return acc;
      },
      { remaining: 0, total: 0 }
    );
    const scores = rows
      .map((r) => r.score)
      .filter((s) => Number.isFinite(s) && s > 0);
    const avgScore =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const totalWattage = list.reduce(
      (sum, app) => sum + (app.auditFields?.systemWattageOutput ?? 0),
      0
    );
    const totalMw = totalWattage > 0 ? totalWattage / 1e6 : 0;

    return {
      activeFarms,
      remaining: totals.remaining,
      total: totals.total,
      avgScore,
      bestScore,
      totalMw,
    };
  }, [rows]);

  const isLoading = isLoadingLaunchpad || isLoadingMiners;
  const isError = isErrorLaunchpad || isErrorMiners;
  const error = (errorLaunchpad || errorMiners) as Error | null;

  const tabCounts = React.useMemo(() => {
    const list =
      zoneId == null
        ? allApplications
        : allApplications.filter((a) => a.zone.id === zoneId);
    const delegations = list.filter((a) => a._type === "delegations").length;
    const miners = list.filter((a) => a._type === "miners").length;
    return { all: list.length, delegations, miners };
  }, [allApplications, zoneId]);

  return (
    <div className="p-4 md:p-6">
      {selectedApplicationForStats?._type === "miners" ? (
        <MiningStatsDialog
          open={statsDialogOpen}
          onOpenChange={setStatsDialogOpen}
          application={selectedApplicationForStats}
          miningScoreData={
            selectedScoreDataForStats as {
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
            selectedScoreDataForStats as {
              userWeeklyGlwRewards: string;
              userWeeklyPdRewards: string;
            } | null
          }
        />
      )}
      <LaunchpadMarketplaceDialogContent
        tab={activeTab}
        onTabChange={setTab}
        sortBy={safeSortBy}
        onSortByChange={setSortBy}
        sortOptions={sortOptions}
        tabCounts={tabCounts}
        isLive={isLive}
        zoneId={zoneId}
        onZoneIdChange={setZoneId}
        shouldShowRegionFilter={shouldShowRegionFilter}
        zones={zones}
        isLoading={isLoading}
        isError={isError}
        error={error}
        rows={rows}
        isRewardScoresLoading={isRewardScoresLoading}
        isMiningScoresLoading={isMiningScoresLoading}
        globalStats={globalStats}
        glwSpotPrice={glwSpotPrice}
        onPayDeposit={onPayDeposit}
        onOpenStats={(application, scoreData) => {
          setSelectedApplicationForStats(application);
          setSelectedScoreDataForStats(scoreData ?? null);
          setStatsDialogOpen(true);
        }}
      />
    </div>
  );
}

function getDialogCardImageSrc(application: AuctionApplication) {
  return (
    application.afterInstallPictures?.[0]?.url ||
    "/images/sections/residential.jpg"
  );
}

function LaunchpadMarketplaceDialogContent({
  tab,
  onTabChange,
  sortBy,
  onSortByChange,
  sortOptions,
  tabCounts,
  isLive,
  zoneId,
  onZoneIdChange,
  shouldShowRegionFilter,
  zones,
  isLoading,
  isError,
  error,
  rows,
  isRewardScoresLoading,
  isMiningScoresLoading,
  globalStats,
  glwSpotPrice,
  onPayDeposit,
  onOpenStats,
}: {
  tab: "all" | "delegations" | "miners" | "activity";
  onTabChange: (t: "all" | "delegations" | "miners" | "activity") => void;
  sortBy: "featured" | "newest" | "rewardScore" | "yieldPer1000";
  onSortByChange: (
    v: "featured" | "newest" | "rewardScore" | "yieldPer1000"
  ) => void;
  sortOptions: ReadonlyArray<{
    value: "featured" | "newest" | "rewardScore" | "yieldPer1000";
    label: string;
  }>;
  tabCounts: { all: number; delegations: number; miners: number };
  isLive: boolean;
  zoneId: number | null;
  onZoneIdChange: (v: number | null) => void;
  shouldShowRegionFilter: boolean;
  zones: Array<{ id: number; name: string }>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  rows: Array<{
    application: TaggedAuctionApplication;
    availability: ReturnType<typeof getActiveFractionAvailability>;
    efficiency: number;
    score: number;
    scoreData:
      | { userWeeklyGlwRewards: string; userWeeklyPdRewards: string }
      | {
          miningScore: number;
          weeklyGlwRewards?: string;
          weeklyGlwRewardsUsd?: string;
        }
      | null;
    cost: number;
    weeklyYield: number;
    rewardScore: { rewardScore: number } | null;
    miningScore: { miningScore: number } | null;
    yieldUsdPerWeek: number;
    yieldPer1000Usd: number;
  }>;
  isRewardScoresLoading: boolean;
  isMiningScoresLoading: boolean;
  globalStats: {
    activeFarms: number;
    remaining: number;
    total: number;
    avgScore: number;
    bestScore: number;
    totalMw: number;
  };
  glwSpotPrice: number;
  onPayDeposit: LaunchpadViewProps["onPayDeposit"];
  onOpenStats: (
    application: TaggedAuctionApplication,
    scoreData:
      | { userWeeklyGlwRewards: string; userWeeklyPdRewards: string }
      | {
          miningScore: number;
          weeklyGlwRewards?: string;
          weeklyGlwRewardsUsd?: string;
        }
      | null
  ) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-4 overflow-x-hidden">
      <h1 className="text-2xl font-bold hidden md:block">Glow Launchpad</h1>
      <div className="rounded-2xl border border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
        <span className="text-foreground/90">
          Unsure where to start? Learn about{" "}
        </span>
        <a
          href="https://glow.org/blog/guide-to-delegating-glow"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-foreground hover:underline"
        >
          Delegating GLW <ExternalLink className="h-3.5 w-3.5" />
        </a>{" "}
        <span className="text-foreground/60">or</span>{" "}
        <a
          href="https://glow.org/blog/guide-to-glow-mining"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-foreground hover:underline"
        >
          Buying Miners <ExternalLink className="h-3.5 w-3.5" />
        </a>
        .
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div
            className={cn(
              "grid gap-2 rounded-2xl border border-border bg-muted/20 p-2",
              isLive ? "grid-cols-4" : "grid-cols-3",
              "w-full md:w-auto"
            )}
          >
            <button
              type="button"
              onClick={() => onTabChange("all")}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold transition-colors",
                tab === "all"
                  ? "border-border bg-background/40 text-foreground"
                  : "border-transparent bg-transparent text-muted-foreground hover:bg-muted/30"
              )}
            >
              All ({tabCounts.all})
            </button>
            <button
              type="button"
              onClick={() => onTabChange("delegations")}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold transition-colors",
                tab === "delegations"
                  ? "border-purple-500/40 bg-purple-500/10 text-foreground"
                  : "border-transparent bg-transparent text-muted-foreground hover:bg-muted/30"
              )}
            >
              Delegations (GLW) ({tabCounts.delegations})
            </button>
            <button
              type="button"
              onClick={() => onTabChange("miners")}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold transition-colors",
                tab === "miners"
                  ? "border-[color:var(--color-miner-yellow)]/40 bg-[color:var(--color-miner-yellow)]/10 text-miner-yellow"
                  : "border-transparent bg-transparent text-muted-foreground hover:bg-muted/30"
              )}
            >
              Miners (USDC) ({tabCounts.miners})
            </button>
            {isLive ? (
              <button
                type="button"
                onClick={() => onTabChange("activity")}
                className={cn(
                  "h-10 rounded-xl border px-3 text-sm font-semibold transition-colors",
                  tab === "activity"
                    ? "border-border bg-background/40 text-foreground"
                    : "border-transparent bg-transparent text-muted-foreground hover:bg-muted/30"
                )}
              >
                Activity
              </button>
            ) : null}
          </div>

          {tab === "activity" ? null : (
            <div className="flex items-center justify-between md:justify-end gap-3">
              {shouldShowRegionFilter ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10">
                      <Filter className="mr-2 h-4 w-4" />
                      Filters
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Region</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={zoneId?.toString() || "all"}
                      onValueChange={(v) =>
                        onZoneIdChange(v === "all" ? null : Number(v))
                      }
                    >
                      <DropdownMenuRadioItem value="all">
                        All regions
                      </DropdownMenuRadioItem>
                      {zones.map((z) => (
                        <DropdownMenuRadioItem
                          key={z.id}
                          value={z.id.toString()}
                        >
                          {z.name}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              <Select
                value={sortBy}
                onValueChange={(v) =>
                  onSortByChange(
                    v as "featured" | "newest" | "rewardScore" | "yieldPer1000"
                  )
                }
              >
                <SelectTrigger className="h-10 w-[190px] bg-background/50">
                  <ArrowDownUp className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {tab === "activity" ? (
          <SponsoredFarmsActivity />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[140px] rounded-2xl border border-border bg-muted/10"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="py-10 text-center">
            <div className="text-sm text-destructive">
              Error loading marketplace: {error?.message}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <LaunchCountdown
            target={getNextTuesdayAt1pmET()}
            title="Launchpad"
            subtitle="The next batch of farms will be available soon"
          />
        ) : (
          rows.map((row) => (
            <LaunchpadAssetCard
              key={row.application.id}
              row={row}
              isScoresLoading={
                row.application._type === "delegations"
                  ? isRewardScoresLoading
                  : isMiningScoresLoading
              }
              glwSpotPrice={glwSpotPrice}
              onPayDeposit={onPayDeposit}
              onOpenStats={onOpenStats}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LaunchpadAssetCard({
  row,
  isScoresLoading,
  glwSpotPrice,
  onPayDeposit,
  onOpenStats,
}: {
  row: {
    application: TaggedAuctionApplication;
    availability: ReturnType<typeof getActiveFractionAvailability>;
    score: number;
    scoreData:
      | { userWeeklyGlwRewards: string; userWeeklyPdRewards: string }
      | {
          miningScore: number;
          weeklyGlwRewards?: string;
          weeklyGlwRewardsUsd?: string;
        }
      | null;
    cost: number;
    weeklyYield: number;
    rewardScore: { rewardScore: number } | null;
    miningScore: { miningScore: number } | null;
    yieldUsdPerWeek: number;
  };
  isScoresLoading: boolean;
  glwSpotPrice: number;
  onPayDeposit: LaunchpadViewProps["onPayDeposit"];
  onOpenStats: (
    application: TaggedAuctionApplication,
    scoreData:
      | { userWeeklyGlwRewards: string; userWeeklyPdRewards: string }
      | {
          miningScore: number;
          weeklyGlwRewards?: string;
          weeklyGlwRewardsUsd?: string;
        }
      | null
  ) => void;
}) {
  const { application, availability, scoreData, cost, weeklyYield } = row;
  const isDelegation = application._type === "delegations";
  const isSoldOut = availability.isSoldOut;
  const remainingPct = React.useMemo(() => {
    const total = availability.total || 0;
    const remaining = availability.remaining || 0;
    if (isSoldOut || total <= 0) return 0;
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  }, [availability.remaining, availability.total, isSoldOut]);

  const accent = isDelegation
    ? {
        badge: "text-foreground border-purple-500/30",
        reward: "text-foreground",
        progress: "bg-purple-500/70",
        button:
          "border-purple-500/30 text-foreground hover:bg-purple-500/10 hover:border-purple-500/50",
      }
    : {
        badge: "text-miner-yellow border-[color:var(--color-miner-yellow)]/30",
        reward: "text-foreground",
        progress: "bg-[color:var(--color-miner-yellow)]/70",
        button:
          "border-[color:var(--color-miner-yellow)]/30 text-foreground hover:bg-[color:var(--color-miner-yellow)]/10 hover:border-[color:var(--color-miner-yellow)]/50",
      };

  const title = application.farmName || "Unnamed Farm";
  const imageSrc = getDialogCardImageSrc(application);

  const costLabel = isDelegation ? "Delegation Amount" : "PRICE / MINER";
  const costMain = isDelegation
    ? `${Math.round(cost).toLocaleString()} GLW`
    : `$${cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`;

  const costSub = isDelegation
    ? glwSpotPrice > 0
      ? `≈ $${Math.round(cost * glwSpotPrice).toLocaleString()} USD`
      : "—"
    : "Stable Price";

  const rewardsMain =
    isScoresLoading && weeklyYield === 0
      ? "…"
      : `+${weeklyYield.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} GLW/wk`;

  const rewardsSub = isDelegation
    ? isScoresLoading
      ? "Score: …"
      : `Score: ${
          row.rewardScore?.rewardScore
            ? Math.round(row.rewardScore.rewardScore).toLocaleString()
            : "0"
        }`
    : glwSpotPrice > 0
    ? `≈ $${Math.round(weeklyYield * glwSpotPrice).toLocaleString()} USD/wk`
    : "—";

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-border bg-muted/10 p-4 transition-colors",
        "hover:bg-muted/20"
      )}
    >
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-[minmax(0,22%)_minmax(0,18%)_minmax(0,35%)_minmax(0,25%)] md:items-center">
        <div className="relative min-w-0">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
            <FallbackImage
              src={imageSrc}
              widthForProxy={520}
              quality={70}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
          <div className="absolute left-2 top-2">
            <Badge
              variant="outline"
              className={cn(
                "border bg-background/90 font-semibold shadow-sm backdrop-blur-md",
                accent.badge
              )}
            >
              {isDelegation ? "Delegation" : "Miner"}
            </Badge>
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-base font-semibold text-foreground truncate">
            {title}
          </div>
          <div className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{application.zone.name}</span>
          </div>

          {/* Availability moved under region */}
          <div className="mt-3 w-full max-w-[260px]">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300 ease-out",
                  accent.progress
                )}
                style={{ width: `${remainingPct}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {isSoldOut
                ? "SOLD OUT"
                : `${availability.remaining} / ${availability.total} Left`}
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/30 p-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {costLabel}
            </div>
            <div className="mt-2 text-base font-semibold text-foreground">
              {costMain}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{costSub}</div>
          </div>

          <div className="rounded-xl border border-border bg-background/30 p-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {isDelegation
                ? "EST. REWARDS (100 WEEKS)"
                : "WEEKLY REWARDS (99 WEEKS)"}
            </div>
            <div className={cn("mt-2 text-base font-semibold", accent.reward)}>
              {rewardsMain}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {isDelegation ? (
                <span>{rewardsSub}</span>
              ) : (
                <span>{rewardsSub}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 md:items-end">
          <Button
            variant={isSoldOut ? "ghost" : "default"}
            className={cn("h-11 w-full md:max-w-[190px] md:ml-auto")}
            disabled={isSoldOut}
            onClick={() => {
              if (isSoldOut) return;
              onPayDeposit(application, scoreData);
            }}
          >
            {isSoldOut
              ? "Waitlist"
              : isDelegation
              ? "Delegate GLW"
              : "Buy Miners"}
          </Button>

          <Button
            variant="outline"
            className="h-11 w-full md:max-w-[190px] md:ml-auto"
            onClick={() => onOpenStats(application, scoreData)}
          >
            Advanced Stats
          </Button>
        </div>
      </div>
    </div>
  );
}
