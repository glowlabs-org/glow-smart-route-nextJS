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
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { StakedEvent } from "@/hooks/useGctlApi";

interface StakedEventsTabProps {
  stakedEvents: StakedEvent[];
  dataLoading: boolean;
  regions: Array<{ id: number; name: string; flag: string }>;
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

// Timer component for staked events
const StakedTimer = ({ stakedAt }: { stakedAt: string }) => {
  const [elapsed, setElapsed] = useState<string>("");

  useEffect(() => {
    const updateElapsed = () => {
      const now = new Date();
      const stakeTime = new Date(stakedAt);
      const diffMs = now.getTime() - stakeTime.getTime();

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
  }, [stakedAt]);

  return (
    <div className="flex items-center space-x-1 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" />
      <span>{elapsed}</span>
    </div>
  );
};

export function StakedEventsTab({
  stakedEvents,
  dataLoading,
  regions,
}: StakedEventsTabProps) {
  return (
    <Card className="border border-border bg-card/90 backdrop-blur-sm">
      <CardHeader className="border-b">
        <CardTitle className="text-xl font-bold text-foreground flex items-center">
          Staking Events
          <span className="ml-auto text-sm font-normal text-muted-foreground bg-card px-3 py-1 rounded-full border border-border">
            {stakedEvents.length} events
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {dataLoading ? (
          <div className="flex justify-center items-center p-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
              <p className="text-muted-foreground">Loading staking events...</p>
            </div>
          </div>
        ) : stakedEvents.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No staking events
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your staking and unstaking transactions will appear here with
              detailed information about amounts, regions, and transaction
              status.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Type
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Wallet
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Amount
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Region
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Epoch
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stakedEvents.map((event) => {
                  const region = regions.find((r) => r.id === event.regionId);
                  const eventDirection = event.direction || "unknown";
                  const isStake = eventDirection === "stake";

                  // Safe type display with fallback
                  const typeDisplay =
                    eventDirection.charAt(0).toUpperCase() +
                    eventDirection.slice(1);

                  return (
                    <TableRow
                      key={event.id || "unknown"}
                      className="hover:bg-muted/30 transition-all duration-200 group/row"
                    >
                      <TableCell className="py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                            isStake
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : eventDirection === "unstake"
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                          }`}
                        >
                          {isStake ? (
                            <TrendingUp className="w-3 h-3 mr-1" />
                          ) : eventDirection === "unstake" ? (
                            <TrendingDown className="w-3 h-3 mr-1" />
                          ) : null}
                          {typeDisplay}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        {event.wallet ? (
                          <CopyableAddress
                            address={event.wallet}
                            type="address"
                          />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="text-base font-semibold text-foreground">
                          {event.amount ? (
                            <>
                              {parseFloat(
                                formatUnits(BigInt(event.amount), 6)
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}{" "}
                              <span className="text-sm font-normal text-muted-foreground">
                                GCTL
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {region ? (
                          <div className="flex items-center space-x-2">
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {region.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                #{event.regionId || "?"}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                            #{event.regionId || "?"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {event.epoch ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-mono">
                            #{event.epoch}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {event.ts ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-foreground">
                              {new Date(event.ts).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(event.ts).toLocaleTimeString(
                                undefined,
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </div>
                            <StakedTimer stakedAt={event.ts} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
