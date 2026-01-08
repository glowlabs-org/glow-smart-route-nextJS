"use client";

import * as React from "react";
import { Crown } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";
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
  formatGlwFromWei,
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
  limit = 3,
  variant = "default",
}: GlobalLeaderboardWidgetProps & { variant?: "default" | "minimal" }) {
  const source = "global_leaderboard_widget";
  const leaderboardQuery = useImpactLeaderboardQuery();
  const rows = leaderboardQuery.data?.wallets ?? [];
  const totalWalletCount =
    leaderboardQuery.data?.totalWalletCount ?? rows.length;
  const isMinimal = variant === "minimal";

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
          "relative flex h-full flex-col overflow-hidden",
          isMinimal
            ? "bg-transparent border-transparent"
            : "bg-card dark:bg-muted/20 border-foreground/10 dark:border-border",
          className
        )}
      >
        <CardHeader className={cn("pb-3", isMinimal && "px-0 pt-0")}>
          <div className="flex items-center justify-between">
            <CardTitle className="tracking-tight text-lg">
              Impact Leaderboard
            </CardTitle>
            <span className="text-[10px] font-mono uppercase text-muted-foreground bg-muted px-2 py-1 rounded">
              Top 3
            </span>
          </div>
        </CardHeader>

        <CardContent
          className={cn(
            "min-h-0 flex-1 flex flex-col gap-4 pt-0",
            isMinimal && "px-0"
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {leaderboardQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/10 px-4 py-4"
                  >
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <Skeleton className="h-5 w-16 rounded-md" />
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
              <div className="space-y-3">
                {topRows.map((row, idx) => {
                  const rank = idx + 1;
                  const name =
                    ensNames[row.walletAddress] ||
                    shortAddress(row.walletAddress);
                  const isTop3 = rank <= 3;
                  const glowWorth = formatGlwFromWei(row.glowWorthWei);

                  return (
                    <div
                      key={row.walletAddress}
                      className={cn(
                        "flex flex-col gap-2 rounded-2xl border px-4 py-4 transition-colors",
                        rank === 1
                          ? "bg-[color:var(--color-glow-orange)]/10 border-[color:var(--color-glow-orange)]/20"
                          : "bg-muted/40 border-border/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex items-center justify-center w-6 h-6 rounded-full font-mono text-xs font-bold shrink-0",
                              rank === 1
                                ? "bg-[color:var(--color-glow-orange)] text-white"
                                : "bg-muted-foreground/20 text-muted-foreground"
                            )}
                          >
                            {rank}
                          </div>
                          <div className="text-sm font-semibold text-foreground truncate max-w-[200px]">
                            {name}
                          </div>
                        </div>
                        {rank === 1 && (
                          <div className="text-[10px] font-bold text-[color:var(--color-glow-orange)] uppercase tracking-wider">
                            1st Place
                          </div>
                        )}
                      </div>

                      <div className="flex items-end justify-between pt-1">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-muted-foreground font-mono tracking-wider">
                            Total Points
                          </span>
                          <span className="text-xl font-bold font-mono text-foreground tabular-nums">
                            {formatImpactPoints(row.totalPoints, 0)}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] uppercase text-muted-foreground font-mono tracking-wider">
                            Glow Worth
                          </span>
                          <span className="text-sm font-medium font-mono text-foreground/80 tabular-nums">
                            {glowWorth} <span className="text-xs">GLW</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 pt-2">
            <Button
              asChild
              className="w-full h-12 font-mono font-bold text-base"
            >
              <Link
                href="/stats/rewards"
                onClick={() => {
                  trackEvent("dashboard_leaderboard_open_click", {
                    source,
                    wallet_connected: false,
                    wallet_address: null,
                  });
                }}
              >
                See Full Leaderboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
