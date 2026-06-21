"use client";

/**
 * Unified Wallet Leaderboard (the single board on /leaderboard).
 *
 * Merges the former Impact and Delegators tabs into one wallet leaderboard
 * with a 3-metric toggle:
 *   - vaultedGLW (default): live actively-delegated GLW principal
 *     (principal − recovered)
 *   - watts: realized V2 impact watts
 *   - carbonCredits: realized V2 carbon credits
 *
 * Backed by `/api/impact/wallet-leaderboard`, which unions delegators with
 * V2 impact-earning wallets and returns every metric per row already ranked
 * by the selected sort. We fetch the top 100 for the active metric and
 * paginate client-side; the podium and "Top X%" follow the active metric.
 *
 * Visual design carried over from the V2 impact leaderboard: top-3 colored
 * rank badges, "Top X%" percentile, self-row highlight, ENS over address,
 * desktop table + mobile card layouts.
 */
import React from "react";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { useAccount, useEnsAddress } from "wagmi";
import { ArrowDown, Copy, Search } from "lucide-react";
import { isAddress } from "viem";
import { normalize } from "viem/ens";

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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { formatNumber } from "@/utils/format";
import { trackEvent } from "@/lib/telemetry";
import { useEnsNames } from "@/hooks/useEnsNames";
import { shortAddress, formatTopPercentile } from "@/utils/impact";
import { copyTextToClipboard } from "@/utils/clipboard";
import { formatGLW } from "@/hooks";
import {
  useWalletLeaderboard,
  type WalletLeaderboardRow,
  type WalletLeaderboardSort,
} from "@/hooks/v2-impact";
import { WalletImpactDialog } from "./wallet-impact-dialog";

const PAGE_SIZE = 50;
const FETCH_LIMIT = 100;

/** The slice of translated strings this view reads. */
type LeaderboardStrings = ReturnType<
  typeof useLang
>["t"]["routes"]["impactLeaderboard"];

/** parseFloat is fine here — these strings are only used for display. */
function fmtMetric(value: string | null | undefined, decimals = 2): string {
  if (value == null) return "-";
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return "-";
  return formatNumber(n, { maximumFractionDigits: decimals });
}

/** The displayed value for a row under a given metric. */
function metricValue(row: WalletLeaderboardRow, key: WalletLeaderboardSort): string {
  if (key === "vaultedGlw") return formatGLW(row.vaultedGlwWei);
  if (key === "watts") return fmtMetric(row.totalWatts);
  return fmtMetric(row.totalCarbonCredits);
}

/** Rank cell: a colored badge for the top 3, a percentile for the rest. */
function RankCell({
  rank,
  total,
  t,
}: {
  rank: number;
  total: number;
  t: LeaderboardStrings;
}) {
  if (rank === 1 || rank === 2 || rank === 3) {
    const tint =
      rank === 1
        ? "bg-[color:var(--color-glow-yellow)]/80"
        : rank === 2
          ? "bg-[color:var(--color-glow-green)]/80"
          : "bg-[color:var(--color-glow-purple)]/80";
    return (
      <span
        className={cn(
          "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-glow-black)]",
          tint,
        )}
      >
        {t.rankN(String(rank))}
      </span>
    );
  }
  const pct = total > 0 ? (rank / total) * 100 : NaN;
  return (
    <div className="flex flex-col leading-tight">
      <span className="font-mono text-sm font-medium tabular-nums text-foreground">
        #{rank}
      </span>
      {rank > 100 && Number.isFinite(pct) && (
        <span className="font-mono text-[10px] text-muted-foreground">
          {t.topPercentile(formatTopPercentile(pct))}
        </span>
      )}
    </div>
  );
}

type PodiumRank = 1 | 2 | 3;

/** Per-rank styling for the podium cards. Mirrors the RankCell palette. */
const PODIUM_VARIANTS: Record<
  PodiumRank,
  {
    label: string;
    cardClass: string;
    cardHeight: string;
  }
