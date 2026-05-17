"use client";

/**
 * V2 Impact Leaderboard (Impact tab of /stats/rewards).
 *
 * Ranks wallets by realized impact — total watts and carbon credits — not
 * by points. Optionally scoped to a single region, which unlocks ranking
 * by policy credits. Clicking a row opens that wallet's impact detail.
 *
 * Visual design carried over from the pre-V2 leaderboard: top-3 colored
 * rank badges, "Top X%" percentile, self-row highlight, ENS over address,
 * desktop table + mobile card layouts.
 */
import React from "react";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { useAccount } from "wagmi";
import { ArrowDown, ArrowUp, Copy, MapPin } from "lucide-react";

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
import { formatNumber } from "@/utils/format";
import { trackEvent } from "@/lib/telemetry";
import { useEnsNames } from "@/hooks/useEnsNames";
import { useRegions } from "@/hooks/control-regions";
import { shortAddress, formatTopPercentile } from "@/utils/impact";
import { copyTextToClipboard } from "@/utils/clipboard";
import {
  useV2ImpactLeaderboard,
  type V2LeaderboardSort,
  type V2SortDir,
} from "@/hooks/v2-impact";
import { WalletImpactDialog } from "./wallet-impact-dialog";

const PAGE_SIZE = 50;

/** parseFloat is fine here — these strings are only used for display. */
function fmtMetric(value: string | null | undefined, decimals = 2): string {
  if (value == null) return "-";
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return "-";
  return formatNumber(n, { maximumFractionDigits: decimals });
}

const SORT_LABEL: Record<V2LeaderboardSort, string> = {
  totalWatts: "total watts",
  carbonCredits: "carbon credits",
  policyCredits: "policy credits",
};

/** Rank cell: a colored badge for the top 3, a percentile for the rest. */
function RankCell({ rank, total }: { rank: number; total: number }) {
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
        Rank {rank}
      </span>
    );
  }
  const pct = total > 0 ? (rank / total) * 100 : NaN;
  return (
    <span className="font-mono text-xs text-muted-foreground">
      Top {formatTopPercentile(pct)}
    </span>
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
}: {
  wallet: string;
  ens: string | null | undefined;
  isSelf: boolean;
  isTop3: boolean;
  onCopy: (wallet: string) => void;
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
          You
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
        aria-label="Copy wallet address"
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ImpactView() {
  const { address } = useAccount();
  const connectedWallet = address?.toLowerCase() ?? null;

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

  // `policyCredits` only ranks region-scoped; coerce when no region is set.
  const sort: V2LeaderboardSort =
    sortRaw === "carbonCredits"
      ? "carbonCredits"
      : sortRaw === "policyCredits" && regionScoped
        ? "policyCredits"
        : "totalWatts";
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
      // policyCredits is invalid without a region — fall back to watts.
      if (next === null && sortRaw === "policyCredits") {
        setSort("totalWatts");
      }
    },
    [setRegionId, setPage, sortRaw, setSort],
  );

  const handleRowClick = React.useCallback((wallet: string) => {
    setDetailWallet(wallet);
    setDetailOpen(true);
  }, []);

  const handleCopy = React.useCallback((wallet: string) => {
    copyTextToClipboard(wallet, { successMessage: "Copied" });
  }, []);

  const regionName = (id: number): string =>
    regions.find((r) => r.id === id)?.name ?? `Region ${id}`;

  const isRefreshing = query.isPlaceholderData;

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-border/20 bg-card dark:border-white/10">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border/20 px-6 py-6 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div className="space-y-1">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
              Impact Leaderboard
            </h3>
            {query.isLoading ? (
              <Skeleton className="h-4 w-72 rounded-md" />
            ) : (
              <p className="font-mono text-sm text-muted-foreground">
                Ranked by {SORT_LABEL[sort]}
                <span className="text-muted-foreground/40"> · </span>
                Showing {total === 0 ? 0 : `${startIdx}-${endIdx}`} of{" "}
                {formatNumber(total)} wallet{total === 1 ? "" : "s"}
                {regionScoped ? ` in ${regionName(regionId!)}` : ""}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select
              value={regionId === null ? "all" : String(regionId)}
              onValueChange={handleRegionChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Body */}
        {query.isError ? (
          <p className="px-6 py-16 text-center text-sm text-muted-foreground">
            The impact leaderboard is unavailable right now. Try again shortly.
          </p>
        ) : query.isLoading ? (
          <div className="space-y-3 p-6 sm:p-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-muted-foreground">
            {regionScoped
              ? "No impact recorded in this region yet."
              : "No wallets to rank yet."}
          </p>
        ) : (
          <>
            {/* Mobile cards */}
            <div
              className={cn(
                "space-y-3 p-6 md:hidden",
                isRefreshing && "opacity-60",
              )}
            >
              {rows.map((row) => {
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
                        <RankCell rank={row.rank} total={total} />
                        <WalletCell
                          wallet={row.wallet}
                          ens={ensNames[row.wallet]}
                          isSelf={isSelf}
                          isTop3={isTop3}
                          onCopy={handleCopy}
                        />
                      </div>
                    </div>
                    <div className="mt-3 font-mono text-2xl font-bold tabular-nums tracking-tight">
                      {fmtMetric(row.totalWatts)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        watts
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3 font-mono text-xs text-muted-foreground">
                      <span>
                        Carbon:{" "}
                        <span className="tabular-nums text-foreground">
                          {fmtMetric(row.totalCarbonCredits)}
                        </span>
                      </span>
                      {regionScoped ? (
                        <span>
                          Policy:{" "}
                          <span className="tabular-nums text-foreground">
                            {fmtMetric(row.totalPolicyCredits)}
                          </span>
                        </span>
                      ) : null}
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
                      Rank
                    </TableHead>
                    <TableHead className="h-11 min-w-[220px] px-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      Wallet
                    </TableHead>
                    <SortHeader
                      label="Total watts"
                      column="totalWatts"
                      activeSort={sort}
                      dir={dir}
                      onSort={handleSort}
                      className="h-11 w-[180px]"
                    />
                    <SortHeader
                      label="Carbon credits"
                      column="carbonCredits"
                      activeSort={sort}
                      dir={dir}
                      onSort={handleSort}
                      className={cn(
                        "h-11 w-[170px]",
                        !regionScoped && "rounded-tr-xl",
                      )}
                    />
                    {regionScoped ? (
                      <SortHeader
                        label="Policy credits"
                        column="policyCredits"
                        activeSort={sort}
                        dir={dir}
                        onSort={handleSort}
                        className="h-11 w-[170px] rounded-tr-xl"
                      />
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
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
                          <RankCell rank={row.rank} total={total} />
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <WalletCell
                            wallet={row.wallet}
                            ens={ensNames[row.wallet]}
                            isSelf={isSelf}
                            isTop3={isTop3}
                            onCopy={handleCopy}
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
                        {regionScoped ? (
                          <TableCell className="px-3 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
                            {fmtMetric(row.totalPolicyCredits)}
                          </TableCell>
                        ) : null}
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
                  Page {safePage} of {totalPages}
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
