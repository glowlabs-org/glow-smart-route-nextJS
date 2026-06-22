"use client";

/**
 * Network-wide solar footprint — the whole-protocol impact section body.
 *
 * Renders the SECTION BODY ONLY (no outer card): the parent bento section
 * provides the white card. A 5-across KPI row (watts / homes / energy / trees /
 * CO₂) sits above a 2-up of recharts: a regional energy distribution pie and a
 * cumulative footprint growth area chart. Everything is derived client-side from
 * the protocol-wide farms fetch (`useV2ImpactFarms`) — totals are summed, the
 * regional split is grouped by region, growth is the cumulative-by-funding-month
 * series, and homes/energy/trees come from `calculateImpact` (same model the
 * wallet footprint uses). Shares the farms fetch with the Live Solar Farms
 * section, so there's no extra request.
 */

import * as React from "react";
import { PieChart as PieChartIcon, TrendingUp } from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { type NetworkFootprint } from "@/lib/mock/network-footprint-mock";
import { useV2ImpactFarms } from "@/hooks/v2-impact";
import { calculateImpact } from "@/hooks/hub-solar-collector";
import { weekToTimestamp } from "@/lib/rewards/weekly-delegations";

const EYEBROW =
  "text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60";

const INT = { maximumFractionDigits: 0 } as const;

/** Watts → MW / kW / W, no decimals. */
function formatWatts(watts: number): { value: string; unit: string } {
  if (watts >= 1_000_000) {
    return { value: (watts / 1_000_000).toLocaleString(undefined, INT), unit: "MW" };
  }
  if (watts >= 1_000) {
    return { value: (watts / 1_000).toLocaleString(undefined, INT), unit: "kW" };
  }
  return { value: Math.round(watts).toLocaleString(), unit: "W" };
}

/** Energy/year (MWh) → GWh / MWh, no decimals. */
function formatEnergy(mwh: number): { value: string; unit: string } {
  if (mwh >= 1_000) {
    return { value: (mwh / 1_000).toLocaleString(undefined, INT), unit: "GWh" };
  }
  return { value: mwh.toLocaleString(undefined, INT), unit: "MWh" };
}

// Vibrant pie palette by rank (so the biggest zone gets a real colour). "Other"
// rolls up the long tail once there are more zones than colours.
const PIE_PALETTE = [
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#ec4899", // pink
  "#f97316", // orange
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#84cc16", // lime
];
const PIE_OTHER_COLOR = "#cbd5e1"; // slate-300

// The footprint charts show V2 farms only. V2 began at week 97, and the "Clean
// Grid Project" zone is the pre-V2 global project — excluded from the pie, and
// naturally absent from the growth series (all of it is pre-week-97).
const V2_GENESIS_MS = weekToTimestamp(97);
const EXCLUDED_ZONE = "Clean Grid Project";

