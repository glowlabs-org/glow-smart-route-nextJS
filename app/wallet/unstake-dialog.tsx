"use client";

import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { useLang } from "@/lib/i18n";

interface UnstakeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  regionYields: Array<{
    region: string;
    yield: string;
    unretiredCredits: string;
    purchasePrice: string;
    userStake: string;
  }>;
  gctlUnstaking: string; // from balances
}

function parseNum(value: string): number {
  return parseFloat((value || "0").replace(/,/g, "")) || 0;
}

export function UnstakeDialog({
  isOpen,
  onClose,
  regionYields,
  gctlUnstaking,
}: UnstakeDialogProps) {
  const { t } = useLang();
  const stakedRegions = useMemo(
    () => regionYields.filter((r) => parseNum(r.userStake) > 0),
    [regionYields]
  );

  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [percentage, setPercentage] = useState<number>(0);

  const selected = stakedRegions.find((r) => r.region === selectedRegion);
  const maxForRegion = selected ? parseNum(selected.userStake) : 0;
  const unstakeAmount = (maxForRegion * percentage) / 100;

  const disableSubmit = !selectedRegion || percentage <= 0;

  function handleSubmit() {
    if (disableSubmit) {
      toast.error(t.dialogs.unstake.toastEnterAmount);
      return;
    }
    toast.success(
      t.dialogs.unstake.toastSuccess(unstakeAmount.toLocaleString()),
      {
        description: t.dialogs.unstake.toastSuccessDesc(selectedRegion),
      },
    );
    onClose();
  }

  function handleStopUnstake() {
    if (parseNum(gctlUnstaking) <= 0) {
      toast.info(t.dialogs.unstake.toastNoOngoingSchedules);
      return;
    }
    toast.success(t.dialogs.unstake.toastStopped);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{t.dialogs.unstake.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Regions */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {t.dialogs.unstake.yourStakedRegions}
            </h3>
            {stakedRegions.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                {t.dialogs.unstake.noStakedGctl}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <RadioGroup
                  value={selectedRegion}
                  onValueChange={(v) => {
                    setSelectedRegion(v);
                    setPercentage(0);
                  }}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>{t.dialogs.unstake.region}</TableHead>
                        <TableHead>{t.dialogs.unstake.yourStake}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stakedRegions.map((r) => (
                        <TableRow key={r.region}>
                          <TableCell>
                            <RadioGroupItem
                              value={r.region}
                              id={`u-${r.region}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.region}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {r.userStake} GCTL
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </RadioGroup>
              </div>
            )}
          </div>

          {/* Unstake percentage (remove-liquidity style) */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {t.dialogs.unstake.selectUnstakeAmount}
            </h3>
            <div className="text-center py-4">
              <div className="text-5xl font-bold tabular-nums">
                {percentage}%
              </div>
            </div>
            <div className="px-2">
              <Slider
                value={[percentage]}
                onValueChange={(value) => setPercentage(value[0])}
                max={100}
                step={1}
                className="w-full"
                disabled={!selectedRegion}
              />
            </div>
            <div className="flex gap-2 justify-center mt-4">
              {[25, 50, 75, 100].map((p) => (
                <Button
                  key={p}
                  variant="outline"
                  size="sm"
                  onClick={() => setPercentage(p)}
                  className="px-4"
                  disabled={!selectedRegion}
                >
                  {p === 100 ? t.dialogs.unstake.max : `${p}%`}
                </Button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground text-center mt-2">
              {selectedRegion
                ? t.dialogs.unstake.unstakingOfGctl(
                    unstakeAmount.toLocaleString(),
                    maxForRegion.toLocaleString(),
                  )
                : t.dialogs.unstake.selectRegion}
            </div>
          </div>

          {/* Preview */}
          {selectedRegion && percentage > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t.dialogs.unstake.region}
                </span>
                <span className="font-medium">{selectedRegion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t.dialogs.unstake.unstakeAmount}
                </span>
                <span className="font-medium">
                  {unstakeAmount.toLocaleString()} GCTL
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-muted-foreground">
                  {t.dialogs.unstake.schedule}
                </span>
                <span className="font-bold text-green-600">
                  {t.dialogs.unstake.scheduleValue}
                </span>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-xs text-blue-600 dark:text-blue-400">
                {t.dialogs.unstake.infoBlurb}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {parseNum(gctlUnstaking) > 0 && (
              <Button variant="ghost" onClick={handleStopUnstake}>
                {t.dialogs.unstake.stopUnstakeLabel(
                  parseNum(gctlUnstaking).toLocaleString(),
                )}
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={onClose}>
                {t.dialogs.unstake.cancel}
              </Button>
              <Button onClick={handleSubmit} disabled={disableSubmit}>
                {t.dialogs.unstake.unstake}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
