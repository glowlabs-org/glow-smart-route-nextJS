"use client";

import React from "react";
import { useAccount } from "wagmi";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatUnits } from "viem";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { isKolWallet } from "@/lib/kol";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { KOL_WALLETS } from "@/lib/kol";
import {
  useKolDashboard,
  type KolAuth,
  type KolDashboardFilter,
  type KolDashboardResponse,
} from "@/hooks/useKolDashboard";

// ---- Formatting helpers (shared with internal dashboard) ----

function formatWallet(wallet: string) {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function CopyableWallet({
  wallet,
  className,
}: {
  wallet: string;
  className?: string;
}) {
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
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 opacity-40 hover:opacity-70" />
      )}
    </button>
  );
}

function addCommas(s: string) {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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

function formatGlwAmount(
  value: string | bigint,
  options?: { raw?: boolean; maximumFractionDigits?: number }
) {
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;
  let normalized = "";
  if (options?.raw) {
    try {
      const raw = typeof value === "bigint" ? value : BigInt(value);
      normalized = formatUnits(raw, 18);
    } catch {
      normalized = String(value);
    }
  } else {
    normalized = typeof value === "bigint" ? value.toString() : value;
  }
  const num = Number(normalized);
  if (!Number.isFinite(num)) return `${value} GLW`;
  return `${num.toLocaleString("en-US", { maximumFractionDigits })} GLW`;
}

function formatPercentValue(value: string | number) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return `${value}%`;
  return `${num.toFixed(num >= 10 ? 2 : 3)}%`;
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

// ---- Month filter generation ----

const GENESIS_TIMESTAMP = 1700352000;
const WEEK_SECONDS = 604800;

function getProtocolWeekForDate(date: Date): number {
  const unix = Math.floor(date.getTime() / 1000);
  return Math.floor((unix - GENESIS_TIMESTAMP) / WEEK_SECONDS);
}

function generateMonthOptions(): Array<{
  kind: "month";
  startWeek: number;
  endWeek: number;
  label: string;
  key: string;
}> {
  const now = new Date();
  const options: Array<{
    kind: "month";
    startWeek: number;
    endWeek: number;
    label: string;
    key: string;
  }> = [];

  let cursor = new Date(Date.UTC(2026, 2, 1));
  while (cursor <= now) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1));
    const firstDayNextMonth = new Date(Date.UTC(year, month + 1, 1));
    options.push({
      kind: "month",
      startWeek: getProtocolWeekForDate(firstDay),
      endWeek: getProtocolWeekForDate(firstDayNextMonth) - 1,
      label: firstDay.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
      key: `${year}-${month}`,
    });
    cursor = new Date(Date.UTC(year, month + 1, 1));
  }

  return options;
}

