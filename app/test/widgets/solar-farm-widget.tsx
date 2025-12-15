"use client";

import React from "react";
import { Cpu, Layers, Sun, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// --- Mock Data ---
const MINERS = [
  {
    id: "Array-A1",
    region: "Arizona, US",
    cost: 50000,
    earned: 22400,
    currentWeek: 42,
    currentPayout: 545, // High payout
  },
  {
    id: "Array-B2",
    region: "Texas, US",
    cost: 30000,
    earned: 8500,
    currentWeek: 25,
    currentPayout: 310,
  },
  {
    id: "Array-C3",
    region: "Nevada, US",
    cost: 15000,
    earned: 14200,
    currentWeek: 88,
    currentPayout: 140,
  },
  {
    id: "Array-D4",
    region: "California, US",
    cost: 5000,
    earned: 10200,
    currentWeek: 12,
    currentPayout: 105,
  },
  {
    id: "Array-E5",
    region: "Florida, US",
    cost: 5000,
    earned: 400,
    currentWeek: 4,
    currentPayout: 98,
  },
];

const DELEGATIONS = [
  {
    id: "Array-A1",
    region: "Arizona, US",
    weeklyPayout: 265,
    lifetimeEarned: 12100,
    recoveryPercent: 28,
    competitivenessPercent: 98,
  },
  {
    id: "Farm-NV2",
    region: "Nevada, US",
    weeklyPayout: 188,
    lifetimeEarned: 9100,
    recoveryPercent: 95,
    competitivenessPercent: 72,
  },
  {
    id: "Farm-AZ3",
    region: "Arizona, US",
    weeklyPayout: 120,
    lifetimeEarned: 3500,
    recoveryPercent: 44,
    competitivenessPercent: 54,
  },
];

type Filter = "all" | "miners" | "delegations";

type MinerRow = (typeof MINERS)[number];
type DelegationRow = (typeof DELEGATIONS)[number];

interface MergedFarmRow {
  id: string;
  region: string;
  miner?: MinerRow;
  delegation?: DelegationRow;
  weeklyGlwBack: number;
  lifetimeEarnedGlw: number;
}

function mergeFarms(miners: MinerRow[], delegations: DelegationRow[]) {
  const byId = new Map<string, MergedFarmRow>();

  for (const miner of miners) {
    byId.set(miner.id, {
      id: miner.id,
      region: miner.region,
      miner,
      weeklyGlwBack: miner.currentPayout,
      lifetimeEarnedGlw: miner.earned,
    });
  }

  for (const delegation of delegations) {
    const existing = byId.get(delegation.id);
    if (!existing) {
      byId.set(delegation.id, {
        id: delegation.id,
        region: delegation.region,
        delegation,
        weeklyGlwBack: delegation.weeklyPayout,
        lifetimeEarnedGlw: delegation.lifetimeEarned,
      });
      continue;
    }

    byId.set(delegation.id, {
      ...existing,
      region: existing.region ?? delegation.region,
      delegation,
      weeklyGlwBack:
        (existing.miner?.currentPayout ?? 0) + delegation.weeklyPayout,
      lifetimeEarnedGlw:
        (existing.miner?.earned ?? 0) + delegation.lifetimeEarned,
    });
  }

  return Array.from(byId.values());
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getCompetitivenessTone(percent: number) {
  if (percent >= 90)
    return {
      fill: "bg-[#C084FC]",
      dot: "bg-emerald-400",
      label: "Excellent",
    } as const;
  if (percent >= 50)
    return {
      fill: "bg-[#C084FC]/60",
      dot: "bg-yellow-400",
      label: "Good",
    } as const;
  return {
    fill: "bg-orange-500",
    dot: "bg-orange-400",
    label: "Low",
  } as const;
}

export default function SolarFarmWidget() {
  const [filter, setFilter] = React.useState<Filter>("all");

  const allRows = React.useMemo(() => mergeFarms(MINERS, DELEGATIONS), []);

  const visibleRows = React.useMemo(() => {
    const filtered =
      filter === "miners"
        ? allRows.filter((r) => r.miner)
        : filter === "delegations"
        ? allRows.filter((r) => r.delegation)
        : allRows;

    return filtered.slice().sort((a, b) => b.weeklyGlwBack - a.weeklyGlwBack);
  }, [allRows, filter]);

  const totalWeeklyReward = React.useMemo(() => {
    return visibleRows.reduce((acc, r) => acc + r.weeklyGlwBack, 0);
  }, [visibleRows]);

  const totalEarned = React.useMemo(() => {
    return visibleRows.reduce((acc, r) => acc + r.lifetimeEarnedGlw, 0);
  }, [visibleRows]);

  const activeUnits = visibleRows.length;

  const avgCompetitiveness = React.useMemo(() => {
    if (filter !== "delegations") return null;

    const comps = visibleRows
      .map((r) => r.delegation?.competitivenessPercent)
      .filter((v): v is number => typeof v === "number");
    if (comps.length === 0) return null;

    const sum = comps.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / comps.length);
  }, [filter, visibleRows]);

  return (
    <Card className="h-full max-h-[400px] overflow-hidden">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="tracking-tight">
            Solar Farm Performance
          </CardTitle>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList className="bg-muted/30 border border-border">
              <TabsTrigger
                value="all"
                className="h-8 px-3 text-[11px] font-mono uppercase tracking-wider"
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="miners"
                className="h-8 px-3 text-[11px] font-mono uppercase tracking-wider"
              >
                Miners
              </TabsTrigger>
              <TabsTrigger
                value="delegations"
                className="h-8 px-3 text-[11px] font-mono uppercase tracking-wider"
              >
                Delegations
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="min-h-0">
        <div className="flex flex-col h-full gap-4 min-h-0">
          {/* Header Summary */}
          <div className="rounded-xl bg-muted/30 border border-border flex-shrink-0">
            <div className="grid grid-cols-3">
              <div className="p-3">
                <span className="text-[10px] uppercase text-muted-foreground font-mono tracking-wider">
                  Weekly Payout
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Sun className="w-3 h-3 text-[color:var(--color-glow-orange)]" />
                  <span className="font-mono text-sm font-bold text-foreground">
                    {totalWeeklyReward.toLocaleString()} GLW
                  </span>
                </div>
              </div>
              <div className="p-3 border-l border-border">
                <span className="text-[10px] uppercase text-muted-foreground font-mono tracking-wider">
                  Lifetime
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Zap className="w-3 h-3 text-[color:var(--color-glow-yellow)] fill-current" />
                  <span className="font-mono text-sm font-bold text-foreground">
                    {totalEarned.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="p-3 border-l border-border">
                <span className="text-[10px] uppercase text-muted-foreground font-mono tracking-wider">
                  {filter === "delegations" ? "Avg Comp" : "Active Units"}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {filter === "delegations" ? (
                    <Zap className="w-3 h-3 text-[#C084FC]" />
                  ) : (
                    <Layers className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span className="font-mono text-sm font-bold text-foreground">
                    {filter === "delegations"
                      ? `${avgCompetitiveness ?? 0}%`
                      : activeUnits.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-12 px-2 text-[10px] font-mono uppercase text-muted-foreground tracking-wider flex-shrink-0">
            <div className="col-span-5">Identity</div>
            <div className="col-span-4 text-right pr-2">Stream / Signal</div>
            <div className="col-span-3 text-right">
              {filter === "miners"
                ? "Recouped"
                : filter === "delegations"
                ? "Recovered"
                : "Return"}
            </div>
          </div>

          {/* Scrollable List */}
          <div className="flex-1 min-h-0 relative">
            <ScrollArea className="h-full pr-2 -mr-2">
              <div className="space-y-1.5 pb-2">
                {visibleRows.map((row) => {
                  const hasMiner = Boolean(row.miner);
                  const hasDelegation = Boolean(row.delegation);
                  const isBoth = hasMiner && hasDelegation;

                  const miner = row.miner;
                  const delegation = row.delegation;

                  const percentRecouped = miner
                    ? Math.round((miner.earned / miner.cost) * 100)
                    : null;
                  const contractProgressPercent = miner
                    ? clampPercent(miner.currentWeek)
                    : 0;

                  const comp = delegation
                    ? clampPercent(delegation.competitivenessPercent)
                    : 0;
                  const tone = delegation ? getCompetitivenessTone(comp) : null;
                  const segments = 10;
                  const filled = delegation
                    ? Math.round((comp / 100) * segments)
                    : 0;

                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-12 items-start p-2 rounded-xl border border-border/60 hover:bg-muted/30 hover:border-border transition-colors group"
                    >
                      {/* 1. Identity */}
                      <div className="col-span-5 flex items-center gap-2 min-w-0">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-xl border border-border/60 flex items-center justify-center flex-shrink-0",
                            hasMiner && hasDelegation
                              ? "bg-gradient-to-br from-emerald-500/10 to-purple-500/10"
                              : hasMiner
                              ? "bg-emerald-500/10"
                              : "bg-purple-500/10"
                          )}
                        >
                          <div className="flex items-center gap-1">
                            {hasMiner && (
                              <Cpu className="h-4 w-4 text-emerald-400" />
                            )}
                            {hasDelegation && (
                              <Zap className="h-4 w-4 text-purple-400" />
                            )}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2 min-w-0">
                            <span className="font-mono text-xs font-bold text-foreground truncate pt-0.5">
                              {row.id}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground truncate">
                            {row.region}
                          </div>
                          {isBoth && miner && delegation && (
                            <div className="mt-1 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                                  <Cpu className="h-3 w-3 text-emerald-400" />
                                  Miner
                                </span>
                                <span className="text-[10px] font-mono font-semibold text-foreground tabular-nums">
                                  +{miner.currentPayout.toLocaleString()} GLW/wk
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                                  <Zap className="h-3 w-3 text-purple-400" />
                                  Delegation
                                </span>
                                <span className="text-[10px] font-mono font-semibold text-foreground tabular-nums">
                                  +{delegation.weeklyPayout.toLocaleString()}{" "}
                                  GLW/wk
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. Stream / Signal */}
                      <div className="col-span-4 flex items-center justify-end pr-2">
                        <div className="flex flex-col items-end gap-2 w-full max-w-[180px]">
                          <div className="font-mono text-[11px] font-bold tabular-nums text-foreground">
                            +{row.weeklyGlwBack.toLocaleString()} GLW/wk
                          </div>

                          {hasMiner && miner && (
                            <div className="flex flex-col items-end gap-1.5 w-full">
                              <div className="relative w-full h-2 bg-zinc-800 rounded-full overflow-hidden border border-border/60">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{
                                    width: `${contractProgressPercent}%`,
                                  }}
                                />
                                <motion.div
                                  aria-hidden
                                  className="absolute inset-y-0 w-12 opacity-35"
                                  style={{
                                    background:
                                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                                  }}
                                  animate={{ x: ["-30%", "130%"] }}
                                  transition={{
                                    duration: 2.2,
                                    repeat: Infinity,
                                    ease: "linear",
                                  }}
                                />
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground tabular-nums">
                                ⚡ Harvesting • Wk {miner.currentWeek} / 100
                              </div>
                            </div>
                          )}

                          {hasDelegation && delegation && tone && (
                            <div className="flex flex-col items-end gap-1.5 w-full">
                              <div className="grid grid-cols-10 gap-0.5 w-full">
                                {Array.from({ length: segments }).map(
                                  (_, idx) => (
                                    <div
                                      key={idx}
                                      className={cn(
                                        "h-2 rounded-[3px] border border-border/60 bg-zinc-800/60",
                                        idx < filled && tone.fill
                                      )}
                                    />
                                  )
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground tabular-nums flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full animate-pulse",
                                      tone.dot
                                    )}
                                  />
                                  <span>Active</span>
                                </span>
                                <span>•</span>
                                <span className="text-foreground/80">
                                  {comp}% Competitive
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 3. Return */}
                      <div className="col-span-3 flex justify-end">
                        <div className="flex flex-col items-end gap-2">
                          {hasMiner && percentRecouped !== null && (
                            <div className="flex flex-col items-end gap-1">
                              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                                Recouped
                              </div>
                              <div
                                className={cn(
                                  "px-2 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap border",
                                  percentRecouped >= 100
                                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                    : "bg-muted text-muted-foreground border-border/60 dark:bg-zinc-800/60 dark:text-zinc-100 dark:border-zinc-700/60"
                                )}
                              >
                                {percentRecouped}%
                              </div>
                            </div>
                          )}

                          {hasDelegation && delegation && (
                            <div className="flex flex-col items-end gap-1">
                              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                                Recovered
                              </div>
                              <div
                                className={cn(
                                  "px-2 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap border",
                                  delegation.recoveryPercent >= 80
                                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                    : delegation.recoveryPercent >= 40
                                    ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                                    : "bg-orange-500/10 text-orange-300 border-orange-500/30"
                                )}
                              >
                                {delegation.recoveryPercent}%
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
