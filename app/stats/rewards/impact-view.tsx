"use client";

/**
 * V2 Impact Leaderboard (Impact tab of /stats/rewards).
 *
 * Ranks wallets by realized impact — total watts and carbon credits — not
 * by points. Optionally scoped to a single region, which unlocks ranking
 * by policy credits. Clicking a row opens that wallet's impact detail.
 */
import React from "react";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { useAccount } from "wagmi";
import { ArrowDown, ArrowUp, MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { cn, formatAddress } from "@/lib/utils";
import { formatNumber } from "@/utils/format";
import { trackEvent } from "@/lib/telemetry";
import { useEnsNames } from "@/hooks/useEnsNames";
import { useRegions } from "@/hooks/control-regions";
import {
  useV2ImpactLeaderboard,
  type V2LeaderboardSort,
  type V2SortDir,
} from "@/hooks/v2-impact";
import { WalletImpactDialog } from "./wallet-impact-dialog";

const PAGE_SIZE = 50;

/** parseFloat is fine here — these strings are only used for display. */
function fmt(value: string | null | undefined, decimals = 2): string {
  if (value == null) return "—";
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return "—";
  return formatNumber(n, { maximumFractionDigits: decimals });
}

interface SortHeaderProps {
  label: string;
  column: V2LeaderboardSort;
  activeSort: V2LeaderboardSort;
  dir: V2SortDir;
  onSort: (column: V2LeaderboardSort) => void;
}

function SortHeader({
  label,
  column,
  activeSort,
  dir,
  onSort,
}: SortHeaderProps) {
  const isActive = activeSort === column;
  return (
    <TableHead className="text-right">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "ml-auto inline-flex items-center gap-1 transition-colors hover:text-foreground",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {isActive ? (
          dir === "desc" ? (
            <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5" />
          )
        ) : null}
      </button>
    </TableHead>
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
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1),
  );

  const { regions } = useRegions();

  // `policyCredits` only ranks region-scoped; coerce when no region is set.
  const sort: V2LeaderboardSort =
    sortRaw === "carbonCredits"
      ? "carbonCredits"
      : sortRaw === "policyCredits" && regionId !== null
        ? "policyCredits"
        : "totalWatts";
  const dir: V2SortDir = dirRaw === "asc" ? "asc" : "desc";

  const query = useV2ImpactLeaderboard({
    sort,
    dir,
    regionId,
    limit: PAGE_SIZE,
    offset: (Math.max(1, page) - 1) * PAGE_SIZE,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const regionScoped = regionId !== null;

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

  const openDetail = React.useCallback((wallet: string) => {
    setDetailWallet(wallet);
    setDetailOpen(true);
  }, []);

  const regionName = (id: number): string =>
    regions.find((r) => r.id === id)?.name ?? `Region ${id}`;

  const columnCount = regionScoped ? 5 : 4;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {query.isLoading
            ? "Loading impact leaderboard…"
            : `Ranking ${formatNumber(total)} wallet${total === 1 ? "" : "s"} by ${
                sort === "carbonCredits"
                  ? "carbon credits"
                  : sort === "policyCredits"
                    ? "policy credits"
                    : "total watts"
              }${regionScoped ? ` in ${regionName(regionId!)}` : ""}.`}
        </p>
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {query.isError ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              The impact leaderboard is unavailable right now. Try again
              shortly.
            </p>
          ) : query.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              {regionScoped
                ? "No impact recorded in this region yet."
                : "No wallets to rank yet."}
            </p>
          ) : (
            <div
              className={cn(
                "transition-opacity",
                query.isPlaceholderData ? "opacity-60" : "opacity-100",
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Wallet</TableHead>
                    <SortHeader
                      label="Total watts"
                      column="totalWatts"
                      activeSort={sort}
                      dir={dir}
                      onSort={handleSort}
                    />
                    <SortHeader
                      label="Carbon credits"
                      column="carbonCredits"
                      activeSort={sort}
                      dir={dir}
                      onSort={handleSort}
                    />
                    {regionScoped ? (
                      <SortHeader
                        label="Policy credits"
                        column="policyCredits"
                        activeSort={sort}
                        dir={dir}
                        onSort={handleSort}
                      />
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const ens = ensNames[row.wallet];
                    const isSelf =
                      connectedWallet === row.wallet.toLowerCase();
                    return (
                      <TableRow
                        key={row.wallet}
                        onClick={() => openDetail(row.wallet)}
                        className={cn(
                          "cursor-pointer",
                          isSelf && "bg-emerald-500/5",
                        )}
                      >
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          #{row.rank}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {ens ?? formatAddress(row.wallet)}
                          </span>
                          {isSelf ? (
                            <span className="ml-2 text-xs text-emerald-600">
                              You
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(row.totalWatts)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(row.totalCarbonCredits)}
                        </TableCell>
                        {regionScoped ? (
                          <TableCell className="text-right tabular-nums">
                            {fmt(row.totalPolicyCredits)}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!query.isLoading && !query.isError && rows.length > 0 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(Math.max(1, page - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(Math.min(totalPages, page + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <WalletImpactDialog
        wallet={detailWallet}
        ensName={detailWallet ? ensNames[detailWallet] : null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