// ---- Metric card ----

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "success";
}) {
  return (
    <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-card px-5 py-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl ${
          tone === "success" ? "text-emerald-500" : ""
        }`}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1.5 text-xs leading-5 text-muted-foreground/60">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

// ---- Chart tooltip ----

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/20 dark:border-border/40 bg-card px-3 py-2.5">
      <div className="mb-1.5 text-xs font-mono font-medium">{label}</div>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          className="flex items-center gap-2 text-xs leading-5"
        >
          <div
            className="h-2 w-2 shrink-0 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground/60 dark:text-muted-foreground/80">{entry.name}</span>
          <span className="ml-auto font-mono font-medium tabular-nums">
            ${entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- Auth gate ----

function AuthGate({
  onAuthenticated,
}: {
  onAuthenticated: (auth: KolAuth) => void;
}) {
  const { address, isConnected } = useAccount();
  const { signer, isLoading: isSignerLoading } = useEthersSigner();
  const [isSigning, setIsSigning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Admin mode state: step 1 = password, step 2 = wallet picker
  const [showAdminLogin, setShowAdminLogin] = React.useState(false);
  const [adminPassword, setAdminPassword] = React.useState("");
  const [adminAuthenticated, setAdminAuthenticated] = React.useState(false);
  const [adminWallet, setAdminWallet] = React.useState(KOL_WALLETS[0]!);
  const [adminError, setAdminError] = React.useState<string | null>(null);

  const isKol = isKolWallet(address);

  const handleSign = React.useCallback(async () => {
    if (!signer || !address) return;
    setIsSigning(true);
    setError(null);
    try {
      const message = `Authenticate as KoL for Glow Dashboard\n\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);
      onAuthenticated({ walletAddress: address, signature, message });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Signing failed. Please try again."
      );
    } finally {
      setIsSigning(false);
    }
  }, [signer, address, onAuthenticated]);

  const handleAdminPasswordSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!adminPassword) return;
      setAdminError(null);
      // Verify password server-side by making a test request
      const res = await fetch("/api/kol/payback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: KOL_WALLETS[0],
          adminPassword,
          rangePreset: "all_time",
        }),
      });
      if (res.ok) {
        setAdminAuthenticated(true);
      } else {
        setAdminError("Invalid password");
      }
    },
    [adminPassword]
  );

  const handleAdminWalletSelect = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onAuthenticated({ walletAddress: adminWallet, adminPassword });
    },
    [adminWallet, adminPassword, onAuthenticated]
  );

  // Admin login: step 1 - password
  if (showAdminLogin && !adminAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <form
          onSubmit={handleAdminPasswordSubmit}
          className="w-full max-w-sm space-y-4"
        >
          <h1 className="text-2xl font-bold tracking-tight">Admin Access</h1>
          <p className="text-sm text-muted-foreground/60 dark:text-muted-foreground/80">
            Enter the admin password to continue.
          </p>
          <Input
            type="password"
            placeholder="Admin password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
          {adminError && (
            <p className="text-sm text-red-500">{adminError}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!adminPassword}
              className="flex-1 bg-foreground text-background hover:bg-foreground/90"
            >
              Continue
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAdminLogin(false);
                setAdminPassword("");
                setAdminError(null);
              }}
              className="border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60"
            >
              Back
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // Admin login: step 2 - wallet picker (only after password verified)
  if (showAdminLogin && adminAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <form
          onSubmit={handleAdminWalletSelect}
          className="w-full max-w-sm space-y-4"
        >
          <h1 className="text-2xl font-bold tracking-tight">Select KoL</h1>
          <p className="text-sm text-muted-foreground/60 dark:text-muted-foreground/80">
            Choose a KoL wallet to view their dashboard.
          </p>
          <select
            value={adminWallet}
            onChange={(e) => setAdminWallet(e.target.value)}
            className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm font-mono transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            {KOL_WALLETS.map((w) => (
              <option key={w} value={w}>
                {formatWallet(w)}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            className="w-full bg-foreground text-background hover:bg-foreground/90"
          >
            View Dashboard
          </Button>
        </form>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-between py-16">
        <div />
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight">KoL Dashboard</h1>
          <p className="text-sm text-muted-foreground/60 dark:text-muted-foreground/80">
            Connect your KoL wallet to access your commission tracking
            and performance metrics.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdminLogin(true)}
          className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors"
        >
          Admin
        </button>
      </div>
    );
  }

  if (!isKol) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-between py-16">
        <div />
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-sm text-muted-foreground/60 dark:text-muted-foreground/80">
            The connected wallet{" "}
            <span className="font-mono text-sm">{formatWallet(address!)}</span>{" "}
            is not registered as a KoL. Please connect with your approved wallet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdminLogin(true)}
          className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors"
        >
          Admin
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">KoL Dashboard</h1>
        <p className="text-muted-foreground">
          Sign a message to verify ownership of{" "}
          <span className="font-mono text-sm">{formatWallet(address!)}</span>{" "}
          and access your dashboard.
        </p>
        <Button
          onClick={handleSign}
          disabled={isSigning || isSignerLoading}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          {isSigning ? "Signing..." : "Verify Identity"}
        </Button>
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}

// ---- Single-KoL Dashboard View ----

type KolData = NonNullable<KolDashboardResponse["kol"]>;

