"use client";

import React from "react";

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

import { Skeleton } from "@/components/ui/skeleton";
import { GlowSymbol } from "@/components/glow-symbol";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useFractionSplits } from "@/hooks/useFractionSplits";
import { useIsMobile } from "@/hooks/use-mobile";
import { SlidersHorizontal, X } from "lucide-react";
import { LaunchCountdown } from "@/components/launch-countdown";

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
  selectedSort: SortBy;
  selectedSortOrder: SortOrder;
  zones: any[];
  onZoneChange: (value: string | null) => void;
  onSortChange: (value: string) => void;
  onSortOrderChange: (value: string) => void;
}

function FilterBar({
  selectedZoneId,
  selectedSort,
  selectedSortOrder,
  zones,
  onZoneChange,
  onSortChange,
  onSortOrderChange,
}: FilterBarProps) {
  return (
    <div className="space-y-6">
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

      <div className="h-px bg-border/60" />

      <div>
        <label
          className="text-sm mb-3 block font-medium"
          style={{
            fontFamily: "Söhne, sans-serif",
            fontWeight: 600,
          }}
        >
          Sort By
        </label>
        <Select value={selectedSort} onValueChange={onSortChange}>
          <SelectTrigger className="w-full h-11 bg-background border-border/60 hover:border-border transition-colors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="publishedOnAuctionTimestamp">
              Date Published
            </SelectItem>
            <SelectItem value="finalProtocolFee">Protocol Deposit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-px bg-border/60" />

      <div>
        <label
          className="text-sm mb-3 block font-medium"
          style={{
            fontFamily: "Söhne, sans-serif",
            fontWeight: 600,
          }}
        >
          Order
        </label>
        <Select value={selectedSortOrder} onValueChange={onSortOrderChange}>
          <SelectTrigger className="w-full h-11 bg-background border-border/60 hover:border-border transition-colors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Descending</SelectItem>
            <SelectItem value="asc">Ascending</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface LaunchpadViewProps {
  onPayDeposit: (
    application: AuctionApplication,
    rewardScore?: {
      userWeeklyGlwRewards: string;
      userWeeklyPdRewards: string;
    } | null
  ) => void;
}

function LaunchpadViewContent({ onPayDeposit }: LaunchpadViewProps) {
  const [zoneParam, setZoneParam] = useQueryState("zone");
  const [sortParam, setSortParam] = useQueryState("sort", {
    defaultValue: "publishedOnAuctionTimestamp",
  });
  const [sortOrderParam, setSortOrderParam] = useQueryState("order", {
    defaultValue: "desc",
  });
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const isMobile = useIsMobile();
  const { address, isConnected } = useAccount();

  const selectedZoneId = zoneParam ? parseInt(zoneParam) : undefined;
  const selectedCurrency = "GLW" as PaymentCurrency | undefined;
  const selectedSort = sortParam as SortBy;
  const selectedSortOrder = sortOrderParam as SortOrder;

  const { applications, isLoading, isError, error } = useGlowLaunchpad({
    filters: {
      zoneId: selectedZoneId,
      sortBy: selectedSort,
      sortOrder: selectedSortOrder,
      paymentCurrency: selectedCurrency,
    },
  });

  const { applications: allApplications } = useGlowLaunchpad({
    filters: {
      sortBy: selectedSort,
      sortOrder: selectedSortOrder,
      paymentCurrency: selectedCurrency,
    },
  });

  const { zones } = useAvailableZones(allApplications);

  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications,
    paymentCurrency: selectedCurrency || "GLW",
    enabled: applications.length > 0,
    walletAddress: address || null,
  });

  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();

  const filterBarProps = {
    selectedZoneId,
    selectedSort,
    selectedSortOrder,
    zones,
    onZoneChange: (v: string | null) => {
      setZoneParam(v);
      setIsDrawerOpen(false);
    },
    onSortChange: (v: string) => {
      setSortParam(v);
      setIsDrawerOpen(false);
    },
    onSortOrderChange: (v: string) => {
      setSortOrderParam(v);
      setIsDrawerOpen(false);
    },
  };

  return (
    <div>
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
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Zone
              </span>
              <Select
                value={selectedZoneId?.toString() || "all"}
                onValueChange={(v) => setZoneParam(v === "all" ? null : v)}
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Sort By
              </span>
              <Select
                value={selectedSort}
                onValueChange={(v) => setSortParam(v)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publishedOnAuctionTimestamp">
                    Date Published
                  </SelectItem>
                  <SelectItem value="finalProtocolFee">
                    Protocol Deposit
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Order
              </span>
              <Select
                value={selectedSortOrder}
                onValueChange={(v) => setSortOrderParam(v)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Desc</SelectItem>
                  <SelectItem value="asc">Asc</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

        {/* List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
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
          <div className="flex flex-col items-center justify-center py-24 px-6">
            <div className="mb-8 opacity-20">
              <GlowSymbol className="w-16 h-16" />
            </div>
            <div className="text-center max-w-md">
              <h3
                className="text-lg font-semibold mb-3"
                style={{
                  fontFamily: "Söhne, sans-serif",
                  fontWeight: 600,
                }}
              >
                {selectedZoneId
                  ? "No applications in this zone"
                  : "No applications available"}
              </h3>
              <p className="text-muted-foreground text-sm">
                {selectedZoneId
                  ? "Try selecting a different zone or check back later for new farm applications."
                  : "Check back later for new solar farm sponsorship opportunities."}
              </p>
              {selectedZoneId && (
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={() => setZoneParam(null)}
                >
                  View All Zones
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
            {applications.map((application) => {
              const displayCurrency = selectedCurrency || "USDG";
              const depositAmountInCurrency = calculateProtocolDepositAmount(
                application.finalProtocolFee,
                application.applicationPriceQuotes,
                displayCurrency
              );

              const rewardScore = getRewardScoreForApplication(
                rewardScoreMap,
                application.id
              );

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
                            <img
                              src={getProxiedImageUrl(
                                application.afterInstallPictures[0]?.url ||
                                  "/images/sections/residential.jpg",
                                900,
                                70
                              )}
                              alt={`${application.zone.name} main`}
                              className="w-full h-56 object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                          </div>
                          <img
                            src={getProxiedImageUrl(
                              application.afterInstallPictures[1]?.url ||
                                "/images/sections/residential.jpg",
                              450,
                              65
                            )}
                            alt={`${application.zone.name} alt 1`}
                            className="w-full h-28 object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <img
                            src={getProxiedImageUrl(
                              application.afterInstallPictures[2]?.url ||
                                "/images/sections/residential.jpg",
                              450,
                              65
                            )}
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
                      {/* Header with Fractions Available and Reward Score */}
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
                        {/* Reward Score */}
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
                          <div
                            className="text-xs uppercase tracking-wider text-gray-500"
                            style={{
                              fontFamily: "Söhne, sans-serif",
                              fontWeight: 600,
                            }}
                          >
                            Reward Score
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Step Price - Left Column */}
                        <div className="bg-muted/50 border border-border rounded-xl p-4">
                          <div
                            className="text-sm text-gray-600 dark:text-gray-400 mb-2"
                            style={{
                              fontFamily: "Söhne, sans-serif",
                              fontWeight: 400,
                            }}
                          >
                            Price
                          </div>
                          {application.activeFraction?.step ? (
                            <div>
                              <div
                                className="text-2xl lg:text-3xl text-black dark:text-white"
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
                                )}{" "}
                                <span className="text-lg font-normal">GLW</span>
                              </div>
                            </div>
                          ) : depositAmountInCurrency ? (
                            <div>
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
                              className="text-base text-gray-500"
                              style={{
                                fontFamily: "Söhne, sans-serif",
                                fontWeight: 400,
                              }}
                            >
                              Price not available
                            </div>
                          )}
                        </div>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="bg-muted/50 border border-border rounded-xl p-4 cursor-help">
                              <div
                                className="text-sm text-gray-600 dark:text-gray-400 mb-2"
                                style={{
                                  fontFamily: "Söhne, sans-serif",
                                  fontWeight: 400,
                                }}
                              >
                                Est. Weekly Rewards
                              </div>
                              <div>
                                <div
                                  className="text-lg lg:text-3xl text-black dark:text-white"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 600,
                                  }}
                                >
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
                                            DECIMALS_BY_TOKEN["GLW"] // Assuming PD rewards are also in GLW
                                          )
                                        );

                                        const totalRewards =
                                          glwRewards + pdRewards;
                                        const totalShares =
                                          application.activeFraction.totalSteps;
                                        const rewardsPerShare =
                                          totalRewards / totalShares;
                                        return `${rewardsPerShare.toLocaleString(
                                          undefined,
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )} GLW`;
                                      })()
                                    : isRewardScoresLoading
                                    ? "..."
                                    : "0 GLW"}
                                  <span className="text-base text-gray-500 dark:text-gray-500 ml-2 font-normal">
                                    ≈
                                    {rewardScore?.userWeeklyGlwRewards &&
                                    rewardScore?.userWeeklyPdRewards &&
                                    application.activeFraction?.totalSteps &&
                                    glwSpotPrice > 0
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
                                            application.activeFraction
                                              .totalSteps;
                                          const rewardsPerShare =
                                            totalRewards / totalShares;
                                          const cashPerShare =
                                            rewardsPerShare * glwSpotPrice;
                                          return `$${cashPerShare.toLocaleString(
                                            undefined,
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            }
                                          )}`;
                                        })()
                                      : isRewardScoresLoading
                                      ? "..."
                                      : "$0"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">
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
                                          <strong>Reward Breakdown:</strong>
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
                                          GLW from mining share
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
                      <div className="flex items-center gap-3">
                        <Button
                          className="flex-1 rounded-full h-11"
                          onClick={() => onPayDeposit(application, rewardScore)}
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
                              : "Delegate GLW"}
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
    </div>
  );
}

export function LaunchpadView({ onPayDeposit }: LaunchpadViewProps) {
  // Compute today's 5:00 PM ET in the user's local timezone
  const targetDate = React.useMemo(() => {
    const now = new Date();
    const nowInET = new Date(
      now.toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const offsetMs = now.getTime() - nowInET.getTime();

    const fivePmETLocal = new Date(nowInET);
    fivePmETLocal.setHours(17, 0, 0, 0);

    return new Date(fivePmETLocal.getTime() + offsetMs);
  }, []);

  const [now, setNow] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isLaunched = now >= targetDate.getTime();

  if (!isLaunched) {
    return (
      <LaunchCountdown
        target={targetDate}
        title="Technical difficulties"
        subtitle="We’re experiencing technical difficulties. Expected availability by 5:00 PM ET."
      />
    );
  }

  return <LaunchpadViewContent onPayDeposit={onPayDeposit} />;
}
