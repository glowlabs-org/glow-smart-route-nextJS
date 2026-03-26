"use client";

import React, { useState, useCallback } from "react";
import { SponsoredFarmsActivity } from "@/app/marketplace/sponsored-farms-activity";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSplitsActivity, type SplitActivity } from "@/hooks";
import { useQuery } from "@tanstack/react-query";
import type { FarmImagesBatchResponse } from "@glowlabs-org/utils/browser";
import { FallbackImage } from "@/components/ui/fallback-image";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUnits } from "viem";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

interface FarmImageWithSkeletonProps {
  src: string;
  alt: string;
}

function FarmImageWithSkeleton({ src, alt }: FarmImageWithSkeletonProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  return (
    <>
      {!isLoaded && <Skeleton className="absolute inset-0 rounded-xl" />}
      <FallbackImage
        src={src}
        widthForProxy={200}
        quality={80}
        alt={alt}
        className={cn(
          "w-full h-full object-cover transition-all duration-300 group-hover:scale-105",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={handleLoad}
        loading="lazy"
        decoding="async"
      />
    </>
  );
}

interface CommunityActivityWidgetProps {
  className?: string;
  variant?: "default" | "minimal";
}

interface AggregatedFarm {
  farmId: string;
  farmName: string;
  totalDelegatedGlw: number;
  rewardScore: number | null;
  fundingDurationMs: number;
  firstPurchaseDate: Date;
  lastPurchaseDate: Date;
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;

  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  if (days >= 1) {
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (hours >= 1) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  if (minutes >= 1) {
    return minutes === 1 ? "1 min" : `${minutes} mins`;
  }
  return "<1 min";
}

function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
  }).format(n);
}

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return formatNumber(n, 0);
}

