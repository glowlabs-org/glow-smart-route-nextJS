"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUnits } from "viem";
import { getCurrencyDecimals } from "@/lib/currency";
import { formatNumber } from "./utils";
import {
  useSponsoredFarms,
  type SponsoredFarm,
} from "@/hooks/useMiningMarketplace";

interface SponsoredFarmsActivityProps {
  className?: string;
}

export function SponsoredFarmsActivity({
  className,
}: SponsoredFarmsActivityProps) {
  const { sponsoredFarms, isLoading, isError, error } = useSponsoredFarms();

  if (isLoading) {
    return (
      <div className={className}>
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
                    <Skeleton className="h-8 w-20" />
                  </div>
                  <Skeleton className="h-16 w-full" />
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={className}>
        <div className="text-center py-8">
          <p className="text-destructive text-sm">
            Error loading sponsored farms: {error?.message}
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Please try again later
          </p>
        </div>
      </div>
    );
  }

  if (sponsoredFarms.length === 0) {
    return (
      <div className={className}>
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">
            No sponsored farms found.
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Sponsored farms will appear here once they are built and operational
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
        {sponsoredFarms.map((farm) => {
          // Parse the deposit amount using the correct decimals
          const decimals = getCurrencyDecimals(
            farm.protocolDepositPaidCurrency
          );
          const depositAmount = formatUnits(
            BigInt(farm.protocolDepositPaidAmount),
            decimals
          );

          // Format the built date
          const builtDate = new Date(farm.builtAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });

          return (
            <Card
              key={farm.farmId}
              className="bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 overflow-hidden pt-0"
            >
              <CardContent className="p-0">
                {/* Images */}
                <div className="relative">
                  {farm.afterInstallPictures &&
                  farm.afterInstallPictures.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1">
                      <div className="col-span-2 relative">
                        <img
                          src={
                            farm.afterInstallPictures[0]?.url ||
                            "/images/sections/residential.jpg"
                          }
                          alt={`${farm.farmId} main`}
                          className="w-full h-56 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      </div>
                      <img
                        src={
                          farm.afterInstallPictures[1]?.url ||
                          "/images/sections/residential.jpg"
                        }
                        alt={`${farm.farmId} alt 1`}
                        className="w-full h-28 object-cover"
                      />
                      <img
                        src={
                          farm.afterInstallPictures[2]?.url ||
                          "/images/sections/residential.jpg"
                        }
                        alt={`${farm.farmId} alt 2`}
                        className="w-full h-28 object-cover"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1">
                      <div className="col-span-2">
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

                <div className="p-6 space-y-4">
                  {/* Header with Farm Name and Status */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4
                        className="text-xl mb-1 text-black dark:text-white truncate"
                        style={{
                          fontFamily: "Söhne, sans-serif",
                          fontWeight: 500,
                        }}
                      >
                        {farm.name}
                      </h4>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <span
                          className="text-sm truncate"
                          style={{
                            fontFamily: "Söhne, sans-serif",
                            fontWeight: 300,
                          }}
                        >
                          {/* //TODO: Add region name */}
                          {farm.regionId}
                        </span>
                      </div>
                    </div>
                    {/* Status Badge */}
                    <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-xs font-medium">
                      Active
                    </div>
                  </div>

                  {/* Protocol Deposit Amount */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 grid grid-cols-2 gap-4">
                    <div>
                      <div
                        className="text-sm text-gray-600 dark:text-gray-400 mb-2"
                        style={{
                          fontFamily: "Söhne, sans-serif",
                          fontWeight: 400,
                        }}
                      >
                        Protocol Deposit Paid
                      </div>
                      <div
                        className="text-2xl lg:text-3xl text-black dark:text-white"
                        style={{
                          fontFamily: "Söhne, sans-serif",
                          fontWeight: 600,
                        }}
                      >
                        {formatNumber(parseFloat(depositAmount), 0)}{" "}
                        <span className="text-lg font-normal">
                          {farm.protocolDepositPaidCurrency}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-sm text-gray-600 dark:text-gray-400 mb-2"
                        style={{
                          fontFamily: "Söhne, sans-serif",
                          fontWeight: 400,
                        }}
                      >
                        Reward Score
                      </div>
                      <div
                        className="text-2xl lg:text-3xl text-black dark:text-white"
                        style={{
                          fontFamily: "Söhne, sans-serif",
                          fontWeight: 600,
                        }}
                      >
                        {/* //TODO: Replace with actual reward score */}0
                      </div>
                    </div>
                  </div>

                  {/* Farm Details Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3">
                      <div
                        className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-1"
                        style={{
                          fontFamily: "Söhne, sans-serif",
                          fontWeight: 600,
                        }}
                      >
                        Built Date
                      </div>
                      <div
                        className="text-sm text-black dark:text-white"
                        style={{
                          fontFamily: "Söhne, sans-serif",
                          fontWeight: 500,
                        }}
                      >
                        {builtDate}
                      </div>
                    </div>
                    <div className="text-center p-3">
                      <div
                        className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-1"
                        style={{
                          fontFamily: "Söhne, sans-serif",
                          fontWeight: 600,
                        }}
                      >
                        Sponsor
                      </div>
                      <div
                        className="text-sm text-black dark:text-white font-mono"
                        style={{
                          fontFamily: "Söhne, sans-serif",
                          fontWeight: 500,
                        }}
                      >
                        {farm.sponsorWallet?.slice(0, 6)}...
                        {farm.sponsorWallet?.slice(-4)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
