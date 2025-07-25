import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Clock,
  Copy,
  Check,
  ArrowUpRight,
  Timer,
  RefreshCw,
} from "lucide-react";
import { formatUnits } from "viem";
import { toast } from "sonner";

interface PendingTransfer {
  txId: string;
  wallet: string;
  amountWei: string; // Updated from amountUsdcWei
  type: string; // New field
  currency: string; // New field
  status: string;
  ts: string; // ISO date string
  applicationId?: string;
  farmId?: string; // New field
  regionId?: number;
}

interface PendingTransfersTabProps {
  pendingTransfers: PendingTransfer[];
  dataLoading: boolean;
  usdcDecimals: number;
  onRefresh?: () => Promise<void>; // New prop for manual refresh
}

function CopyableAddress({
  address,
  type = "address",
}: {
  address: string;
  type?: "address" | "tx";
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success(
        `${type === "tx" ? "Transaction hash" : "Address"} copied to clipboard`
      );
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const etherscanUrl =
    type === "tx"
      ? `https://sepolia.etherscan.io/tx/${address}`
      : `https://sepolia.etherscan.io/address/${address}`;

  const displayText =
    type === "tx"
      ? `${address.slice(0, 8)}...${address.slice(-6)}`
      : `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="flex items-center space-x-1 group">
      <a
        href={etherscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-sm text-primary hover:text-primary/80 transition-colors flex items-center space-x-1 group/link"
      >
        <span>{displayText}</span>
        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
      </a>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </Button>
    </div>
  );
}

// Countdown component for auto-refresh
const RefreshCountdown = ({
  onRefresh,
  isRefreshing,
}: {
  onRefresh?: () => Promise<void>;
  isRefreshing: boolean;
}) => {
  const [countdown, setCountdown] = useState<number>(30);
  const [isManualRefreshing, setIsManualRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 30; // Reset to 30 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    if (!onRefresh || isManualRefreshing) return;

    setIsManualRefreshing(true);
    try {
      await onRefresh();
      setCountdown(30); // Reset countdown after manual refresh
      toast.success("Data refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setIsManualRefreshing(false);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>Auto-refresh in {countdown}s</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleManualRefresh}
        disabled={isManualRefreshing || isRefreshing}
        className="h-8 px-3 text-xs hover:bg-primary/10 hover:border-primary/50"
      >
        {isManualRefreshing || isRefreshing ? (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Refreshing...
          </>
        ) : (
          <>
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </>
        )}
      </Button>
    </div>
  );
};

// Countdown component for pending transfers
const PendingTimer = ({ queuedAt }: { queuedAt: string }) => {
  const [elapsed, setElapsed] = useState<string>("");

  useEffect(() => {
    const updateElapsed = () => {
      const now = new Date();
      const queueTime = new Date(queuedAt);
      const diffMs = now.getTime() - queueTime.getTime();

      const minutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        setElapsed(`${days}d ${hours % 24}h ago`);
      } else if (hours > 0) {
        setElapsed(`${hours}h ${minutes % 60}m ago`);
      } else if (minutes > 0) {
        setElapsed(`${minutes}m ago`);
      } else {
        setElapsed("Just now");
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [queuedAt]);

  return (
    <div className="flex items-center space-x-1 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" />
      <span>{elapsed}</span>
    </div>
  );
};

export function PendingTransfersTab({
  pendingTransfers,
  dataLoading,
  usdcDecimals,
  onRefresh,
}: PendingTransfersTabProps) {
  return (
    <Card className="border border-border bg-card/90 backdrop-blur-sm">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-foreground flex items-center">
            Transfer Events
            <span className="ml-3 text-sm font-normal text-muted-foreground bg-card px-3 py-1 rounded-full border border-border">
              {pendingTransfers.length} events
            </span>
          </CardTitle>
          <RefreshCountdown onRefresh={onRefresh} isRefreshing={dataLoading} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {dataLoading ? (
          <div className="flex justify-center items-center p-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-chart-3 mx-auto mb-4" />
              <p className="text-muted-foreground">
                Loading transfer events...
              </p>
            </div>
          </div>
        ) : pendingTransfers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No transfer events
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your processing transactions will appear here with live status
              updates and Etherscan links for tracking.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Wallet
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Amount
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Currency
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Type
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Status
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Application ID
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Farm ID
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Region
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Date
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Transaction
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTransfers.map((transfer) => (
                  <TableRow
                    key={transfer.txId}
                    className="hover:bg-muted/30 transition-all duration-200 group/row"
                  >
                    <TableCell className="py-4">
                      <CopyableAddress
                        address={transfer.wallet}
                        type="address"
                      />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-base font-semibold text-foreground">
                        {parseFloat(
                          formatUnits(
                            BigInt(transfer.amountWei),
                            transfer.currency === "USDC" ? usdcDecimals : 18
                          )
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits:
                            transfer.currency === "USDC" ? 2 : 6,
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                          transfer.currency === "USDC"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            : transfer.currency === "ETH"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                            : "bg-chart-4 text-white"
                        }`}
                      >
                        {transfer.currency}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 capitalize">
                        {transfer.type}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="space-y-2">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          <div className="w-1.5 h-1.5 bg-amber-600 dark:bg-amber-400 rounded-full mr-2 animate-pulse"></div>
                          {transfer.status}
                        </span>
                        {transfer.status.toLowerCase() === "pending" && (
                          <PendingTimer queuedAt={transfer.ts} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {transfer.applicationId ? (
                        <div className="font-mono text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md border border-border">
                          {`${transfer.applicationId.slice(0, 8)}...`}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      {transfer.farmId ? (
                        <div className="font-mono text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md border border-border">
                          {`${transfer.farmId.slice(0, 8)}...`}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      {transfer.regionId ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                          #{transfer.regionId}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-sm font-medium text-foreground">
                        {new Date(transfer.ts).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(transfer.ts).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="bg-muted px-3 py-1.5 rounded-md border border-border group-hover/row:bg-muted/70 transition-colors">
                        <CopyableAddress address={transfer.txId} type="tx" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