export default function CommunityActivityWidget({
  className,
  variant = "default",
}: CommunityActivityWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMinimal = variant === "minimal";

  // Fetch activity data for launchpad (delegation) only
  const { activity, isLoading } = useSplitsActivity({
    limit: 200,
    fractionType: "launchpad",
    enabled: true,
  });

  // Aggregate farms that are fully funded
  const aggregatedFarms = React.useMemo<AggregatedFarm[]>(() => {
    if (!activity || activity.length === 0) return [];

    // Group by farmId, only include filled farms
    const farmMap = new Map<
      string,
      {
        farmId: string;
        farmName: string;
        totalDelegatedWei: bigint;
        rewardScore: number | null;
        timestamps: number[];
      }
    >();

    for (const purchase of activity) {
      // Only include launchpad (delegation) and filled farms
      if (purchase.fractionType !== "launchpad") continue;
      if (!purchase.isFilled && purchase.fractionStatus !== "filled") continue;

      const farmId = purchase.farmId ?? purchase.applicationId;
      if (!farmId) continue;

      const existing = farmMap.get(farmId);
      const amountWei = BigInt(purchase.amount || "0");
      const timestamp = purchase.timestamp * 1000;

      if (existing) {
        existing.totalDelegatedWei += amountWei;
        existing.timestamps.push(timestamp);
        // Use the first non-null reward score
        if (existing.rewardScore === null && purchase.rewardScore !== null) {
          existing.rewardScore = purchase.rewardScore;
        }
      } else {
        farmMap.set(farmId, {
          farmId,
          farmName: purchase.farmName,
          totalDelegatedWei: amountWei,
          rewardScore: purchase.rewardScore,
          timestamps: [timestamp],
        });
      }
    }

    // Convert to array and calculate funding duration
    const farms: AggregatedFarm[] = [];
    for (const [, data] of farmMap) {
      if (data.timestamps.length === 0) continue;

      const sortedTimestamps = data.timestamps.sort((a, b) => a - b);
      const firstPurchaseDate = new Date(sortedTimestamps[0]);
      const lastPurchaseDate = new Date(
        sortedTimestamps[sortedTimestamps.length - 1]
      );
      const fundingDurationMs =
        lastPurchaseDate.getTime() - firstPurchaseDate.getTime();

      // Convert from wei (18 decimals) to GLW
      const totalDelegatedGlw = Number(formatUnits(data.totalDelegatedWei, 18));

      farms.push({
        farmId: data.farmId,
        farmName: data.farmName,
        totalDelegatedGlw,
        rewardScore: data.rewardScore,
        fundingDurationMs,
        firstPurchaseDate,
        lastPurchaseDate,
      });
    }

    // Sort by most recently funded (last purchase date)
    farms.sort(
      (a, b) => b.lastPurchaseDate.getTime() - a.lastPurchaseDate.getTime()
    );

    // Return top 3
    return farms.slice(0, 3);
  }, [activity]);

  // Collect farm IDs for image fetch
  const farmIds = React.useMemo(() => {
    return aggregatedFarms.map((f) => f.farmId);
  }, [aggregatedFarms]);

  // Fetch farm images
  const { data: farmImagesData } = useQuery({
    queryKey: ["farm-images-batch", farmIds],
    queryFn: async () => {
      if (farmIds.length === 0) return { results: {} };
      const response = await fetch("/api/farms/images-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ farmIds }),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch farm images: ${response.status}`);
      }
      return (await response.json()) as FarmImagesBatchResponse;
    },
    enabled: farmIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const farmImageMap = React.useMemo(() => {
    const map = new Map<string, string>();
    if (farmImagesData?.results) {
      for (const [farmId, data] of Object.entries(farmImagesData.results)) {
        if (data.imageUrl) {
          map.set(farmId, data.imageUrl);
        }
      }
    }
    return map;
  }, [farmImagesData]);

  return (
    <>
      <Card
        className={cn(
          "relative flex h-full flex-col overflow-hidden",
          isMinimal
            ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl"
            : "bg-card dark:bg-card border-border/20",
          className
        )}
      >
        <CardHeader className={cn("pb-3", isMinimal && "px-6 pt-0")}>
          <div className="flex items-center justify-between">
            <CardTitle className="tracking-tight text-lg">
              Recently Funded Farms
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(true)}
              className="text-xs font-mono text-muted-foreground hover:text-foreground px-2 h-7"
            >
              See All Activity
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </CardHeader>

        <CardContent
          className={cn(
            "min-h-0 flex-1 flex flex-col gap-3 pt-0",
            isMinimal && "px-6"
          )}
        >
          {isLoading ? (
            <div className="flex-1 flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex-1 flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 animate-pulse"
                >
                  <div className="w-20 sm:w-24 h-full min-h-[70px] sm:min-h-[80px] rounded-xl bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-32 bg-muted rounded" />
                    <div className="h-4 w-28 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : aggregatedFarms.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              No recently funded farms
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3">
              {aggregatedFarms.map((farm) => {
                const imageUrl =
                  farmImageMap.get(farm.farmId) ??
                  "/images/sections/residential.jpg";
                const auditUrl = `https://glow.org/audits/${farm.farmId}`;

                return (
                  <Link
                    key={farm.farmId}
                    href={auditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 hover:bg-muted/40 dark:hover:bg-muted/60 transition-colors group"
                  >
                    {/* Farm Image - Takes full height */}
                    <div className="relative w-20 sm:w-24 h-full min-h-[70px] sm:min-h-[80px] rounded-xl overflow-hidden shrink-0 border border-border/20 dark:border-border/40">
                      <FarmImageWithSkeleton
                        src={imageUrl}
                        alt={farm.farmName}
                      />
                    </div>

                    {/* Farm Info */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      {/* Name */}
                      <h3 className="font-bold text-base sm:text-lg truncate text-foreground group-hover:text-glow-orange transition-colors">
                        {farm.farmName}
                      </h3>

                      {/* Delegated amount - prominent */}
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-lg font-bold text-delegation-purple">
                          {formatCompactNumber(farm.totalDelegatedGlw)}
                        </span>
                        <span className="text-xs text-muted-foreground">GLW</span>
                      </div>

                      {/* Secondary stats row */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {farm.rewardScore !== null && (
                          <>
                            <span className="whitespace-nowrap">
                              Score <span className="font-mono font-medium text-foreground">{formatNumber(farm.rewardScore, 0)}</span>
                            </span>
                            <span className="text-border">•</span>
                          </>
                        )}
                        <span className="whitespace-nowrap">
                          <span className="font-mono font-medium text-foreground">{formatDuration(farm.fundingDurationMs)}</span>
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 group-hover:translate-x-1 transition-transform hidden sm:block" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0 bg-card border-border/40 rounded-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-border/20">
            <DialogTitle>Recent Activity</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 bg-background">
            <SponsoredFarmsActivity
              variant="full"
              constrainHeight={false}
              showKpis={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
