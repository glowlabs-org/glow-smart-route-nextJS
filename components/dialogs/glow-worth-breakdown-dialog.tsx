"use client";

import * as React from "react";
import { GlwWorthIcon, VaultIcon, EmissionsIcon } from "@/components/impact-icons";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface GlowWorthBreakdown {
  glowWorthGlw: number;
  liquidGlw: number;
  delegatedActiveGlw: number;
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
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

type BreakdownTone = "emerald" | "purple" | "cyan";

function getToneClasses(tone: BreakdownTone) {
  if (tone === "emerald")
    return {
      row: "border-border/60 hover:border-border dark:border-white/5 dark:hover:border-white/10",
      iconWrap: "bg-[#4ADE80]/10 border-[#4ADE80]/20 text-[#4ADE80]",
      label: "text-[#4ADE80]",
      value: "text-[#4ADE80]",
    } as const;
  if (tone === "purple")
    return {
      row: "border-border/60 hover:border-border dark:border-white/5 dark:hover:border-white/10",
      iconWrap: "bg-delegation-purple/10 border-delegation-purple/20 text-delegation-purple",
      label: "text-delegation-purple",
      value: "text-delegation-purple",
    } as const;
  return {
    row: "border-border/60 hover:border-border dark:border-white/5 dark:hover:border-white/10",
    iconWrap: "bg-[#22D3EE]/10 border-[#22D3EE]/20 text-[#22D3EE]",
    label: "text-[#22D3EE]",
    value: "text-[#22D3EE]",
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
        "flex items-center justify-between p-3 rounded-xl border transition-all bg-muted/30 dark:bg-zinc-900/40",
        toneClasses.row
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg border",
            toneClasses.iconWrap
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span
            className={cn(
              "text-xs font-bold uppercase tracking-wide text-foreground dark:text-zinc-200",
              toneClasses.label
            )}
          >
            {label}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono dark:text-zinc-500">
            {sublabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span
          className={cn(
            "font-mono font-bold text-sm text-foreground dark:text-white tabular-nums",
            toneClasses.value
          )}
        >
          {value}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono dark:text-zinc-600">
          GLW
        </span>
      </div>
    </div>
  );
}

export function GlowWorthBreakdownDialog(props: GlowWorthBreakdownDialogProps) {
  const { open, onOpenChange, breakdown } = props;

  const safeBreakdown = breakdown ?? {
    glowWorthGlw: NaN,
    liquidGlw: NaN,
    delegatedActiveGlw: NaN,
    unclaimedGlwRewards: NaN,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl bg-card border-foreground/10 dark:bg-[#09090b] dark:border-zinc-800">
        <div className="px-6 pr-14 py-6 border-b border-border bg-muted/20 dark:border-zinc-800 dark:bg-zinc-900/50">
          <DialogHeader>
            <div className="flex items-start justify-between gap-6">
              <div>
                <DialogTitle className="font-mono uppercase tracking-wide text-lg text-foreground dark:text-white">
                  What’s in your Glow Worth?
                </DialogTitle>
                <DialogDescription className="text-muted-foreground mt-1 dark:text-zinc-400">
                  Your Glow Worth is your total GLW across your wallet, active
                  delegations, and earned rewards you haven’t claimed yet.
                </DialogDescription>
              </div>

              <div className="text-right">
                <div className="text-[10px] uppercase text-muted-foreground font-mono dark:text-zinc-500">
                  Total
                </div>
                <div className="text-xl font-bold font-mono text-foreground tracking-tight dark:text-white tabular-nums">
                  {formatGlw(safeBreakdown.glowWorthGlw)}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6 space-y-8">
            <div className="space-y-2">
              <BreakdownRow
                icon={GlwWorthIcon}
                label="GLW in your wallet"
                sublabel="Updates right away when you receive or swap GLW"
                value={formatGlw(safeBreakdown.liquidGlw)}
                tone="emerald"
              />
              <BreakdownRow
                icon={VaultIcon}
                label="GLW from delegations"
                sublabel="Shows up once delegations are active in the weekly accounting"
                value={formatGlw(safeBreakdown.delegatedActiveGlw)}
                tone="purple"
              />
              <BreakdownRow
                icon={EmissionsIcon}
                label="Unclaimed rewards"
                sublabel="Rewards you've earned but haven't claimed yet"
                value={formatGlw(safeBreakdown.unclaimedGlwRewards)}
                tone="cyan"
              />
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider dark:text-zinc-500">
                When do these numbers change?
              </div>
              <div className="rounded-2xl border border-border bg-muted/10 p-4 text-sm text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900/30">
                <ul className="space-y-2 list-disc pl-5">
                  <li>
                    If you buy or receive GLW, your “GLW in your wallet” updates
                    right away.
                  </li>
                  <li>
                    Buying a miner usually won’t change Glow Worth immediately.
                    Rewards show up later, after weekly processing.
                  </li>
                  <li>
                    Buying a delegation can take time to reflect: your wallet GLW
                    changes immediately, but the “GLW from delegations” part may
                    appear later.
                  </li>
                  <li>
                    Unclaimed rewards become claimable a few weeks later (about
                    3–4 weeks).
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}


