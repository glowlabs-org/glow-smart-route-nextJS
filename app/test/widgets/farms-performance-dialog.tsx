"use client";

import React from "react";
import {
  Cpu,
  LayoutGrid,
  Layers,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Shadcn UI Components ---
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip as ShadTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- MOCK DATA: DETAILED LIST ---
const MINERS = [
  {
    id: "Effervecent Hollow",
    region: "Arizona, US",
    type: "miner" as const,
    initialCost: 50000,
    recovered: 0, // Miners don't recover deposit
    inflation: 28400, // Pure yield
    weeksActive: 42,
    totalWeeks: 99,
  },
  {
    id: "Coronet Cliffs",
    region: "Texas, US",
    type: "miner" as const,
    initialCost: 30000,
    recovered: 0,
    inflation: 8500,
    weeksActive: 25,
    totalWeeks: 99,
  },
];

const DELEGATIONS = [
  {
    id: "Darkgrove Meadows", // The Winner
    region: "Nevada, US",
    type: "delegation" as const,
    initialCost: 10000,
    recovered: 8500, // 85% of principal back
    inflation: 4500, // + 45% yield
    weeksActive: 90,
    totalWeeks: 100,
  },
  {
    id: "Pinecrest Hills", // The Underperformer
    region: "Arizona, US",
    type: "delegation" as const,
    initialCost: 10000,
    recovered: 2000, // Only 20% back
    inflation: 1000, // Low yield
    weeksActive: 50,
    totalWeeks: 100,
  },
  {
    id: "Riverside View", // On Track
    region: "Texas, US",
    type: "delegation" as const,
    initialCost: 10000,
    recovered: 3500,
    inflation: 500,
    weeksActive: 40,
    totalWeeks: 100,
  },
];

// --- HELPER: FORMATTERS ---
const fmtGlw = (n: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(n);

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const FILTER_VALUES = ["all", "miners", "delegations"] as const;
type FilterValue = (typeof FILTER_VALUES)[number];

function isFilterValue(value: string): value is FilterValue {
  return (FILTER_VALUES as readonly string[]).includes(value);
}

// --- COMPONENT: THE FARM ROW ---
const FarmPerformanceRow = ({
  data,
}: {
  data: (typeof MINERS)[0] | (typeof DELEGATIONS)[0];
}) => {
  // 1. Calculations
  const totalValue = data.recovered + data.inflation;
  const isMiner = data.type === "miner";

  // Percentages (0-100 for bar width)
  const timePct = Math.min((data.weeksActive / data.totalWeeks) * 100, 100);

  // Stacking Logic:
  const principalPct = Math.min((data.recovered / data.initialCost) * 100, 100);
  // Inflation sits on top of principal. If total > 100, we clamp for the main bar
  // and handle the overflow visually.
  const inflationPct = Math.min(
    (data.inflation / data.initialCost) * 100,
    100 - principalPct
  );

  const totalValuePct = (totalValue / data.initialCost) * 100;

  // Status Flags
  const isProfit = totalValuePct >= 100;
  const isLagging = totalValuePct < timePct - 10; // Buffer of 10% before warning

  return (
    <div className="grid grid-cols-12 items-center p-4 rounded-xl border border-zinc-800/60 bg-[#09090b] hover:bg-zinc-900/40 hover:border-zinc-700 transition-all group">
      {/* COLUMN 1: IDENTITY (3 Cols) */}
      <div className="col-span-3 flex items-center gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center border",
            data.type === "miner"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-purple-500/10 border-purple-500/20 text-purple-400"
          )}
        >
          {data.type === "miner" ? (
            <Cpu className="w-5 h-5" />
          ) : (
            <Layers className="w-5 h-5" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base text-zinc-200 leading-tight">
            {data.id}
          </span>
          <span className="text-sm font-mono text-zinc-500">{data.region}</span>
        </div>
      </div>

      {/* COLUMN 2: DUAL TRACKS (7 Cols) */}
      <div className="col-span-7 px-4 flex flex-col justify-center gap-3">
        {/* Track A: TIME */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-500 w-10 text-right uppercase tracking-wider">
            Time
          </span>
          <div className="flex-1 relative group/tooltip">
            <div className="relative w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-glow-yellow"
                style={{ width: `${timePct}%` }}
              />
            </div>
            {/* Hover Data */}
            <div className="absolute -top-8 left-0 hidden group-hover/tooltip:block bg-zinc-900 border border-zinc-800 text-sm px-2.5 py-1.5 rounded text-zinc-200 whitespace-nowrap z-10 leading-snug">
              {data.weeksActive} weeks elapsed
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-500 w-16 text-right">
            {data.totalWeeks - data.weeksActive} Left
          </span>
        </div>

        {/* Track B: MONEY */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-500 w-10 text-right uppercase tracking-wider">
            Value
          </span>
          <div className="flex-1 relative">
            <ShadTooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "relative w-full h-2.5 bg-muted rounded-full overflow-hidden border border-zinc-700/50 cursor-help",
                    isProfit &&
                      "ring-1 ring-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                  )}
                >
                  {/* Segment 1: Recovered Principal (Zinc) */}
                  <div
                    className="absolute left-0 h-full bg-accent"
                    style={{ width: `${principalPct}%` }}
                  />
                  {/* Segment 2: Inflation Yield (Green) */}
                  <div
                    className="absolute h-full bg-emerald-400"
                    style={{
                      left: `${principalPct}%`,
                      width: `${inflationPct}%`,
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-zinc-950 border-zinc-800 text-sm font-mono px-4 py-3 text-zinc-200">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-zinc-500">Initial:</span>
                  <span className="text-right text-zinc-200">
                    {isMiner
                      ? fmtUsd(data.initialCost)
                      : `${fmtGlw(data.initialCost)} GLW`}
                  </span>

                  <span className="text-zinc-500">Recovered:</span>
                  <span className="text-right text-accent">
                    {isMiner
                      ? fmtUsd(data.recovered)
                      : `${fmtGlw(data.recovered)} GLW`}
                  </span>

                  <span className="text-zinc-500">Inflation:</span>
                  <span className="text-right text-emerald-400">
                    {isMiner
                      ? `+${fmtUsd(data.inflation)}`
                      : `+${fmtGlw(data.inflation)} GLW`}
                  </span>

                  <div className="col-span-2 h-px bg-zinc-800 my-1" />

                  <span className="text-zinc-500">Total:</span>
                  <span className="text-right font-bold">
                    {isMiner ? fmtUsd(totalValue) : `${fmtGlw(totalValue)} GLW`}
                  </span>
                </div>
              </TooltipContent>
            </ShadTooltip>

            {/* Profit Overflow Marker */}
            {isProfit && (
              <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-1 h-3 bg-white shadow-[0_0_8px_white] rounded-full z-10" />
            )}
          </div>

          <div className="flex flex-col items-end w-16">
            <span
              className={cn(
                "text-sm font-mono font-bold",
                isProfit ? "text-emerald-400" : "text-zinc-300"
              )}
            >
              {Math.round(totalValuePct)}%
            </span>
          </div>
        </div>
      </div>

      {/* COLUMN 3: STATUS (2 Cols) */}
      <div className="col-span-2 flex justify-end">
        {isProfit ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs font-bold font-mono">PROFIT</span>
            </div>
          </div>
        ) : isLagging ? (
          <div
            className="flex items-center gap-1.5 text-orange-400 opacity-80"
            title="Value is growing slower than time passed"
          >
            <span className="text-xs font-mono uppercase tracking-wide">
              Lagging
            </span>
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 text-zinc-500"
            title="On track to break even"
          >
            <span className="text-xs font-mono uppercase tracking-wide">
              On Track
            </span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </div>
  );
};

export function FarmsPerformanceDialogContent() {
  const [filter, setFilter] = React.useState<FilterValue>("all");

  const visibleRows = React.useMemo(() => {
    let rows = [...MINERS, ...DELEGATIONS];
    if (filter === "miners") rows = rows.filter((r) => r.type === "miner");
    if (filter === "delegations")
      rows = rows.filter((r) => r.type === "delegation");
    // Sort by Total Value % (High performance first)
    return rows.sort((a, b) => {
      const valA = (a.recovered + a.inflation) / a.initialCost;
      const valB = (b.recovered + b.inflation) / b.initialCost;
      return valB - valA;
    });
  }, [filter]);

  return (
    <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
      {/* Header */}
      <DialogHeader className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/40 flex-shrink-0 flex-row items-center justify-between space-y-0">
        <DialogTitle className="text-2xl font-bold font-mono uppercase tracking-wide">
          Farm Performance
        </DialogTitle>

        <Tabs
          value={filter}
          onValueChange={(value) =>
            setFilter(isFilterValue(value) ? value : "all")
          }
        >
          <TabsList className="bg-zinc-900 border border-zinc-800 h-9 p-1">
            <TabsTrigger
              value="all"
              className="h-7 text-xs font-mono px-4 text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              ALL
            </TabsTrigger>
            <TabsTrigger
              value="miners"
              className="h-7 text-xs font-mono px-4 text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-emerald-400"
            >
              MINERS
            </TabsTrigger>
            <TabsTrigger
              value="delegations"
              className="h-7 text-xs font-mono px-4 text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-purple-400"
            >
              DELEGATIONS
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </DialogHeader>

      {/* Legend / Columns */}
      <div className="grid grid-cols-12 px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/20 text-xs font-mono uppercase text-zinc-500 tracking-wider flex-shrink-0">
        <div className="col-span-3">Identity</div>
        <div className="col-span-7 pl-4 flex gap-4">
          <span>Lifecycle (Time vs Money)</span>
          <span className="ml-auto text-zinc-600 normal-case tracking-normal">
            <span className="text-accent">■</span> Principal
            <span className="ml-2 text-emerald-500">■</span> Inflation
          </span>
        </div>
        <div className="col-span-2 text-right">Status</div>
      </div>

      {/* Scrollable List */}
      <ScrollArea className="flex-1 bg-[#050505]">
        <TooltipProvider delayDuration={0}>
          <div className="p-6 space-y-3 pb-12">
            {visibleRows.map((row) => (
              <FarmPerformanceRow key={row.id} data={row} />
            ))}
          </div>
        </TooltipProvider>
      </ScrollArea>
    </DialogContent>
  );
}

// --- STANDALONE WIDGET (OPTIONAL) ---

export default function FarmsPerformanceDialogWidget() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <Card className="h-full max-h-[400px] flex flex-col overflow-hidden bg-[#09090b] border-zinc-800 shadow-2xl shadow-black/50">
        <CardHeader className="pb-2 border-b border-zinc-800/50 bg-zinc-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="tracking-tight text-sm font-bold text-white uppercase font-mono">
                Reward Flow
              </CardTitle>
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs text-zinc-400 font-mono">
                Last 10 Weeks
              </span>
            </div>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1"
              >
                <LayoutGrid className="w-3 h-3" />
                View Details
              </Button>
            </DialogTrigger>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 p-6 flex flex-col gap-6">
          <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-xs">
            [ Chart View Component ]
          </div>
        </CardContent>
      </Card>

      <FarmsPerformanceDialogContent />
    </Dialog>
  );
}