> = {
  1: {
    label: "1st",
    cardClass:
      "bg-gradient-to-b from-[color:var(--color-glow-yellow)]/20 to-transparent dark:from-[color:var(--color-glow-yellow)]/10 ring-1 ring-[color:var(--color-glow-yellow)]/30",
    cardHeight: "md:min-h-[260px]",
  },
  2: {
    label: "2nd",
    cardClass:
      "bg-gradient-to-b from-[color:var(--color-glow-green)]/15 to-transparent dark:from-[color:var(--color-glow-green)]/8 ring-1 ring-[color:var(--color-glow-green)]/20",
    cardHeight: "md:min-h-[230px]",
  },
  3: {
    label: "3rd",
    cardClass:
      "bg-gradient-to-b from-[color:var(--color-glow-purple)]/15 to-transparent dark:from-[color:var(--color-glow-purple)]/8 ring-1 ring-[color:var(--color-glow-purple)]/20",
    cardHeight: "md:min-h-[210px]",
  },
};

function PodiumCard({
  row,
  rank,
  sort,
  primaryUnit,
  secondary,
  ens,
  isSelf,
  onClick,
}: {
  row: WalletLeaderboardRow;
  rank: PodiumRank;
  sort: WalletLeaderboardSort;
  primaryUnit: string;
  secondary: string;
  ens: string | undefined;
  isSelf: boolean;
  onClick: () => void;
}) {
  const v = PODIUM_VARIANTS[rank];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col items-center justify-between gap-3 rounded-3xl border border-border/20 p-6 text-center transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10",
        v.cardClass,
        v.cardHeight,
        isSelf && "ring-2 ring-[color:var(--color-glow-orange)]/50",
      )}
    >
      {isSelf && (
        <span className="absolute top-3 right-3 rounded-full bg-[color:var(--color-glow-orange)]/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-glow-orange)]">
          You
        </span>
      )}
      <div className="flex flex-col items-center gap-3">
        <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
          {v.label}
        </span>
        <div className="w-full max-w-full truncate px-2 font-mono text-sm font-medium text-foreground">
          {ens ?? shortAddress(row.walletAddress)}
        </div>
        <div className="mt-2 flex flex-col items-center gap-0.5">
          <span className="font-mono text-3xl font-bold tabular-nums tracking-tight">
            {metricValue(row, sort)}
          </span>
          {primaryUnit ? (
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {primaryUnit}
            </span>
          ) : null}
        </div>
        <div className="font-mono text-xs tabular-nums text-muted-foreground">
          {secondary}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 w-full text-xs font-medium"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        See Impact
      </Button>
    </div>
  );
}

/** Tailwind classes tinting a row by rank / self-ownership. */
function rowTint(rank: number, isSelf: boolean): string {
  if (isSelf) {
    return "bg-[color:var(--color-glow-orange)]/12 dark:bg-[color:var(--color-glow-orange)]/10 ring-1 ring-inset ring-[color:var(--color-glow-orange)]/30";
  }
  if (rank === 1)
    return "bg-[color:var(--color-glow-yellow)]/20 dark:bg-[color:var(--color-glow-yellow)]/10 hover:bg-[color:var(--color-glow-yellow)]/30";
  if (rank === 2)
    return "bg-[color:var(--color-glow-green)]/20 dark:bg-[color:var(--color-glow-green)]/10 hover:bg-[color:var(--color-glow-green)]/30";
  if (rank === 3)
    return "bg-[color:var(--color-glow-purple)]/20 dark:bg-[color:var(--color-glow-purple)]/10 hover:bg-[color:var(--color-glow-purple)]/30";
  return "hover:bg-muted/40 dark:hover:bg-muted/60";
}

interface MetricHeaderProps {
  label: string;
  column: WalletLeaderboardSort;
  activeSort: WalletLeaderboardSort;
  onSort: (column: WalletLeaderboardSort) => void;
  className?: string;
}

