"use client";

import React from "react";
import { normalizeMinerWeeksRemainingDisplay } from "@/lib/mining-score";
import { FallbackImage } from "@/components/ui/fallback-image";
import { SponsoredFarmsActivity } from "@/app/marketplace/sponsored-farms-activity";
import { ArrowUpRight } from "lucide-react";

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

function formatMinerWeeksLabel(weeks?: number | null): string {
  const resolvedWeeks = normalizeMinerWeeksRemainingDisplay(weeks) ?? 99;
  return `${resolvedWeeks} week${resolvedWeeks === 1 ? "" : "s"}`;
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
  isFractionOpenForMarketplace,
  type PaymentCurrency,
  type SortBy,
  type SortOrder,
  type AuctionApplication,
} from "@/hooks";
import { useRewardScore, getRewardScoreForApplication } from "@/hooks";
import { QUERY_CONFIG } from "@/hooks/query-config";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";
import { useMiningCenter, type MiningCenterFilters } from "@/hooks";
import { useMiningScore, getMiningScoreForApplication } from "@/hooks";
import { useEthPrice } from "@/hooks/useEthPrice";
import { resolveRewardScorePaymentCurrency } from "@/lib/reward-score";
import {
  calculateLaunchpadPerShareRewards,
  getDelegationCurrencyDecimals,
  parseDelegationStepAmount,
  resolveDelegationCurrency,
  resolveLaunchpadDelegationShareCount,
} from "@/utils/launchpad-rewards";

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
  Sparkles,
  X,
} from "lucide-react";
import { HowItWorks } from "@/components/how-it-works";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { LaunchCountdown } from "@/components/launch-countdown";
import { getNextLaunchpadDelegationBatchAtET } from "@/utils/nextTuesdayET";
import { getListingVisibleStartAtMs } from "@/utils/launchpad";
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
import { CashMinerIcon, DelegationIcon } from "@/components/impact-icons";

function countActiveListings(
  applications: Array<{
    activeFraction: AuctionApplication["activeFraction"];
  }>
) {
  return applications.reduce((count, app) => {
    const hasAvailability = isFractionOpenForMarketplace(app.activeFraction);
    return hasAvailability ? count + 1 : count;
  }, 0);
}

const MARKETPLACE_RELEASE_POLL_INTERVAL_MS =
  QUERY_CONFIG.REALTIME.refetchInterval;

