"use client";

import React from "react";
import { RefreshCw, Users, UserCheck, Clock, Gift, Trophy, TrendingUp, Link2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
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
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useReferralDashboard,
  type ReferralDashboardTopReferrer,
  type ReferralDashboardRecentReferral,
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

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TIER_CONFIG = {
  Seed: { color: "#71717a", label: "5%" },
  Grow: { color: "#3b82f6", label: "10%" },
  Scale: { color: "#a855f7", label: "15%" },
  Legend: { color: "#f59e0b", label: "20%" },
} as const;

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 mb-6">
      {title}
    </h2>
  );
}

function ReferralDashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero Stats Skeleton */}
      <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8 lg:p-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-3 w-24 bg-muted/50" />
              <Skeleton className="h-12 w-20 bg-muted/50" />
              <Skeleton className="h-3 w-32 bg-muted/50" />
            </div>
          ))}
        </div>
      </div>

      {/* Charts Skeleton */}
      <div className="grid lg:grid-cols-2 gap-8">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
            <Skeleton className="h-4 w-32 bg-muted/50 mb-6" />
            <Skeleton className="h-64 w-full bg-muted/50 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
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

export function ReferralDashboard() {
  const { data, isLoading, isFetching, isError, refetch } = useReferralDashboard();

  if (isLoading) {
    return <ReferralDashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-12 text-center">
        <p className="text-muted-foreground/60">Unable to load referral dashboard data.</p>
        <Button variant="outline" className="mt-6" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const totalPointsAllTime =
    Number(data.totalPointsAllTime.referrerPoints) +
    Number(data.totalPointsAllTime.refereeBonusPoints) +
    Number(data.totalPointsAllTime.activationBonusPoints);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Referral Dashboard</h1>
          <p className="text-sm text-muted-foreground/60 dark:text-muted-foreground/80 mt-1">
            Internal tracking · Week {data.currentWeek}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
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
        <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8 lg:p-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 divide-y lg:divide-y-0 lg:divide-x divide-border/20 dark:divide-border/40">
            <KPIDisplay
              label="Total Referrals"
              value={data.overview.totalReferrals}
              subtitle={`${data.overview.activeReferrals} active · ${data.overview.pendingReferrals} pending`}
              icon={<Users className="h-4 w-4" />}
            />
            <div className="pt-8 lg:pt-0 lg:pl-12">
              <KPIDisplay
                label="Unique Referrers"
                value={data.overview.uniqueReferrers}
                subtitle={`${data.overview.totalCodesGenerated} codes generated`}
                icon={<UserCheck className="h-4 w-4" />}
              />
            </div>
            <div className="pt-8 lg:pt-0 lg:pl-12">
              <KPIDisplay
                label="In Grace Period"
                value={data.overview.inGracePeriod}
                subtitle={`${data.overview.inBonusPeriod} in bonus period`}
                icon={<Clock className="h-4 w-4" />}
              />
            </div>
            <div className="pt-8 lg:pt-0 lg:pl-12">
              <KPIDisplay
                label="Total Points"
                value={formatPoints(String(totalPointsAllTime))}
                subtitle={`${data.overview.activationBonusesAwarded} activation bonuses`}
                icon={<Gift className="h-4 w-4" />}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Tier Distribution */}
        <section>
          <SectionHeader title="Tier Distribution" />
          <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
            <TierDistributionChart data={data.tierDistribution} />
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
        </section>

        {/* Activation Funnel */}
        <section>
          <SectionHeader title="Activation Funnel" />
          <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
            <ActivationFunnel
              total={data.overview.totalReferrals}
              active={data.overview.activeReferrals}
              pending={data.overview.pendingReferrals}
            />
          </div>
        </section>
      </div>

      {/* Weekly Points Chart */}
      <section>
        <SectionHeader title="Weekly Points (Last 12 Weeks)" />
        <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
          <WeeklyPointsChart data={data.weeklyStats} />
        </div>
      </section>

      {/* Tables Row */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Top Referrers */}
        <section>
          <SectionHeader title="Top Referrers" />
          <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
            <TopReferrersTable data={data.topReferrers} />
          </div>
        </section>

        {/* Recent Referrals */}
        <section>
          <SectionHeader title="Recent Activity" />
          <div className="rounded-3xl bg-card border border-border/20 dark:border-border/40 p-8">
            <RecentReferralsTable data={data.recentReferrals} />
          </div>
        </section>
      </div>
    </div>
  );
}
