"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TrendingUp, Info, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface RestakeAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  regionYields: Array<{
    region: string;
    yield: string;
    unretiredCredits: string;
    purchasePrice: string;
    userStake: string;
  }>;
}

export function RestakeAssistant({
  isOpen,
  onClose,
  regionYields,
}: RestakeAssistantProps) {
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [restakeAmount, setRestakeAmount] = useState("1000");
  const [showAllRegions, setShowAllRegions] = useState(false);

  // Sort regions by yield (highest first)
  const sortedRegions = [...regionYields].sort(
    (a, b) =>
      parseFloat(b.yield.replace(/,/g, "")) -
      parseFloat(a.yield.replace(/,/g, ""))
  );

  const displayedRegions = showAllRegions
    ? sortedRegions
    : sortedRegions.slice(0, 3);

  // Estimation helpers to reflect region share of weekly 175k GLW
  function parseNum(value: string): number {
    return parseFloat((value || "0").replace(/,/g, "")) || 0;
  }

  function estimateRegionStake(region: { userStake: string }): number {
    const user = parseNum(region.userStake);
    if (user > 0) return user * 10; // heuristic for demo
    return 5000; // baseline when no stake
  }

  const estimatedStakeByRegion = regionYields.reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.region] = estimateRegionStake(r);
      return acc;
    },
    {}
  );

  const estimatedTotalStake = Object.values(estimatedStakeByRegion).reduce(
    (a, b) => a + b,
    0
  );

  function computeRegionShare(regionName: string, extraStake: number = 0) {
    const base = estimatedStakeByRegion[regionName] || 0;
    const total = estimatedTotalStake + extraStake;
    if (total <= 0) return { sharePct: 0, weeklyGlw: 0 };
    const regionStake = base + extraStake;
    const sharePct = (regionStake / total) * 100;
    const weeklyGlw = (sharePct / 100) * 175_000;
    return { sharePct, weeklyGlw };
  }

  const handleRegionSelect = (region: string) => {
    setRestakeAmount("0");
    setSelectedRegion(region);
  };

  const handleRestake = () => {
    if (!selectedRegion) {
      toast.error("Please select a region");
      return;
    }
    const selected = regionYields.find((r) => r.region === selectedRegion);
    const maxStake = selected
      ? parseFloat(selected.userStake.replace(/,/g, "")) || 0
      : 0;
    const amount = parseFloat(restakeAmount || "0");
    if (amount <= 0) {
      toast.error("Enter an amount to restake");
      return;
    }
    if (amount > maxStake) {
      toast.error("Amount exceeds staked in selected region");
      return;
    }
    toast.success(`Restaking ${restakeAmount} GCTL`, {
      description: `To region: ${selectedRegion}`,
    });
    onClose();
  };
  const selectedRegionData = regionYields.find(
    (r) => r.region === selectedRegion
  );
  const maxStakeForSelected = selectedRegionData
    ? parseFloat(selectedRegionData.userStake.replace(/,/g, "")) || 0
    : 0;
  const restakeDisabled =
    !selectedRegion ||
    parseFloat(restakeAmount || "0") <= 0 ||
    parseFloat(restakeAmount || "0") > maxStakeForSelected;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Restake Assistant</DialogTitle>
          <DialogDescription>
            Move your GCTL to the best performing region
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* Compare Regions Table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Compare Regions</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllRegions(!showAllRegions)}
              >
                {showAllRegions ? "Show Top 3" : "Show All Regions"}
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <RadioGroup
                value={selectedRegion}
                onValueChange={handleRegionSelect}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          Region Share of 175k/wk
                        </div>
                      </TableHead>
                      <TableHead>Unbinded Credits</TableHead>

                      <TableHead>Your Stake</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedRegions.map((region, idx) => (
                      <TableRow key={region.region}>
                        <TableCell>
                          <RadioGroupItem
                            value={region.region}
                            id={`r-${region.region}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {region.region}
                            {idx === 0 && (
                              <Badge variant="default" className="text-xs">
                                TOP
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-green-600">
                          {computeRegionShare(region.region).sharePct.toFixed(
                            2
                          )}
                          %
                        </TableCell>
                        <TableCell>{region.unretiredCredits}</TableCell>

                        <TableCell>
                          {region.userStake === "0" ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <span className="font-medium">
                              {region.userStake}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </RadioGroup>
            </div>
          </div>

          {/* Restake Configuration */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount to Restake</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="amount"
                  type="number"
                  value={restakeAmount}
                  onChange={(e) => setRestakeAmount(e.target.value)}
                  placeholder="0"
                  max={maxStakeForSelected || undefined}
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    setRestakeAmount(maxStakeForSelected.toString())
                  }
                >
                  Max
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Available in {selectedRegion || "region"}:{" "}
                {maxStakeForSelected.toLocaleString()} GCTL
              </div>
            </div>

            {selectedRegion && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="text-sm font-medium">Preview</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Selected Regions
                    </span>
                    <span className="font-medium">{selectedRegion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Amount per Region
                    </span>
                    <span className="font-medium">
                      {parseFloat(restakeAmount || "0").toFixed(2)} GCTL
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">
                      Region Share (est.)
                    </span>
                    <span className="font-bold text-green-600">
                      {computeRegionShare(
                        selectedRegion,
                        parseFloat(restakeAmount || "0")
                      ).sharePct.toFixed(2)}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      GLW/week to region (est.)
                    </span>
                    <span className="font-bold text-green-600">
                      {computeRegionShare(
                        selectedRegion,
                        parseFloat(restakeAmount || "0")
                      ).weeklyGlw.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  <div className="font-medium mb-1">Info</div>
                  <div>Restaking drips 1% per week.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="link"
              size="sm"
              onClick={() => toast.info("Opening impact.glow.org")}
            >
              Deep dive on impact & farms
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleRestake} disabled={restakeDisabled}>
                Restake Now
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
