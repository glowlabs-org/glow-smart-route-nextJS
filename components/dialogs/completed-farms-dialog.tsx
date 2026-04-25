"use client";

import React from "react";
import Link from "next/link";
import { Sun, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLang } from "@/lib/i18n";

export interface CompletedFarmItem {
  id: string;
  name: string;
  zoneName: string;
  netCCProduction?: string;
  solarPanelsQuantity?: number;
  timestampLabel: string;
  auditUrl?: string;
  paymentLabel?: string | null;
}

interface CompletedFarmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farms: CompletedFarmItem[];
}

function FarmRow({ farm }: { farm: CompletedFarmItem }) {
  const { t } = useLang();
  const solarPanelsLabel =
    typeof farm.solarPanelsQuantity === "number" &&
    Number.isFinite(farm.solarPanelsQuantity)
      ? t.dialogs.completedFarms.panels(
          farm.solarPanelsQuantity.toLocaleString(),
        )
      : null;

  const content = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-glow-orange/20 bg-glow-orange/10">
        <Sun className="h-5 w-5 text-glow-orange" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {farm.name}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground/70">
          {farm.zoneName && (
            <Badge variant="secondary" className="h-5 px-2 text-[10px] font-medium">
              {farm.zoneName}
            </Badge>
          )}
          {farm.netCCProduction && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="whitespace-nowrap text-muted-foreground/60">
                {t.dialogs.completedFarms.ccPerWeek(farm.netCCProduction)}
              </span>
            </>
          )}
          {solarPanelsLabel && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="whitespace-nowrap text-muted-foreground/60">
                {solarPanelsLabel}
              </span>
            </>
          )}
          <span className="text-muted-foreground/40">·</span>
          <span className="whitespace-nowrap text-muted-foreground/60">
            {farm.timestampLabel}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {farm.paymentLabel && (
          <Badge variant="outline" className="text-xs font-semibold leading-none">
            {farm.paymentLabel}
          </Badge>
        )}
        {farm.auditUrl ? (
          <Badge variant="secondary" className="gap-1 text-xs">
            {t.dialogs.completedFarms.seeAudit}
            <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground/60">
            {t.dialogs.completedFarms.auditPending}
          </Badge>
        )}
      </div>
    </div>
  );

  const baseClassName =
    "group flex flex-col gap-4 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-4 transition-colors";
  const interactiveClassName = farm.auditUrl
    ? " hover:border-border/40 dark:hover:border-border/60 hover:bg-muted/50 dark:hover:bg-muted/60"
    : "";

  if (farm.auditUrl) {
    return (
      <Link
        href={farm.auditUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClassName}${interactiveClassName}`}
      >
        {content}
      </Link>
    );
  }

  return <div className={baseClassName}>{content}</div>;
}

export function CompletedFarmsDialog({
  open,
  onOpenChange,
  farms,
}: CompletedFarmsDialogProps) {
  const { t } = useLang();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40 max-h-[80vh] flex flex-col">
        <div className="border-b border-border/20 dark:border-border/40 pb-6 pt-8 px-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground">
              {t.dialogs.completedFarms.title}
            </DialogTitle>
            <p className="mt-0.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
              {t.dialogs.completedFarms.farmsBrought(farms.length)}
            </p>
          </DialogHeader>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-3">
            {farms.map((farm) => (
              <FarmRow key={farm.id} farm={farm} />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
