"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFinalizedReportWeek } from "@/utils/getFinalizedReportWeek";
import { toast } from "sonner";

interface WeeklyReportTokenAmount {
  amount: string;
  asset: string;
  assetAddress: `0x${string}`;
}

interface WeeklyReportTrace {
  amount: string;
  asset: string;
  farmId: string;
  glowInflationReward: string;
  regionId: number;
  inflationRewardSplit6Decimals: string;
  depositRewardSplit6Decimals: string;
}

interface WeeklyReportWalletDistribution {
  userAddress: `0x${string}`;
  assetsEarned: Record<string, string>;
  glowInflationEarned: string;
  traces: WeeklyReportTrace[];
}

interface WeeklyReportFarmReward {
  id: string;
  regionId: number;
  asset: string;
  assetEarned: string;
  glowInflationReward: string;
  protocolDeposit: string;
  expectedProduction: string;
}

interface WeeklyReportItem {
  week: number;
  v1MerkleRoot: string;
  v2MerkleRoot: string;
  totalGlowInflationRewards: string;
  totalGlowInflationRewardsLeafWeight: string;
  totalV1UsdgWeight: string;
  fullOnchainTokensAndAmountsArray: WeeklyReportTokenAmount[];
  walletDistributionsArray: WeeklyReportWalletDistribution[];
  farmRewardsArray: WeeklyReportFarmReward[];
}

export interface WeeklyReportPanelProps {
  week?: number; // if omitted, uses the latest finalized weekly report week
  className?: string;
}

export function WeeklyReportPanel({ week, className }: WeeklyReportPanelProps) {
  const [weeklyReport, setWeeklyReport] =
    React.useState<WeeklyReportItem | null>(null);
  const [isWeeklyLoading, setIsWeeklyLoading] = React.useState<boolean>(false);
  const [weeklyError, setWeeklyError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function loadWeekly() {
      try {
        setIsWeeklyLoading(true);
        setWeeklyError(null);

        const baseWeek = week ?? Math.max(0, getFinalizedReportWeek());
        const url = `https://pub-311748c72106476cbeabe0a22a59217d.r2.dev/weekly-report-week-${baseWeek}.json`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok)
          throw new Error(`Failed to fetch weekly report (${res.status})`);
        const data = (await res.json()) as WeeklyReportItem;
        if (!cancelled) setWeeklyReport(data);
      } catch (e: any) {
        const message = e?.message || "Failed to load weekly report";
        setWeeklyError(message);
        toast.error("Weekly report error", { description: message });
      } finally {
        if (!cancelled) setIsWeeklyLoading(false);
      }
    }
    loadWeekly();
    return () => {
      cancelled = true;
    };
  }, [week]);

  return (
    <Card
      className={
        className ??
        "bg-card/60 backdrop-blur-xl rounded-2xl border border-border"
      }
    >
      <CardHeader>
        <CardTitle>Weekly Reports</CardTitle>
      </CardHeader>
      <CardContent>
        {isWeeklyLoading && <Skeleton className="h-24 w-full" />}

        {!isWeeklyLoading && weeklyReport && (
          <div className="mb-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-lg font-semibold">
                Week {weeklyReport.week - 1}
              </div>
              <div className="text-xs text-muted-foreground">
                v1:{" "}
                <code className="break-all">{weeklyReport.v1MerkleRoot}</code>
                <span className="mx-2">·</span>
                v2:{" "}
                <code className="break-all">{weeklyReport.v2MerkleRoot}</code>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
                <div className="text-sm text-muted-foreground mb-1">
                  Total GLW Emissions
                </div>
                <div className="text-base font-semibold break-all">
                  {weeklyReport.totalGlowInflationRewards}
                </div>
              </div>
              <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
                <div className="text-sm text-muted-foreground mb-1">
                  GLW Leaf Weight
                </div>
                <div className="text-base font-semibold break-all">
                  {weeklyReport.totalGlowInflationRewardsLeafWeight}
                </div>
              </div>
              <div className="bg-muted dark:bg-muted/30 rounded-xl p-4">
                <div className="text-sm text-muted-foreground mb-1">
                  V1 USDG Weight
                </div>
                <div className="text-base font-semibold break-all">
                  {weeklyReport.totalV1UsdgWeight}
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Amount (raw)</TableHead>
                    <TableHead className="min-w-[200px]">Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyReport.fullOnchainTokensAndAmountsArray.map(
                    (t, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{t.asset}</TableCell>
                        <TableCell className="break-all">{t.amount}</TableCell>
                        <TableCell>
                          <code className="text-xs break-all">
                            {t.assetAddress}
                          </code>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Farm</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Asset Earned (raw)</TableHead>
                    <TableHead>GLW Emissions (raw)</TableHead>
                    <TableHead>Protocol Deposit (raw)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyReport.farmRewardsArray.map((fr) => (
                    <TableRow key={fr.id}>
                      <TableCell className="font-mono text-xs">
                        {fr.id}
                      </TableCell>
                      <TableCell>{fr.regionId}</TableCell>
                      <TableCell>{fr.asset}</TableCell>
                      <TableCell className="break-all">
                        {fr.assetEarned}
                      </TableCell>
                      <TableCell className="break-all">
                        {fr.glowInflationReward}
                      </TableCell>
                      <TableCell className="break-all">
                        {fr.protocolDeposit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {!isWeeklyLoading && !weeklyReport && (
          <div className="text-sm text-muted-foreground">
            No weekly report available yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