function KolDashboardView({ auth }: { auth: KolAuth }) {
  const [filter, setFilter] = React.useState<KolDashboardFilter>({
    kind: "all_time",
  });
  const [isFilterPending, startFilterTransition] = React.useTransition();
  const monthOptions = React.useMemo(() => generateMonthOptions(), []);

  const { data, isLoading, isError, isFetching, refetch } = useKolDashboard(
    auth,
    filter
  );

  const kol = data?.kol;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">KoL Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground/60">
            Commission tracking for{" "}
            <CopyableWallet wallet={auth.walletAddress} className="text-sm" />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {monthOptions.map((option) => {
            const isActive =
              filter.kind === "month" &&
              filter.startWeek === option.startWeek &&
              filter.endWeek === option.endWeek;
            return (
              <Button
                key={option.key}
                type="button"
                size="sm"
                variant={isActive ? "default" : "outline"}
                disabled={isFilterPending}
                onClick={() =>
                  startFilterTransition(() => setFilter(option))
                }
                className={
                  isActive
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "border-border/20 dark:border-border/40"
                }
              >
                {option.label}
              </Button>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant={filter.kind === "all_time" ? "default" : "outline"}
            disabled={isFilterPending}
            onClick={() =>
              startFilterTransition(() => setFilter({ kind: "all_time" }))
            }
            className={
              filter.kind === "all_time"
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "border-border/20 dark:border-border/40"
            }
          >
            All Time
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/20 p-5 dark:border-border/40"
              >
                <Skeleton className="h-3 w-24 bg-muted/50" />
                <Skeleton className="mt-3 h-8 w-28 bg-muted/50" />
                <Skeleton className="mt-2 h-3 w-32 bg-muted/50" />
              </div>
            ))}
          </div>
          <Skeleton className="h-52 w-full rounded-2xl bg-muted/50" />
        </div>
      ) : isError || !data ? (
        <div className="rounded-2xl border border-border/20 p-6 text-center text-sm text-muted-foreground/60 dark:border-border/40">
          <div>Unable to load dashboard data.</div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      ) : !kol ? (
        <div className="rounded-2xl border border-border/20 p-6 text-center text-sm text-muted-foreground/60 dark:border-border/40">
          No data found for your wallet in this period.
        </div>
      ) : (
        <KolContent
          kol={kol}
          range={data.range}
          program={data.program}
          isFetching={isFetching}
        />
      )}
    </div>
  );
}

