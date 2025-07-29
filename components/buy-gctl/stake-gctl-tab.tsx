"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Lock,
  Unlock,
  TrendingUp,
  ArrowUpRight,
  Users,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { parseUnits, formatUnits } from "viem";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { useGctlApi } from "@/hooks/useGctlApi";
import { ConnectButton } from "@/components/connect-button";

export function StakeGctlTab() {
  const { address, isConnected } = useAccount();

  const {
    gctlBalance,
    regions,
    isRegionsLoading,
    isGctlBalanceLoading,
    stakeGctl,
    unstakeGctl,
    isStaking,
    isUnstaking,
    useRegionStake,
    useWalletRegionStake,
    useWalletRegionUnlocked,
  } = useGctlApi(address);

  // Staking-related state
  const [stakeAmount, setStakeAmount] = useState<string>("");
  const [unstakeAmount, setUnstakeAmount] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<number>(-1); // -1 indicates no region selected

  // Use React Query hooks for the selected region data (only when a region is selected)
  const { data: regionStakeData, isLoading: isRegionStakeLoading } =
    useRegionStake(selectedRegion >= 0 ? selectedRegion : 0);
  const { data: walletStakeData, isLoading: isWalletStakeLoading } =
    useWalletRegionStake(selectedRegion >= 0 ? selectedRegion : 0);
  const { data: walletUnlockedData, isLoading: isWalletUnlockedLoading } =
    useWalletRegionUnlocked(selectedRegion >= 0 ? selectedRegion : 0);

  // Calculate available amounts
  const availableToStake = parseFloat(formatUnits(BigInt(gctlBalance), 6));
  const availableToUnstake = parseFloat(
    formatUnits(BigInt(walletUnlockedData?.unlocked || "0"), 6)
  );
  const currentStakeFormatted = parseFloat(
    formatUnits(BigInt(walletStakeData?.currentGctlStake || "0"), 6)
  );

  // Check if a valid region is selected
  const isRegionSelected =
    selectedRegion >= 0 && regions.some((r) => r.id === selectedRegion);

  // Combined loading states for better UX
  const isWalletDataLoading = isWalletStakeLoading || isWalletUnlockedLoading;
  const isAnyOperationPending = isStaking || isUnstaking;

  // Get selected region data
  const selectedRegionData = regions.find((r) => r.id === selectedRegion);

  // Handle staking
  const handleStake = async () => {
    if (!stakeAmount || !address) return;

    try {
      const amountWei = parseUnits(stakeAmount, 6).toString();
      console.log("amountWei", amountWei);
      console.log("selectedRegion", selectedRegion);
      const result = await stakeGctl(selectedRegion, amountWei);

      if (result.ok) {
        const selectedRegionName = regions.find(
          (r) => r.id === selectedRegion
        )?.name;
        toast.success(
          `Successfully staked ${stakeAmount} GCTL to ${selectedRegionName}`
        );
        setStakeAmount("");
      } else {
        toast.error(`Failed to stake: ${result.val}`);
      }
    } catch (error) {
      toast.error("Staking failed");
      console.error("Staking error:", error);
    }
  };

  // Handle unstaking
  const handleUnstake = async () => {
    if (!unstakeAmount || !address) return;

    try {
      const amountWei = parseUnits(unstakeAmount, 6).toString();
      const result = await unstakeGctl(selectedRegion, amountWei);

      if (result.ok) {
        const selectedRegionName = regions.find(
          (r) => r.id === selectedRegion
        )?.name;
        toast.success(
          `Successfully unstaked ${unstakeAmount} GCTL from ${selectedRegionName}`
        );
        setUnstakeAmount("");
      } else {
        toast.error(`Failed to unstake: ${result.val}`);
      }
    } catch (error) {
      toast.error("Unstaking failed");
      console.error("Unstaking error:", error);
    }
  };

  // Handle MAX button clicks
  const handleMaxStake = () => {
    setStakeAmount(availableToStake.toString());
  };

  const handleMaxUnstake = () => {
    setUnstakeAmount(availableToUnstake.toString());
  };

  // Validation functions
  const getStakeValidation = () => {
    if (!stakeAmount) return null;
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0)
      return { type: "error", message: "Please enter a valid amount" };
    if (amount > availableToStake)
      return { type: "error", message: "Insufficient GCTL balance" };
    return {
      type: "success",
      message: `Ready to stake ${amount.toLocaleString()} GCTL`,
    };
  };

  const getUnstakeValidation = () => {
    if (!unstakeAmount) return null;
    const amount = parseFloat(unstakeAmount);
    if (isNaN(amount) || amount <= 0)
      return { type: "error", message: "Please enter a valid amount" };
    if (amount > availableToUnstake)
      return { type: "error", message: "Insufficient unlocked GCTL" };
    return {
      type: "success",
      message: `Ready to unstake ${amount.toLocaleString()} GCTL`,
    };
  };

  const stakeValidation = getStakeValidation();
  const unstakeValidation = getUnstakeValidation();

  return (
    <Card className="border border-border bg-white/95 backdrop-blur-sm w-full">
      <CardHeader className="pb-6 border-b border-border/50">
        <CardTitle className="text-2xl font-bold text-foreground flex items-center">
          Stake GCTL
        </CardTitle>
        <div className="text-muted-foreground">
          Stake your GCTL tokens to support renewable energy projects and earn
          rewards
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-8">
        {/* Balance Overview - Enhanced Design */}
        {isConnected && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4 text-center">
                <div className="text-sm font-medium text-blue-700 mb-2">
                  Available to Stake
                </div>
                {isGctlBalanceLoading ? (
                  <Skeleton className="h-8 w-32 mx-auto" />
                ) : (
                  <div className="text-2xl font-bold text-blue-900">
                    {availableToStake.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                )}
                <div className="text-xs text-blue-600 mt-1">GCTL</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4 text-center">
                <div className="text-sm font-medium text-green-700 mb-2">
                  Your Total Stake
                </div>
                {isWalletStakeLoading && isRegionSelected ? (
                  <Skeleton className="h-8 w-32 mx-auto" />
                ) : (
                  <div className="text-2xl font-bold text-green-900">
                    {currentStakeFormatted.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                )}
                <div className="text-xs text-green-600 mt-1">GCTL</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-4 text-center">
                <div className="text-sm font-medium text-orange-700 mb-2">
                  Available to Unstake
                </div>
                {isWalletUnlockedLoading && isRegionSelected ? (
                  <Skeleton className="h-8 w-32 mx-auto" />
                ) : (
                  <div className="text-2xl font-bold text-orange-900">
                    {availableToUnstake.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                )}
                <div className="text-xs text-orange-600 mt-1">GCTL</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Region Selection - Enhanced Design */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-semibold text-foreground flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-primary" />
              Choose a Region
            </Label>
            {selectedRegionData && (
              <Badge variant="outline" className="px-3 py-1">
                {selectedRegionData.flag} {selectedRegionData.name}
              </Badge>
            )}
          </div>

          {isRegionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regions.map((region) => {
                const isSelected = selectedRegion === region.id;
                const regionStake = parseFloat(
                  formatUnits(BigInt(region.currentGctlStake || "0"), 6)
                );

                return (
                  <Card
                    key={region.id}
                    className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                      isSelected
                        ? "ring-2 ring-primary border-primary bg-primary/5 shadow-lg"
                        : "border-border hover:border-primary/50 hover:bg-primary/2"
                    } ${
                      isAnyOperationPending
                        ? "opacity-75 pointer-events-none"
                        : ""
                    }`}
                    onClick={() => setSelectedRegion(region.id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-3xl">{region.flag}</span>
                          <div>
                            <div className="font-bold text-lg text-foreground">
                              {region.name}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center mt-1">
                              <Users className="w-3 h-3 mr-1" />
                              {region.solarFarmCount}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          {region.isActive ? (
                            <Badge className="bg-green-600 hover:bg-green-700">
                              <Unlock className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Lock className="w-3 h-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm font-medium text-muted-foreground">
                            Total Staked
                          </span>
                          <span className="text-lg font-bold text-foreground">
                            {regionStake.toLocaleString(undefined, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}{" "}
                            <span className="text-sm font-normal text-muted-foreground">
                              GCTL
                            </span>
                          </span>
                        </div>

                        {isSelected && (
                          <div className="flex items-center justify-center pt-2 text-primary">
                            <ArrowUpRight className="w-4 h-4 mr-1" />
                            <span className="text-sm font-medium">
                              Selected Region
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Staking Actions */}
        {isRegionSelected ? (
          <div className="space-y-8">
            {/* Loading overlay for wallet data when region changes */}
            {isWalletDataLoading && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
                <p className="text-muted-foreground">Loading region data...</p>
              </div>
            )}

            {!isWalletDataLoading && (
              <>
                {/* Stake Section */}
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-green-800 flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      Stake GCTL
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="Enter amount to stake"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        className={`h-16 text-xl font-medium pr-20 border-2 transition-all duration-200 bg-white ${
                          stakeValidation?.type === "error"
                            ? "border-red-400 focus:border-red-500"
                            : stakeValidation?.type === "success"
                            ? "border-green-400 focus:border-green-500"
                            : "border-green-300 focus:border-green-500"
                        }`}
                        disabled={
                          !isConnected ||
                          isRegionsLoading ||
                          isWalletDataLoading ||
                          isAnyOperationPending
                        }
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleMaxStake}
                          className="h-10 px-4 text-sm font-medium text-green-700 hover:text-green-800 hover:bg-green-100 border-green-300 hover:border-green-400"
                          disabled={
                            !isConnected ||
                            availableToStake === 0 ||
                            isGctlBalanceLoading ||
                            isAnyOperationPending
                          }
                        >
                          {isGctlBalanceLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "MAX"
                          )}
                        </Button>
                      </div>
                    </div>

                    {stakeValidation && (
                      <div
                        className={`text-sm flex items-center space-x-2 p-3 rounded-lg ${
                          stakeValidation.type === "error"
                            ? "bg-red-50 border border-red-200 text-red-700"
                            : "bg-green-50 border border-green-200 text-green-700"
                        }`}
                      >
                        <span>
                          {stakeValidation.type === "error" ? "⚠️" : "✓"}
                        </span>
                        <span>{stakeValidation.message}</span>
                      </div>
                    )}

                    <Button
                      onClick={handleStake}
                      disabled={
                        !isConnected ||
                        !stakeAmount ||
                        isStaking ||
                        isRegionsLoading ||
                        isWalletDataLoading ||
                        isGctlBalanceLoading ||
                        stakeValidation?.type === "error"
                      }
                      className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-semibold text-lg rounded-xl transition-all duration-200 hover:scale-[1.02]"
                    >
                      {isStaking ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-3" />
                          Staking...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-5 h-5 mr-3" />
                          Stake {stakeAmount || "0"} GCTL
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Unstake Section */}
                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-orange-800 flex items-center">
                      <Unlock className="w-5 h-5 mr-2" />
                      Unstake GCTL
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="Enter amount to unstake"
                        value={unstakeAmount}
                        onChange={(e) => setUnstakeAmount(e.target.value)}
                        className={`h-16 text-xl font-medium pr-20 border-2 transition-all duration-200 bg-white ${
                          unstakeValidation?.type === "error"
                            ? "border-red-400 focus:border-red-500"
                            : unstakeValidation?.type === "success"
                            ? "border-orange-400 focus:border-orange-500"
                            : "border-orange-300 focus:border-orange-500"
                        }`}
                        disabled={
                          !isConnected ||
                          isRegionsLoading ||
                          isWalletDataLoading ||
                          isAnyOperationPending
                        }
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleMaxUnstake}
                          className="h-10 px-4 text-sm font-medium text-orange-700 hover:text-orange-800 hover:bg-orange-100 border-orange-300 hover:border-orange-400"
                          disabled={
                            !isConnected ||
                            availableToUnstake === 0 ||
                            isWalletUnlockedLoading ||
                            isAnyOperationPending
                          }
                        >
                          {isWalletUnlockedLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "MAX"
                          )}
                        </Button>
                      </div>
                    </div>

                    {unstakeValidation && (
                      <div
                        className={`text-sm flex items-center space-x-2 p-3 rounded-lg ${
                          unstakeValidation.type === "error"
                            ? "bg-red-50 border border-red-200 text-red-700"
                            : "bg-orange-50 border border-orange-200 text-orange-700"
                        }`}
                      >
                        <span>
                          {unstakeValidation.type === "error" ? "⚠️" : "✓"}
                        </span>
                        <span>{unstakeValidation.message}</span>
                      </div>
                    )}

                    <Button
                      onClick={handleUnstake}
                      disabled={
                        !isConnected ||
                        !unstakeAmount ||
                        isUnstaking ||
                        isRegionsLoading ||
                        isWalletDataLoading ||
                        unstakeValidation?.type === "error"
                      }
                      variant="destructive"
                      className="w-full h-14 font-semibold text-lg rounded-xl transition-all duration-200 hover:scale-[1.02]"
                    >
                      {isUnstaking ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-3" />
                          Unstaking...
                        </>
                      ) : (
                        <>
                          <Unlock className="w-5 h-5 mr-3" />
                          Unstake {unstakeAmount || "0"} GCTL
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        ) : (
          /* No Region Selected Message */
          <div className="text-center py-12 space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary/10 to-primary/20 rounded-full flex items-center justify-center">
              <MapPin className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-foreground">
                Select a Region to Start Staking
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                Choose a region above to stake your GCTL tokens and participate
                in the network&apos;s growth.
              </p>
            </div>
          </div>
        )}

        {/* Enhanced Info Section */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mt-1 flex-shrink-0">
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="space-y-3">
                <h4 className="font-bold text-blue-900 text-lg">
                  Important Staking Information
                </h4>
                <div className="space-y-2 text-blue-800">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>
                      Stakes are locked for{" "}
                      <span className="font-semibold">
                        100 epochs (~2 years)
                      </span>
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>
                      You can only unstake unlocked amounts from previous stakes
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>
                      Staking supports renewable energy projects in your
                      selected region
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p>
                      Need GCTL tokens? Use the{" "}
                      <span className="font-semibold">Buy GCTL</span> tab to
                      purchase and optionally stake in one transaction
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
