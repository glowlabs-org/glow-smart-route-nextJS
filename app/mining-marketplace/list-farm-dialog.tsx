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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { farmsForSale, FarmForSale } from "./mock-farms";
import { toast } from "sonner";

interface ListFarmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onListed: (
    farm: FarmForSale,
    split: { owner: number; sponsor: number }
  ) => void;
}

export function ListFarmDialog({
  open,
  onOpenChange,
  onListed,
}: ListFarmDialogProps) {
  const [farmId, setFarmId] = React.useState<string>(farmsForSale[0]?.id ?? "");
  const [sponsorPercent, setSponsorPercent] = React.useState<number>(50);

  const farm = React.useMemo(
    () => farmsForSale.find((f) => f.id === farmId) ?? null,
    [farmId]
  );
  const ownerPercent = 100 - sponsorPercent;

  function clampPercent(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function handleChangeSponsor(value: string) {
    const n = clampPercent(Number(value));
    setSponsorPercent(n);
  }

  // Reward score preview (rough mock): scale with sponsor share; base from farm.rewardRating
  const rewardPreview = React.useMemo(() => {
    if (!farm) return null;
    // Assume linear scaling with sponsor share relative to 50% baseline
    const scale = sponsorPercent / 50; // 50% -> 1x, 80% -> 1.6x, 20% -> 0.4x
    const score = Math.round(farm.rewardRating * scale);
    return score;
  }, [farm, sponsorPercent]);

  const ownerGlowPerWeek = React.useMemo(() => {
    if (!farm) return 0;
    return (farm.weeklyGlowRewards * ownerPercent) / 100;
  }, [farm, ownerPercent]);

  function submit() {
    try {
      if (!farm) {
        toast.error("Please select a farm");
        return;
      }
      onListed(farm, { owner: ownerPercent, sponsor: sponsorPercent });
      toast.success("Farm listed (mock)", {
        description: `${farm.name} • Owner ${ownerPercent}% / Sponsor ${sponsorPercent}%`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to list farm");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>List a Farm on the Marketplace</DialogTitle>
          <DialogDescription>
            Choose a farm and set the owner/sponsor split.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Farm</Label>
            <Select value={farmId} onValueChange={setFarmId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {farmsForSale.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {farm && (
              <div className="text-xs text-muted-foreground">
                Region: {farm.region}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sponsor split</Label>
              <div className="text-sm tabular-nums">{sponsorPercent}%</div>
            </div>
            <Slider
              min={20}
              max={80}
              step={10}
              value={[sponsorPercent]}
              onValueChange={(v) => handleChangeSponsor(String(v?.[0] ?? 50))}
            />
            <div className="text-xs text-muted-foreground">
              Owner split: {ownerPercent}%
            </div>
          </div>

          {farm && (
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">
                Estimated Reward Score (preview)
              </div>
              <div className="text-xl font-semibold tabular-nums">
                {rewardPreview}
              </div>
              <div className="mt-2">
                <div className="text-xs text-muted-foreground">
                  Owner GLW per week
                </div>
                <div className="text-sm font-medium tabular-nums">
                  {ownerGlowPerWeek.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{" "}
                  GLW
                </div>
              </div>
            </div>
          )}
          <div className="text-xs text-muted-foreground bg-muted p-4 rounded-md">
            Owner share decays by 10 percentage points per week after a 1-week
            offset until a sponsor picks it up. It may take up to 60 minutes for
            a new split to take effect.
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="ml-auto" onClick={submit}>
              List Farm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