function KolContent({
  kol,
  range,
  program,
  isFetching,
}: {
  kol: KolData;
  range: KolDashboardResponse["range"];
  program: KolDashboardResponse["program"];
  isFetching: boolean;
}) {
  const totalSales =
    kol.attributionBreakdown.direct.saleCount +
    kol.attributionBreakdown.secondDegree.saleCount;

  const currentWeek = getProtocolWeekForDate(new Date());

  // Only include weeks that have started (current + past)
  const activeWeeks = kol.weeks.filter((w) => w.weekNumber <= currentWeek);

  // Chart data
  const chartData = activeWeeks
    .slice()
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((w) => ({
      name: `W${w.weekNumber}`,
      volume: Math.round(
        Number(formatUnits(BigInt(w.totalMinerSalesRaw), 6))
      ),
      payback:
        Math.round(
          Number(formatUnits(BigInt(w.totalPaybackRaw), 6)) * 100
        ) / 100,
    }));

  return (
    <>
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Sales" value={totalSales} hint={`${kol.attributionBreakdown.direct.saleCount} direct, ${kol.attributionBreakdown.secondDegree.saleCount} 2nd-degree`} />
        <MetricCard
          label="Volume"
          value={formatUsdFromRawUsdc6(kol.totalMinerSalesRaw)}
          hint={`Week ${range.startWeek} - ${range.endWeek}`}
        />
        <MetricCard
          label="Payback"
          value={formatUsdFromRawUsdc6(kol.totalPaybackRaw)}
          hint={`${program.baseCommissionPercent}% base commission`}
          tone="success"
        />
        <MetricCard
          label="Rolling 30D GLW"
          value={formatGlwAmount(
            kol.rolling30DayDelegation.totalDelegatedGlwRaw,
            { raw: true }
          )}
          hint={`${kol.rolling30DayDelegation.uniqueDelegators} delegators`}
        />
        <MetricCard
          label="Commission"
          value={formatPercentValue(
            kol.rolling30DayDelegation.totalCommissionPercent
          )}
          hint={`${formatPercentValue(kol.rolling30DayDelegation.ecosystemBonusPercent)} bonus`}
        />
      </div>

      {/* Weekly Trends Chart */}
      {chartData.length > 1 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-4 w-1 rounded-full bg-emerald-500/70" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Weekly Trends
            </span>
          </div>
          <div className="rounded-2xl border border-border/20 dark:border-border/40 bg-card p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={chartData}
                barGap={2}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border)/0.2)"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground)/0.5)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground)/0.5)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                  }
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="volume" name="Volume" fill="#d4d4d8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="payback" name="Payback" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 flex items-center justify-center gap-6 text-xs text-muted-foreground/60">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-[4px] bg-[#d4d4d8]" />
                Volume
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-[4px] bg-[#10b981]" />
                Payback
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Breakdown Table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="h-4 w-1 rounded-full bg-foreground/70" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Weekly Breakdown
          </span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/20 dark:border-border/40 bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="px-4">Week</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Payback</TableHead>
                <TableHead className="text-right">Delegated GLW</TableHead>
                <TableHead className="text-right pr-4">Rolling GLW</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeWeeks
                .slice()
                .sort((a, b) => b.weekNumber - a.weekNumber)
                .map((week) => {
                  const weekDelegated =
                    BigInt(week.delegationBreakdown.direct.totalDelegatedGlwRaw) +
                    BigInt(week.delegationBreakdown.secondDegree.totalDelegatedGlwRaw);
                  const isCurrentWeek = week.weekNumber === currentWeek;

                  return (
                    <React.Fragment key={week.weekNumber}>
                      <TableRow className="hover:bg-muted/20">
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Week {week.weekNumber}</span>
                            {isCurrentWeek && (
                              <Badge variant="outline" className="border-border/20 dark:border-border/40 text-[10px] font-mono">
                                In progress
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground/50">
                            {formatDate(week.startAt)} - {formatDate(week.endAt)}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right font-medium tabular-nums">
                          {week.saleCount}
                        </TableCell>
                        <TableCell className="py-3 text-right font-medium tabular-nums">
                          {formatUsdFromRawUsdc6(week.totalMinerSalesRaw)}
                        </TableCell>
                        <TableCell className="py-3 text-right font-medium tabular-nums text-emerald-500">
                          {formatUsdFromRawUsdc6(week.totalPaybackRaw)}
                        </TableCell>
                        <TableCell className="py-3 text-right tabular-nums">
                          {formatGlwAmount(weekDelegated, { raw: true })}
                        </TableCell>
                        <TableCell className="py-3 text-right pr-4 tabular-nums">
                          {formatGlwAmount(week.rolling30DayDelegation.totalDelegatedGlwRaw, { raw: true })}
                        </TableCell>
                      </TableRow>

                      {/* Expandable sale rows */}
                      {week.sales.length > 0 && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="p-0">
                            <details className="group">
                              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground/50 transition-colors marker:content-none hover:text-muted-foreground/70">
                                <span className="transition group-open:rotate-90">&#9654;</span>
                                {week.sales.length} sale{week.sales.length === 1 ? "" : "s"}
                              </summary>
                              <div className="border-t border-border/10 dark:border-border/20">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                                      <TableHead className="px-4 text-[10px]">Type</TableHead>
                                      <TableHead className="text-[10px]">Buyer</TableHead>
                                      <TableHead className="text-[10px]">Farm</TableHead>
                                      <TableHead className="text-right text-[10px]">Amount</TableHead>
                                      <TableHead className="text-right text-[10px]">Payback</TableHead>
                                      <TableHead className="text-[10px] pr-4">Date</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {week.sales.map((sale) => (
                                      <TableRow key={sale.transactionHash} className="text-xs">
                                        <TableCell className="px-4 py-2">
                                          <Badge
                                            variant="outline"
                                            className="border-border/20 text-[10px] font-mono dark:border-border/40"
                                          >
                                            {sale.attributionType === "direct_kol" ? "direct" : "2nd deg"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <CopyableWallet wallet={sale.buyer} className="text-[10px]" />
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <div className="font-medium">{sale.farmName ?? "\u2014"}</div>
                                          <div className="text-[10px] text-muted-foreground/50">{sale.stepsPurchased} steps</div>
                                        </TableCell>
                                        <TableCell className="py-2 text-right font-medium tabular-nums">
                                          {formatUsdFromRawUsdc6(sale.amountRaw)}
                                        </TableCell>
                                        <TableCell className="py-2 text-right font-medium tabular-nums text-emerald-500">
                                          {formatUsdFromRawUsdc6(sale.paybackRaw)}
                                        </TableCell>
                                        <TableCell className="py-2 pr-4">
                                          {formatDateTime(sale.saleAt)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </details>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>

      {isFetching && (
        <div className="text-xs text-muted-foreground/50">Refreshing...</div>
      )}
    </>
  );
}

// ---- Main export ----

export function KolDashboard() {
  const [auth, setAuth] = React.useState<KolAuth | null>(null);

  if (!auth) {
    return <AuthGate onAuthenticated={setAuth} />;
  }

  return <KolDashboardView auth={auth} />;
}
