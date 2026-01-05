"use client";

import * as React from "react";
import { Crown } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEnsNames } from "@/hooks/useEnsNames";
import {
  useImpactLeaderboardQuery,
  type ImpactGlowScoreLeaderboardRow,
} from "@/hooks";
import {
  formatImpactPoints,
  formatTopPercentile,
  shortAddress,
  safeNumber,
} from "@/utils/impact";

interface GlobalLeaderboardWidgetProps {
  className?: string;
  limit?: number;
}

function sortByPointsDesc(
  a: ImpactGlowScoreLeaderboardRow,
  b: ImpactGlowScoreLeaderboardRow
) {
  return safeNumber(b.totalPoints) - safeNumber(a.totalPoints);
}

export default function GlobalLeaderboardWidget({
  className,
  limit = 5,
}: GlobalLeaderboardWidgetProps) {
  const leaderboardQuery = useImpactLeaderboardQuery();
  const rows = leaderboardQuery.data?.wallets ?? [];
  const totalWalletCount =
    leaderboardQuery.data?.totalWalletCount ?? rows.length;

  const topRows = React.useMemo(() => {
    if (!rows.length) return [];
    return [...rows]
      .sort(sortByPointsDesc)
      .slice(0, Math.max(3, Math.min(5, limit)));
  }, [limit, rows]);

  const addresses = React.useMemo(
    () => topRows.map((r) => r.walletAddress),
    [topRows]
  );
  const { ensNames } = useEnsNames({
    addresses: addresses.slice(),
    enabled: addresses.length > 0,
  });

  return (
    <>
      <Card
        className={cn(
          "relative flex h-full flex-col overflow-hidden bg-card dark:bg-muted/20 border-border shadow-sm",
          className
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="tracking-tight text-base">
            Impact Leaderboard
          </CardTitle>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 flex flex-col gap-4 pt-0">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {leaderboardQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/10 px-4 py-3"
                  >
                    <Skeleton className="h-4 w-24 rounded-md" />
                    <Skeleton className="h-4 w-16 rounded-md" />
                  </div>
                ))}
              </div>
            ) : leaderboardQuery.isError ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                Unable to load leaderboard.
              </div>
            ) : topRows.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                No leaderboard data yet.
              </div>
            ) : (
              <div className="space-y-2">
                {topRows.map((row, idx) => {
                  const rank = idx + 1;
                  const percentile =
                    totalWalletCount > 0
                      ? (rank / totalWalletCount) * 100
                      : NaN;
                  const name =
                    ensNames[row.walletAddress] ||
                    shortAddress(row.walletAddress);
                  return (
                    <div
                      key={row.walletAddress}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/10 px-4 py-3",
                        rank === 1 &&
                          "border-[color:var(--color-glow-orange)]/35 bg-[color:var(--color-glow-orange)]/10"
                      )}
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground tabular-nums shrink-0">
                          {rank <= 3 ? (
                            <>
                              <span>#{rank}</span>
                            </>
                          ) : (
                            <span>
                              Top{" "}
                              {Number.isFinite(percentile)
                                ? formatTopPercentile(percentile)
                                : "—"}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {name}
                          </div>
                          {ensNames[row.walletAddress] ? (
                            <div className="truncate text-[10px] font-mono text-muted-foreground">
                              {shortAddress(row.walletAddress)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="font-mono text-sm font-bold tabular-nums text-foreground shrink-0">
                        {formatImpactPoints(row.totalPoints, 0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 pt-1 space-y-2">
            <Button
              asChild
              variant="outline"
              className="w-full h-12 font-mono font-bold text-base"
            >
              <Link href="/stats/rewards">See leaderboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
