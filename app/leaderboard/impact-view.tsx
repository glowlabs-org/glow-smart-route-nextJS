"use client";

/**
 * V2 Impact Leaderboard (Impact tab of /leaderboard).
 *
 * Ranks wallets by realized impact: total watts and carbon credits, not
 * by points. Optionally scoped to a single region. Clicking a row opens
 * that wallet's impact detail.
 *
 * Visual design carried over from the pre-V2 leaderboard: top-3 colored
 * rank badges, "Top X%" percentile, self-row highlight, ENS over address,
 * desktop table + mobile card layouts.
 */
import React from "react";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { useAccount, useEnsAddress } from "wagmi";
import { ArrowDown, ArrowUp, Copy, MapPin, Search, Trophy } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useRegions } from "@/hooks/control-regions";
import { shortAddress, formatTopPercentile } from "@/utils/impact";
import { copyTextToClipboard } from "@/utils/clipboard";
import {
  useV2ImpactLeaderboard,
  type V2LeaderboardRow,
  type V2LeaderboardSort,
  type V2SortDir,
} from "@/hooks/v2-impact";
import { WalletImpactDialog } from "./wallet-impact-dialog";

const PAGE_SIZE = 50;

/** The slice of translated strings this view reads. */
type LeaderboardStrings = ReturnType<typeof useLang>["t"]["routes"]["impactLeaderboard"];

/** parseFloat is fine here — these strings are only used for display. */
function fmtMetric(value: string | null | undefined, decimals = 2): string {
  if (value == null) return "-";
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return "-";
  return formatNumber(n, { maximumFractionDigits: decimals });
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
    <span className="font-mono text-xs text-muted-foreground">
      {t.topPercentile(formatTopPercentile(pct))}
    </span>
  );
}

type PodiumRank = 1 | 2 | 3;

/** Per-rank styling for the podium cards. Mirrors the RankCell palette. */
const PODIUM_VARIANTS: Record<
  PodiumRank,
  {
    label: string;
    sublabel: string;
    iconClass: string;
    iconBgClass: string;
    cardClass: string;
    cardHeight: string;
  }
> = {
  1: {
    label: "1st",
    sublabel: "Champion",
    iconClass: "text-[color:var(--color-glow-yellow)]",
    iconBgClass:
      "bg-[color:var(--color-glow-yellow)]/20 ring-2 ring-[color:var(--color-glow-yellow)]/40",
    cardClass:
      "bg-gradient-to-b from-[color:var(--color-glow-yellow)]/20 to-transparent dark:from-[color:var(--color-glow-yellow)]/10 ring-1 ring-[color:var(--color-glow-yellow)]/30",
    cardHeight: "md:min-h-[300px]",
  },
  2: {
    label: "2nd",
    sublabel: "Runner-up",
    iconClass: "text-[color:var(--color-glow-green)]",
    iconBgClass:
      "bg-[color:var(--color-glow-green)]/15 ring-1 ring-[color:var(--color-glow-green)]/30",
    cardClass:
      "bg-gradient-to-b from-[color:var(--color-glow-green)]/15 to-transparent dark:from-[color:var(--color-glow-green)]/8 ring-1 ring-[color:var(--color-glow-green)]/20",
    cardHeight: "md:min-h-[260px]",
  },
  3: {
    label: "3rd",
    sublabel: "Bronze",
    iconClass: "text-[color:var(--color-glow-purple)]",
    iconBgClass:
      "bg-[color:var(--color-glow-purple)]/15 ring-1 ring-[color:var(--color-glow-purple)]/30",
    cardClass:
      "bg-gradient-to-b from-[color:var(--color-glow-purple)]/15 to-transparent dark:from-[color:var(--color-glow-purple)]/8 ring-1 ring-[color:var(--color-glow-purple)]/20",
    cardHeight: "md:min-h-[230px]",
  },
};

function PodiumCard({
  row,
  rank,
  ens,
  isSelf,
  onClick,
  t,
}: {
  row: V2LeaderboardRow;
  rank: PodiumRank;
  ens: string | undefined;
  isSelf: boolean;
  onClick: () => void;
  t: LeaderboardStrings;
}) {
  const v = PODIUM_VARIANTS[rank];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col items-center justify-end gap-3 rounded-3xl border border-border/20 p-6 text-center transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10",
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
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-2xl",
          v.iconBgClass,
          v.iconClass,
        )}
      >
        <Trophy className="h-7 w-7" />
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
          {v.label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {v.sublabel}
        </span>
      </div>
      <div className="w-full max-w-full truncate px-2 font-mono text-sm font-medium text-foreground">
        {ens ?? shortAddress(row.wallet)}
      </div>
      <div className="mt-2 flex flex-col items-center gap-0.5">
        <span className="font-mono text-3xl font-bold tabular-nums tracking-tight">
          {fmtMetric(row.totalWatts)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {t.v2WattsUnit}
        </span>
      </div>
      <div className="font-mono text-xs tabular-nums text-muted-foreground">
        {fmtMetric(row.totalCarbonCredits)} {t.v2CarbonLabel.toLowerCase()}
      </div>
    </button>
  );
}

