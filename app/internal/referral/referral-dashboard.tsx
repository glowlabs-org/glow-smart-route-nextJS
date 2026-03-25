"use client";

import React from "react";
import { Check, Copy, Gift, RefreshCw, TrendingUp, Users, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useReferralDashboardOverview,
  useReferralDashboardTopReferrers,
  useReferralDashboardRecentReferrals,
  useReferralDashboardWeeklyStats,
  useReferralDashboardNewReferees,
  useReferralDashboardKolPayback,
  type ReferralDashboardTopReferrer,
  type ReferralDashboardRecentReferral,
  type ReferralDashboardResponse,
  type ReferralDashboardKolPaybackRangePreset,
  type ReferralDashboardKolPaybackResponse,
  type ReferralDashboardWeeklyReferralActivity,
} from "@/hooks/useReferralDashboard";

function formatWallet(wallet: string) {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function CopyableWallet({ wallet, className }: { wallet: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    toast.success("Wallet address copied");
    setTimeout(() => setCopied(false), 2000);
  }, [wallet]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 font-mono hover:text-foreground transition-colors ${className ?? ""}`}
    >
      {formatWallet(wallet)}
      {copied ? (
        <Check className="w-3 h-3 text-emerald-500" />
      ) : (
        <Copy className="w-3 h-3 opacity-40 hover:opacity-70" />
      )}
    </button>
  );
}

function formatPoints(scaled6: string) {
  const num = Number(scaled6);
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(1);
}

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatLongDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(isoString: string) {
  return new Date(isoString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addCommas(intString: string) {
  return intString.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatUsdFromRawUsdc6(value: string | bigint) {
  const raw = typeof value === "bigint" ? value : BigInt(value);
  const isNegative = raw < 0n;
  const abs = isNegative ? -raw : raw;
  const cents = (abs + 5_000n) / 10_000n;
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, "0");
  return `$${isNegative ? "-" : ""}${addCommas(whole.toString())}.${fraction}`;
}

const TIER_CONFIG = {
  Seed: { color: "#71717a", label: "5%" },
  Grow: { color: "#3b82f6", label: "10%" },
  Scale: { color: "#a855f7", label: "15%" },
  Legend: { color: "#f59e0b", label: "20%" },
} as const;

const KOL_PAYBACK_RANGE_OPTIONS: Array<{
  value: ReferralDashboardKolPaybackRangePreset;
  label: string;
}> = [
  { value: "this_week", label: "This Week" },
  { value: "past_month", label: "Past Month" },
  { value: "past_3_months", label: "Past 3 Months" },
  { value: "past_6_months", label: "Past 6 Months" },
  { value: "year_to_date", label: "YTD" },
  { value: "all_time", label: "All Time" },
];

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 mb-6">
      {title}
    </h2>
  );
}

interface KPIDisplayProps {
  label: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
}

function KPIDisplay({ label, value, subtitle, icon }: KPIDisplayProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-muted-foreground/50">{icon}</span>}
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
          {label}
        </span>
      </div>
      <div className="text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {subtitle && (
        <span className="text-xs text-muted-foreground/60 dark:text-muted-foreground/80 mt-1">
          {subtitle}
        </span>
      )}
    </div>
  );
}

function TierDistributionChart({
  data,
}: {
  data: { seed: number; grow: number; scale: number; legend: number };
}) {
  const chartData = [
    { name: "Seed", value: data.seed, color: TIER_CONFIG.Seed.color },
    { name: "Grow", value: data.grow, color: TIER_CONFIG.Grow.color },
    { name: "Scale", value: data.scale, color: TIER_CONFIG.Scale.color },
    { name: "Legend", value: data.legend, color: TIER_CONFIG.Legend.color },
  ];

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <span className="text-sm text-muted-foreground/50">No tier data available</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8">
      <div className="w-48 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-3">
        {chartData.map((tier) => (
          <div key={tier.name} className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: tier.color }}
            />
            <span className="text-sm font-medium w-16">{tier.name}</span>
            <span className="text-2xl font-semibold tabular-nums">{tier.value}</span>
            <span className="text-xs text-muted-foreground/50">
              ({total > 0 ? ((tier.value / total) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyPointsChart({
  data,
}: {
  data: Array<{
    weekNumber: number;
    totalReferrerPoints: string;
    totalRefereeBonusPoints: string;
    uniqueReferees: number;
  }>;
}) {
  const chartData = data
    .slice()
    .reverse()
    .map((w) => ({
      week: `W${w.weekNumber}`,
      referrer: Number(w.totalReferrerPoints),
      bonus: Number(w.totalRefereeBonusPoints),
      referees: w.uniqueReferees,
    }));

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <span className="text-sm text-muted-foreground/50">No weekly data available</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="referrerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="bonusGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.2)" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground)/0.5)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground)/0.5)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatPoints(String(v))}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border)/0.4)",
              borderRadius: "12px",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => [
              formatPoints(String(value)),
              name === "referrer" ? "Referrer Points" : "Referee Bonus",
            ]}
          />
          <Area
            type="monotone"
            dataKey="referrer"
            stroke="#a855f7"
            strokeWidth={2}
            fill="url(#referrerGradient)"
          />
          <Area
            type="monotone"
            dataKey="bonus"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#bonusGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground/60 dark:text-muted-foreground/80">
        <span className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-[#a855f7] rounded-full" />
          Referrer Points
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-[#22c55e] rounded-full" />
          Referee Bonus
        </span>
      </div>
    </div>
  );
}

function WeeklyReferralActivityChart({
  data,
}: {
  data: ReferralDashboardWeeklyReferralActivity[];
}) {
  const chartData = data
    .slice()
    .reverse()
    .map((week) => ({
      ...week,
      week: week.label,
    }));
  const totalActivity = chartData.reduce(
    (sum, week) => sum + week.referralsLinked + week.activations,
    0
  );

  if (chartData.length === 0 || totalActivity === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <span className="text-sm text-muted-foreground/50">
          No weekly referral activity yet
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border)/0.2)"
          />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground)/0.5)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground)/0.5)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border)/0.4)",
              borderRadius: "12px",
              fontSize: "12px",
            }}
            labelFormatter={(_label, payload) => {
              const point = payload?.[0]?.payload as
                | ReferralDashboardWeeklyReferralActivity
                | undefined;
              if (!point) return _label;
              return `${point.label} · ${formatDate(point.startAt)} - ${formatDate(point.endAt)}`;
            }}
            formatter={(value: number, name: string) => [
              value,
              name === "referralsLinked" ? "Referrals Linked" : "Activations",
            ]}
          />
          <Bar
            dataKey="referralsLinked"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
          />
          <Bar
            dataKey="activations"
            fill="#22c55e"
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground/60 dark:text-muted-foreground/80">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-[4px] bg-[#3b82f6]" />
          Referrals Linked
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-[4px] bg-[#22c55e]" />
          Activations
        </span>
      </div>
    </div>
  );
}

function TopReferrersTable({ data }: { data: ReferralDashboardTopReferrer[] }) {
  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground/50">
        No referrers yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.slice(0, 10).map((referrer, idx) => (
        <div
          key={referrer.referrerWallet}
          className="flex items-center justify-between py-3 border-b border-border/20 dark:border-border/40 last:border-b-0"
        >
          <div className="flex items-center gap-4">
            <span className="text-2xl font-semibold tabular-nums text-muted-foreground/40 w-8">
              {idx + 1}
            </span>
            <div className="flex flex-col">
              {referrer.ensName ? (
                <>
                  <span className="font-medium">{referrer.ensName}</span>
                  <CopyableWallet
                    wallet={referrer.referrerWallet}
                    className="text-xs text-muted-foreground/50"
                  />
                </>
              ) : (
                <CopyableWallet
                  wallet={referrer.referrerWallet}
                  className="text-sm"
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xl font-semibold tabular-nums text-emerald-500">
                {referrer.activeReferees}
              </div>
              <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">
                Active
              </div>
            </div>
            <div className="text-right min-w-[60px]">
              <div className="text-xl font-semibold tabular-nums text-yellow-500">
                {referrer.pendingReferees}
              </div>
              <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">
                Pending
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-border/20 dark:border-border/40 text-xs font-mono px-2"
              style={{
                borderColor: TIER_CONFIG[referrer.tier as keyof typeof TIER_CONFIG]?.color,
                color: TIER_CONFIG[referrer.tier as keyof typeof TIER_CONFIG]?.color,
              }}
            >
              {referrer.tier}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentReferralsTable({ data }: { data: ReferralDashboardRecentReferral[] }) {
  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground/50">
        No recent referrals
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.slice(0, 10).map((referral) => (
        <div
          key={referral.refereeWallet}
          className="flex items-center justify-between py-3 px-4 rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40"
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-2 h-2 rounded-full ${
                referral.status === "active" ? "bg-emerald-500" : "bg-yellow-500"
              }`}
            />
            <div className="flex flex-col">
              <CopyableWallet
                wallet={referral.refereeWallet}
                className="text-sm"
              />
              <span className="text-xs text-muted-foreground/50">
                via <span className="font-medium">{referral.referralCode}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {referral.status !== "active" && (
              <div className="text-right min-w-[90px]">
                <div className="text-xs font-semibold text-yellow-500">
                  +{formatPoints(referral.refereePendingPointsScaled6 ?? "0")} pts
                </div>
                <div className="text-[10px] text-muted-foreground/50">
                  Referee pending
                </div>
              </div>
            )}
            {referral.isInGracePeriod && (
              <Badge
                variant="outline"
                className="border-yellow-500/30 text-yellow-500 text-[10px] font-mono"
              >
                Grace
              </Badge>
            )}
            <div className="text-right">
              <div className="text-xs font-medium">{formatDate(referral.linkedAt)}</div>
              <div className="text-[10px] text-muted-foreground/50">
                {formatTime(referral.linkedAt)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivationFunnel({
  total,
  active,
  pending,
}: {
  total: number;
  active: number;
  pending: number;
}) {
  const activationRate = total > 0 ? ((active / total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70 mb-1">
            Activation Rate
          </div>
          <div className="text-5xl font-semibold tracking-tight tabular-nums">
            {activationRate}%
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground/60">
            {active} of {total} referrals activated
          </div>
        </div>
      </div>
      <div className="h-3 rounded-full bg-muted/50 dark:bg-muted/30 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${activationRate}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/20 dark:border-border/40">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{total}</div>
          <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">
            Total Linked
          </div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums text-emerald-500">{active}</div>
          <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">
            Activated
          </div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums text-yellow-500">{pending}</div>
          <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">
            Pending
          </div>
        </div>
      </div>
    </div>
  );
}

function NewRefereesTable({
  data,
  total,
  truncated,
}: {
  data: ReferralDashboardResponse["newRefereeActivations"]["rows"];
  total: number;
  truncated: boolean;
}) {
  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground/50">
        No new referees with points yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((row) => (
        <div
          key={row.refereeWallet}
          className="rounded-2xl border border-border/20 dark:border-border/40 p-4 bg-muted/20 dark:bg-muted/40"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <CopyableWallet wallet={row.refereeWallet} className="text-sm" />
                <span className="text-[10px] text-muted-foreground/50">
                  via <span className="font-medium">{formatWallet(row.referrerWallet)}</span> ·{" "}
                  {formatDate(row.linkedAt)}
                </span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-emerald-500">
                  +{formatPoints(row.projectedBasePointsScaled6)} pts
                </div>
                <div className="text-[10px] text-muted-foreground/50">Projected base</div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground/70">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-background/60 px-2 py-1">
                <span>Inflation</span>
                <span className="font-medium text-foreground/80">
                  {formatPoints(row.inflationPointsScaled6)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-background/60 px-2 py-1">
                <span>Steering</span>
                <span className="font-medium text-foreground/80">
                  {formatPoints(row.steeringPointsScaled6)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-background/60 px-2 py-1">
                <span>Vault</span>
                <span className="font-medium text-foreground/80">
                  {formatPoints(row.vaultPointsScaled6)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-background/60 px-2 py-1">
                <span>Worth</span>
                <span className="font-medium text-foreground/80">
                  {formatPoints(row.worthPointsScaled6)}
                </span>
              </div>
            </div>
            {truncated && (
              <div className="text-[10px] text-muted-foreground/50">
                Showing top {data.length} of {total} new referees.
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/20 dark:border-border/40 p-6 text-sm text-muted-foreground/60 text-center">
      <div>{message}</div>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

type KolPaybackSale =
  ReferralDashboardKolPaybackResponse["kols"][number]["weeks"][number]["sales"][number];

type KolPaybackWeekRow = {
  weekNumber: number;
  startAt: string;
  endAt: string;
  totalMinerSalesRaw: string;
  totalPaybackRaw: string;
  saleCount: number;
  uniqueBuyers: number;
  sales: KolPaybackSale[];
  kols: Array<{
    kolWallet: string;
    totalMinerSalesRaw: string;
    totalPaybackRaw: string;
    saleCount: number;
    uniqueBuyers: number;
  }>;
};

function buildKolPaybackWeekRows(
  data: ReferralDashboardKolPaybackResponse
): KolPaybackWeekRow[] {
  const weeks = new Map<number, KolPaybackWeekRow>();

  for (const kol of data.kols) {
    for (const week of kol.weeks) {
      const existing = weeks.get(week.weekNumber);
      if (!existing) {
        weeks.set(week.weekNumber, {
          weekNumber: week.weekNumber,
          startAt: week.startAt,
          endAt: week.endAt,
          totalMinerSalesRaw: week.totalMinerSalesRaw,
          totalPaybackRaw: week.totalPaybackRaw,
          saleCount: week.saleCount,
          uniqueBuyers: week.uniqueBuyers,
          sales: [...week.sales],
          kols: [
            {
              kolWallet: kol.kolWallet,
              totalMinerSalesRaw: week.totalMinerSalesRaw,
              totalPaybackRaw: week.totalPaybackRaw,
              saleCount: week.saleCount,
              uniqueBuyers: week.uniqueBuyers,
            },
          ],
        });
        continue;
      }

      existing.totalMinerSalesRaw = (
        BigInt(existing.totalMinerSalesRaw) + BigInt(week.totalMinerSalesRaw)
      ).toString();
      existing.totalPaybackRaw = (
        BigInt(existing.totalPaybackRaw) + BigInt(week.totalPaybackRaw)
      ).toString();
      existing.saleCount += week.saleCount;
      existing.sales.push(...week.sales);
      existing.kols.push({
        kolWallet: kol.kolWallet,
        totalMinerSalesRaw: week.totalMinerSalesRaw,
        totalPaybackRaw: week.totalPaybackRaw,
        saleCount: week.saleCount,
        uniqueBuyers: week.uniqueBuyers,
      });
    }
  }

  return Array.from(weeks.values())
    .map((week) => {
      const uniqueBuyers = new Set(week.sales.map((sale) => sale.buyer)).size;
      const sales = week.sales
        .slice()
        .sort((a, b) => b.saleAt.localeCompare(a.saleAt));

      return {
        ...week,
        uniqueBuyers,
        sales,
      };
    })
    .sort((a, b) => b.weekNumber - a.weekNumber);
}

function KolPaybackExport({
  data,
  isLoading,
  isError,
  isFetching,
  rangePreset,
  isRangePending,
  onRangePresetChange,
  onRetry,
}: {
  data?: ReferralDashboardKolPaybackResponse;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  rangePreset: ReferralDashboardKolPaybackRangePreset;
  isRangePending: boolean;
  onRangePresetChange: (preset: ReferralDashboardKolPaybackRangePreset) => void;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-medium">KoL Miner Export</div>
          <p className="text-sm text-muted-foreground/60 dark:text-muted-foreground/80 mt-1">
            Eligible mining-center sales grouped by protocol week and current referrer.
            {data
              ? ` Program start: ${formatLongDate(data.program.startedAt)}.`
              : " Program start: March 2, 2026."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {KOL_PAYBACK_RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={rangePreset === option.value ? "default" : "outline"}
              disabled={isRangePending}
              onClick={() => onRangePresetChange(option.value)}
              className={
                rangePreset === option.value
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60"
              }
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-border/20 dark:border-border/40 p-5"
              >
                <Skeleton className="h-3 w-24 bg-muted/50" />
                <Skeleton className="h-8 w-24 bg-muted/50 mt-3" />
              </div>
            ))}
          </div>
          <Skeleton className="h-56 w-full bg-muted/50 rounded-2xl" />
        </div>
      ) : isError || !data ? (
        <SectionError
          message="Unable to load KoL payback export."
          onRetry={onRetry}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-border/20 dark:border-border/40 p-5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                Weeks Covered
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                {data.range.endWeek - data.range.startWeek + 1}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/60">
                Week {data.range.startWeek} to Week {data.range.endWeek}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/50">
                {formatDate(data.range.startWeekAt)} to {formatDate(data.range.endWeekAt)}
              </div>
            </div>
            <div className="rounded-2xl border border-border/20 dark:border-border/40 p-5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                Eligible Sales
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                {data.summary.totalEligibleSales}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/60">
                {data.program.eligibleKolWallets.length} KoL wallets tracked
              </div>
            </div>
            <div className="rounded-2xl border border-border/20 dark:border-border/40 p-5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                Miner Sales
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                {formatUsdFromRawUsdc6(data.summary.totalMinerSalesRaw)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/60">
                Gross eligible miner volume
              </div>
            </div>
            <div className="rounded-2xl border border-border/20 dark:border-border/40 p-5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                Payback
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                {formatUsdFromRawUsdc6(data.summary.totalPaybackRaw)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/60">
                {data.program.paybackPercent}% of eligible sales
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {buildKolPaybackWeekRows(data).map((week) => (
              <div
                key={week.weekNumber}
                className="rounded-2xl border border-border/20 dark:border-border/40 overflow-hidden"
              >
                <div className="border-b border-border/20 dark:border-border/40 px-5 py-4 bg-muted/20 dark:bg-muted/40">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="text-lg font-semibold tracking-tight">
                        Week {week.weekNumber}
                      </div>
                      <div className="text-xs text-muted-foreground/60 mt-1">
                        {formatDate(week.startAt)} to {formatDate(week.endAt)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="rounded-xl bg-background/70 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                          Sales
                        </div>
                        <div className="mt-1 text-lg font-semibold tabular-nums">
                          {week.saleCount}
                        </div>
                      </div>
                      <div className="rounded-xl bg-background/70 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                          Buyers
                        </div>
                        <div className="mt-1 text-lg font-semibold tabular-nums">
                          {week.uniqueBuyers}
                        </div>
                      </div>
                      <div className="rounded-xl bg-background/70 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                          Miner Sales
                        </div>
                        <div className="mt-1 text-lg font-semibold tabular-nums">
                          {formatUsdFromRawUsdc6(week.totalMinerSalesRaw)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-background/70 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                          Payback
                        </div>
                        <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-500">
                          {formatUsdFromRawUsdc6(week.totalPaybackRaw)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    {week.kols.map((kol) => (
                      <div
                        key={`${week.weekNumber}-${kol.kolWallet}`}
                        className="rounded-2xl border border-border/20 dark:border-border/40 p-4 bg-muted/20 dark:bg-muted/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-2">
                              KoL Wallet
                            </div>
                            <CopyableWallet wallet={kol.kolWallet} className="text-sm" />
                          </div>
                          <Badge
                            variant="outline"
                            className="border-border/20 dark:border-border/40 text-[10px] font-mono"
                          >
                            {data.program.paybackPercent}% payback
                          </Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                              Sales
                            </div>
                            <div className="mt-1 font-semibold tabular-nums">
                              {kol.saleCount}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                              Volume
                            </div>
                            <div className="mt-1 font-semibold tabular-nums">
                              {formatUsdFromRawUsdc6(kol.totalMinerSalesRaw)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                              Payback
                            </div>
                            <div className="mt-1 font-semibold tabular-nums text-emerald-500">
                              {formatUsdFromRawUsdc6(kol.totalPaybackRaw)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {week.sales.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/20 dark:border-border/40 px-4 py-8 text-center text-sm text-muted-foreground/50">
                      No eligible miner sales in this week.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/20 dark:border-border/40 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableHead className="px-4">KoL</TableHead>
                            <TableHead>Buyer</TableHead>
                            <TableHead>Farm</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Payback</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Sale At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {week.sales.map((sale) => (
                            <TableRow key={sale.transactionHash}>
                              <TableCell className="px-4 py-3">
                                <CopyableWallet wallet={sale.kolWallet} className="text-xs" />
                              </TableCell>
                              <TableCell className="py-3">
                                <CopyableWallet wallet={sale.buyer} className="text-xs" />
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="text-sm font-medium">
                                  {sale.farmName ?? "—"}
                                </div>
                                <div className="text-[10px] text-muted-foreground/50">
                                  {sale.stepsPurchased} steps
                                </div>
                              </TableCell>
                              <TableCell className="py-3 text-right font-medium tabular-nums">
                                {formatUsdFromRawUsdc6(sale.amountRaw)}
                              </TableCell>
                              <TableCell className="py-3 text-right font-medium tabular-nums text-emerald-500">
                                {formatUsdFromRawUsdc6(sale.paybackRaw)}
                              </TableCell>
                              <TableCell className="py-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    sale.referralStatus === "active"
                                      ? "border-emerald-500/30 text-emerald-500 text-[10px] font-mono"
                                      : "border-yellow-500/30 text-yellow-500 text-[10px] font-mono"
                                  }
                                >
                                  {sale.referralStatus}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="text-sm">{formatDateTime(sale.saleAt)}</div>
                                <div className="text-[10px] text-muted-foreground/50">
                                  Linked {formatDateTime(sale.referralLinkedAt)}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground/50">
            {data.program.eligibilityRule}
            {isFetching ? " Refreshing…" : ""}
          </div>
        </>
      )}
    </div>
  );
}

export function ReferralDashboard() {
  const [kolRangePreset, setKolRangePreset] =
    React.useState<ReferralDashboardKolPaybackRangePreset>("all_time");
  const [isKolRangePending, startKolRangeTransition] = React.useTransition();

  const overviewQuery = useReferralDashboardOverview();
  const topReferrersQuery = useReferralDashboardTopReferrers();
  const recentReferralsQuery = useReferralDashboardRecentReferrals();
  const weeklyStatsQuery = useReferralDashboardWeeklyStats();
  const newRefereesQuery = useReferralDashboardNewReferees();
  const kolPaybackQuery = useReferralDashboardKolPayback(kolRangePreset);

  const currentWeek =
    overviewQuery.data?.currentWeek ?? weeklyStatsQuery.data?.currentWeek;
  const isFetching =
    overviewQuery.isFetching ||
    topReferrersQuery.isFetching ||
    recentReferralsQuery.isFetching ||
    weeklyStatsQuery.isFetching ||
    newRefereesQuery.isFetching ||
    kolPaybackQuery.isFetching;

  const refetchAll = () => {
    overviewQuery.refetch();
    topReferrersQuery.refetch();
    recentReferralsQuery.refetch();
    weeklyStatsQuery.refetch();
    newRefereesQuery.refetch();
    kolPaybackQuery.refetch();
  };

  const totalPointsAllTime = weeklyStatsQuery.data
    ? Number(weeklyStatsQuery.data.totalPointsAllTime.referrerPoints) +
      Number(weeklyStatsQuery.data.totalPointsAllTime.refereeBonusPoints) +
      Number(weeklyStatsQuery.data.totalPointsAllTime.activationBonusPoints)
    : null;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Referral Dashboard</h1>
          <p className="text-sm text-muted-foreground/60 dark:text-muted-foreground/80 mt-1">
            Internal tracking · Week {currentWeek ?? "—"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refetchAll}
          disabled={isFetching}
          className="border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Hero KPIs */}
      <section>
        <SectionHeader title="Overview" />
        {overviewQuery.isLoading ? (
          <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8 lg:p-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 divide-y lg:divide-y-0 lg:divide-x divide-border/20 dark:divide-border/40">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-3 w-24 bg-muted/50" />
                  <Skeleton className="h-12 w-20 bg-muted/50" />
                  <Skeleton className="h-3 w-32 bg-muted/50" />
                </div>
              ))}
            </div>
          </div>
        ) : overviewQuery.isError || !overviewQuery.data ? (
          <SectionError
            message="Unable to load overview."
            onRetry={() => overviewQuery.refetch()}
          />
        ) : (
          <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8 lg:p-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 divide-y lg:divide-y-0 lg:divide-x divide-border/20 dark:divide-border/40">
              <KPIDisplay
                label="Total Referrals"
                value={overviewQuery.data.overview.totalReferrals}
                subtitle={`${overviewQuery.data.overview.activeReferrals} active · ${overviewQuery.data.overview.pendingReferrals} pending`}
                icon={<Users className="h-4 w-4" />}
              />
              <div className="pt-8 lg:pt-0 lg:pl-12">
                <KPIDisplay
                  label="Unique Referrers"
                  value={overviewQuery.data.overview.uniqueReferrers}
                  subtitle={`${overviewQuery.data.overview.totalCodesGenerated} codes generated`}
                  icon={<UserCheck className="h-4 w-4" />}
                />
              </div>
              <div className="pt-8 lg:pt-0 lg:pl-12">
                <KPIDisplay
                  label="Pending Activation"
                  value={newRefereesQuery.data?.newRefereeActivations.total ?? "—"}
                  subtitle={`${overviewQuery.data.overview.pendingReferrals} total pending`}
                  icon={<TrendingUp className="h-4 w-4" />}
                />
              </div>
              <div className="pt-8 lg:pt-0 lg:pl-12">
                <KPIDisplay
                  label="Total Points"
                  value={
                    totalPointsAllTime == null
                      ? "—"
                      : formatPoints(String(totalPointsAllTime))
                  }
                  subtitle={`${overviewQuery.data.overview.activationBonusesAwarded} activation bonuses`}
                  icon={<Gift className="h-4 w-4" />}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Tier Distribution */}
        <section>
          <SectionHeader title="Tier Distribution" />
          {overviewQuery.isLoading ? (
            <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
              <Skeleton className="h-64 w-full bg-muted/50 rounded-xl" />
            </div>
          ) : overviewQuery.isError || !overviewQuery.data ? (
            <SectionError
              message="Unable to load tier distribution."
              onRetry={() => overviewQuery.refetch()}
            />
          ) : (
            <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
              <TierDistributionChart data={overviewQuery.data.tierDistribution} />
              <div className="mt-6 pt-6 border-t border-border/20 dark:border-border/40">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground/50 mb-1">Seed</div>
                    <div className="text-sm font-medium">1 ref · 5%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground/50 mb-1">Grow</div>
                    <div className="text-sm font-medium">2-3 refs · 10%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground/50 mb-1">Scale</div>
                    <div className="text-sm font-medium">4-6 refs · 15%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground/50 mb-1">Legend</div>
                    <div className="text-sm font-medium">7+ refs · 20%</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Activation Funnel */}
        <section>
          <SectionHeader title="Activation Funnel" />
          {overviewQuery.isLoading ? (
            <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
              <Skeleton className="h-40 w-full bg-muted/50 rounded-xl" />
            </div>
          ) : overviewQuery.isError || !overviewQuery.data ? (
            <SectionError
              message="Unable to load activation funnel."
              onRetry={() => overviewQuery.refetch()}
            />
          ) : (
            <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
              <ActivationFunnel
                total={overviewQuery.data.overview.totalReferrals}
                active={overviewQuery.data.overview.activeReferrals}
                pending={overviewQuery.data.overview.pendingReferrals}
              />
            </div>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <section>
          <SectionHeader title="Weekly Points (Last 12 Weeks)" />
          {weeklyStatsQuery.isLoading ? (
            <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
              <Skeleton className="h-64 w-full bg-muted/50 rounded-xl" />
            </div>
          ) : weeklyStatsQuery.isError || !weeklyStatsQuery.data ? (
            <SectionError
              message="Unable to load weekly stats."
              onRetry={() => weeklyStatsQuery.refetch()}
            />
          ) : (
            <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
              <WeeklyPointsChart data={weeklyStatsQuery.data.weeklyStats} />
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="Weekly Referral Activity (Last 12 Weeks)" />
          {weeklyStatsQuery.isLoading ? (
            <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
              <Skeleton className="h-64 w-full bg-muted/50 rounded-xl" />
            </div>
          ) : weeklyStatsQuery.isError || !weeklyStatsQuery.data ? (
            <SectionError
              message="Unable to load weekly referral activity."
              onRetry={() => weeklyStatsQuery.refetch()}
            />
          ) : (
            <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
              <WeeklyReferralActivityChart
                data={weeklyStatsQuery.data.weeklyReferralActivity}
              />
            </div>
          )}
        </section>
      </div>

      {/* Tables Row */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Top Referrers */}
        <section>
          <SectionHeader title="Top Referrers" />
          {topReferrersQuery.isLoading ? (
            <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
              <Skeleton className="h-48 w-full bg-muted/50 rounded-xl" />
            </div>
          ) : topReferrersQuery.isError || !topReferrersQuery.data ? (
            <SectionError
              message="Unable to load top referrers."
              onRetry={() => topReferrersQuery.refetch()}
            />
          ) : (
            <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
              <TopReferrersTable data={topReferrersQuery.data.topReferrers} />
            </div>
          )}
        </section>

        {/* Recent Referrals */}
        <section>
          <SectionHeader title="Recent Activity" />
          {recentReferralsQuery.isLoading ? (
            <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
              <Skeleton className="h-48 w-full bg-muted/50 rounded-xl" />
            </div>
          ) : recentReferralsQuery.isError || !recentReferralsQuery.data ? (
            <SectionError
              message="Unable to load recent referrals."
              onRetry={() => recentReferralsQuery.refetch()}
            />
          ) : (
            <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
              <RecentReferralsTable data={recentReferralsQuery.data.recentReferrals} />
            </div>
          )}
        </section>
      </div>

      {/* New Referees */}
      <section>
        <SectionHeader title="New Referees (0 Last Week → Points Now)" />
        {newRefereesQuery.isLoading ? (
          <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
            <Skeleton className="h-48 w-full bg-muted/50 rounded-xl" />
          </div>
        ) : newRefereesQuery.isError || !newRefereesQuery.data ? (
          <SectionError
            message="Unable to load new referees."
            onRetry={() => newRefereesQuery.refetch()}
          />
        ) : (
          <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
            <NewRefereesTable
              data={newRefereesQuery.data.newRefereeActivations.rows}
              total={newRefereesQuery.data.newRefereeActivations.total}
              truncated={newRefereesQuery.data.newRefereeActivations.truncated}
            />
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="KoL Miner Export" />
        <KolPaybackExport
          data={kolPaybackQuery.data}
          isLoading={kolPaybackQuery.isLoading}
          isError={kolPaybackQuery.isError}
          isFetching={kolPaybackQuery.isFetching}
          rangePreset={kolRangePreset}
          isRangePending={isKolRangePending}
          onRangePresetChange={(preset) => {
            startKolRangeTransition(() => {
              setKolRangePreset(preset);
            });
          }}
          onRetry={() => kolPaybackQuery.refetch()}
        />
      </section>
    </div>
  );
}