/** A sortable metric column header (always ranks descending). */
function MetricHeader({
  label,
  column,
  activeSort,
  onSort,
  className,
}: MetricHeaderProps) {
  const isActive = activeSort === column;
  return (
    <TableHead className={cn("px-3 text-right", className)}>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "ml-auto h-8 px-2 font-mono text-xs uppercase tracking-wider",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
        onClick={() => onSort(column)}
      >
        {label}
        {isActive ? <ArrowDown className="ml-1 h-3.5 w-3.5" /> : null}
      </Button>
    </TableHead>
  );
}

/** A wallet identity block: ENS over short address, with a copy button. */
function WalletCell({
  wallet,
  ens,
  isSelf,
  isTop3,
  onCopy,
  t,
}: {
  wallet: string;
  ens: string | null | undefined;
  isSelf: boolean;
  isTop3: boolean;
  onCopy: (wallet: string) => void;
  t: LeaderboardStrings;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {ens ? (
          <>
            <span
              className={cn(
                "text-sm font-medium",
                isTop3 && "font-bold text-foreground",
              )}
            >
              {ens}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {shortAddress(wallet)}
            </span>
          </>
        ) : (
          <span
            className={cn(
              "font-mono text-sm",
              isTop3 && "font-bold text-foreground",
            )}
          >
            {shortAddress(wallet)}
          </span>
        )}
      </div>
      {isSelf ? (
        <Badge
          variant="outline"
          className="font-mono text-[10px] uppercase tracking-wider border-[color:var(--color-glow-orange)]/40 bg-[color:var(--color-glow-orange)]/15 text-[color:var(--color-glow-orange)]"
        >
          {t.you}
        </Badge>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          onCopy(wallet);
        }}
        aria-label={t.copyWalletAddress}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

function parseSort(value: string | null | undefined): WalletLeaderboardSort {
  if (value === "watts" || value === "carbonCredits") return value;
  return "vaultedGlw";
}

export function WalletLeaderboardView() {
  const { t } = useLang();
  const lb = t.routes.impactLeaderboard;
  const wl = t.routes.walletsLeaderboard;
  const { address } = useAccount();
  const connectedWallet = address?.toLowerCase() ?? null;

  const sortMeta: Record<
    WalletLeaderboardSort,
    { label: string; unit: string }
  > = {
    vaultedGlw: { label: wl.glwActivelyDelegatedLabel, unit: "GLW" },
    watts: { label: lb.v2ColTotalWatts, unit: lb.v2WattsUnit },
    carbonCredits: { label: lb.v2ColCarbonCredits, unit: "" },
  };
  const SORT_OPTIONS: WalletLeaderboardSort[] = [
    "vaultedGlw",
    "watts",
    "carbonCredits",
  ];

  const [sortRaw, setSort] = useQueryState(
    "sort",
    parseAsString.withDefault("vaultedGlw"),
  );
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));

  const sort = parseSort(sortRaw);
  const safePage = Math.max(1, page);

  const query = useWalletLeaderboard({ sort, limit: FETCH_LIMIT });

  const rows = React.useMemo(() => query.data?.wallets ?? [], [query.data]);
  const total = query.data?.totalWalletCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePageClamped = Math.min(safePage, totalPages);

  // Page-1 podium = the global top 3 for the active metric (rows arrive
  // already ranked by `sort`). Those wallets are hidden from the table body.
  const podiumRows = React.useMemo(
    () => (safePageClamped === 1 ? rows.slice(0, 3) : []),
    [rows, safePageClamped],
  );
  const podiumWallets = React.useMemo(
    () => new Set(podiumRows.map((r) => r.walletAddress.toLowerCase())),
    [podiumRows],
  );

  const bodyRows = React.useMemo(() => {
    // Slice the fetched top-100 into a fixed per-page window FIRST (consistent
    // rank indexing across pages), then drop the podium wallets from page 1's
    // window so they aren't shown twice. Page 1 body = ranks 4..PAGE_SIZE;
    // later pages are untouched.
    const start = (safePageClamped - 1) * PAGE_SIZE;
    const slice = rows.slice(start, start + PAGE_SIZE);
    if (safePageClamped === 1 && podiumRows.length >= 3) {
      return slice.filter(
        (r) => !podiumWallets.has(r.walletAddress.toLowerCase()),
      );
    }
    return slice;
  }, [rows, podiumRows.length, podiumWallets, safePageClamped]);

  const startIdx = rows.length === 0 ? 0 : (safePageClamped - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(rows.length, safePageClamped * PAGE_SIZE);

  const { ensNames } = useEnsNames({
    addresses: React.useMemo(() => rows.map((r) => r.walletAddress), [rows]),
    enabled: rows.length > 0,
  });

  const [detailWallet, setDetailWallet] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Wallet / ENS lookup -> opens that wallet's impact detail.
  const [search, setSearch] = React.useState("");
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const trimmedSearch = search.trim();
  const isEnsQuery = /\.eth$/i.test(trimmedSearch);
  const normalizedEns = React.useMemo(() => {
    if (!isEnsQuery) return undefined;
    try {
      return normalize(trimmedSearch);
    } catch {
      return undefined;
    }
  }, [isEnsQuery, trimmedSearch]);
  const ensAddressQuery = useEnsAddress({
    name: normalizedEns,
    chainId: 1,
    query: { enabled: Boolean(normalizedEns) },
  });

  const handleSort = React.useCallback(
    (column: WalletLeaderboardSort) => {
      setSort(column);
      setPage(1);
      trackEvent("leaderboard_sort_changed", {
        sort: column,
        dir: "desc",
        source: "stats_rewards_wallet",
      });
    },
    [setSort, setPage],
  );

  const handleRowClick = React.useCallback((wallet: string) => {
    setDetailWallet(wallet);
    setDetailOpen(true);
  }, []);

  const handleSearch = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const v = trimmedSearch;
      if (!v) return;
      let addr: string | null = null;
      if (isAddress(v)) {
        addr = v;
      } else if (isEnsQuery) {
        if (!normalizedEns) {
          setSearchError("Invalid ENS name");
          return;
        }
        if (ensAddressQuery.isLoading) {
          setSearchError("Resolving ENS…");
          return;
        }
        addr = ensAddressQuery.data ?? null;
        if (!addr) {
          setSearchError("That ENS name didn't resolve");
          return;
        }
      } else {
        setSearchError("Enter a 0x address or a .eth name");
        return;
      }
      setSearchError(null);
      trackEvent("leaderboard_wallet_lookup", {
        query: v,
        source: "stats_rewards_wallet",
      });
      setDetailWallet(addr.toLowerCase());
      setDetailOpen(true);
    },
    [
      trimmedSearch,
      isEnsQuery,
      normalizedEns,
      ensAddressQuery.isLoading,
      ensAddressQuery.data,
    ],
  );

  const handleCopy = React.useCallback(
    (wallet: string) => {
      copyTextToClipboard(wallet, { successMessage: lb.copied });
    },
    [lb.copied],
  );

  const isRefreshing = query.isPlaceholderData;

  // Secondary line on each podium card: the two non-active metrics.
  const podiumSecondary = React.useCallback(
    (row: WalletLeaderboardRow): string => {
      if (sort === "vaultedGlw") {
        return `${fmtMetric(row.totalWatts)} ${lb.v2WattsUnit} · ${fmtMetric(
          row.totalCarbonCredits,
        )} ${lb.v2CarbonLabel}`;
      }
      if (sort === "watts") {
        return `${formatGLW(row.vaultedGlwWei)} GLW · ${fmtMetric(
          row.totalCarbonCredits,
        )} ${lb.v2CarbonLabel}`;
      }
      return `${formatGLW(row.vaultedGlwWei)} GLW · ${fmtMetric(
        row.totalWatts,
      )} ${lb.v2WattsUnit}`;
    },
    [sort, lb],
  );

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-border/20 bg-card dark:border-white/10">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border/20 px-6 py-6 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div className="space-y-1">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
              {wl.walletLeaderboard}
            </h3>
            {query.isLoading ? (
              <Skeleton className="h-4 w-72 rounded-md" />
            ) : (
              <p className="font-mono text-sm text-muted-foreground">
                {lb.v2RankedBy(sortMeta[sort].label)}
                <span className="text-muted-foreground/40"> · </span>
                {lb.v2ShowingCount(
                  rows.length === 0 ? "0" : `${startIdx}-${endIdx}`,
                  formatNumber(total),
                  total,
                )}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <form onSubmit={handleSearch} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      if (searchError) setSearchError(null);
                    }}
                    placeholder="Search wallet or ENS"
                    spellCheck={false}
                    autoCapitalize="none"
                    className="w-full sm:w-[200px] pl-8"
                  />
                </div>
                <Button type="submit" size="sm" variant="outline">
                  Look up
                </Button>
              </div>
              {searchError ? (
                <span className="pl-1 text-[11px] text-destructive">
                  {searchError}
                </span>
              ) : null}
            </form>
            {/* Metric toggle */}
            <div className="inline-flex w-full rounded-full border border-border/30 bg-muted/30 p-1 dark:border-white/10 sm:w-auto">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSort(opt)}
                  className={cn(
                    "flex-1 whitespace-nowrap rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors sm:flex-none",
                    sort === opt
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {sortMeta[opt].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        {query.isError ? (
          <p className="px-6 py-16 text-center text-sm text-muted-foreground">
            {lb.v2Error}
          </p>
        ) : query.isLoading ? (
          <div className="space-y-3 p-6 sm:p-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-muted-foreground">
            {lb.v2EmptyNoWallets}
          </p>
        ) : (
          <>
            {/* Podium top-3 (page 1 only), for the active metric. */}
            {podiumRows.length >= 3 && (
              <div className="px-6 pt-8 pb-2 sm:px-8 md:pt-10">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end md:gap-6">
                  {([podiumRows[0], podiumRows[1], podiumRows[2]] as const).map(
                    (row, i) => {
                      const rank = (i + 1) as PodiumRank;
                      return (
                        <div key={row.walletAddress}>
                          <PodiumCard
                            row={row}
                            rank={rank}
                            sort={sort}
                            primaryUnit={sortMeta[sort].unit}
                            secondary={podiumSecondary(row)}
                            ens={ensNames[row.walletAddress] ?? undefined}
                            isSelf={
                              connectedWallet === row.walletAddress.toLowerCase()
                            }
                            onClick={() => handleRowClick(row.walletAddress)}
                          />
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            )}

            {/* Mobile cards */}
            <div
              className={cn(
                "space-y-3 p-6 md:hidden",
                isRefreshing && "opacity-60",
              )}
            >
              {bodyRows.map((row) => {
                const isSelf =
                  connectedWallet === row.walletAddress.toLowerCase();
                const isTop3 = row.rank <= 3;
                return (
                  <div
                    key={row.walletAddress}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(row.walletAddress)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      handleRowClick(row.walletAddress);
                    }}
                    className={cn(
                      "cursor-pointer rounded-xl border p-4 transition-colors",
                      isSelf || isTop3
                        ? "border-transparent"
                        : "border-border/20 bg-muted/30 dark:border-white/10 dark:bg-zinc-800",
                      rowTint(row.rank, isSelf),
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <RankCell rank={row.rank} total={total} t={lb} />
                        <WalletCell
                          wallet={row.walletAddress}
                          ens={ensNames[row.walletAddress]}
                          isSelf={isSelf}
                          isTop3={isTop3}
                          onCopy={handleCopy}
                          t={lb}
                        />
                      </div>
                    </div>
                    <div className="mt-3 font-mono text-2xl font-bold tabular-nums tracking-tight">
                      {metricValue(row, sort)}
                      {sortMeta[sort].unit ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          {sortMeta[sort].unit}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 font-mono text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {podiumSecondary(row)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div
              className={cn(
                "hidden p-8 md:block",
                isRefreshing && "opacity-60",
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 dark:bg-zinc-800">
                    <TableHead className="h-11 w-24 rounded-tl-xl px-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      {lb.v2ColRank}
                    </TableHead>
                    <TableHead className="h-11 min-w-[220px] px-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      {lb.v2ColWallet}
                    </TableHead>
                    <MetricHeader
                      label={sortMeta.vaultedGlw.label}
                      column="vaultedGlw"
                      activeSort={sort}
                      onSort={handleSort}
                      className="h-11 w-[200px]"
                    />
                    <MetricHeader
                      label={sortMeta.watts.label}
                      column="watts"
                      activeSort={sort}
                      onSort={handleSort}
                      className="h-11 w-[160px]"
                    />
                    <MetricHeader
                      label={sortMeta.carbonCredits.label}
                      column="carbonCredits"
                      activeSort={sort}
                      onSort={handleSort}
                      className="h-11 w-[160px] rounded-tr-xl"
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bodyRows.map((row) => {
                    const isSelf =
                      connectedWallet === row.walletAddress.toLowerCase();
                    const isTop3 = row.rank <= 3;
                    const cellClass = (key: WalletLeaderboardSort) =>
                      cn(
                        "px-3 py-3 text-right font-mono tabular-nums",
                        sort === key
                          ? "text-base font-semibold text-foreground"
                          : "text-sm text-muted-foreground",
                      );
                    return (
                      <TableRow
                        key={row.walletAddress}
                        onClick={() => handleRowClick(row.walletAddress)}
                        className={cn(
                          "cursor-pointer transition-colors",
                          rowTint(row.rank, isSelf),
                        )}
                      >
                        <TableCell className="px-4 py-3">
                          <RankCell rank={row.rank} total={total} t={lb} />
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <WalletCell
                            wallet={row.walletAddress}
                            ens={ensNames[row.walletAddress]}
                            isSelf={isSelf}
                            isTop3={isTop3}
                            onCopy={handleCopy}
                            t={lb}
                          />
                        </TableCell>
                        <TableCell className={cellClass("vaultedGlw")}>
                          {formatGLW(row.vaultedGlwWei)}
                        </TableCell>
                        <TableCell className={cellClass("watts")}>
                          {fmtMetric(row.totalWatts)}
                        </TableCell>
                        <TableCell className={cellClass("carbonCredits")}>
                          {fmtMetric(row.totalCarbonCredits)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t border-border/20 px-6 py-6 dark:border-white/10 sm:px-8">
                <span className="font-mono text-xs text-muted-foreground">
                  {lb.pageOf(String(safePageClamped), String(totalPages))}
                </span>
                <Pagination className="mx-0 w-auto justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        size="default"
                        className={cn(
                          safePageClamped <= 1 &&
                            "pointer-events-none opacity-40",
                        )}
                        onClick={() => setPage(Math.max(1, safePageClamped - 1))}
                      />
                    </PaginationItem>
                    {buildPageList(safePageClamped, totalPages).map((entry, i) =>
                      entry === "ellipsis" ? (
                        <PaginationItem key={`e${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={entry}>
                          <PaginationLink
                            size="icon"
                            isActive={safePageClamped === entry}
                            onClick={() => setPage(entry)}
                          >
                            {entry}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        size="default"
                        className={cn(
                          safePageClamped >= totalPages &&
                            "pointer-events-none opacity-40",
                        )}
                        onClick={() =>
                          setPage(Math.min(totalPages, safePageClamped + 1))
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            ) : null}
          </>
        )}
      </div>

      <WalletImpactDialog
        wallet={detailWallet}
        ensName={detailWallet ? ensNames[detailWallet] : null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}

/** Page numbers to render: first, last, a window around current, ellipses. */
function buildPageList(
  current: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const list: Array<number | "ellipsis"> = [1];
  if (current > 3) list.push("ellipsis");
  for (let p = current - 1; p <= current + 1; p += 1) {
    if (p > 1 && p < totalPages) list.push(p);
  }
  if (current < totalPages - 2) list.push("ellipsis");
  list.push(totalPages);
  return list;
}
