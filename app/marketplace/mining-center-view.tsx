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
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useQueryState } from "nuqs";
import { formatNumber } from "./utils";
import {
  useMiningCenter,
  calculateProtocolDepositAmount,
  getAvailableCurrencies,
  type PaymentCurrency,
  type SortBy,
  type SortOrder,
  type AuctionApplication,
} from "@/hooks/useMiningCenter";
import { useAvailableZones } from "@/hooks/useGlowLaunchpad";
import {
  useMiningScore,
  getMiningScoreForApplication,
} from "@/hooks/useMiningScore";
import { DepositDialog } from "./deposit-dialog";

import { Skeleton } from "@/components/ui/skeleton";
import { GlowSymbol } from "@/components/glow-symbol";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useFractionSplits } from "@/hooks/useFractionSplits";
import { useIsMobile } from "@/hooks/use-mobile";
import { SlidersHorizontal, X } from "lucide-react";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { LaunchCountdown } from "@/components/launch-countdown";
import { getNextTuesdayAt1pmET } from "@/utils/nextTuesdayET";

// Component to show owned fractions for a specific mining center application
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
      <div className="bg-muted/50 border border-border rounded-xl p-3 lg:p-4">
        <div
          className="text-sm text-muted-foreground mb-2"
          style={{ fontFamily: "Söhne, sans-serif", fontWeight: 400 }}
        >
          Your miners
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
    <div className="bg-muted/50 border border-border rounded-xl p-3 lg:p-4">
      <div
        className="text-sm text-muted-foreground mb-2"
        style={{ fontFamily: "Söhne, sans-serif", fontWeight: 400 }}
      >
        Your miners
      </div>
      <div
        className="text-base lg:text-lg text-black dark:text-white"
        style={{ fontFamily: "Söhne, sans-serif", fontWeight: 600 }}
      >
        {summary.totalStepsPurchased.toLocaleString()} of{" "}
        {totalSteps.toLocaleString()} ({percent}%)
      </div>
    </div>
  );
}

