"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useWalletV2Claims } from "@/hooks/useWalletV2Claims";

interface WalletV2ClaimsProps {
  walletAddress: string | undefined;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNumber(value: number, decimals = 2) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function WalletV2Claims({ walletAddress }: WalletV2ClaimsProps) {
  const {
    protocolTotals,
    protocolClaims,
    inflationClaims,
    inflationTotalGlw,
    isLoading,
    isError,
  } = useWalletV2Claims(walletAddress);

  const safeProtocolClaims = protocolClaims ?? [];
  const safeInflationClaims = inflationClaims ?? [];
  const protocolEntries = React.useMemo(
    () => Object.entries(protocolTotals ?? {}),
    [protocolTotals]
  );
  const hasProtocolClaims = safeProtocolClaims.length > 0;
  const hasInflationClaims = safeInflationClaims.length > 0;
  const mergedRows = React.useMemo(() => {
    const map = new Map<
      number,
      {
        date: number;
        inflation?: number;
        protocol?: Array<{ currency: string; amount: number }>;
      }
    >();

    safeInflationClaims.forEach((claim) => {
      const entry = map.get(claim.week) ?? {
        date: claim.claimedAt,
        protocol: [],
      };
      entry.date = claim.claimedAt;
      entry.inflation = (entry.inflation ?? 0) + claim.amount;
      map.set(claim.week, entry);
    });

    safeProtocolClaims.forEach((claim) => {
      const entry = map.get(claim.week) ?? {
        date: claim.claimedAt,
        protocol: [],
      };
      entry.date = claim.claimedAt;
      entry.protocol = entry.protocol ?? [];
      entry.protocol.push({ currency: claim.currency, amount: claim.amount });
      map.set(claim.week, entry);
    });

    if (map.size === 0) return [];

    return Array.from(map.entries())
      .map(([week, entry]) => ({
        week,
        date: entry.date,
        inflation: entry.inflation ?? 0,
        protocol: entry.protocol ?? [],
      }))
      .sort((a, b) => b.week - a.week);
  }, [safeInflationClaims, safeProtocolClaims]);

  if (!walletAddress) return null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>V2 Rewards Claimed</CardTitle>
          <CardDescription>Fetching protocol deposit claims…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {[0, 1].map((idx) => (
              <div key={idx} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </div>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>V2 Rewards Claimed</CardTitle>
          <CardDescription>Error loading claim history</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            We couldn’t fetch this wallet’s protocol deposit claims. Please
            retry later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>V2 Rewards Claimed</CardTitle>
        <CardDescription>
          Tokens this wallet already pulled from protocol deposit rewards
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {inflationTotalGlw > 0 && (
            <div className="rounded-lg border p-4 space-y-1">
              <div className="text-sm text-muted-foreground uppercase font-semibold">
                Emissions Claimed
              </div>
              <div className="text-2xl font-bold">
                {formatNumber(inflationTotalGlw, 4)} GLW
              </div>
            </div>
          )}
          {protocolEntries.map(([currency, value]) => (
            <div key={currency} className="rounded-lg border p-4 space-y-1">
              <div className="text-sm text-muted-foreground uppercase font-semibold">
                {currency} Claimed
              </div>
              <div className="text-2xl font-bold">
                {formatNumber(value, currency === "GLW" ? 4 : 2)} {currency}
              </div>
            </div>
          ))}
        </div>

        {mergedRows.length > 0 ? (
          <>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Weekly Claims
            </h3>
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week</TableHead>

                      <TableHead className="text-right">
                        Emissions (GLW)
                      </TableHead>
                      <TableHead className="text-right">
                        Protocol Deposit
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mergedRows.map((row) => (
                      <TableRow key={`combined-${row.week}`}>
                        <TableCell>
                          <Badge variant="secondary">#{row.week}</Badge>
                        </TableCell>

                        <TableCell className="text-right font-semibold">
                          {row.inflation > 0
                            ? formatNumber(row.inflation, 4)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {row.protocol.length
                            ? row.protocol
                                .map(
                                  (item) =>
                                    `${formatNumber(
                                      item.amount,
                                      item.currency === "GLW" ? 4 : 2
                                    )} ${item.currency}`
                                )
                                .join(" · ")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No reward claims have been recorded for this wallet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