function PodiumTopThree({
  rows,
  ensNames,
  connectedWallet,
  onRowClick,
  t,
}: {
  rows: V2LeaderboardRow[];
  ensNames: Record<string, string | null | undefined>;
  connectedWallet: string | null;
  onRowClick: (wallet: string) => void;
  t: LeaderboardStrings;
}) {
  if (rows.length < 3) return null;
  const [r1, r2, r3] = rows;

  const card = (row: V2LeaderboardRow, rank: PodiumRank) => (
    <PodiumCard
      row={row}
      rank={rank}
      ens={ensNames[row.wallet] ?? undefined}
      isSelf={connectedWallet === row.wallet.toLowerCase()}
      onClick={() => onRowClick(row.wallet)}
      t={t}
    />
  );

  return (
    <div className="px-6 pt-8 pb-2 sm:px-8 md:pt-10">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end md:gap-6">
        {/* Mobile: 1, 2, 3 top to bottom. Desktop: 2, 1, 3 with #1 elevated. */}
        <div className="order-2 md:order-1">{card(r2, 2)}</div>
        <div className="order-1 md:order-2">{card(r1, 1)}</div>
        <div className="order-3 md:order-3">{card(r3, 3)}</div>
      </div>
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

interface SortHeaderProps {
  label: string;
  column: V2LeaderboardSort;
  activeSort: V2LeaderboardSort;
  dir: V2SortDir;
  onSort: (column: V2LeaderboardSort) => void;
  className?: string;
}

function SortHeader({
  label,
  column,
  activeSort,
  dir,
  onSort,
  className,
}: SortHeaderProps) {
  const isActive = activeSort === column;
  return (
    <TableHead className={cn("px-3 text-right", className)}>
      <Button
        type="button"
        variant="ghost"
        className="ml-auto h-8 px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground"
        onClick={() => onSort(column)}
      >
        {label}
        {isActive ? (
          dir === "desc" ? (
            <ArrowDown className="ml-1 h-3.5 w-3.5" />
          ) : (
            <ArrowUp className="ml-1 h-3.5 w-3.5" />
          )
        ) : null}
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
    <div className="inline-flex items-center gap-2">
      <div className="flex flex-col gap-0.5">
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

export function ImpactView() {
  const { t } = useLang();
  const lb = t.routes.impactLeaderboard;
  const { address } = useAccount();
  const connectedWallet = address?.toLowerCase() ?? null;

  const sortLabel: Record<V2LeaderboardSort, string> = {
    totalWatts: lb.v2SortTotalWatts,
    carbonCredits: lb.v2SortCarbonCredits,
    policyCredits: lb.v2SortPolicyCredits,
  };

  const [sortRaw, setSort] = useQueryState(
    "sort",
    parseAsString.withDefault("totalWatts"),
  );
  const [dirRaw, setDir] = useQueryState(
    "dir",
    parseAsString.withDefault("desc"),
  );
  const [regionId, setRegionId] = useQueryState("regionId", parseAsInteger);
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));

  const { regions } = useRegions();

  const regionScoped = regionId !== null;

  // Only watts and carbon are user-sortable (policy credits == carbon today).
  const sort: V2LeaderboardSort =
    sortRaw === "carbonCredits" ? "carbonCredits" : "totalWatts";
  const dir: V2SortDir = dirRaw === "asc" ? "asc" : "desc";
  const safePage = Math.max(1, page);

  const query = useV2ImpactLeaderboard({
    sort,
    dir,
    regionId,
    limit: PAGE_SIZE,
    offset: (safePage - 1) * PAGE_SIZE,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIdx = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(total, safePage * PAGE_SIZE);

  const { ensNames } = useEnsNames({
    addresses: rows.map((r) => r.wallet),
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
    (column: V2LeaderboardSort) => {
      const nextDir: V2SortDir =
        column === sort ? (dir === "desc" ? "asc" : "desc") : "desc";
      setSort(column);
      setDir(nextDir);
      setPage(1);
      trackEvent("leaderboard_sort_changed", {
        sort: column,
        dir: nextDir,
        region_id: regionId,
        source: "stats_rewards_impact",
      });
    },
    [sort, dir, regionId, setSort, setDir, setPage],
  );

  const handleRegionChange = React.useCallback(
    (value: string) => {
      const next = value === "all" ? null : Number(value);
      setRegionId(next);
      setPage(1);
    },
    [setRegionId, setPage],
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
        source: "stats_rewards_impact",
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

  const regionName = (id: number): string =>
    regions.find((r) => r.id === id)?.name ?? lb.v2RegionFallback(String(id));

  const isRefreshing = query.isPlaceholderData;

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-border/20 bg-card dark:border-white/10">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border/20 px-6 py-6 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div className="space-y-1">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
              {lb.v2Title}
            </h3>
            {query.isLoading ? (
              <Skeleton className="h-4 w-72 rounded-md" />
            ) : (
              <p className="font-mono text-sm text-muted-foreground">
                {lb.v2RankedBy(sortLabel[sort])}
                <span className="text-muted-foreground/40"> · </span>
                {lb.v2ShowingCount(
                  total === 0 ? "0" : `${startIdx}-${endIdx}`,
                  formatNumber(total),
                  total,
                )}
                {regionScoped ? lb.v2InRegion(regionName(regionId!)) : ""}
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
                    className="w-[200px] pl-8"
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
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Select
                value={regionId === null ? "all" : String(regionId)}
                onValueChange={handleRegionChange}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={lb.v2AllRegions} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lb.v2AllRegions}</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {regionScoped ? lb.v2EmptyRegion : lb.v2EmptyNoWallets}
          </p>
        ) : (
          <>
            {/* Podium top-3 (page 1 only, when ≥3 rows). Hides those ranks
                from the table below to avoid duplication. */}
            {safePage === 1 && rows.length >= 3 && (
              <PodiumTopThree
                rows={rows}
                ensNames={ensNames}
                connectedWallet={connectedWallet}
                onRowClick={handleRowClick}
                t={lb}
              />
            )}

            {/* Mobile cards */}
            <div
              className={cn(
                "space-y-3 p-6 md:hidden",
                isRefreshing && "opacity-60",
              )}
            >
              {(safePage === 1 && rows.length >= 3
                ? rows.filter((r) => r.rank > 3)
                : rows
              ).map((row) => {
                const isSelf =
                  connectedWallet === row.wallet.toLowerCase();
                const isTop3 = row.rank <= 3;
                return (
                  <div
                    key={row.wallet}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(row.wallet)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      handleRowClick(row.wallet);
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
                          wallet={row.wallet}
                          ens={ensNames[row.wallet]}
                          isSelf={isSelf}
                          isTop3={isTop3}
                          onCopy={handleCopy}
                          t={lb}
                        />
                      </div>
                    </div>
                    <div className="mt-3 font-mono text-2xl font-bold tabular-nums tracking-tight">
                      {fmtMetric(row.totalWatts)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {lb.v2WattsUnit}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 font-mono text-xs text-muted-foreground">
                      <span>
                        {lb.v2CarbonLabel}{" "}
                        <span className="tabular-nums text-foreground">
                          {fmtMetric(row.totalCarbonCredits)}
                        </span>
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
                    <SortHeader
                      label={lb.v2ColTotalWatts}
                      column="totalWatts"
                      activeSort={sort}
                      dir={dir}
                      onSort={handleSort}
                      className="h-11 w-[180px]"
                    />
                    <SortHeader
                      label={lb.v2ColCarbonCredits}
                      column="carbonCredits"
                      activeSort={sort}
                      dir={dir}
                      onSort={handleSort}
                      className="h-11 w-[170px] rounded-tr-xl"
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(safePage === 1 && rows.length >= 3
                    ? rows.filter((r) => r.rank > 3)
                    : rows
                  ).map((row) => {
                    const isSelf =
                      connectedWallet === row.wallet.toLowerCase();
                    const isTop3 = row.rank <= 3;
                    return (
                      <TableRow
                        key={row.wallet}
                        onClick={() => handleRowClick(row.wallet)}
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
                            wallet={row.wallet}
                            ens={ensNames[row.wallet]}
                            isSelf={isSelf}
                            isTop3={isTop3}
                            onCopy={handleCopy}
                            t={lb}
                          />
                        </TableCell>
                        <TableCell
                          className={cn(
                            "px-3 py-3 text-right font-mono text-base font-semibold tabular-nums",
                            row.rank === 1
                              ? "text-[color:var(--color-glow-black)] dark:text-[color:var(--color-glow-yellow)]"
                              : "text-foreground",
                          )}
                        >
                          {fmtMetric(row.totalWatts)}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
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
                  {lb.pageOf(String(safePage), String(totalPages))}
                </span>
                <Pagination className="mx-0 w-auto justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        size="default"
                        className={cn(
                          safePage <= 1 && "pointer-events-none opacity-40",
                        )}
                        onClick={() => setPage(Math.max(1, safePage - 1))}
                      />
                    </PaginationItem>
                    {buildPageList(safePage, totalPages).map((entry, i) =>
                      entry === "ellipsis" ? (
                        <PaginationItem key={`e${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={entry}>
                          <PaginationLink
                            size="icon"
                            isActive={safePage === entry}
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
                          safePage >= totalPages &&
                            "pointer-events-none opacity-40",
                        )}
                        onClick={() =>
                          setPage(Math.min(totalPages, safePage + 1))
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