// Component to show owned fractions as a badge overlay on the image
function OwnedFractionsBadge({
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

  if (isLoading || summary.totalStepsPurchased === 0) return null;

  const totalSteps = application.activeFraction?.totalSteps || 0;
  const percent =
    totalSteps > 0
      ? ((summary.totalStepsPurchased / totalSteps) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="bg-black/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg">
      <div
        className="text-xs text-white/80 mb-1"
        style={{
          fontFamily: "Söhne, sans-serif",
          fontWeight: 400,
        }}
      >
        Your miners
      </div>
      <div
        className="text-sm font-semibold text-white"
        style={{
          fontFamily: "Söhne, sans-serif",
          fontWeight: 600,
        }}
      >
        {summary.totalStepsPurchased} of {totalSteps} ({percent}%)
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
    <div className="space-y-6 md:space-y-8">
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

      <div className="h-px bg-border/60" />

      {/* Sort By Filter */}
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

      {/* Order Filter */}
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

interface MiningCenterViewProps {
  onPayDeposit: (
    application: AuctionApplication,
    miningScoreData?: {
      miningScore: number;
      weeklyGlwRewards?: string;
      weeklyGlwRewardsUsd?: string;
    } | null
  ) => void;
}

function MiningCenterViewContent({ onPayDeposit }: MiningCenterViewProps) {
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
  const selectedCurrency = "USDC" as PaymentCurrency;
  const selectedSort = sortParam as SortBy;
  const selectedSortOrder = sortOrderParam as SortOrder;

  const { applications, isLoading, isError, error } = useMiningCenter({
    filters: {
      zoneId: selectedZoneId,
      sortBy: selectedSort,
      sortOrder: selectedSortOrder,
      paymentCurrency: selectedCurrency,
    },
  });

  const { applications: allApplications } = useMiningCenter({
    filters: {
      sortBy: selectedSort,
      sortOrder: selectedSortOrder,
      paymentCurrency: selectedCurrency,
    },
  });

  const { zones } = useAvailableZones(allApplications);

  const { miningScoreMap, isLoading: isMiningScoresLoading } = useMiningScore({
    applications,
    enabled: applications.length > 0,
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
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden md:block w-70 flex-shrink-0 border-r border-border/60 bg-muted/30 rounded-r-lg sticky top-0 h-screen overflow-y-auto">
        <div className="p-8">
          <div className="mb-8">
            <h3
              className="text-2xl mb-2"
              style={{
                fontFamily: "Duplicate Slab, serif",
                fontWeight: 300,
              }}
            >
              Filter
            </h3>
            <p
              className="text-sm text-muted-foreground"
              style={{
                fontFamily: "Söhne, sans-serif",
                fontWeight: 400,
              }}
            >
              Refine your search
            </p>
          </div>
          <FilterBar {...filterBarProps} />
        </div>
      </aside>

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

      {/* Content Area */}
      <div className="flex-1">
        {/* Mobile Filter Button */}
        <div className="md:hidden sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/60 p-4">
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

        <div className="p-4 md:p-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card
                  key={i}
                  className="bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                >
                  <CardContent className="p-0">
                    <div className="flex flex-col lg:flex-row">
                      <Skeleton className="w-full lg:w-80 h-48 lg:h-64 flex-shrink-0" />
                      <div className="flex-1 p-4 lg:p-6">
                        <div className="space-y-4">
                          <Skeleton className="h-8 w-48" />
                          <Skeleton className="h-20 w-full" />
                          <div className="flex gap-4">
                            <Skeleton className="h-24 flex-1" />
                            <Skeleton className="h-24 flex-1" />
                          </div>
                        </div>
                      </div>
                      <div className="w-full lg:w-48 p-4 lg:p-6 flex flex-col justify-between items-start lg:items-end border-t lg:border-t-0 lg:border-l border-border">
                        <Skeleton className="h-12 w-32" />
                        <Skeleton className="h-11 w-full rounded-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-8">
              <p className="text-destructive text-sm">
                Error loading mining center applications: {error?.message}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                Please try again later
              </p>
            </div>
          ) : applications.length === 0 ? (
            <>
              <LaunchCountdown
                target={getNextTuesdayAt1pmET()}
                title="Mining Center"
                subtitle="The next batch of miners will be available soon"
              />
            </>
          ) : (
            <div className="space-y-4">
              {applications.map((application) => {
                const depositAmountInCurrency = calculateProtocolDepositAmount(
                  application.finalProtocolFee,
                  application.applicationPriceQuotes,
                  selectedCurrency
                );

                const miningScoreData = getMiningScoreForApplication(
                  miningScoreMap,
                  application.id
                );

                return (
                  <Card
                    key={application.id}
                    className="bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 overflow-hidden"
                  >
                    <CardContent>
                      <div className="flex flex-col lg:flex-row">
                        {/* Left: Image */}
                        <div className="relative w-full lg:w-56 xl:w-64 2xl:w-80 flex-shrink-0">
                          {/* Zone Badge */}
                          <div className="absolute top-4 left-4 z-10">
                            <div className="bg-black/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium">
                              {application.zone.name}
                            </div>
                          </div>

                          {/* Your Miners Badge (lg and xl only) */}
                          {isConnected && address && (
                            <div className="hidden lg:block 2xl:hidden absolute bottom-4 right-4 z-10">
                              <OwnedFractionsBadge
                                application={application}
                                walletAddress={address}
                              />
                            </div>
                          )}

                          {application.afterInstallPictures.length > 0 ? (
                            <FallbackImage
                              src={
                                application.afterInstallPictures[0]?.url ||
                                "/images/sections/residential.jpg"
                              }
                              widthForProxy={600}
                              quality={70}
                              alt={`${application.zone.name}`}
                              className="w-full h-64 lg:h-full object-cover rounded-lg"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="w-full h-64 lg:h-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                              <span className="text-gray-400">
                                No images available
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Middle: Content */}
                        <div className="flex-1 p-4 lg:p-5 xl:p-6">
                          <div className="space-y-3 lg:space-y-4">
                            {/* Miners Available */}
                            <div className="flex items-start gap-4 lg:gap-6 xl:gap-8">
                              <div>
                                <div
                                  className="text-2xl lg:text-3xl xl:text-4xl leading-none mb-2"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 600,
                                  }}
                                >
                                  {application.activeFraction
                                    ? `${
                                        application.activeFraction
                                          .remainingSteps || 0
                                      }/${
                                        application.activeFraction.totalSteps
                                      }`
                                    : "0/0"}
                                </div>
                                <div
                                  className="text-xs uppercase tracking-wider text-gray-500"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 600,
                                  }}
                                >
                                  Miners Available
                                </div>
                              </div>
                            </div>

                            {/* Price, Rewards, and Owned Fractions */}
                            <div className="grid grid-cols-1 lg:grid-cols-1 2xl:grid-cols-2 gap-3 lg:gap-4">
                              {/* Weekly Rewards per miner */}
                              <div className="bg-muted/50 border border-border rounded-xl p-3 lg:p-4 lg:col-span-1 2xl:col-span-1">
                                <div
                                  className="text-sm 2xl:text-xs text-gray-600 dark:text-gray-400 mb-2"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 400,
                                  }}
                                >
                                  Est. Weekly Rewards per miner
                                </div>
                                <div
                                  className="text-base lg:text-2xl text-black dark:text-white"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 600,
                                  }}
                                >
                                  {miningScoreData?.weeklyGlwRewards
                                    ? (() => {
                                        const rewardsPerMiner = parseFloat(
                                          formatUnits(
                                            BigInt(
                                              miningScoreData.weeklyGlwRewards
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
                                        )} GLW`;
                                      })()
                                    : isMiningScoresLoading
                                    ? "..."
                                    : "0 GLW"}
                                  <span className="text-base text-gray-500 dark:text-gray-500 ml-2 font-normal">
                                    ≈
                                    {miningScoreData?.weeklyGlwRewards &&
                                    glwSpotPrice > 0
                                      ? (() => {
                                          const rewardsPerMiner = parseFloat(
                                            formatUnits(
                                              BigInt(
                                                miningScoreData.weeklyGlwRewards
                                              ),
                                              DECIMALS_BY_TOKEN["GLW"]
                                            )
                                          );
                                          const usdPerMiner =
                                            rewardsPerMiner * glwSpotPrice;
                                          return `$${usdPerMiner.toLocaleString(
                                            undefined,
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            }
                                          )}`;
                                        })()
                                      : isMiningScoresLoading
                                      ? "..."
                                      : "$0"}
                                  </span>
                                </div>
                              </div>

                              {/* Owned Fractions Display (2xl only) */}
                              {isConnected && address && (
                                <div className="hidden 2xl:block">
                                  <OwnedFractionsDisplay
                                    application={application}
                                    walletAddress={address}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Price and CTA */}
                        <div className="w-full lg:w-48 xl:w-52 2xl:w-60 p-4 lg:p-5 xl:p-6 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-border">
                          <div className="mb-4 lg:mb-0">
                            <div
                              className="text-sm text-muted-foreground mb-1"
                              style={{
                                fontFamily: "Söhne, sans-serif",
                                fontWeight: 400,
                              }}
                            >
                              Price per miner
                            </div>
                            <div
                              className="text-4xl md:text-5xl xl:text-6xl 2xl:text-7xl text-black dark:text-white"
                              style={{
                                fontFamily: "Söhne, sans-serif",
                                fontWeight: 600,
                              }}
                            >
                              {application.activeFraction?.stepPrice
                                ? `$${formatNumber(
                                    parseFloat(
                                      formatUnits(
                                        BigInt(
                                          application.activeFraction.stepPrice
                                        ),
                                        DECIMALS_BY_TOKEN["USDC"]
                                      )
                                    ),
                                    0
                                  )}`
                                : depositAmountInCurrency
                                ? `$${formatNumber(
                                    parseFloat(depositAmountInCurrency),
                                    0
                                  )}`
                                : "N/A"}
                            </div>
                          </div>
                          <Button
                            className="w-full rounded-full h-11"
                            onClick={() =>
                              onPayDeposit(application, miningScoreData || null)
                            }
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
                                ? "No Miners Available"
                                : "Buy Miners"}
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
    </div>
  );
}

export function MiningCenterView({ onPayDeposit }: MiningCenterViewProps) {
  return <MiningCenterViewContent onPayDeposit={onPayDeposit} />;
}
