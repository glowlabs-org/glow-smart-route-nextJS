"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { formatNumber } from "./utils";
import { getDisplayDecimals } from "@/lib/currency";
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
import { DepositDialog } from "./deposit-dialog";
import { SponsoredFarmsActivity } from "./sponsored-farms-activity";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/header";
import { GlowSymbol } from "@/components/glow-symbol";
import { notFound } from "next/navigation";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { formatUnits, parseUnits } from "viem";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useFractionSplits } from "@/hooks/useFractionSplits";

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
      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
        <div
          className="text-sm text-muted-foreground mb-2"
          style={{ fontFamily: "Söhne, sans-serif", fontWeight: 400 }}
        >
          Your shares
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
    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
      <div
        className="text-sm text-muted-foreground mb-2"
        style={{ fontFamily: "Söhne, sans-serif", fontWeight: 400 }}
      >
        Your shares
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

export default function GlowLaunchpadPage() {
  return notFound();

  // const [zoneParam, setZoneParam] = useQueryState("zone");
  // // const [currencyParam, setCurrencyParam] = useQueryState("currency");
  // const [sortParam, setSortParam] = useQueryState("sort", {
  //   defaultValue: "publishedOnAuctionTimestamp",
  // });
  // const [sortOrderParam, setSortOrderParam] = useQueryState("order", {
  //   defaultValue: "desc",
  // });
  // const [dialogOpen, setDialogOpen] = React.useState(false);
  // const [selectedApplicationForDeposit, setSelectedApplicationForDeposit] =
  //   React.useState<AuctionApplication | null>(null);

  // // Get wallet connection status
  // const { address, isConnected } = useAccount();

  // const selectedZoneId = zoneParam ? parseInt(zoneParam) : undefined; // TODO: Add back in
  // // const selectedZoneId = 1;
  // const selectedCurrency = "GLW" as PaymentCurrency | undefined;
  // const selectedSort = sortParam as SortBy;
  // const selectedSortOrder = sortOrderParam as SortOrder;

  // // Fetch applications with current filters
  // const { applications, isLoading, isError, error } = useGlowLaunchpad({
  //   filters: {
  //     zoneId: selectedZoneId,
  //     sortBy: selectedSort,
  //     sortOrder: selectedSortOrder,
  //     paymentCurrency: selectedCurrency,
  //   },
  // });

  // // Get available zones
  // const { zones } = useAvailableZones(applications);

  // // Get reward scores for applications
  // const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
  //   applications,
  //   paymentCurrency: selectedCurrency || "GLW",
  //   enabled: applications.length > 0,
  // });

  // function onPayDeposit(application: AuctionApplication) {
  //   setSelectedApplicationForDeposit(application);
  //   setDialogOpen(true);
  // }

  // return (
  //   <>
  //     <Header />
  //     <div className="min-h-screen relative overflow-hidden pt-20">
  //       <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto lg:px-8 py-8">
  //         <div className="bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden mb-6">
  //           <div className="p-6">
  //             <div className="flex items-center justify-between">
  //               <div className="flex-1">
  //                 <h1 className="text-xl font-semibold">Glow Launchpad</h1>
  //                 <p className="text-sm text-muted-foreground mt-1">
  //                   Sponsor solar farms and earn weekly GLW rewards
  //                 </p>
  //               </div>
  //               <Button variant="outline" asChild>
  //                 <Link href="https://impact.glow.org" target="_blank">
  //                   See Regions Dashboard
  //                 </Link>
  //               </Button>
  //             </div>
  //           </div>
  //         </div>

  //         <div className="bg-background backdrop-blur-xl rounded-3xl border border-border overflow-hidden">
  //           <Tabs defaultValue="market" className="w-full">
  //             <div className="p-6">
  //               <TabsList className="grid w-fit grid-cols-2">
  //                 <TabsTrigger value="market">Launchpad</TabsTrigger>
  //                 <TabsTrigger value="activity">Activity</TabsTrigger>
  //               </TabsList>
  //             </div>

  //             <TabsContent value="market" className="mt-0">
  //               <div className="p-6 pt-4">
  //                 {/* Filters */}
  //                 <div className="bg-muted/30 rounded-2xl border border-border p-4 mb-6">
  //                   <div className="flex items-center gap-2 mb-4">
  //                     <h3 className="text-lg font-semibold">Filters</h3>
  //                   </div>
  //                   <div className="flex flex-wrap items-center gap-4">
  //                     <div className="flex items-center gap-2">
  //                       <span className="text-sm font-medium text-muted-foreground">
  //                         Zone
  //                       </span>
  //                       <Select
  //                         value={selectedZoneId?.toString() || "all"}
  //                         onValueChange={(v) =>
  //                           setZoneParam(v === "all" ? null : v)
  //                         }
  //                       >
  //                         <SelectTrigger className="w-[220px]">
  //                           <SelectValue placeholder="All zones" />
  //                         </SelectTrigger>
  //                         <SelectContent>
  //                           <SelectItem value="all">All zones</SelectItem>
  //                           {zones.map((zone) => (
  //                             <SelectItem
  //                               key={zone.id}
  //                               value={zone.id.toString()}
  //                             >
  //                               {zone.name}
  //                             </SelectItem>
  //                           ))}
  //                         </SelectContent>
  //                       </Select>
  //                     </div>
  //                     {/* <div className="flex items-center gap-2">
  //                       <span className="text-sm font-medium text-muted-foreground">
  //                         Currency
  //                       </span>
  //                       <Select
  //                         value={selectedCurrency || "all"}
  //                         onValueChange={(v) =>
  //                           setCurrencyParam(v === "all" ? null : v)
  //                         }
  //                       >
  //                         <SelectTrigger className="w-[180px]">
  //                           <SelectValue placeholder="All currencies" />
  //                         </SelectTrigger>
  //                         <SelectContent>
  //                           <SelectItem value="all">All currencies</SelectItem>
  //                           <SelectItem value="USDG">USDG</SelectItem>
  //                           <SelectItem value="USDC">USDC</SelectItem>
  //                           <SelectItem value="GLW">GLW</SelectItem>
  //                           <SelectItem value="GCTL">GCTL</SelectItem>
  //                         </SelectContent>
  //                       </Select>
  //                     </div> */}
  //                     <div className="flex items-center gap-2">
  //                       <span className="text-sm font-medium text-muted-foreground">
  //                         Sort By
  //                       </span>
  //                       <Select
  //                         value={selectedSort}
  //                         onValueChange={(v) => setSortParam(v)}
  //                       >
  //                         <SelectTrigger className="w-[200px]">
  //                           <SelectValue />
  //                         </SelectTrigger>
  //                         <SelectContent>
  //                           <SelectItem value="publishedOnAuctionTimestamp">
  //                             Date Published
  //                           </SelectItem>

  //                           <SelectItem value="finalProtocolFee">
  //                             Protocol Deposit
  //                           </SelectItem>
  //                         </SelectContent>
  //                       </Select>
  //                     </div>
  //                     <div className="flex items-center gap-2">
  //                       <span className="text-sm font-medium text-muted-foreground">
  //                         Order
  //                       </span>
  //                       <Select
  //                         value={selectedSortOrder}
  //                         onValueChange={(v) => setSortOrderParam(v)}
  //                       >
  //                         <SelectTrigger className="w-[120px]">
  //                           <SelectValue />
  //                         </SelectTrigger>
  //                         <SelectContent>
  //                           <SelectItem value="desc">Desc</SelectItem>
  //                           <SelectItem value="asc">Asc</SelectItem>
  //                         </SelectContent>
  //                       </Select>
  //                     </div>
  //                   </div>
  //                 </div>

  //                 {/* List */}
  //                 {isLoading ? (
  //                   <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
  //                     {Array.from({ length: 6 }).map((_, i) => (
  //                       <Card
  //                         key={i}
  //                         className="bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
  //                       >
  //                         <CardContent className="p-0">
  //                           <div className="grid grid-cols-2 gap-1">
  //                             <Skeleton className="col-span-2 w-full h-56" />
  //                             <Skeleton className="w-full h-28" />
  //                             <Skeleton className="w-full h-28" />
  //                           </div>
  //                           <div className="p-6 space-y-5">
  //                             <div className="flex justify-between items-start">
  //                               <div className="space-y-2">
  //                                 <Skeleton className="h-6 w-32" />
  //                                 <Skeleton className="h-4 w-24" />
  //                               </div>
  //                               <div className="text-right">
  //                                 <Skeleton className="h-10 w-16 mb-1" />
  //                                 <Skeleton className="h-3 w-20" />
  //                               </div>
  //                             </div>
  //                             <Skeleton className="h-20 w-full rounded-xl" />
  //                             <div className="grid grid-cols-2 gap-3">
  //                               <Skeleton className="h-14 w-full" />
  //                               <Skeleton className="h-14 w-full" />
  //                             </div>
  //                             <div className="flex gap-3">
  //                               <Skeleton className="h-11 flex-1 rounded-full" />
  //                               <Skeleton className="h-11 flex-1 rounded-full" />
  //                             </div>
  //                           </div>
  //                         </CardContent>
  //                       </Card>
  //                     ))}
  //                   </div>
  //                 ) : isError ? (
  //                   <div className="text-center py-8">
  //                     <p className="text-destructive text-sm">
  //                       Error loading applications: {error?.message}
  //                     </p>
  //                     <p className="text-muted-foreground text-xs mt-1">
  //                       Please try again later
  //                     </p>
  //                   </div>
  //                 ) : applications.length === 0 ? (
  //                   <div className="flex flex-col items-center justify-center py-16 px-4">
  //                     <div className="mb-6 opacity-20">
  //                       <GlowSymbol className="w-16 h-16" />
  //                     </div>
  //                     <div className="text-center max-w-md">
  //                       <h3
  //                         className="text-lg font-semibold mb-2"
  //                         style={{
  //                           fontFamily: "Söhne, sans-serif",
  //                           fontWeight: 600,
  //                         }}
  //                       >
  //                         {selectedZoneId
  //                           ? "No applications in this zone"
  //                           : "No applications available"}
  //                       </h3>
  //                       <p className="text-muted-foreground text-sm">
  //                         {selectedZoneId
  //                           ? "Try selecting a different zone or check back later for new farm applications."
  //                           : "Check back later for new solar farm sponsorship opportunities."}
  //                       </p>
  //                       {selectedZoneId && (
  //                         <Button
  //                           variant="outline"
  //                           className="mt-4"
  //                           onClick={() => setZoneParam(null)}
  //                         >
  //                           View All Zones
  //                         </Button>
  //                       )}
  //                     </div>
  //                   </div>
  //                 ) : (
  //                   <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
  //                     {applications.map((application) => {
  //                       const displayCurrency = selectedCurrency || "USDG";
  //                       const depositAmountInCurrency =
  //                         calculateProtocolDepositAmount(
  //                           application.finalProtocolFee,
  //                           application.applicationPriceQuotes,
  //                           displayCurrency
  //                         );
  //                       const availableCurrencies = getAvailableCurrencies(
  //                         application.applicationPriceQuotes
  //                       );

  //                       const rewardScore = getRewardScoreForApplication(
  //                         rewardScoreMap,
  //                         application.id
  //                       );

  //                       return (
  //                         <Card
  //                           key={application.id}
  //                           className="bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 overflow-hidden pt-0"
  //                         >
  //                           <CardContent className="p-0">
  //                             {/* Images */}
  //                             <div className="relative">
  //                               {/* Zone Badge */}
  //                               <div className="absolute top-3 left-3 z-10">
  //                                 <div className="bg-black/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium">
  //                                   {application.zone.name}
  //                                 </div>
  //                               </div>

  //                               {application.afterInstallPictures.length > 0 ? (
  //                                 <div className="grid grid-cols-2 gap-1">
  //                                   <div className="col-span-2 relative">
  //                                     <img
  //                                       src={
  //                                         application.afterInstallPictures[0]
  //                                           ?.url ||
  //                                         "/images/sections/residential.jpg"
  //                                       }
  //                                       alt={`${application.zone.name} main`}
  //                                       className="w-full h-56 object-cover"
  //                                     />
  //                                     <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
  //                                   </div>
  //                                   <img
  //                                     src={
  //                                       application.afterInstallPictures[1]
  //                                         ?.url ||
  //                                       "/images/sections/residential.jpg"
  //                                     }
  //                                     alt={`${application.zone.name} alt 1`}
  //                                     className="w-full h-28 object-cover"
  //                                   />
  //                                   <img
  //                                     src={
  //                                       application.afterInstallPictures[2]
  //                                         ?.url ||
  //                                       "/images/sections/residential.jpg"
  //                                     }
  //                                     alt={`${application.zone.name} alt 2`}
  //                                     className="w-full h-28 object-cover"
  //                                   />
  //                                 </div>
  //                               ) : (
  //                                 <div className="grid grid-cols-2 gap-1">
  //                                   <div className="col-span-2 relative">
  //                                     <div className="w-full h-56 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
  //                                       <span className="text-gray-400">
  //                                         No images available
  //                                       </span>
  //                                     </div>
  //                                   </div>
  //                                   <div className="w-full h-28 bg-gray-100 dark:bg-gray-900"></div>
  //                                   <div className="w-full h-28 bg-gray-100 dark:bg-gray-900"></div>
  //                                 </div>
  //                               )}
  //                             </div>

  //                             <div className="p-6 space-y-5">
  //                               {/* Header with Fractions Available and Reward Score */}
  //                               <div className="flex items-start justify-between">
  //                                 <div className="flex-1 min-w-0">
  //                                   <div
  //                                     className="text-3xl lg:text-4xl leading-none mb-1"
  //                                     style={{
  //                                       fontFamily: "Duplicate Slab, serif",
  //                                       fontWeight: 300,
  //                                     }}
  //                                   >
  //                                     {application.activeFraction
  //                                       ? `${
  //                                           application.activeFraction
  //                                             .remainingSteps || 0
  //                                         }/${
  //                                           application.activeFraction
  //                                             .totalSteps
  //                                         }`
  //                                       : "0/0"}
  //                                   </div>
  //                                   <div
  //                                     className="text-xs uppercase tracking-wider text-gray-500"
  //                                     style={{
  //                                       fontFamily: "Söhne, sans-serif",
  //                                       fontWeight: 600,
  //                                     }}
  //                                   >
  //                                     Shares Available
  //                                   </div>
  //                                 </div>
  //                                 {/* Reward Score */}
  //                                 <div className="text-right ml-4">
  //                                   <div
  //                                     className="text-3xl lg:text-4xl leading-none mb-1"
  //                                     style={{
  //                                       fontFamily: "Duplicate Slab, serif",
  //                                       fontWeight: 300,
  //                                     }}
  //                                   >
  //                                     {rewardScore?.rewardScore
  //                                       ? rewardScore.rewardScore.toFixed(0)
  //                                       : isRewardScoresLoading
  //                                       ? "..."
  //                                       : "0"}
  //                                   </div>
  //                                   <div
  //                                     className="text-xs uppercase tracking-wider text-gray-500"
  //                                     style={{
  //                                       fontFamily: "Söhne, sans-serif",
  //                                       fontWeight: 600,
  //                                     }}
  //                                   >
  //                                     Reward Score
  //                                   </div>
  //                                 </div>
  //                               </div>

  //                               <div className="grid grid-cols-2 gap-4">
  //                                 {/* Step Price - Left Column */}
  //                                 <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
  //                                   <div
  //                                     className="text-sm text-gray-600 dark:text-gray-400 mb-2"
  //                                     style={{
  //                                       fontFamily: "Söhne, sans-serif",
  //                                       fontWeight: 400,
  //                                     }}
  //                                   >
  //                                     Price per share
  //                                   </div>
  //                                   {application.activeFraction?.step ? (
  //                                     <div>
  //                                       <div
  //                                         className="text-2xl lg:text-3xl text-black dark:text-white"
  //                                         style={{
  //                                           fontFamily: "Söhne, sans-serif",
  //                                           fontWeight: 600,
  //                                         }}
  //                                       >
  //                                         {formatNumber(
  //                                           parseFloat(
  //                                             formatUnits(
  //                                               BigInt(
  //                                                 application.activeFraction
  //                                                   .step
  //                                               ),
  //                                               DECIMALS_BY_TOKEN["GLW"]
  //                                             )
  //                                           ),
  //                                           0
  //                                         )}{" "}
  //                                         <span className="text-lg font-normal">
  //                                           GLW
  //                                         </span>
  //                                       </div>
  //                                     </div>
  //                                   ) : depositAmountInCurrency ? (
  //                                     <div>
  //                                       <div
  //                                         className="text-2xl lg:text-3xl text-black dark:text-white"
  //                                         style={{
  //                                           fontFamily: "Söhne, sans-serif",
  //                                           fontWeight: 600,
  //                                         }}
  //                                       >
  //                                         {formatNumber(
  //                                           parseFloat(depositAmountInCurrency),
  //                                           0
  //                                         )}{" "}
  //                                         <span className="text-lg font-normal">
  //                                           {displayCurrency}
  //                                         </span>
  //                                       </div>
  //                                       <div
  //                                         className="text-sm text-gray-500 dark:text-gray-500 mt-1"
  //                                         style={{
  //                                           fontFamily: "Söhne, sans-serif",
  //                                           fontWeight: 300,
  //                                         }}
  //                                       >
  //                                         Full sponsorship
  //                                       </div>
  //                                     </div>
  //                                   ) : (
  //                                     <div
  //                                       className="text-lg text-gray-500"
  //                                       style={{
  //                                         fontFamily: "Söhne, sans-serif",
  //                                         fontWeight: 300,
  //                                       }}
  //                                     >
  //                                       Price not available
  //                                     </div>
  //                                   )}
  //                                 </div>

  //                                 <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
  //                                   <div
  //                                     className="text-sm text-gray-600 dark:text-gray-400 mb-2"
  //                                     style={{
  //                                       fontFamily: "Söhne, sans-serif",
  //                                       fontWeight: 400,
  //                                     }}
  //                                   >
  //                                     Est. Weekly Rewards per share
  //                                   </div>
  //                                   <div>
  //                                     <div
  //                                       className="text-lg lg:text-xl text-black dark:text-white"
  //                                       style={{
  //                                         fontFamily: "Söhne, sans-serif",
  //                                         fontWeight: 600,
  //                                       }}
  //                                     >
  //                                       {rewardScore?.userWeeklyGlwRewards &&
  //                                       rewardScore?.userWeeklyPdRewards &&
  //                                       application.activeFraction?.totalSteps
  //                                         ? (() => {
  //                                             const glwRewards = parseFloat(
  //                                               formatUnits(
  //                                                 BigInt(
  //                                                   rewardScore.userWeeklyGlwRewards
  //                                                 ),
  //                                                 DECIMALS_BY_TOKEN["GLW"]
  //                                               )
  //                                             );
  //                                             const pdRewards = parseFloat(
  //                                               formatUnits(
  //                                                 BigInt(
  //                                                   rewardScore.userWeeklyPdRewards
  //                                                 ),
  //                                                 DECIMALS_BY_TOKEN["GLW"] // Assuming PD rewards are also in GLW
  //                                               )
  //                                             );
  //                                             const totalRewards =
  //                                               glwRewards + pdRewards;
  //                                             const totalShares =
  //                                               application.activeFraction
  //                                                 .totalSteps;
  //                                             const rewardsPerShare =
  //                                               totalRewards / totalShares;
  //                                             return `${rewardsPerShare.toLocaleString(
  //                                               undefined,
  //                                               {
  //                                                 minimumFractionDigits: 2,
  //                                                 maximumFractionDigits: 2,
  //                                               }
  //                                             )} GLW`;
  //                                           })()s
  //                                         : isRewardScoresLoading
  //                                         ? "..."
  //                                         : "0 GLW"}
  //                                       <span className="text-base text-gray-500 dark:text-gray-500 ml-2 font-normal">
  //                                         ≈
  //                                         {rewardScore?.userEstimatedWeeklyCash &&
  //                                         application.activeFraction?.totalSteps
  //                                           ? (() => {
  //                                               const totalCash = parseFloat(
  //                                                 formatUnits(
  //                                                   BigInt(
  //                                                     rewardScore.userEstimatedWeeklyCash
  //                                                   ),
  //                                                   6 // USDC decimals for cash estimates
  //                                                 )
  //                                               );
  //                                               const totalShares =
  //                                                 application.activeFraction
  //                                                   .totalSteps;
  //                                               const cashPerShare =
  //                                                 totalCash / totalShares;
  //                                               return `$${cashPerShare.toLocaleString(
  //                                                 undefined,
  //                                                 {
  //                                                   minimumFractionDigits: 2,
  //                                                   maximumFractionDigits: 2,
  //                                                 }
  //                                               )}`;
  //                                             })()
  //                                           : isRewardScoresLoading
  //                                           ? "..."
  //                                           : "$0"}
  //                                       </span>
  //                                     </div>
  //                                   </div>
  //                                 </div>
  //                               </div>

  //                               {/* Owned Fractions Display */}
  //                               {isConnected && address && (
  //                                 <OwnedFractionsDisplay
  //                                   application={application}
  //                                   walletAddress={address}
  //                                 />
  //                               )}

  //                               {/* CTAs */}
  //                               <div className="flex items-center gap-3">
  //                                 <Button
  //                                   className="flex-1 rounded-full h-11"
  //                                   onClick={() => onPayDeposit(application)}
  //                                   disabled={
  //                                     application.activeFraction
  //                                       ? application.activeFraction.isFilled ||
  //                                         (application.activeFraction
  //                                           .remainingSteps || 0) <= 0
  //                                       : !depositAmountInCurrency
  //                                   }
  //                                 >
  //                                   <span
  //                                     style={{
  //                                       fontFamily: "Söhne, sans-serif",
  //                                       fontWeight: 400,
  //                                     }}
  //                                   >
  //                                     {application.activeFraction?.isFilled
  //                                       ? "Fully Funded"
  //                                       : (application.activeFraction
  //                                           ?.remainingSteps || 0) <= 0
  //                                       ? "No Shares Available"
  //                                       : "Buy Shares"}
  //                                   </span>
  //                                 </Button>
  //                               </div>
  //                             </div>
  //                           </CardContent>
  //                         </Card>
  //                       );
  //                     })}
  //                   </div>
  //                 )}
  //               </div>
  //             </TabsContent>

  //             <TabsContent value="activity" className="mt-0">
  //               <SponsoredFarmsActivity />
  //             </TabsContent>
  //           </Tabs>
  //         </div>

  //         {/* Deposit Dialog */}
  //         <DepositDialog
  //           open={dialogOpen}
  //           onOpenChange={setDialogOpen}
  //           application={selectedApplicationForDeposit}
  //           selectedCurrency={"GLW"}
  //         />
  //       </div>
  //     </div>
  //   </>
  // );
}
