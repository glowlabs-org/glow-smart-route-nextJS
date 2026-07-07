"use client";

import * as React from "react";
import {
  GlwWorthIcon,
  VaultIcon,
  EmissionsIcon,
} from "@/components/impact-icons";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

export interface GlowWorthBreakdown {
  glowWorthGlw: number;
  liquidGlw: number;
  delegatedActiveGlw: number;
  pendingDelegatedGlw: number;
  pendingRecoveredGlw: number;
  unclaimedGlwRewards: number;
}

interface GlowWorthBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakdown: GlowWorthBreakdown | null;
}

function formatGlw(value: number, opts?: { maximumFractionDigits?: number }) {
  if (!Number.isFinite(value)) return "—";
  const maximumFractionDigits = opts?.maximumFractionDigits ?? 0;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(
    value
  );
}

type BreakdownTone = "emerald" | "purple" | "cyan";

function getToneClasses(tone: BreakdownTone) {
  if (tone === "emerald")
    return {
      row: "border-border/20 dark:border-border/40",
      iconWrap: "bg-[#4ADE80]/10 text-[#4ADE80]",
    } as const;
  if (tone === "purple")
    return {
      row: "border-border/20 dark:border-border/40",
      iconWrap: "bg-[color:var(--delegation-purple)]/10 text-[color:var(--delegation-purple)]",
    } as const;
  return {
    row: "border-border/20 dark:border-border/40",
    iconWrap: "bg-[#22D3EE]/10 text-[#22D3EE]",
  } as const;
}

function BreakdownRow(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  value: string;
  tone: BreakdownTone;
}) {
  const { icon: Icon, label, sublabel, value, tone } = props;
  const toneClasses = getToneClasses(tone);

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-xl bg-muted/30 dark:bg-muted/50 border",
        toneClasses.row
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
            toneClasses.iconWrap
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {label}
          </span>
          <span className="text-[10px] text-muted-foreground/60 dark:text-muted-foreground/80">
            {sublabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono font-semibold text-sm text-foreground tabular-nums">
          {value}
        </span>
        <span className="text-[10px] text-muted-foreground/50 font-mono uppercase">
          GLW
        </span>
      </div>
    </div>
  );
}

export function GlowWorthBreakdownDialog(props: GlowWorthBreakdownDialogProps) {
  const { open, onOpenChange, breakdown } = props;
  const { t } = useLang();

  const safeBreakdown = breakdown ?? {
    glowWorthGlw: NaN,
    liquidGlw: NaN,
    delegatedActiveGlw: NaN,
    pendingDelegatedGlw: NaN,
    pendingRecoveredGlw: NaN,
    unclaimedGlwRewards: NaN,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40">
        <div className="border-b border-border/40 pb-6 pt-8 px-6">
          <DialogHeader>
            <div className="flex flex-col items-center text-center space-y-2">
              <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
                {t.dialogs.glowWorth.title}
              </DialogTitle>
              <div className="text-6xl font-mono font-semibold text-foreground tracking-tighter tabular-nums">
                {formatGlw(safeBreakdown.glowWorthGlw)}
              </div>
              <DialogDescription className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mt-2">
                {t.dialogs.glowWorth.totalDescription}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[65vh]">
          <div className="p-5 space-y-8">
            <div className="space-y-3">
              <BreakdownRow
                icon={GlwWorthIcon}
                label={t.dialogs.glowWorth.liquidLabel}
                sublabel={t.dialogs.glowWorth.liquidSublabel}
                value={formatGlw(safeBreakdown.liquidGlw)}
                tone="emerald"
              />
              <BreakdownRow
                icon={VaultIcon}
                label={t.dialogs.glowWorth.delegatedLabel}
                sublabel={t.dialogs.glowWorth.delegatedSublabel}
                value={formatGlw(safeBreakdown.delegatedActiveGlw)}
                tone="purple"
              />
              {Number.isFinite(safeBreakdown.pendingDelegatedGlw) &&
              safeBreakdown.pendingDelegatedGlw > 0 ? (
                <BreakdownRow
                  icon={VaultIcon}
                  label={t.dialogs.glowWorth.pendingDelegatedLabel}
                  sublabel={t.dialogs.glowWorth.pendingDelegatedSublabel}
                  value={formatGlw(safeBreakdown.pendingDelegatedGlw)}
                  tone="purple"
                />
              ) : null}
              {Number.isFinite(safeBreakdown.pendingRecoveredGlw) &&
              safeBreakdown.pendingRecoveredGlw > 0 ? (
                <BreakdownRow
                  icon={VaultIcon}
                  label={t.dialogs.glowWorth.pendingRecoveryLabel}
                  sublabel={t.dialogs.glowWorth.pendingRecoverySublabel}
                  value={formatGlw(safeBreakdown.pendingRecoveredGlw)}
                  tone="purple"
                />
              ) : null}
              <BreakdownRow
                icon={EmissionsIcon}
                label={t.dialogs.glowWorth.unclaimedLabel}
                sublabel={t.dialogs.glowWorth.unclaimedSublabel}
                value={formatGlw(safeBreakdown.unclaimedGlwRewards)}
                tone="cyan"
              />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
