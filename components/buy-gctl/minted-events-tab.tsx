import React, { useState, useEffect } from "react";
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
  ExternalLink,
  Copy,
  Check,
  ArrowUpRight,
  Clock,
  RefreshCw,
} from "lucide-react";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { getCurrencyDecimals, getDisplayDecimals } from "@/lib/currency";
import { MintedEvent } from "@glowlabs-org/utils/browser";

interface MintedEventsTabProps {
  mintedEvents: MintedEvent[];
  dataLoading: boolean;
  onRefresh?: () => Promise<void>;
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
      ? `https://etherscan.io/tx/${address}`
      : `https://etherscan.io/address/${address}`;

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

export function MintedEventsTab({
  mintedEvents,
  dataLoading,
  onRefresh,
}: MintedEventsTabProps) {
  return (
    <Card className="border border-border bg-card/90 backdrop-blur-sm">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-foreground flex items-center">
            Recent Minted Events
            <span className="ml-3 text-sm font-normal text-muted-foreground bg-card px-3 py-1 rounded-full border border-border">
              {mintedEvents.length} events
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
              <p className="text-muted-foreground">Loading minted events...</p>
            </div>
          </div>
        ) : mintedEvents.length === 0 ? (
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No minted events yet
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your successful GCTL purchases will appear here. Each transaction
              will be linked to Sepolia Etherscan for easy verification.
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
                    GCTL Minted
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Amount
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Currency
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Epoch
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
                {mintedEvents.map((event, index) => (
                  <TableRow
                    key={event.txId}
                    className="hover:bg-muted/30 transition-all duration-200 group/row"
                  >
                    <TableCell className="py-4">
                      <CopyableAddress address={event.wallet} type="address" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-base font-semibold text-foreground">
                        {parseFloat(
                          formatUnits(BigInt(event.gctlMinted), 6)
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 6,
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">
                        GCTL
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-base font-medium text-foreground">
                        {parseFloat(
                          formatUnits(
                            BigInt(event.amountRaw),
                            getCurrencyDecimals(event.currency)
                          )
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: getDisplayDecimals(
                            event.currency
                          ),
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                          event.currency === "USDC"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            : event.currency === "ETH"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                            : "bg-chart-4 text-white"
                        }`}
                      >
                        {event.currency}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                        #{event.epoch}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-sm font-medium text-foreground">
                        {new Date(event.ts).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.ts).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center space-x-2">
                        <div className="bg-muted px-3 py-1.5 rounded-md border border-border group-hover/row:bg-muted/70 transition-colors">
                          <CopyableAddress address={event.txId} type="tx" />
                        </div>
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