/** A single KPI cell: mono eyebrow + big tabular value + small sub-label. */
function Kpi({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={EYEBROW}>{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-2xl font-bold tracking-tight tabular-nums text-foreground md:text-3xl">
          {value}
        </span>
        <span className="font-mono text-sm text-muted-foreground">{unit}</span>
      </div>
      <span className="text-pretty text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

export default function NetworkSolarFootprint() {
  const { data: farmsResp } = useV2ImpactFarms();

  // Aggregate the whole protocol footprint from the shared farms fetch.
  const data: NetworkFootprint = React.useMemo(() => {
    const farms = farmsResp?.rows ?? [];
    const totalWatts = farms.reduce((s, f) => s + (Number(f.totalWatts) || 0), 0);
    const totalTonsCo2 = farms.reduce(
      (s, f) => s + (Number(f.totalCarbonCredits) || 0),
      0,
    );
    const { annualEnergyKwh, treesEquivalent, homesPowered } =
      calculateImpact(totalWatts);

    // Distribution by Glow zone (Clean Grid Project, Eternal Florida, Ratan
    // Rajasthan, …) — the user-facing project names, not the grid-operator
    // region. Roll the long tail into "Other" and colour by rank.
    const byZone = new Map<string, number>();
    for (const f of farms) {
      const w = Number(f.totalWatts) || 0;
      if (w <= 0) continue;
      if (f.zoneName === EXCLUDED_ZONE) continue; // pre-V2 global project
      const label =
        f.zoneName || f.regionFullName || f.region || `Zone ${f.zoneId}`;
      byZone.set(label, (byZone.get(label) ?? 0) + w);
    }
    const ranked = [...byZone.entries()]
      .map(([label, watts]) => ({ label, watts }))
      .sort((a, b) => b.watts - a.watts);
    const TOP_REGIONS = PIE_PALETTE.length;
    const tailWatts = ranked
      .slice(TOP_REGIONS)
      .reduce((s, r) => s + r.watts, 0);
    const regional = ranked.slice(0, TOP_REGIONS).map((r, i) => ({
      code: `r${i}`,
      label: r.label,
      watts: r.watts,
      color: PIE_PALETTE[i % PIE_PALETTE.length]!,
    }));
    if (tailWatts > 0) {
      regional.push({
        code: "other",
        label: "Other",
        watts: tailWatts,
        color: PIE_OTHER_COLOR,
      });
    }

    // Cumulative V2 watts by funding month — only farms funded on/after week 97.
    const funded = farms
      .filter((f) => f.fundedAt && (Number(f.totalWatts) || 0) > 0)
      .map((f) => ({ d: new Date(f.fundedAt as string), w: Number(f.totalWatts) }))
      .filter(
        (x) => !Number.isNaN(x.d.getTime()) && x.d.getTime() >= V2_GENESIS_MS,
      )
      .sort((a, b) => a.d.getTime() - b.d.getTime());
    const monthly = new Map<string, number>();
    let cum = 0;
    for (const e of funded) {
      cum += e.w;
      const key = `${e.d.getUTCFullYear()}-${String(
        e.d.getUTCMonth() + 1,
      ).padStart(2, "0")}-01`;
      monthly.set(key, cum);
    }
    const growth = [...monthly.entries()].map(([date, watts]) => ({
      date,
      watts,
    }));

    return {
      totalWatts,
      homesPowered,
      energyPerYearMwh: annualEnergyKwh / 1000,
      treesEquivalent,
      totalTonsCo2,
      regional,
      growth,
    };
  }, [farmsResp]);

  const watts = formatWatts(data.totalWatts);
  const energy = formatEnergy(data.energyPerYearMwh);

  // Pie data. The slice `value` is a DISPLAY share: no single zone may swallow
  // more than half the pie, so if the biggest exceeds 50% it's pinned to 50%
  // and everyone else is scaled into the remaining 50% proportionally. The real
  // watts + real % ride along on the payload for the tooltip.
  const pieData = React.useMemo(() => {
    const regional = data.regional;
    const total = regional.reduce((s, r) => s + r.watts, 0);
    if (!total) return [];
    const CAP = 0.5;
    const largest = regional[0]; // regional is sorted desc
    const useCap = regional.length > 1 && largest.watts / total > CAP;
    const restTotal = total - largest.watts;
    return regional.map((r, i) => {
      const realShare = r.watts / total;
      const displayShare = useCap
        ? i === 0
          ? CAP
          : restTotal > 0
            ? (r.watts / restTotal) * (1 - CAP)
            : 0
        : realShare;
      return {
        name: r.code,
        label: r.label,
        value: displayShare,
        watts: r.watts,
        pct: realShare * 100,
        fill: r.color,
      };
    });
  }, [data.regional]);

  const chartConfig = React.useMemo<ChartConfig>(() => {
    const config: ChartConfig = {
      watts: { label: "Watts", color: "#f59e0b" },
    };
    for (const r of data.regional) {
      config[r.code] = { label: r.label, color: r.color };
    }
    return config;
  }, [data.regional]);

  const growthData = React.useMemo(
    () =>
      data.growth.map((g) => ({
        date: new Date(g.date),
        watts: g.watts,
      })),
    [data.growth],
  );

  const maxGrowthWatts = React.useMemo(
    () =>
      growthData.length ? Math.max(...growthData.map((d) => d.watts)) : 0,
    [growthData],
  );

  const growthYAxisFormatter = React.useCallback(
    (value: number) => {
      if (value === 0) return "0";
      if (maxGrowthWatts >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (maxGrowthWatts >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
      return `${value}W`;
    },
    [maxGrowthWatts],
  );

  return (
    <div className="flex flex-col gap-8">
      {/* KPI row — 5 across, responsive */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi
          label="Watts"
          value={watts.value}
          unit={watts.unit}
          sub="Verified solar network-wide"
        />
        <Kpi
          label="Homes Powered"
          value={data.homesPowered.toLocaleString(undefined, INT)}
          unit="homes"
          sub="Equivalent annual supply"
        />
        <Kpi
          label="Energy / Year"
          value={energy.value}
          unit={energy.unit}
          sub="Estimated generation"
        />
        <Kpi
          label="Trees Equivalent"
          value={data.treesEquivalent.toLocaleString()}
          unit="trees"
          sub="Lifetime carbon offset"
        />
        <Kpi
          label="Total CO₂"
          value={data.totalTonsCo2.toLocaleString(undefined, INT)}
          unit="t"
          sub="Displaced to date"
        />
      </div>

      {/* Charts — 2-up: regional distribution + footprint growth */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Regional energy distribution (Pie) */}
        <div className="flex flex-col gap-4 rounded-3xl border border-border/15 bg-muted/10 p-6 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
            <span className={EYEBROW}>Regional Energy Distribution</span>
          </div>
          <div className="relative min-h-[240px] w-full flex-1">
            <ChartContainer
              config={chartConfig}
              className="absolute inset-0 aspect-auto h-full w-full"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(_value, _name, item) => {
                        const p = item?.payload as
                          | { label?: string; watts?: number; pct?: number }
                          | undefined;
                        const w = formatWatts(p?.watts ?? 0);
                        const pct = p?.pct ?? 0;
                        return (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-foreground">
                              {p?.label ?? ""}
                            </span>
                            <span className="flex items-baseline gap-1.5">
                              <span className="font-mono font-medium tabular-nums text-foreground">
                                {w.value}
                              </span>
                              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                                {w.unit} · {pct.toFixed(pct < 1 ? 1 : 0)}%
                              </span>
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={5}
                >
                  {pieData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend
                  content={<ChartLegendContent nameKey="name" />}
                  className="-translate-y-2 flex-wrap justify-center gap-x-4 gap-y-1.5"
                />
              </PieChart>
            </ChartContainer>
          </div>
        </div>

        {/* Footprint growth (Area, cumulative) */}
        <div className="flex flex-col gap-4 rounded-3xl border border-border/15 bg-muted/10 p-6 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className={EYEBROW}>Footprint Growth</span>
          </div>
          <div className="relative min-h-[240px] w-full flex-1">
            <ChartContainer
              config={chartConfig}
              className="absolute inset-0 aspect-auto h-full w-full"
            >
              <AreaChart
                data={growthData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) =>
                    value.toLocaleDateString("en-US", { month: "short" })
                  }
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={growthYAxisFormatter}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {Number(value).toLocaleString()}
                          </span>
                          <span className="font-mono text-[10px] uppercase text-muted-foreground">
                            W
                          </span>
                        </div>
                      )}
                      labelFormatter={(value, payload) => {
                        const date = payload?.[0]?.payload?.date;
                        if (date instanceof Date) {
                          return date.toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          });
                        }
                        return String(value);
                      }}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="watts"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
