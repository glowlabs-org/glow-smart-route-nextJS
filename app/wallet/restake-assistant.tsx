"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { useLang } from "@/lib/i18n";

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

const MOCK_REGION_YIELDS: RestakeAssistantProps["regionYields"] = [
  {
    region: "North Valley",
    yield: "12.4",
    unretiredCredits: "24,100",
    purchasePrice: "$1.02",
    userStake: "1,250",
  },
  {
    region: "Coastal Ridge",
    yield: "9.8",
    unretiredCredits: "18,450",
    purchasePrice: "$0.97",
    userStake: "0",
  },
  {
    region: "Sunset Plains",
    yield: "14.1",
    unretiredCredits: "31,220",
    purchasePrice: "$1.08",
    userStake: "4,750",
  },
  {
    region: "Canyon East",
    yield: "7.6",
    unretiredCredits: "12,005",
    purchasePrice: "$0.93",
    userStake: "3,200",
  },
  {
    region: "Harbor South",
    yield: "10.2",
    unretiredCredits: "15,330",
    purchasePrice: "$1.00",
    userStake: "0",
  },
];

export function RestakeAssistant({
  isOpen,
  onClose,
  regionYields,
}: RestakeAssistantProps) {
  const { t } = useLang();
  const s = t.dialogs.restake;
  const [selectedFromRegion, setSelectedFromRegion] = useState<string>("");
  const [selectedToRegion, setSelectedToRegion] = useState<string>("");
  const [restakePercentage, setRestakePercentage] = useState(0);
  const [showAllRegions, setShowAllRegions] = useState(false);

  const sourceRegions =
    regionYields && regionYields.length > 0 ? regionYields : MOCK_REGION_YIELDS;

  // Sort regions by yield (highest first)
  const sortedRegions = [...sourceRegions].sort(
    (a, b) =>
      parseFloat(b.yield.replace(/,/g, "")) -
      parseFloat(a.yield.replace(/,/g, ""))
  );

  const displayedToRegions = showAllRegions
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

  const estimatedStakeByRegion = sourceRegions.reduce<Record<string, number>>(
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

  const handleSelectFrom = (region: string) => {
    setSelectedFromRegion(region);
    setRestakePercentage(0);
    if (region === selectedToRegion) setSelectedToRegion("");
  };
  const handleSelectTo = (region: string) => {
    setSelectedToRegion(region);
  };

  const stakedFromRegions = sourceRegions.filter(
    (r) => parseNum(r.userStake) > 0
  );
  const sortedFromRegions = [...stakedFromRegions].sort(
    (a, b) => parseNum(b.userStake) - parseNum(a.userStake)
  );
  const displayedFromRegions = showAllRegions
    ? sortedFromRegions
    : sortedFromRegions.slice(0, 3);

  const fromRegionData = sourceRegions.find(
    (r) => r.region === selectedFromRegion
  );
  const maxStakeForSelected = fromRegionData
    ? parseFloat(fromRegionData.userStake.replace(/,/g, "")) || 0
    : 0;
  const restakeAmount = (maxStakeForSelected * restakePercentage) / 100;
  const restakeDisabled =
    !selectedFromRegion ||
    !selectedToRegion ||
    selectedFromRegion === selectedToRegion ||
    restakePercentage <= 0;

  const onSubmitRestake = () => {
    if (!selectedFromRegion || !selectedToRegion) return;
    const amount = restakeAmount;
    if (amount <= 0) return;
    toast.success(s.toastSuccess(restakeAmount.toLocaleString()), {
      description: s.toastSuccessDesc(selectedFromRegion, selectedToRegion),
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{s.title}</DialogTitle>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* From Region (staked only) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {s.fromRegion}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllRegions(!showAllRegions)}
              >
                {showAllRegions ? s.showTop3 : s.showTop}
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <RadioGroup
                value={selectedFromRegion}
                onValueChange={handleSelectFrom}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>{s.region}</TableHead>
                      <TableHead>{s.yourStake}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedFromRegions.map((r) => (
                      <TableRow key={r.region}>
                        <TableCell>
                          <RadioGroupItem
                            value={r.region}
                            id={`from-${r.region}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.region}
                        </TableCell>
                        <TableCell>
                          {r.userStake === "0" ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <span className="font-medium">
                              {r.userStake} GCTL
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

          {/* To Region (all) */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {s.toRegion}
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <RadioGroup
                value={selectedToRegion}
                onValueChange={handleSelectTo}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>{s.region}</TableHead>
                      <TableHead>{s.yieldPct}</TableHead>
                      <TableHead>{s.unbindedCredits}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedToRegions.map((region) => (
                      <TableRow key={region.region}>
                        <TableCell>
                          <RadioGroupItem
                            value={region.region}
                            id={`to-${region.region}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {region.region}
                        </TableCell>
                        <TableCell className="font-bold text-green-600">
                          {parseFloat(region.yield).toFixed(2)}%
                        </TableCell>
                        <TableCell>{region.unretiredCredits}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </RadioGroup>
            </div>
            {selectedFromRegion &&
              selectedToRegion &&
              selectedFromRegion === selectedToRegion && (
                <div className="text-xs text-orange-600 mt-2">
                  {s.regionsMustDiffer}
                </div>
              )}
          </div>

          {/* Restake Configuration */}
          <div className="space-y-4">
            <div className="text-sm font-medium text-muted-foreground">
              {s.selectRestakeAmount}
            </div>
            <div className="text-center py-2">
              <div className="text-5xl font-bold tabular-nums">
                {restakePercentage}%
              </div>
            </div>
            <div className="px-2">
              <Slider
                value={[restakePercentage]}
                onValueChange={(v) => setRestakePercentage(v[0])}
                max={100}
                step={1}
                className="w-full"
                disabled={!selectedFromRegion}
              />
            </div>
            <div className="flex gap-2 justify-center">
              {[25, 50, 75, 100].map((p) => (
                <Button
                  key={p}
                  variant="outline"
                  size="sm"
                  onClick={() => setRestakePercentage(p)}
                  className="px-4"
                  disabled={!selectedFromRegion}
                >
                  {p === 100 ? s.max : `${p}%`}
                </Button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {selectedFromRegion
                ? s.restakingOfGctl(
                    restakeAmount.toLocaleString(),
                    maxStakeForSelected.toLocaleString(),
                  )
                : s.selectFromRegion}
            </div>
          </div>

          {selectedFromRegion && selectedToRegion && restakePercentage > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium">{s.preview}</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{s.fromTo}</span>
                  <span className="font-medium">
                    {selectedFromRegion} → {selectedToRegion}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{s.amount}</span>
                  <span className="font-medium">
                    {restakeAmount.toLocaleString()} GCTL
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-xs text-blue-600 dark:text-blue-400">
                {s.infoBlurb}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {s.cancel}
          </Button>
          <Button onClick={onSubmitRestake} disabled={restakeDisabled}>
            {s.restake}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