// Image component with skeleton loading state for SSR-friendly progressive loading
function FarmImageWithSkeleton({
  src,
  alt,
  className,
  widthForProxy,
  quality,
}: {
  src: string;
  alt: string;
  className?: string;
  widthForProxy?: number;
  quality?: number;
}) {
  const [isLoaded, setIsLoaded] = React.useState(false);

  const handleLoad = React.useCallback(() => {
    setIsLoaded(true);
  }, []);

  return (
    <>
      {!isLoaded && (
        <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
      )}
      <FallbackImage
        src={src}
        widthForProxy={widthForProxy}
        quality={quality}
        alt={alt}
        className={cn(
          className,
          "transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={handleLoad}
        loading="lazy"
        decoding="async"
      />
    </>
  );
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
  widgetCarouselVariant?: "compact" | "hero";
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
  const rewardScoreFallbackCurrency = "GLW" as PaymentCurrency;
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
    },
    query: {
      refetchInterval: MARKETPLACE_RELEASE_POLL_INTERVAL_MS,
      refetchIntervalInBackground: true,
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
    query: {
      refetchInterval: MARKETPLACE_RELEASE_POLL_INTERVAL_MS,
      refetchIntervalInBackground: true,
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
  const activeDelegationsForScores = React.useMemo(
    () =>
      taggedLaunchpadApplications.filter(
        (app) => !getActiveFractionAvailability(app).isSoldOut
      ),
    [taggedLaunchpadApplications]
  );

  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications: activeDelegationsForScores,
    paymentCurrency: rewardScoreFallbackCurrency,
    enabled: activeDelegationsForScores.length > 0,
    walletAddress: address || null,
  });

  // Fetch mining scores only for miners
  const activeMinersForScores = React.useMemo(
    () =>
      taggedMinersApplications.filter(
        (app) => !getActiveFractionAvailability(app).isSoldOut
      ),
    [taggedMinersApplications]
  );

  const { miningScoreMap, isLoading: isMiningScoresLoading } = useMiningScore({
    applications: activeMinersForScores,
    extraLiveApplications: taggedLaunchpadApplications,
    enabled: activeMinersForScores.length > 0,
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
              target={getNextLaunchpadDelegationBatchAtET()}
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
              const displayCurrency = resolveRewardScorePaymentCurrency(
                application,
                rewardScoreFallbackCurrency
              );
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

              const availability = getActiveFractionAvailability(application);
              const isSoldOut = availability.isSoldOut;

              return (
                <Card
                  key={application.id}
                  className={cn(
                    "overflow-hidden pt-0 bg-muted transition-opacity",
                    isSoldOut && "opacity-50"
                  )}
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
                          <div className="col-span-2 relative h-56 overflow-hidden">
                            <FarmImageWithSkeleton
                              src={
                                application.afterInstallPictures[0]?.url ||
                                "/images/sections/residential.jpg"
                              }
                              widthForProxy={900}
                              quality={70}
                              alt={`${application.zone.name} main`}
                              className="w-full h-56 object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                          </div>
                          <div className="relative h-28 overflow-hidden">
                            <FarmImageWithSkeleton
                              src={
                                application.afterInstallPictures[1]?.url ||
                                "/images/sections/residential.jpg"
                              }
                              widthForProxy={450}
                              quality={65}
                              alt={`${application.zone.name} alt 1`}
                              className="w-full h-28 object-cover"
                            />
                          </div>
                          <div className="relative h-28 overflow-hidden">
                            <FarmImageWithSkeleton
                              src={
                                application.afterInstallPictures[2]?.url ||
                                "/images/sections/residential.jpg"
                              }
                              widthForProxy={450}
                              quality={65}
                              alt={`${application.zone.name} alt 2`}
                              className="w-full h-28 object-cover"
                            />
                          </div>
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
                              ? "border-[color:var(--color-miner)]/30 bg-[color:var(--color-miner)]/10 text-miner"
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
                        <div
                          className={cn(
                            "bg-muted/50 border border-border rounded-xl p-4 flex flex-col",
                            isSoldOut && "md:col-span-2"
                          )}
                        >
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
                              {(() => {
                                const delegationStepAmount =
                                  parseDelegationStepAmount(application);
                                return (
                                  <>
                              <div
                                className="text-2xl lg:text-3xl text-foreground leading-tight"
                                style={{
                                  fontFamily: "Söhne, sans-serif",
                                  fontWeight: 600,
                                }}
                              >
                                {formatNumber(
                                  delegationStepAmount,
                                  0
                                )}
                                <span
                                  className="text-base text-muted-foreground ml-1"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 500,
                                  }}
                                >
                                  {displayCurrency}
                                </span>
                              </div>

                              {displayCurrency === "GLW" && glwSpotPrice > 0 && (
                                <div
                                  className="text-sm text-muted-foreground mt-2"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 400,
                                  }}
                                >
                                  ≈ $
                                  {formatNumber(
                                    delegationStepAmount * glwSpotPrice,
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
                                  </>
                                );
                              })()}
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
                        {!isSoldOut && (
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
                                    ? `Weekly Rewards per Miner (${formatMinerWeeksLabel(
                                        miningScore?.weeksOfMinerLifeRemaining
                                      )})`
                                    : "Est. Weekly Rewards (100 weeks)"}
                                </div>
                                <div className="group/help relative">
                                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/help:block z-50 w-64">
                                    <div className="bg-popover text-popover-foreground border border-border text-xs rounded-lg py-2 px-3 shadow-lg">
                                      {application._type === "miners"
                                        ? `Current weekly rate per miner, paid weekly for ${formatMinerWeeksLabel(
                                            miningScore?.weeksOfMinerLifeRemaining
                                          )}. May decrease as new farms join the region and dilute emissions.`
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
                                        const delegationCurrency =
                                          resolveDelegationCurrency(
                                            application
                                          );
                                        const perShareRewards =
                                          calculateLaunchpadPerShareRewards({
                                            reward: rewardScore,
                                            totalShares:
                                              application.activeFraction
                                                .totalSteps,
                                            delegationCurrency,
                                            glwSpotPrice,
                                          });
                                        const emissionGlwLabel =
                                          perShareRewards.emissionGlwPerShare.toLocaleString(
                                            undefined,
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            }
                                          );
                                        const pdLabel =
                                          perShareRewards.pdPerShare.toLocaleString(
                                            undefined,
                                            {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            }
                                          );
                                        if (delegationCurrency === "SGCTL") {
                                          return `${pdLabel} SGCTL + ${emissionGlwLabel} GLW`;
                                        }
                                        return `${perShareRewards.totalGlwPerShare.toLocaleString(
                                          undefined,
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )} GLW`;
                                      })()
                                    : isRewardScoresLoading
                                    ? "..."
                                    : "0"}
                                  {application._type === "miners" && (
                                    <span
                                      className="text-base text-muted-foreground ml-1"
                                      style={{
                                        fontFamily: "Söhne, sans-serif",
                                        fontWeight: 500,
                                      }}
                                    >
                                      GLW
                                    </span>
                                  )}
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
                                  application.activeFraction?.totalSteps ? (
                                  (() => {
                                    const delegationCurrency =
                                      resolveDelegationCurrency(application);
                                    if (delegationCurrency === "SGCTL") {
                                      return null;
                                    }
                                    const perShareRewards =
                                      calculateLaunchpadPerShareRewards({
                                        reward: rewardScore,
                                        totalShares:
                                          application.activeFraction.totalSteps,
                                        delegationCurrency,
                                        glwSpotPrice,
                                      });
                                    return (
                                      <div
                                        className="text-sm text-muted-foreground mt-2"
                                        style={{
                                          fontFamily: "Söhne, sans-serif",
                                          fontWeight: 400,
                                        }}
                                      >
                                        ≈ $
                                        {perShareRewards.totalUsdPerShare.toLocaleString(
                                          undefined,
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )}{" "}
                                        USD per week
                                      </div>
                                    );
                                  })()
                                ) : null}
                                <div
                                  className="text-[10px] text-muted-foreground italic mt-3"
                                  style={{
                                    fontFamily: "Söhne, sans-serif",
                                    fontWeight: 400,
                                  }}
                                >
                                  {application._type === "miners"
                                    ? `Paid weekly for ${formatMinerWeeksLabel(
                                        miningScore?.weeksOfMinerLifeRemaining
                                      )}. See Advanced Stats.`
                                    : "Paid weekly for 100 weeks. See Advanced Stats."}
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {application._type === "miners" ? (
                              <div className="text-sm">
                                <div className="mb-2 text-background/80 text-xs">
                                  {`Estimated weekly rewards per miner, paid weekly for ${formatMinerWeeksLabel(
                                    miningScore?.weeksOfMinerLifeRemaining
                                  )}. This rate may decrease as new farms join the region and dilute the regional GLW allocation. See Advanced Stats for details.`}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm">
                                <div className="mb-2 text-background/80 text-xs">
                                  Weekly reward breakdown (per delegation).
                                  Estimates update weekly as new farms and
                                  regions join the protocol.
                                </div>
                                {rewardScore?.userWeeklyGlwRewards &&
                                rewardScore?.userWeeklyPdRewards &&
                                application.activeFraction?.totalSteps
                                  ? (() => {
                                      const delegationCurrency =
                                        resolveDelegationCurrency(application);
                                      const pdDecimals =
                                        getDelegationCurrencyDecimals(
                                          delegationCurrency
                                        );
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
                                          pdDecimals
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
                                          <div className="flex justify-between gap-4 text-xs">
                                            <span className="text-background/70">
                                              PD Recovery
                                            </span>
                                            <span className="font-mono font-medium">
                                              +
                                              {pdPerShare.toLocaleString(
                                                undefined,
                                                {
                                                  maximumFractionDigits: 1,
                                                }
                                              )}{" "}
                                              {delegationCurrency}
                                            </span>
                                          </div>
                                          <div className="flex justify-between gap-4 text-xs">
                                            <span className="text-background/70">
                                              Emissions
                                            </span>
                                            <span className="font-mono font-medium">
                                              +
                                              {glwPerShare.toLocaleString(
                                                undefined,
                                                {
                                                  maximumFractionDigits: 1,
                                                }
                                              )}{" "}
                                              GLW
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })()
                                  : "Calculating rewards..."}
                              </div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                        )}
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
                              ? availability.isSoldOut
                              : !depositAmountInCurrency
                          }
                        >
                          <span
                            style={{
                              fontFamily: "Söhne, sans-serif",
                              fontWeight: 400,
                            }}
                          >
                            {availability.isSoldOut
                              ? "Unavailable"
                              : application._type === "miners"
                              ? "Buy Miners"
                              : resolveDelegationCurrency(application) ===
                                "SGCTL"
                              ? "Delegate SGCTL"
                              : "Delegate GLW"}
                          </span>
                        </Button>
                        {!isSoldOut && (
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
                        )}
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
  widgetCarouselVariant,
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
        carouselVariant={widgetCarouselVariant}
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
  const total = resolveLaunchpadDelegationShareCount(application);
  const remaining = fraction.remainingSteps ?? 0;
  const isSoldOut = !isFractionOpenForMarketplace(fraction);
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

function formatTimeToSellOut(
  startAt: number | string | null,
  filledAt: string | null,
) {
  if (!startAt || !filledAt) return "—";
  const start =
    typeof startAt === "number" ? startAt : new Date(startAt).getTime();
  const end = new Date(filledAt).getTime();
  const diffMs = end - start;
  if (diffMs <= 0) return "Instant";

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
  if (diffHours > 0) return `${diffHours}h ${diffMinutes % 60}m`;
  if (diffMinutes > 0) return `${diffMinutes}m ${diffSeconds % 60}s`;
  return `${diffSeconds}s`;
}

interface LaunchpadMarketplaceWidgetProps {
  onPayDeposit: LaunchpadViewProps["onPayDeposit"];
  typeFilter?: LaunchpadViewProps["typeFilter"];
  layout?: "stack" | "grid" | "carousel";
  carouselVariant?: LaunchpadViewProps["widgetCarouselVariant"];
}

function LaunchpadMarketplaceWidget({
  onPayDeposit,
  typeFilter,
  layout,
  carouselVariant,
}: LaunchpadMarketplaceWidgetProps) {
  const { address } = useAccount();
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const { ethPrice } = useEthPrice();
  const isMobile = useIsMobile();
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
          weeksOfMinerLifeRemaining?: number;
        }
      | null
    >(null);
  const rewardScoreFallbackCurrency = "GLW" as PaymentCurrency;

  // --- Data Fetching Hooks (Unchanged) ---
  const {
    applications: launchpadApplications,
    isLoading: isLoadingLaunchpad,
    isError: isErrorLaunchpad,
    error: errorLaunchpad,
  } = useGlowLaunchpad({
    filters: { includeFilled: true },
  });

  const {
    applications: minersApplications,
    isLoading: isLoadingMiners,
    isError: isErrorMiners,
    error: errorMiners,
  } = useMiningCenter({
    filters: { paymentCurrency: "USDC", includeFilled: true },
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

  const activeDelegationsForScores = React.useMemo(
    () =>
      taggedDelegations.filter(
        (app) => !getActiveFractionAvailability(app).isSoldOut
      ),
    [taggedDelegations]
  );

  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications: activeDelegationsForScores,
    paymentCurrency: rewardScoreFallbackCurrency,
    enabled: activeDelegationsForScores.length > 0,
    walletAddress: address || null,
  });

  const activeMinersForScores = React.useMemo(
    () =>
      taggedMiners.filter(
        (app) => !getActiveFractionAvailability(app).isSoldOut
      ),
    [taggedMiners]
  );

  const { miningScoreMap, isLoading: isMiningScoresLoading } = useMiningScore({
    applications: activeMinersForScores,
    extraLiveApplications: taggedDelegations,
    enabled: activeMinersForScores.length > 0,
  });

  // --- Metrics Calculation (Unchanged) ---
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
              weeksOfMinerLifeRemaining: mining.weeksOfMinerLifeRemaining,
            }
          : null;
      const delegationCurrency =
        application._type === "delegations"
          ? resolveDelegationCurrency(application)
          : null;
      const totalShares =
        application._type === "delegations"
          ? resolveLaunchpadDelegationShareCount(application)
          : application.activeFraction?.totalSteps || 0;
      const delegationPerShareRewards =
        application._type === "delegations"
          ? calculateLaunchpadPerShareRewards({
              reward,
              totalShares,
              delegationCurrency: delegationCurrency || "GLW",
              glwSpotPrice,
            })
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
          return parseDelegationStepAmount(application);
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
          return delegationPerShareRewards?.totalGlwPerShare ?? 0;
        } catch {
          return 0;
        }
      })();

      const yieldUsdPerWeek =
        application._type === "delegations"
          ? delegationPerShareRewards?.totalUsdPerShare ?? 0
          : glwSpotPrice > 0
          ? weeklyYield * glwSpotPrice
          : 0;
      const yieldPer1000Usd =
        application._type === "miners" && cost > 0 && yieldUsdPerWeek > 0
          ? (yieldUsdPerWeek / cost) * 1000
          : 0;

      const amountRaised = application.activeFraction?.amountRaised
        ? parseFloat(
            formatUnits(
              BigInt(application.activeFraction.amountRaised),
              application._type === "miners"
                ? DECIMALS_BY_TOKEN.USDC
                : getDelegationCurrencyDecimals(delegationCurrency || "GLW")
            )
          )
        : 0;

      const totalAmountNeeded = application.activeFraction?.totalAmountNeeded
        ? parseFloat(
            formatUnits(
              BigInt(application.activeFraction.totalAmountNeeded),
              application._type === "miners"
                ? DECIMALS_BY_TOKEN.USDC
                : getDelegationCurrencyDecimals(delegationCurrency || "GLW")
            )
          )
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
        amountRaised,
        totalAmountNeeded,
      };
    });

    // Partition into active and filled
    const activeRows = withMetrics.filter((r) => !r.availability.isSoldOut);
    const filledRows = withMetrics
      .filter((r) => r.availability.isSoldOut)
      .sort((a, b) => {
        const aTime = new Date(
          a.application.activeFraction?.filledAt ||
            a.application.activeFraction?.createdAt ||
            0
        ).getTime();
        const bTime = new Date(
          b.application.activeFraction?.filledAt ||
            b.application.activeFraction?.createdAt ||
            0
        ).getTime();
        return bTime - aTime;
      });

    let finalRows: typeof withMetrics = [];

    if (filter === "delegations") {
      const active = activeRows.filter(
        (r) => r.application._type === "delegations"
      );
      active.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      finalRows = active;

      if (finalRows.length < 2) {
        const extra = filledRows
          .filter((r) => r.application._type === "delegations")
          .slice(0, 2 - finalRows.length);
        finalRows = [...finalRows, ...extra];
      }
    } else if (filter === "miners") {
      const active = activeRows.filter(
        (r) => r.application._type === "miners"
      );
      active.sort((a, b) => (b.yieldPer1000Usd ?? 0) - (a.yieldPer1000Usd ?? 0));
      finalRows = active;

      if (finalRows.length < 2) {
        const extra = filledRows
          .filter((r) => r.application._type === "miners")
          .slice(0, 2 - finalRows.length);
        finalRows = [...finalRows, ...extra];
      }
    } else {
      // Merge active delegations and miners (alternating)
      const activeDelegations = activeRows
        .filter((r) => r.application._type === "delegations")
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const activeMiners = activeRows
        .filter((r) => r.application._type === "miners")
        .sort((a, b) => (b.yieldPer1000Usd ?? 0) - (a.yieldPer1000Usd ?? 0));

      const mergedActive: typeof withMetrics = [];
      let i = 0;
      let j = 0;
      while (i < activeDelegations.length || j < activeMiners.length) {
        if (i < activeDelegations.length) mergedActive.push(activeDelegations[i++]);
        if (j < activeMiners.length) mergedActive.push(activeMiners[j++]);
      }
      finalRows = mergedActive;

      if (finalRows.length < 2) {
        const extra = filledRows.slice(0, 2 - finalRows.length);
        finalRows = [...finalRows, ...extra];
      }
    }

    return finalRows;
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

  // --- Carousel Logic (Unchanged) ---
  const resolvedLayout = layout ?? (isMobile ? "carousel" : "stack");
  const resolvedCarouselVariant = carouselVariant ?? "compact";
  const isHeroCarousel =
    resolvedLayout === "carousel" && resolvedCarouselVariant === "hero";
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
        carouselStepPxRef.current = isHeroCarousel
          ? el.clientWidth + 16
          : items[0].offsetWidth + 12;
      } else {
        carouselStepPxRef.current = 0;
      }
      updateCarouselMeta();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isHeroCarousel, resolvedLayout, rows.length, updateCarouselMeta]);

  // Glassy Carousel Controls
  const carouselControls = React.useMemo(() => {
    if (resolvedLayout !== "carousel") return null;
    if (!isLoading && rows.length <= 1) return null;
    if (!isLoading && isHeroCarousel && rows.length <= 2) return null;

    const dotsCount = isLoading ? 3 : Math.max(1, rows.length);
    const isDisabled = isLoading || rows.length <= 1;
    const canPrev = !isDisabled && carouselCanPrev;
    const canNext = !isDisabled && carouselCanNext;
    const activeIndex = Math.max(0, Math.min(dotsCount - 1, carouselIndex));

    return (
      <div className="mt-4 flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-foreground"
          onClick={() => scrollCarouselBy(-1)}
          disabled={!canPrev}
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-xl rounded-full border border-white/5">
          {Array.from({ length: dotsCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to item ${i + 1}`}
              onClick={() => {
                if (isDisabled) return;
                scrollCarouselTo(i);
              }}
              disabled={isDisabled}
              className={cn(
                "h-2 w-2 rounded-full transition-all duration-300",
                i === activeIndex
                  ? "bg-foreground scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
                isDisabled
                  ? "cursor-not-allowed hover:bg-muted-foreground/30"
                  : null
              )}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-foreground"
          onClick={() => scrollCarouselBy(1)}
          disabled={!canNext}
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    );
  }, [
    carouselCanNext,
    carouselCanPrev,
    carouselIndex,
    isHeroCarousel,
    isLoading,
    resolvedLayout,
    rows.length,
    scrollCarouselBy,
    scrollCarouselTo,
  ]);

  // --- Inline Hero Card Implementation (Apple Liquid Glass Style) ---
  const renderHeroCard = (row: (typeof rows)[0]) => {
    const { application, score, cost, weeklyYield, availability, scoreData } =
      row;
    const isMiner = application._type === "miners";
    const minerWeeksRemaining = isMiner
      ? (
          scoreData as { weeksOfMinerLifeRemaining?: number } | null
        )?.weeksOfMinerLifeRemaining
      : null;
    const delegationCurrency = isMiner
      ? null
      : resolveDelegationCurrency(application);
    const currency = isMiner ? "USDC" : delegationCurrency || "GLW";

    const rewardsBreakdown = (() => {
      if (isMiner) return null;
      if (!scoreData || !("userWeeklyGlwRewards" in scoreData)) return null;
      try {
        const totalShares = resolveLaunchpadDelegationShareCount(application);
        if (!totalShares) return null;
        const perShareRewards = calculateLaunchpadPerShareRewards({
          reward: scoreData,
          totalShares,
          delegationCurrency: delegationCurrency || "GLW",
          glwSpotPrice,
        });
        return {
          inflationPerShare: perShareRewards.emissionGlwPerShare,
          pdPerShare: perShareRewards.pdPerShare,
          pdCurrency: delegationCurrency || "GLW",
        };
      } catch {
        return null;
      }
    })();

    return (
      <div
        className={cn(
          "relative w-full h-full rounded-[2rem] overflow-hidden group transition-opacity",
          availability.isSoldOut && "opacity-50"
        )}
      >
        {/* Full Background Image */}
        <div className="absolute inset-0">
          {application.afterInstallPictures?.[0]?.url ? (
            <FallbackImage
              src={application.afterInstallPictures[0].url}
              widthForProxy={1200}
              quality={90}
              alt={application.farmName || "Farm Image"}
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-muted/20" />
          )}
          {/* Gradient overlay for better text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        </div>

        {/* Top Right: Advanced Stats Pill */}
        {!availability.isSoldOut && (
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedApplicationForStats(application);
                setSelectedScoreDataForStats(row.scoreData ?? null);
                setStatsDialogOpen(true);
              }}
              className="backdrop-blur-xl bg-white/60 hover:bg-white/55 border border-black/10 text-foreground rounded-full px-4 h-8 text-xs font-medium transition-all dark:bg-black/30 dark:hover:bg-black/50 dark:border-white/10 dark:text-white"
            >
              Advanced Stats <ArrowUpRight className="ml-1 w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Bottom Overlay: Apple Liquid Glass Panel */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="relative overflow-hidden rounded-3xl bg-white/80 text-foreground backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.2)] dark:bg-black/70 dark:text-white">
            {/* Liquid Glass Material Layer - Adaptive tint for light/dark */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-white/20 to-transparent dark:from-white/10 dark:via-transparent dark:to-transparent" />

            {/* Specular Rim Light (1-2px inner bright stroke, 40-60% opacity) */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/50 dark:ring-white/40" />

            {/* Top Edge Highlight - Simulates light catching the glass surface */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/30" />

            <div className="relative p-4 md:p-6">
              {/* Header: Title & Badges (moved above stats to free space) */}
              <div className="flex flex-col gap-2 md:gap-3 md:flex-row md:items-start md:justify-between">
                <h3
                  className="text-2xl md:text-3xl font-semibold tracking-tight"
                  style={{ fontFamily: "Söhne, sans-serif" }}
                >
                  {application.farmName || "Unnamed Farm"}
                </h3>

                <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                  <div className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white/15 px-2.5 py-1 backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
                    <MapPin className="w-3.5 h-3.5 opacity-80" />
                    <span className="text-foreground/80 dark:text-white/80">
                      {application.zone.name}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 backdrop-blur-md",
                      isMiner
                        ? "border-[color:var(--color-miner)]/30 bg-[color:var(--color-miner)]/15 text-miner"
                        : "border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-200"
                    )}
                  >
                    {isMiner ? (
                      <CashMinerIcon className="w-3.5 h-3.5" />
                    ) : (
                      <DelegationIcon className="w-3.5 h-3.5" />
                    )}
                    <span>{isMiner ? "Miner" : "Delegation"}</span>
                  </div>
                  {application._type === "delegations" && score > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1 text-indigo-800 dark:text-indigo-200 backdrop-blur-md cursor-help">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Score: {score.toFixed(0)}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[300px]">
                        <div className="text-xs">
                          <div className="font-semibold mb-1.5">
                            Reward Score
                          </div>
                          <div className="text-primary-foreground/80 leading-relaxed">
                            The Reward Score combines both revenue streams
                            (deposit recovery and GLW inflation) into a single
                            metric representing expected rewards per dollar
                            delegated. Higher scores generally indicate better
                            opportunities, but do not guarantee performance.
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              </div>

              {/* Stats & Action */}
              <div className="mt-3 md:mt-5 flex flex-col gap-2 md:gap-3 md:flex-row md:items-stretch">
                {/* Amount + Units row on mobile */}
                <div className="flex flex-row gap-2 md:gap-3 md:contents">
                  {/* Stat 1: Amount + Availability */}
                  <div className="flex-1 min-w-0 md:min-w-[140px] p-2.5 md:p-3 rounded-2xl bg-white/10 border border-white10 flex flex-col justify-center dark:bg-white/5 dark:border-white/10">
                    <span className="text-[9px] md:text-[10px] uppercase tracking-widest text-foreground/60 font-bold mb-0.5 md:mb-1 dark:text-white/50">
                      {availability.isSoldOut
                        ? isMiner
                          ? "Total Mined"
                          : "Total Delegated"
                        : isMiner
                        ? "Price"
                        : "Amount"}
                    </span>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base md:text-lg font-semibold">
                        {availability.isSoldOut ? (
                          <>
                            {isMiner ? "$" : ""}
                            {formatNumber(row.totalAmountNeeded || 0, 0)}{" "}
                            {currency}
                          </>
                        ) : cost > 0 ? (
                          <>
                            {isMiner ? "$" : ""}
                            {formatNumber(cost, 0)} {currency}
                          </>
                        ) : (
                          "Free"
                        )}
                      </span>
                      {!availability.isSoldOut && (
                        <span className="text-xs md:text-sm font-mono tabular-nums text-foreground/70 dark:text-white/60">
                          {availability?.remaining}/{availability?.total} left
                        </span>
                      )}
                    </div>
                    {availability.isSoldOut ? (
                      <span className="text-[9px] md:text-[10px] text-foreground/50 dark:text-white/40">
                        {formatTimeToSellOut(
                          getListingVisibleStartAtMs(application),
                          application.activeFraction?.filledAt || null
                        )}{" "}
                        to sell out
                      </span>
                    ) : (
                      <span className="text-[9px] md:text-[10px] text-foreground/50 dark:text-white/40">
                        {isMiner ? "≈ 0.003 ETH" : "≈ $1,810 USD"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stat 3: Rewards */}
                {!availability.isSoldOut && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1 min-w-[120px] md:min-w-[140px] p-2.5 md:p-3 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white flex flex-col justify-center dark:from-white/10 dark:to-transparent dark:border-white/10 cursor-help">
                        <span className="text-[9px] md:text-[10px] uppercase tracking-widest text-foreground/60 font-bold mb-0.5 md:mb-1 dark:text-white/50">
                          {isMiner
                            ? `Weekly (${formatMinerWeeksLabel(
                                minerWeeksRemaining
                              )})`
                            : "Weekly (100 wks)"}
                        </span>
                        <span className="text-xs md:text-sm font-semibold">
                          +{formatNumber(weeklyYield, 2)} GLW / wk
                        </span>
                        <span className="text-[9px] md:text-[10px] text-foreground/50 dark:text-white/40">
                          Estimated earnings are subject to change.
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px] p-3">
                      <div className="text-xs">
                        <div className="font-semibold mb-1.5">
                          Estimated Rewards
                        </div>
                        <div className="text-primary-foreground/80 leading-relaxed">
                          {isMiner
                            ? `Estimated weekly rewards per miner, paid weekly for ${formatMinerWeeksLabel(
                                minerWeeksRemaining
                              )}. May decrease as new farms join the region and dilute emissions.`
                            : "Expected weekly rewards per delegation, paid weekly for 100 weeks. May vary with network changes."}
                        </div>
                        {!isMiner && rewardsBreakdown ? (
                          <>
                            <div className="h-px bg-primary-foreground/15 my-2" />
                            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[11px]">
                              <div className="text-primary-foreground/80">
                                {rewardsBreakdown.pdCurrency} from PDs
                              </div>
                              <div className="font-mono tabular-nums text-primary-foreground">
                                {rewardsBreakdown.pdPerShare.toLocaleString(
                                  undefined,
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                                {" "}
                                {rewardsBreakdown.pdCurrency}
                              </div>
                              <div className="text-primary-foreground/80">
                                GLW from Inflation
                              </div>
                              <div className="font-mono tabular-nums text-primary-foreground">
                                {rewardsBreakdown.inflationPerShare.toLocaleString(
                                  undefined,
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </div>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* CTA Button */}
                <Button
                  size="lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPayDeposit(application, row.scoreData);
                  }}
                  disabled={
                    availability.isSoldOut ||
                    (isMiner ? isMiningScoresLoading : isRewardScoresLoading) ||
                    !row.scoreData
                  }
                  className={cn(
                    "h-auto min-h-10 md:min-h-12 px-4 md:px-6 rounded-2xl font-medium border min-w-[120px] md:min-w-[120px] text-sm md:text-base",
                    "bg-white/30 text-foreground border-white/20 hover:bg-white/50 backdrop-blur-md",
                    "dark:bg-gradient-to-b dark:from-white/20 dark:to-white/5 dark:hover:from-white/30 dark:hover:to-white/10 dark:text-white dark:border-white/10"
                  )}
                >
                    {availability.isSoldOut
                      ? "Sold Out"
                      : isMiner
                      ? "Buy Miners"
                      : resolveDelegationCurrency(application) === "SGCTL"
                      ? "Delegate SGCTL"
                      : "Delegate GLW"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
              weeksOfMinerLifeRemaining?: number;
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
            <div
              ref={carouselScrollRef}
              className="w-full overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scroll-smooth touch-pan-x overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <div
                className={cn(
                  "flex",
                  isHeroCarousel ? "w-full gap-4 pr-0" : "gap-4 pr-6"
                )}
              >
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    data-carousel-item
                    className={cn(
                      "snap-start shrink-0",
                      isHeroCarousel
                        ? "w-[calc(50%-12px)] min-w-[400px] max-w-[700px]"
                        : "w-[380px] max-w-[85vw]"
                    )}
                  >
                    <Skeleton className="w-full h-[500px] rounded-[2rem] bg-white/5" />
                  </div>
                ))}
              </div>
            </div>
            {carouselControls}
          </div>
        ) : (
          <div
            className={
              resolvedLayout === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                : "space-y-4"
            }
          >
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-[400px] w-full rounded-[2rem] bg-white/5"
              />
            ))}
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
          target={getNextLaunchpadDelegationBatchAtET()}
          title="Launchpad"
          subtitle="The next batch of farms will be available soon"
        />
      ) : resolvedLayout === "carousel" && isHeroCarousel && isMobile ? (
        // Mobile hero: vertical stack - use explicit height for h-full children
        <div className="w-full space-y-4">
          {rows.map((row) => (
            <div
              key={row.application.id}
              className={cn(
                "h-[580px] w-full cursor-pointer transition-opacity hover:opacity-95",
                row.availability.isSoldOut && "cursor-default hover:opacity-100"
              )}
              onClick={() => {
                if (!row.scoreData || row.availability.isSoldOut) return;
                onPayDeposit(row.application, row.scoreData);
              }}
            >
              {renderHeroCard(row)}
            </div>
          ))}
        </div>
      ) : resolvedLayout === "carousel" ? (
        <div className="w-full">
          {!isHeroCarousel ? (
            <div className="mb-4 flex items-center justify-between gap-3 px-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {rows.length}{" "}
                {rows.length === 1 ? "Active Listing" : "Active Listings"}
              </div>
            </div>
          ) : null}

          <div
            ref={carouselScrollRef}
            onScroll={updateCarouselMeta}
            onWheel={handleCarouselWheel}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") scrollCarouselBy(-1);
              if (e.key === "ArrowRight") scrollCarouselBy(1);
            }}
            tabIndex={0}
            className="w-full overflow-x-auto overflow-y-hidden pb-4 snap-x snap-mandatory scroll-smooth touch-pan-x overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <div
              className={cn(
                "flex",
                isHeroCarousel ? "w-full gap-6 pl-1 pr-0" : "gap-4",
                !isHeroCarousel &&
                  (rows.length <= 1 ? "w-full pr-0" : "pr-6 pl-1")
              )}
            >
              {rows.map((row) => (
                <div
                  key={row.application.id}
                  data-carousel-item
                  className={cn(
                    "snap-start shrink-0 cursor-pointer transition-transform hover:scale-[1.01] duration-300",
                    row.availability.isSoldOut && "cursor-default hover:scale-100",
                    isHeroCarousel
                      ? "w-[calc(50%-12px)] min-w-[400px] max-w-[700px] h-[500px]"
                      : rows.length <= 1
                      ? "w-[380px] max-w-[85vw] h-[500px]"
                      : "w-[380px] max-w-[85vw]"
                  )}
                  onClick={() => {
                    if (!row.scoreData || row.availability.isSoldOut) return;
                    onPayDeposit(row.application, row.scoreData);
                  }}
                >
                  {isHeroCarousel ? (
                    renderHeroCard(row)
                  ) : (
                    <LaunchpadWidgetAssetCard /* Keeping the non-hero variant as standard component for now unless requested */
                      row={row}
                      isScoresLoading={
                        row.application._type === "delegations"
                          ? isRewardScoresLoading
                          : isMiningScoresLoading
                      }
                      glwSpotPrice={glwSpotPrice}
                      ethPrice={ethPrice}
                      onPayDeposit={onPayDeposit}
                      onOpenStats={(application, scoreData) => {
                        setSelectedApplicationForStats(application);
                        setSelectedScoreDataForStats(scoreData ?? null);
                        setStatsDialogOpen(true);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          {carouselControls}
        </div>
      ) : (
        <div
          className={
            resolvedLayout === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 gap-4"
              : "space-y-4"
          }
        >
          {rows.map((row) => (
            <div key={row.application.id} className="h-[500px]">
              {renderHeroCard(row)}
            </div>
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
  ethPrice,
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
          weeksOfMinerLifeRemaining?: number;
        }
      | null;
    cost: number;
    weeklyYield: number;
    rewardScore: { rewardScore: number } | null;
    miningScore: { miningScore: number } | null;
    yieldUsdPerWeek: number;
    yieldPer1000Usd: number;
    amountRaised: number;
    totalAmountNeeded: number;
  };
  isScoresLoading: boolean;
  glwSpotPrice: number;
  ethPrice: number;
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
  const minerWeeksRemaining = !isDelegation
    ? (
        scoreData as { weeksOfMinerLifeRemaining?: number } | null
      )?.weeksOfMinerLifeRemaining
    : null;
  const delegationCurrency = isDelegation
    ? resolveDelegationCurrency(application)
    : "GLW";
  const isSoldOut = availability.isSoldOut;
  const remainingPct = React.useMemo(() => {
    const total = availability.total || 0;
    const remaining = availability.remaining || 0;
    if (isSoldOut || total <= 0) return 0;
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  }, [availability.remaining, availability.total, isSoldOut]);

  const title = application.farmName || "Unnamed Farm";
  const imageSrc = getDialogCardImageSrc(application);

  const costLabel = isSoldOut
    ? isDelegation
      ? "Total Delegated"
      : "Total Mined"
    : isDelegation
    ? "Delegation Amount"
    : "Price / Miner";

  const costMain = isSoldOut
    ? isDelegation
      ? `${Math.round(row.totalAmountNeeded).toLocaleString()} ${delegationCurrency}`
      : `$${Math.round(row.totalAmountNeeded).toLocaleString()} USDC`
    : isDelegation
    ? `${Math.round(cost).toLocaleString()} ${delegationCurrency}`
    : `$${cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`;

  const costSub = isSoldOut
    ? null
    : isDelegation
    ? delegationCurrency === "GLW" && glwSpotPrice > 0
      ? `≈ $${Math.round(cost * glwSpotPrice).toLocaleString()} USD`
      : "—"
    : ethPrice > 0
    ? `≈ ${(cost / ethPrice).toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })} ETH`
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
    if (!scoreData) return null;
    if (!("userWeeklyGlwRewards" in scoreData)) return null;
    if (!("userWeeklyPdRewards" in scoreData)) return null;

    try {
      const totalShares = resolveLaunchpadDelegationShareCount(application);
      if (!totalShares) return null;
      const perShareRewards = calculateLaunchpadPerShareRewards({
        reward: scoreData,
        totalShares,
        delegationCurrency,
        glwSpotPrice,
      });

      return {
        inflationPerShare: perShareRewards.emissionGlwPerShare,
        pdPerShare: perShareRewards.pdPerShare,
        pdCurrency: delegationCurrency,
      };
    } catch {
      return null;
    }
  }, [
    application,
    delegationCurrency,
    glwSpotPrice,
    isDelegation,
    scoreData,
  ]);

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
        progress: "bg-primary/70",
      }
    : {
        badge:
          "border-[color:var(--color-miner)]/30 bg-[color:var(--color-miner)]/10 text-miner",
        progress: "bg-primary/70",
      };

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-border bg-muted/10 p-4 transition-opacity",
        isSoldOut && "opacity-50"
      )}
    >
      <div className="flex min-w-0 gap-3">
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/20 h-24 w-24 shrink-0">
          <FallbackImage
            src={imageSrc}
            widthForProxy={280}
            quality={70}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="min-w-0 truncate text-xl font-semibold text-foreground">
                {title}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">{application.zone.name}</span>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "border px-2 py-0.5 text-xs leading-none",
                    accent.badge
                  )}
                >
                  {isDelegation ? "Delegation" : "Miner"}
                </Badge>
              </div>
              <div className="mt-3">
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/40 border border-border/60">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      accent.progress
                    )}
                    style={{ width: `${remainingPct}%` }}
                  />
                </div>
                <div className="mt-1.5 text-xs font-mono font-medium tabular-nums text-foreground/80">
                  {isSoldOut ? (
                    <>
                      SOLD OUT IN{" "}
                      {formatTimeToSellOut(
                        getListingVisibleStartAtMs(application),
                        application.activeFraction?.filledAt || null
                      )}
                    </>
                  ) : (
                    `${availability.remaining} / ${availability.total} Left`
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <Button
                className="h-10 rounded-full px-4 text-sm whitespace-nowrap"
                disabled={isSoldOut || isScoresLoading || !scoreData}
                onClick={() => {
                  if (isSoldOut || !scoreData) return;
                  onPayDeposit(application, scoreData);
                }}
              >
                {isSoldOut
                  ? "Waitlist"
                  : isDelegation
                  ? resolveDelegationCurrency(application) === "SGCTL"
                    ? "Delegate SGCTL"
                    : "Delegate GLW"
                  : "Buy Miners"}
              </Button>
              {!isSoldOut && (
                <Button
                  variant="outline"
                  className="h-10 rounded-full px-4 text-sm whitespace-nowrap"
                  onClick={() => onOpenStats(application, scoreData)}
                >
                  Advanced Stats
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 min-w-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className={cn("rounded-xl border border-border bg-background/30 p-4", isSoldOut && "sm:col-span-2")}>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {costLabel}
            </div>
            <div className="mt-2 text-base font-semibold text-foreground">
              {costMain}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{costSub}</div>
          </div>
          {!isSoldOut && (
            <div className="rounded-xl border border-border bg-background/30 p-4">
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
                            {delegationRewardsBreakdown.pdCurrency} from PDs
                          </div>
                          <div className="font-mono tabular-nums text-primary-foreground">
                            {delegationRewardsBreakdown.pdPerShare.toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}{" "}
                            {delegationRewardsBreakdown.pdCurrency}
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-flex cursor-help items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {`Weekly Rewards (${formatMinerWeeksLabel(
                        minerWeeksRemaining
                      )})`}
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
                        {`Estimated weekly rewards per miner for ${formatMinerWeeksLabel(
                          minerWeeksRemaining
                        )}. These estimates may decrease as new farms join the region and dilute the regional GLW allocation. See Advanced Stats for detailed information.`}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              <div className="mt-2 text-base font-semibold text-foreground">
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
          )}
        </div>
      </div>
    </div>
  );
}

function formatSignedCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1000)
    return Math.round(value).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function HeroStatColumn({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string | null;
}) {
  return (
    <div className={cn("px-3 py-2")}>
      <div className="text-[9px] font-mono uppercase tracking-widest text-foreground/65 dark:text-white/65">
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-foreground dark:text-white">
        {value}
      </div>
      {subValue ? (
        <div className="mt-1 text-[11px] text-foreground/60 dark:text-white/60">
          {subValue}
        </div>
      ) : null}
    </div>
  );
}

function LaunchpadWidgetHeroCarouselCard({
  row,
  isScoresLoading,
  glwSpotPrice,
  ethPrice,
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
    amountRaised: number;
    totalAmountNeeded: number;
  };
  isScoresLoading: boolean;
  glwSpotPrice: number;
  ethPrice: number;
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
  const minerWeeksRemaining = !isDelegation
    ? (
        scoreData as { weeksOfMinerLifeRemaining?: number } | null
      )?.weeksOfMinerLifeRemaining
    : null;
  const delegationCurrency = isDelegation
    ? resolveDelegationCurrency(application)
    : "GLW";
  const isSoldOut = availability.isSoldOut;

  const title = application.farmName || "Unnamed Farm";
  const imageSrc = getDialogCardImageSrc(application);

  const priceValue = isSoldOut
    ? isDelegation
      ? `${Math.round(row.totalAmountNeeded).toLocaleString()} ${delegationCurrency}`
      : `$${Math.round(row.totalAmountNeeded).toLocaleString()} USDC`
    : isDelegation
    ? `${Math.round(cost).toLocaleString()} ${delegationCurrency}`
    : `$${Math.round(cost).toLocaleString()} USDC`;

  const priceSubValue = isSoldOut
    ? null
    : isDelegation
    ? delegationCurrency === "GLW" && glwSpotPrice > 0
      ? `≈ $${Math.round(cost * glwSpotPrice).toLocaleString()} USD`
      : "—"
    : ethPrice > 0
    ? `≈ ${(cost / ethPrice).toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })} ETH`
    : "Stable price";

  const unitsValue = isSoldOut
    ? formatTimeToSellOut(
        getListingVisibleStartAtMs(application),
        application.activeFraction?.filledAt || null
      )
    : `${availability.remaining.toLocaleString()} / ${availability.total.toLocaleString()}`;

  const unitsSubValue = isSoldOut ? "Sell out time" : "Available";
  const unitsRemainingPct = React.useMemo(() => {
    const total = availability.total || 0;
    const remaining = availability.remaining || 0;
    if (total <= 0) return 0;
    if (isSoldOut) return 0;
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  }, [availability.remaining, availability.total, isSoldOut]);

  const delegationRewardsBreakdown = React.useMemo(() => {
    if (!isDelegation) return null;
    if (!scoreData || !("userWeeklyGlwRewards" in scoreData)) return null;
    try {
      const totalShares = resolveLaunchpadDelegationShareCount(application);
      if (!totalShares) return null;
      const perShareRewards = calculateLaunchpadPerShareRewards({
        reward: scoreData,
        totalShares,
        delegationCurrency,
        glwSpotPrice,
      });
      return {
        emissionGlwPerShare: perShareRewards.emissionGlwPerShare,
        pdPerShare: perShareRewards.pdPerShare,
      };
    } catch {
      return null;
    }
  }, [
    application,
    delegationCurrency,
    glwSpotPrice,
    isDelegation,
    scoreData,
  ]);

  const rewardsMain =
    isScoresLoading && weeklyYield === 0
      ? "…"
      : isDelegation &&
        delegationCurrency === "SGCTL" &&
        delegationRewardsBreakdown
      ? `+${formatSignedCompactNumber(
          delegationRewardsBreakdown.pdPerShare
        ).replace(/^\+/, '')} SGCTL + ${formatSignedCompactNumber(
          delegationRewardsBreakdown.emissionGlwPerShare
        )} GLW / wk`
      : `+${formatSignedCompactNumber(weeklyYield)} GLW / wk`;
  const rewardsSub =
    isDelegation && delegationCurrency === "SGCTL"
      ? null
      : glwSpotPrice > 0 && weeklyYield > 0
      ? `≈ $${formatSignedCompactNumber(weeklyYield * glwSpotPrice)} USD / wk`
      : null;

  const rewardScoreValue = React.useMemo(() => {
    if (!isDelegation) return null;
    if (isScoresLoading) return "…";
    return row.rewardScore?.rewardScore
      ? Math.round(row.rewardScore.rewardScore).toLocaleString()
      : "0";
  }, [isDelegation, isScoresLoading, row.rewardScore?.rewardScore]);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-border bg-muted/10">
      <FallbackImage
        src={imageSrc}
        widthForProxy={1400}
        quality={70}
        alt={title}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/40 to-transparent dark:from-black/75 dark:via-black/25 dark:to-black/5" />

      <div className="relative h-[420px] sm:h-[340px]">
        <div className="absolute inset-x-4 bottom-4 flex flex-col gap-4 sm:inset-x-6 sm:bottom-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full min-w-0 sm:w-auto">
            <div className="mb-2 min-w-0">
              <div className="truncate text-2xl font-semibold text-foreground dark:text-white sm:text-3xl">
                {title}
              </div>
              <div className="mt-1 flex max-w-full flex-wrap items-center gap-2">
                <div className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-white/40 bg-white/30 px-2.5 py-1 text-xs text-foreground/80 backdrop-blur-3xl shadow-lg dark:border-white/10 dark:bg-black/30 dark:text-white/80">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">{application.zone.name}</span>
                </div>
                <div
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border border-white/40 bg-white/30 px-2.5 py-1 text-xs font-medium backdrop-blur-3xl shadow-lg dark:border-white/10 dark:bg-black/30",
                    isDelegation
                      ? "text-purple-700 dark:text-purple-300"
                      : "text-miner"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isDelegation
                        ? "bg-purple-700 dark:bg-purple-300"
                        : "bg-[color:var(--color-miner)]"
                    )}
                  />
                  {isDelegation ? "Delegation" : "Miner"}
                </div>
                {isDelegation && rewardScoreValue && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/40 bg-white/30 px-2.5 py-1 text-xs font-medium backdrop-blur-3xl shadow-lg cursor-help dark:border-purple-400/30 dark:bg-purple-500/20">
                        <Sparkles className="h-3 w-3 text-purple-700 dark:text-purple-300" />
                        <span className="text-purple-900/80 dark:text-purple-200/80">
                          Reward Score:
                        </span>
                        <span className="font-bold text-purple-900 dark:text-purple-200 tabular-nums">
                          {rewardScoreValue}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[300px]">
                      <div className="text-xs">
                        <div className="font-semibold mb-1.5">Reward Score</div>
                        <div className="text-primary-foreground/80 leading-relaxed">
                          The Reward Score is a tool that combines both revenue
                          streams (deposit recovery and GLW inflation) into a
                          single metric representing expected rewards per dollar
                          delegated. Higher Reward Scores generally indicate
                          better delegation opportunities, but do not guarantee
                          realized performance, since a farm's actual
                          competitiveness and rewards may shift as new farms
                          join its region.
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            <div
              className={cn(
                "w-full max-w-full overflow-hidden rounded-3xl border border-white/40 bg-white/30 backdrop-blur-3xl sm:w-auto transition-colors shadow-lg dark:border-white/10 dark:bg-black/30",
                !isSoldOut && "cursor-pointer hover:bg-white/40 dark:hover:bg-black/40"
              )}
              onClick={(e) => {
                if (isSoldOut) return;
                e.stopPropagation();
                onOpenStats(application, scoreData);
              }}
            >
              <div
                className={cn(
                  "grid w-full grid-cols-2",
                  !isSoldOut && "sm:grid-cols-3"
                )}
              >
                {/* First column: Delegation Amount OR Price per Miner */}
                <div className="border-b border-white/20 sm:border-b-0 sm:border-r sm:border-white/20 dark:border-white/10 dark:sm:border-white/10">
                  <HeroStatColumn
                    label={
                      isSoldOut
                        ? isDelegation
                          ? "Total Delegated"
                          : "Total Mined"
                        : isDelegation
                        ? "Delegation Amount"
                        : "Price per Miner"
                    }
                    value={priceValue}
                    subValue={priceSubValue}
                  />
                </div>

                {/* Second column: Units with progress bar */}
                <div
                  className={cn(
                    "border-b border-white/20 sm:border-b-0 dark:border-white/10",
                    !isSoldOut && "sm:border-r sm:border-white/20 dark:sm:border-white/10"
                  )}
                >
                  <div className="px-3 py-2">
                    <div className="text-[9px] font-mono uppercase tracking-widest text-foreground/65 dark:text-white/65">
                      Units
                    </div>
                    <div className="mt-1.5 text-sm font-semibold text-foreground dark:text-white">
                      {unitsValue}
                    </div>
                    <div className="mt-1 text-[11px] text-foreground/60 dark:text-white/60">
                      {unitsSubValue}
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div
                        className={cn("h-full rounded-full", "bg-primary/70")}
                        style={{ width: `${unitsRemainingPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Third column: Weekly Rewards */}
                {!isSoldOut && (
                  <div className="col-span-2 sm:col-span-1">
                    <HeroStatColumn
                      label="Est. Weekly Rewards"
                      value={rewardsMain}
                      subValue={rewardsSub}
                    />
                    <div className="px-3 pb-2 text-[9px] text-foreground/40 leading-tight -mt-1 dark:text-white/40">
                      Weekly earnings are subject to change.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 sm:w-auto">
            <Button
              className="h-full w-full rounded-3xl bg-white/30 px-8 text-lg font-medium text-foreground hover:bg-white/40 backdrop-blur-3xl border border-white/40 sm:w-auto shadow-lg dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:border-white/10"
              disabled={isSoldOut || isScoresLoading || !scoreData}
              onClick={() => {
                if (isSoldOut || !scoreData) return;
                onPayDeposit(application, scoreData);
              }}
            >
              {isSoldOut
                ? "Waitlist"
                : isDelegation
                ? resolveDelegationCurrency(application) === "SGCTL"
                  ? "Delegate SGCTL"
                  : "Delegate GLW"
                : "Buy Miners"}
            </Button>
          </div>
        </div>
      </div>
      {!isSoldOut && (
        <Button
          variant="ghost"
          className="absolute top-4 right-4 h-8 rounded-full bg-white/30 px-4 text-xs font-medium text-foreground/90 hover:bg-white/40 backdrop-blur-3xl border border-white/40 transition-colors shadow-lg dark:bg-black/30 dark:text-white/90 dark:hover:bg-black/40 dark:border-white/10"
          onClick={(e) => {
            e.stopPropagation();
            onOpenStats(application, scoreData);
          }}
        >
          <span>Advanced Stats</span>
          <ArrowUpRight className="ml-1.5 h-3 w-3 opacity-70" />
        </Button>
      )}
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
    filters: {},
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
  const rewardScoreFallbackCurrency = "GLW" as PaymentCurrency;

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

  const activeDelegationsForScores = React.useMemo(
    () =>
      taggedDelegations.filter(
        (app) => !getActiveFractionAvailability(app).isSoldOut
      ),
    [taggedDelegations]
  );

  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications: activeDelegationsForScores,
    paymentCurrency: rewardScoreFallbackCurrency,
    enabled: activeDelegationsForScores.length > 0,
    walletAddress: address || null,
  });

  const { miningScoreMap, isLoading: isMiningScoresLoading } = useMiningScore({
    applications: taggedMiners,
    extraLiveApplications: taggedDelegations,
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
              weeksOfMinerLifeRemaining: mining.weeksOfMinerLifeRemaining,
            }
          : null;
      const delegationCurrency =
        application._type === "delegations"
          ? resolveDelegationCurrency(application)
          : null;
      const totalShares = application.activeFraction?.totalSteps || 0;
      const delegationPerShareRewards =
        application._type === "delegations"
          ? calculateLaunchpadPerShareRewards({
              reward: rewardScore,
              totalShares,
              delegationCurrency: delegationCurrency || "GLW",
              glwSpotPrice,
            })
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
          return parseDelegationStepAmount(application);
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
          return delegationPerShareRewards?.totalGlwPerShare ?? 0;
        } catch {
          return 0;
        }
      })();

      const yieldUsdPerWeek =
        application._type === "delegations"
          ? delegationPerShareRewards?.totalUsdPerShare ?? 0
          : glwSpotPrice > 0
          ? weeklyYield * glwSpotPrice
          : 0;
      const yieldPer1000Usd =
        application._type === "miners" && cost > 0 && yieldUsdPerWeek > 0
          ? (yieldUsdPerWeek / cost) * 1000
          : 0;

      const amountRaised = application.activeFraction?.amountRaised
        ? parseFloat(
            formatUnits(
              BigInt(application.activeFraction.amountRaised),
              application._type === "miners"
                ? DECIMALS_BY_TOKEN.USDC
                : getDelegationCurrencyDecimals(delegationCurrency || "GLW")
            )
          )
        : 0;

      const totalAmountNeeded = application.activeFraction?.totalAmountNeeded
        ? parseFloat(
            formatUnits(
              BigInt(application.activeFraction.totalAmountNeeded),
              application._type === "miners"
                ? DECIMALS_BY_TOKEN.USDC
                : getDelegationCurrencyDecimals(delegationCurrency || "GLW")
            )
          )
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
        amountRaised,
        totalAmountNeeded,
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
    amountRaised: number;
    totalAmountNeeded: number;
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
          weeksOfMinerLifeRemaining?: number;
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
              Delegations ({tabCounts.delegations})
            </button>
            <button
              type="button"
              onClick={() => onTabChange("miners")}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold transition-colors",
                tab === "miners"
                  ? "border-[color:var(--color-miner)]/40 bg-[color:var(--color-miner)]/10 text-miner"
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
          <SponsoredFarmsActivity constrainHeight />
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
            target={getNextLaunchpadDelegationBatchAtET()}
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
    amountRaised: number;
    totalAmountNeeded: number;
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
  const minerWeeksRemaining = !isDelegation
    ? (
        scoreData as { weeksOfMinerLifeRemaining?: number } | null
      )?.weeksOfMinerLifeRemaining
    : null;
  const delegationCurrency = isDelegation
    ? resolveDelegationCurrency(application)
    : "GLW";
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
        progress: "bg-primary/70",
        button:
          "border-purple-500/30 text-foreground hover:bg-purple-500/10 hover:border-purple-500/50",
      }
    : {
        badge: "text-miner border-[color:var(--color-miner)]/30",
        reward: "text-foreground",
        progress: "bg-primary/70",
        button:
          "border-[color:var(--color-miner)]/30 text-foreground hover:bg-[color:var(--color-miner)]/10 hover:border-[color:var(--color-miner)]/50",
      };

  const title = application.farmName || "Unnamed Farm";
  const imageSrc = getDialogCardImageSrc(application);

  const costLabel = isSoldOut
    ? isDelegation
      ? "Total Delegated"
      : "Total Mined"
    : isDelegation
    ? "Delegation Amount"
    : "PRICE / MINER";

  const costMain = isSoldOut
    ? isDelegation
      ? `${Math.round(row.totalAmountNeeded).toLocaleString()} ${delegationCurrency}`
      : `$${Math.round(row.totalAmountNeeded).toLocaleString()} USDC`
    : isDelegation
    ? `${Math.round(cost).toLocaleString()} ${delegationCurrency}`
    : `$${cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`;

  const costSub = isSoldOut
    ? null
    : isDelegation
    ? delegationCurrency === "GLW" && glwSpotPrice > 0
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
        "w-full overflow-hidden rounded-2xl border border-border bg-muted/10 p-4 transition-all",
        "hover:bg-muted/20",
        isSoldOut && "opacity-50"
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-[minmax(0,18%)_minmax(0,1fr)]">
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

          <div className="min-w-0 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xl font-semibold text-foreground truncate">
                  {title}
                </div>
                <div className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">{application.zone.name}</span>
                </div>
              </div>

              <div className="shrink-0">
                <div className="h-2 w-48 overflow-hidden rounded-full bg-muted/40 border border-border/60">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300 ease-out",
                      accent.progress
                    )}
                    style={{ width: `${remainingPct}%` }}
                  />
                </div>
                <div className="mt-1.5 text-xs font-medium text-muted-foreground text-right">
                  {isSoldOut ? (
                    <>
                      SOLD OUT IN{" "}
                      {formatTimeToSellOut(
                        getListingVisibleStartAtMs(application),
                        application.activeFraction?.filledAt || null
                      )}
                    </>
                  ) : (
                    `${availability.remaining} / ${availability.total} Left`
                  )}
                </div>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={cn("rounded-xl border border-border bg-background/30 p-4", isSoldOut && "sm:col-span-2")}>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {costLabel}
                </div>
                <div className="mt-2 text-lg font-semibold text-foreground">
                  {costMain}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {costSub}
                </div>
              </div>

              {!isSoldOut && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="rounded-xl border border-border bg-background/30 p-4 cursor-help">
                      <div className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        {isDelegation
                          ? "EST. REWARDS (100 WEEKS)"
                          : `WEEKLY REWARDS (${formatMinerWeeksLabel(
                              minerWeeksRemaining
                            ).toUpperCase()})`}
                        <Info className="h-3.5 w-3.5 opacity-70" />
                      </div>
                      <div
                        className={cn(
                          "mt-2 text-lg font-semibold",
                          accent.reward
                        )}
                      >
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
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="start"
                    sideOffset={8}
                    className="max-w-[280px] p-3"
                  >
                    {isDelegation ? (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-primary-foreground">
                          Estimated rewards
                        </div>
                        <div className="text-[11px] leading-snug text-primary-foreground/80">
                          Weekly estimate per delegation, paid weekly for 100
                          weeks. Can decrease as regions fill. See Advanced Stats
                          for details.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-primary-foreground">
                          Estimated rewards
                        </div>
                        <div className="text-[11px] leading-snug text-primary-foreground/80">
                          {`Estimated weekly rewards per miner for ${formatMinerWeeksLabel(
                            minerWeeksRemaining
                          )}. These estimates may decrease as new farms join the region and dilute the regional GLW allocation. See Advanced Stats for detailed information.`}
                        </div>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col sm:flex-row gap-3">
          <Button
            variant={isSoldOut ? "ghost" : "default"}
            className="h-11 w-full sm:flex-1 rounded-full"
            disabled={isSoldOut || isScoresLoading || !scoreData}
            onClick={() => {
              if (isSoldOut || !scoreData) return;
              onPayDeposit(application, scoreData);
            }}
          >
            {isSoldOut
              ? "Waitlist"
              : isDelegation
              ? resolveDelegationCurrency(application) === "SGCTL"
                ? "Delegate SGCTL"
                : "Delegate GLW"
              : "Buy Miners"}
          </Button>

          {!isSoldOut && (
            <Button
              variant="outline"
              className="h-11 w-full sm:flex-1 rounded-full"
              onClick={() => onOpenStats(application, scoreData)}
            >
              Advanced Stats
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
