"use client";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Lock,
  Unlock,
  Users,
  MapPin,
  Zap,
  ArrowRight,
  X,
  Loader2,
} from "lucide-react";
import { formatUnits } from "viem";
import { Region } from "@glowlabs-org/utils/browser";

interface RegionSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRegion: (regionId: number) => void;
  onSkipStaking: () => void;
  regions: Region[];
  isRegionsLoading: boolean;
  usdcAmount: string;
  gctlAmount: string;
  isProcessing?: boolean;
}

export function RegionSelectionModal({
  isOpen,
  onClose,
  onSelectRegion,
  onSkipStaking,
  regions,
  isRegionsLoading,
  usdcAmount,
  gctlAmount,
  isProcessing = false,
}: RegionSelectionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card rounded-2xl p-0 max-w-5xl max-h-[95vh] border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-border/10">
          <div className="flex items-center justify-between">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-2xl font-bold flex items-center text-foreground">
                <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center mr-3">
                  <Zap className="w-5 h-5 text-primary-foreground" />
                </div>
                Choose Your Purchase Type
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground max-w-2xl">
                You&apos;re purchasing {gctlAmount} GCTL with {usdcAmount} USDC.
                Choose to mint only or stake to a region for rewards.
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="ghost"
              size="sm"
              onClick={!isProcessing ? onClose : undefined}
              className="h-10 w-10 rounded-full hover:bg-muted/80"
              disabled={isProcessing}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6 overflow-y-auto max-h-[calc(95vh-120px)]">
          <div className="space-y-8">
            {/* Purchase Summary */}
            <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-2xl p-6 border border-blue-200/50">
              <div className="flex items-center justify-center space-x-6">
                <div className="text-center">
                  <div className="size-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <span className="text-white font-bold text-lg">$</span>
                  </div>
                  <div className="text-sm text-blue-600/80 font-medium">
                    Spending
                  </div>
                  <div className="text-xl font-bold text-blue-900">
                    {usdcAmount} USDC
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <ArrowRight className="w-5 h-5 text-blue-400" />
                  </div>
                </div>

                <div className="text-center">
                  <div className="size-16 glow-gradient rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <span className="text-glow-black font-bold text-lg">
                      GCTL
                    </span>
                  </div>
                  <div className="text-sm text-green-600/80 font-medium">
                    Receiving
                  </div>
                  <div className="text-xl font-bold text-green-900">
                    {gctlAmount} GCTL
                  </div>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-6">
              {/* Mint Only Option */}
              <div className="group">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-bold text-muted-foreground">
                      1
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Mint GCTL Only
                  </h3>
                </div>

                <Card
                  className="border-2 border-muted hover:border-primary/30 transition-all duration-200 cursor-pointer hover:shadow-lg bg-gradient-to-r from-gray-50/50 to-slate-50/50 group-hover:from-gray-50 group-hover:to-slate-50"
                  onClick={!isProcessing ? onSkipStaking : undefined}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                          <span className="text-2xl">💰</span>
                        </div>
                        <div>
                          <div className="font-semibold text-lg text-foreground">
                            Mint GCTL Only
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Receive GCTL tokens without staking
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="h-11 px-6 font-semibold hover:bg-primary hover:text-primary-foreground border-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isProcessing) onSkipStaking();
                        }}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <div className="flex items-center">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Processing...
                          </div>
                        ) : (
                          "Mint Only"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Regions Section */}
              <div className="space-y-4">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-bold text-primary-foreground">
                      2
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-foreground">
                      Mint & Stake to a Region
                    </h3>
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary border-primary/20 text-xs px-2 py-1"
                    >
                      Recommended
                    </Badge>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground mb-6 ml-11">
                  Stake your GCTL to support renewable energy projects and earn
                  rewards (~2 year lock period)
                </div>

                {isRegionsLoading ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 ml-11">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-32 rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 ml-11 max-h-80 overflow-y-auto pr-2">
                    {regions.map((region) => {
                      const regionStake = parseFloat(
                        formatUnits(BigInt("0"), 6)
                      );

                      return (
                        <Card
                          key={region.id}
                          className={`cursor-pointer transition-all duration-200 hover:shadow-xl border border-border hover:border-primary/50 hover:bg-primary/5 group ${
                            isProcessing ? "opacity-60 pointer-events-none" : ""
                          }`}
                          onClick={
                            !isProcessing
                              ? () => onSelectRegion(region.id)
                              : undefined
                          }
                        >
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div>
                                  <div className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                                    {region.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center mt-1">
                                    <Users className="w-3 h-3 mr-1" />0 farms
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex justify-between items-center p-3 bg-muted/40 rounded-lg group-hover:bg-muted/60 transition-colors">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Total Staked
                                </span>
                                <span className="text-sm font-semibold text-foreground">
                                  {regionStake.toLocaleString(undefined, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })}{" "}
                                  GCTL
                                </span>
                              </div>

                              <Button
                                size="sm"
                                className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm rounded-lg group-hover:shadow-md transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isProcessing) onSelectRegion(region.id);
                                }}
                                disabled={isProcessing}
                              >
                                {isProcessing ? (
                                  <div className="flex items-center">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Processing...
                                  </div>
                                ) : (
                                  <>
                                    <Zap className="w-4 h-4 mr-2" />
                                    Mint & Stake Here
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="bg-blue-50/50 border border-blue-200/50 rounded-2xl p-6">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center mt-1 flex-shrink-0">
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
                  <h4 className="font-semibold text-blue-900 text-base">
                    Important Notes
                  </h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex items-start space-x-3">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <p>Stakes are locked for 100 epochs (~2 years)</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <p>
                        Staking supports renewable energy projects in your
                        selected region
                      </p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <p>
                        You can always stake your GCTL later if you choose to
                        mint only
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-border/10 bg-muted/20">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {isProcessing ? (
                <div className="flex items-center">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing your transaction...
                </div>
              ) : (
                "Choose your option above to complete the purchase"
              )}
            </div>
            <Button
              variant="outline"
              onClick={!isProcessing ? onClose : undefined}
              className="h-10 px-6 font-medium hover:bg-muted/80"
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Cancel Purchase"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
