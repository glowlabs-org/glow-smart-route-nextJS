"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";
import { useWalletSwaps } from "@/hooks/useWalletSwaps";

interface WalletSwapStatsProps {
  walletAddress: string | undefined;
}

function formatGLW(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatUSDG(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getExplorerUrl(txHash: `0x${string}`): string {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID;
  const isSepolia = chainId === "11155111";
  if (isSepolia) {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }
  return `https://etherscan.io/tx/${txHash}`;
}

export function WalletSwapStats({ walletAddress }: WalletSwapStatsProps) {
  const { swaps, totals, isLoading, error } = useWalletSwaps(walletAddress);

  if (!walletAddress) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Swap Activity (Last 90 Days)</CardTitle>
          <CardDescription>Loading swap history...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Swap Activity (Last 90 Days)</CardTitle>
          <CardDescription>Error loading swap history</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to fetch swap data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Swap Activity (Last 90 Days)</CardTitle>
        <CardDescription>
          Recent swaps in the GLW/USDG liquidity pool
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">GLW Sold</div>
              <div className="text-2xl font-bold">
                {formatGLW(totals.totalGlwIn)} GLW
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">USDG Received</div>
              <div className="text-2xl font-bold">
                {formatUSDG(totals.totalUsdgOut)} USDG
              </div>
            </div>
          </div>

          {swaps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No swaps found in the last 90 days
            </div>
          ) : (
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">GLW Sold</TableHead>
                      <TableHead className="text-right">
                        USDG Received
                      </TableHead>
                      <TableHead className="text-right">Transaction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {swaps.map((swap) => (
                      <TableRow key={swap.txHash}>
                        <TableCell className="font-medium">
                          {formatDate(swap.timestamp)}
                        </TableCell>
                        <TableCell className="text-right">
                          {swap.glwIn > 0 ? (
                            <span className="text-red-600 dark:text-red-400">
                              {formatGLW(swap.glwIn)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {swap.usdgOut > 0 ? (
                            <span className="text-green-600 dark:text-green-400">
                              {formatUSDG(swap.usdgOut)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <a
                            href={getExplorerUrl(swap.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            View
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
