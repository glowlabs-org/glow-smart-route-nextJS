import React, { useState } from "react";
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
  Copy,
  Check,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { useGctlApi } from "@/hooks/useGctlApi";
import { getCurrencyDecimals, getDisplayDecimals } from "@/lib/currency";
import { FailedOperation } from "@glowlabs-org/utils/browser";

interface FailedOperationsTabProps {
  failedOperations: FailedOperation[];
  dataLoading: boolean;
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

export function FailedOperationsTab({
  failedOperations,
  dataLoading,
}: FailedOperationsTabProps) {
  const { retryFailedOperation, isRetryingFailedOperation } = useGctlApi();
  const [retryingOperationId, setRetryingOperationId] = useState<string | null>(
    null
  );

  const handleRetry = async (operationId: string) => {
    setRetryingOperationId(operationId);
    try {
      const result = await retryFailedOperation(operationId);
      if (result.ok) {
        toast.success("Operation retry initiated successfully");
      } else {
        toast.error(`Failed to retry operation: ${result.val}`);
      }
    } catch (error) {
      toast.error("Failed to retry operation");
    } finally {
      setRetryingOperationId(null);
    }
  };

  return (
    <Card className="border border-border bg-card/90 backdrop-blur-sm">
      <CardHeader className="border-b">
        <CardTitle className="text-xl font-bold text-foreground flex items-center">
          Failed Operations
          <span className="ml-auto text-sm font-normal text-muted-foreground bg-card px-3 py-1 rounded-full border border-border">
            {failedOperations.length} failed
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {dataLoading ? (
          <div className="flex justify-center items-center p-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-chart-3 mx-auto mb-4" />
              <p className="text-muted-foreground">
                Loading failed operations...
              </p>
            </div>
          </div>
        ) : failedOperations.length === 0 ? (
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
              No failed operations
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              All transactions have been processed successfully. Failed
              operations will appear here with Etherscan links for debugging.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Operation
                  </TableHead>
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
                    Failure Type
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Retries
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Retryable
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Created
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Error & Transaction
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedOperations.map((operation) => (
                  <TableRow
                    key={operation.id}
                    className="hover:bg-muted/30 transition-all duration-200 group/row"
                  >
                    <TableCell className="py-4">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 capitalize">
                        {operation.operation}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      {operation.wallet ? (
                        <CopyableAddress
                          address={operation.wallet}
                          type="address"
                        />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      {operation.amountRaw ? (
                        <div className="text-base font-semibold text-foreground">
                          {parseFloat(
                            formatUnits(
                              BigInt(operation.amountRaw),
                              getCurrencyDecimals(operation.currency ?? "USDC")
                            )
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: getDisplayDecimals(
                              operation.currency ?? "USDC"
                            ),
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      {operation.currency ? (
                        <span
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                            operation.currency === "USDC"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              : operation.currency === "ETH"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                              : "bg-chart-4 text-white"
                          }`}
                        >
                          {operation.currency}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                        {operation.failureType}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                          {operation.retryCount}
                        </span>
                        {operation.retryCount > 0 && (
                          <RefreshCw className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                          operation.isRetryable === "true"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                        }`}
                      >
                        {operation.isRetryable === "true" ? "✓ Yes" : "✗ No"}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-sm font-medium text-foreground">
                        {new Date(operation.createdAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(operation.createdAt).toLocaleTimeString(
                          undefined,
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 max-w-xs">
                      <div className="space-y-2">
                        <div
                          className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md border border-red-200 dark:border-red-800 truncate font-medium"
                          title={operation.errorMessage}
                        >
                          {operation.errorMessage}
                        </div>
                        {operation.errorDetails && (
                          <div
                            className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md border border-border truncate"
                            title={operation.errorDetails}
                          >
                            {operation.errorDetails}
                          </div>
                        )}
                        <div className="bg-muted px-3 py-1.5 rounded-md border border-border group-hover/row:bg-muted/70 transition-colors">
                          <CopyableAddress address={operation.txId} type="tx" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {operation.isRetryable === "true" ? (
                        <Button
                          size="sm"
                          onClick={() => handleRetry(operation.id)}
                          disabled={
                            retryingOperationId === operation.id ||
                            isRetryingFailedOperation
                          }
                          title="Retry failed operation"
                        >
                          {retryingOperationId === operation.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-1" />
                          )}
                          {retryingOperationId === operation.id
                            ? "Retrying..."
                            : "Retry"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Not retryable
                        </span>
                      )}
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
