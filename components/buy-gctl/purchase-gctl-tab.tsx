"use client";
import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAccount, usePublicClient, useChainId } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowUpDown, Info, HelpCircle } from "lucide-react";
import { ERC20_ABI } from "@/web3/web3/abis/erc20.abi";
import { useForwarder } from "@/hooks/useForwarder";
import { BigNumber } from "ethers";
import { ConnectButton } from "@/components/connect-button";

interface PurchaseGctlTabProps {
  gctlBalance: string;
  gctlPrice: number;
  gctlDataLoading: boolean;
  onTransactionStart: (txHash: string) => void;
  fetchPendingTransfers: () => Promise<any>;
  fetchMintedEvents: () => Promise<any>;
}

// Helper function to format large numbers
const formatLargeNumber = (value: number, decimals: number = 2): string => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(decimals)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(decimals)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(decimals)}K`;
  return value.toFixed(decimals);
};

// Helper function to format currency input
const formatCurrencyInput = (value: string): string => {
  if (!value) return "";
  // Remove non-numeric characters except decimal point
  let cleaned = value.replace(/[^0-9.]/g, "");
  // Ensure only one decimal point
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = parts[0] + "." + parts.slice(1).join("");
  }
  // Limit decimal places to 6
  if (parts[1] && parts[1].length > 6) {
    cleaned = parts[0] + "." + parts[1].substring(0, 6);
  }
  return cleaned;
};

export function PurchaseGctlTab({
  gctlBalance,
  gctlPrice,
  gctlDataLoading,
  onTransactionStart,
  fetchPendingTransfers,
  fetchMintedEvents,
}: PurchaseGctlTabProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const isOnSepolia = chainId === 11155111;

  // Use the forwarder hook
  const { forwardUSDC, checkAllowance, mintTestUSDC, isProcessing, addresses } =
    useForwarder();

  const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));
  const [inputAmount, setInputAmount] = useState<string>("");
  const [outputAmount, setOutputAmount] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [usdcBalanceLoading, setUsdcBalanceLoading] = useState<boolean>(true);
  const [needsApproval, setNeedsApproval] = useState<boolean>(false);
  const [inputError, setInputError] = useState<string>("");
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch USDC balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !publicClient) {
        setUsdcBalanceLoading(false);
        return;
      }
      setUsdcBalanceLoading(true);
      try {
        const bal = (await publicClient.readContract({
          address: addresses.USDC,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;
        setUsdcBalance(bal);
      } catch (error) {
        toast.error("Failed to fetch USDC balance");
      } finally {
        setUsdcBalanceLoading(false);
      }
    };
    if (isConnected) fetchBalance();
    else setUsdcBalanceLoading(false);
  }, [address, isConnected, publicClient, addresses.USDC]);

  // Check approval status
  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!address || !inputAmount) return;
      try {
        const amount = BigNumber.from(parseUnits(inputAmount, 6).toString());
        const allowanceResult = await checkAllowance(address);

        if (allowanceResult.ok) {
          setNeedsApproval(allowanceResult.val.lt(amount));
        }
      } catch (error) {
        console.error("Error checking approval:", error);
      }
    };
    if (isConnected && inputAmount) checkApprovalStatus();
  }, [address, inputAmount, isConnected, checkAllowance]);

  // Validate input and set errors
  const validateInput = (value: string): string => {
    if (!value) return "";
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return "Please enter a valid number";
    if (numValue < 1) return "Minimum purchase is 1 USDC";
    if (numValue > parseFloat(formatUnits(usdcBalance, 6)))
      return "Insufficient USDC balance";
    return "";
  };

  // Handle input change with dynamic pricing
  const handleInputChange = (value: string) => {
    const formatted = formatCurrencyInput(value);
    setInputAmount(formatted);

    const error = validateInput(formatted);
    setInputError(error);

    if (!formatted || error) {
      setOutputAmount("");
      return;
    }

    const usdc = parseFloat(formatted);
    if (isNaN(usdc) || gctlPrice <= 0) {
      setOutputAmount("");
      return;
    }

    const gctl = usdc / gctlPrice;
    setOutputAmount(gctl.toFixed(6));
  };

  // Handle percentage buttons
  const handlePercentage = (percentage: number) => {
    if (usdcBalance === BigInt(0)) return;
    const balanceInUsdc = parseFloat(formatUnits(usdcBalance, 6));
    const amount = ((balanceInUsdc * percentage) / 100).toFixed(6);
    handleInputChange(amount);
  };

  // Handle balance click
  const handleBalanceClick = () => {
    if (usdcBalance === BigInt(0)) return;
    const balanceInUsdc = formatUnits(usdcBalance, 6);
    handleInputChange(balanceInUsdc);
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      !loading &&
      !isProcessing &&
      inputAmount &&
      !inputError
    ) {
      handleBuy();
    }
  };

  // Forward USDC through forwarder contract using the hook
  const handleBuy = async () => {
    if (!inputAmount || !address || inputError) return;
    setLoading(true);

    try {
      const amount = BigNumber.from(parseUnits(inputAmount, 6).toString());
      const result = await forwardUSDC(amount, address);

      if (result.ok) {
        const txHash = result.val;
        const expectedGctl = parseFloat(outputAmount);
        const eta = new Date(Date.now() + 45 * 1000); // 45 seconds from now

        // Notify parent component about transaction start
        onTransactionStart(txHash);

        setInputAmount("");
        setOutputAmount("");
        setInputError("");

        // Refresh balance
        if (publicClient) {
          const bal = (await publicClient.readContract({
            address: addresses.USDC,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          })) as bigint;
          setUsdcBalance(bal);
        }

        // Initial fetch to check if transaction appears quickly
        setTimeout(() => {
          fetchPendingTransfers();
          fetchMintedEvents();
        }, 5000);
      } else {
        toast.error(`Transaction failed: ${result.val}`);
      }
    } catch (error) {
      toast.error("Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  // Handle minting test USDC
  const handleMintTestUSDC = async () => {
    if (!address) return;

    try {
      // Mint 1000 USDC for testing
      const amount = BigNumber.from(parseUnits("1000", 6).toString());
      const result = await mintTestUSDC(amount, address);

      if (result.ok) {
        toast.success("Successfully minted 1000 test USDC!");

        // Refresh USDC balance
        if (publicClient) {
          const bal = (await publicClient.readContract({
            address: addresses.USDC,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          })) as bigint;
          setUsdcBalance(bal);
        }
      } else {
        toast.error(`Failed to mint test USDC: ${result.val}`);
      }
    } catch (error) {
      toast.error("Failed to mint test USDC");
    }
  };

  const usdcBalanceFormatted = parseFloat(formatUnits(usdcBalance, 6));
  const gctlBalanceFormatted = parseFloat(formatUnits(BigInt(gctlBalance), 6));
  const dynamicButtonText = inputAmount
    ? `Buy GCTL for ${inputAmount} USDC`
    : "Enter Amount to Buy GCTL";

  return (
    <Card className="border border-border bg-white/95 backdrop-blur-sm w-full">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-foreground flex items-center">
            Buy GCTL
          </CardTitle>

          {/* Price Display */}
          <div className="text-right">
            {gctlDataLoading ? (
              <Skeleton className="h-6 w-32" />
            ) : gctlPrice > 0 ? (
              <div className="text-sm font-medium">
                1 USDC → {(1 / gctlPrice).toFixed(4)} GCTL
              </div>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {/* User GCTL Balance Display */}
        {isConnected && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">G</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-green-700 mb-1">
                    Your GCTL Balance
                  </div>
                  {gctlDataLoading ? (
                    <Skeleton className="h-6 w-32" />
                  ) : (
                    <div className="text-xl font-bold text-green-900">
                      {gctlBalanceFormatted > 999999
                        ? formatLargeNumber(gctlBalanceFormatted)
                        : gctlBalanceFormatted.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}{" "}
                      GCTL
                    </div>
                  )}
                </div>
              </div>
              {!gctlDataLoading && gctlBalanceFormatted > 0 && (
                <div className="text-right">
                  <div className="text-xs text-green-600 mb-1">USD Value</div>
                  <div className="text-sm font-semibold text-green-800">
                    $
                    {(gctlBalanceFormatted * gctlPrice).toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Sections Container with relative positioning for absolute swap icon */}
        <div className="relative gap-4 flex flex-col">
          {/* From Section - USDC */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium text-muted-foreground">
                From
              </Label>
              {isConnected && (
                <div className="text-sm text-muted-foreground">
                  {usdcBalanceLoading ? (
                    <div className="flex items-center space-x-1">
                      <span>Balance:</span>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ) : (
                    <button
                      onClick={handleBalanceClick}
                      className="hover:text-foreground transition-colors cursor-pointer"
                      disabled={usdcBalance === BigInt(0)}
                      title={`Full balance: ${usdcBalanceFormatted.toLocaleString(
                        undefined,
                        { maximumFractionDigits: 6 }
                      )} USDC`}
                    >
                      Balance:{" "}
                      {usdcBalanceFormatted > 999999
                        ? formatLargeNumber(usdcBalanceFormatted)
                        : usdcBalanceFormatted.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}{" "}
                      USDC
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder="0.00"
                value={inputAmount}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`h-16 text-2xl font-medium pr-32 border-2 focus:border-primary transition-all duration-200 bg-background/50 ${
                  inputError ? "border-red-500 focus:border-red-500" : ""
                }`}
                disabled={gctlDataLoading || gctlPrice <= 0}
                aria-label="USDC amount to spend"
              />

              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-full border border-blue-200">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">$</span>
                  </div>
                  <span className="text-sm font-semibold text-blue-700">
                    USDC
                  </span>
                </div>
              </div>
            </div>

            {/* Percentage Buttons */}
            {isConnected && usdcBalance > BigInt(0) && !usdcBalanceLoading && (
              <div className="flex space-x-2">
                {[25, 50, 75].map((percentage) => (
                  <Button
                    key={percentage}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePercentage(percentage)}
                    className="h-8 px-3 text-xs hover:bg-primary/10 hover:border-primary/50"
                    disabled={gctlDataLoading || gctlPrice <= 0}
                  >
                    {percentage}%
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePercentage(100)}
                  className="h-8 px-3 text-xs font-medium hover:bg-primary/10 hover:border-primary/50"
                  disabled={gctlDataLoading || gctlPrice <= 0}
                >
                  MAX
                </Button>
              </div>
            )}

            {/* Input Error */}
            {inputError && (
              <div
                className="text-sm text-red-600 flex items-center space-x-2 bg-red-50 border border-red-200 rounded-md p-2"
                role="alert"
              >
                <span className="text-red-500">⚠</span>
                <span>{inputError}</span>
              </div>
            )}
          </div>

          {/* Swap Icon - Absolutely positioned between inputs */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div
              className="w-10 h-10 bg-background rounded-full flex items-center justify-center border border-border hover:bg-muted/80 transition-colors opacity-50 cursor-not-allowed shadow-sm"
              title="GCTL redemptions disabled in v1.5"
            >
              <ArrowUpDown className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          {/* To Section - GCTL */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium text-muted-foreground">
                To
              </Label>
              {isConnected && (
                <div className="text-sm text-muted-foreground">
                  {gctlDataLoading ? (
                    <div className="flex items-center space-x-1">
                      <span>Balance:</span>
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ) : (
                    <span
                      title={`Full balance: ${gctlBalanceFormatted.toLocaleString(
                        undefined,
                        { maximumFractionDigits: 6 }
                      )} GCTL`}
                    >
                      Balance:{" "}
                      {gctlBalanceFormatted > 999999
                        ? formatLargeNumber(gctlBalanceFormatted)
                        : gctlBalanceFormatted.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}{" "}
                      GCTL
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <Input
                type="text"
                value={outputAmount}
                readOnly
                className="h-16 text-2xl font-medium pr-32 bg-muted/30 border-2 border-border cursor-not-allowed"
                aria-label="GCTL amount you'll receive"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="flex items-center space-x-2 bg-gradient-to-r from-green-50 to-blue-50 px-3 py-2 rounded-full border border-green-200">
                  <div className="w-5 h-5 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">G</span>
                  </div>
                  <span className="text-sm font-semibold text-green-700">
                    GCTL
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Exchange Rate Summary */}
        {inputAmount && outputAmount && !gctlDataLoading && (
          <div className="bg-muted/30 border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">
              You&apos;ll receive{" "}
              <span
                className="text-foreground font-medium"
                title="Rounded to 6 decimals; final mint amount shown on receipt"
              >
                ~
                {parseFloat(outputAmount).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}{" "}
                GCTL
              </span>
            </div>
          </div>
        )}

        {/* Zero Balance State */}
        {isConnected && usdcBalance === BigInt(0) && !usdcBalanceLoading && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <div className="text-amber-800 mb-2 font-medium">
              No USDC Balance Found
            </div>
            <div className="text-amber-700 text-sm mb-3">
              You need USDC to purchase GCTL
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                className="text-amber-700 border-amber-300 hover:bg-amber-100"
              >
                Add USDC to Wallet
              </Button>
              {isOnSepolia && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMintTestUSDC}
                  disabled={isProcessing}
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Minting...
                    </>
                  ) : (
                    "Mint 1000 Test USDC"
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Test USDC Mint Button for users with balance on Sepolia */}
        {isConnected && isOnSepolia && usdcBalance > BigInt(0) && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMintTestUSDC}
              disabled={isProcessing}
              className="text-blue-700 border-blue-300 hover:bg-blue-100"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Minting...
                </>
              ) : (
                "Mint 1000 Test USDC"
              )}
            </Button>
          </div>
        )}

        {/* Buy Button */}
        {!isConnected ? (
          <ConnectButton
            variant="default"
            size="large"
            className="w-full rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          />
        ) : (
          <Button
            className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            onClick={handleBuy}
            disabled={
              !isOnSepolia ||
              !inputAmount ||
              !!inputError ||
              loading ||
              isProcessing ||
              gctlDataLoading ||
              gctlPrice <= 0
            }
          >
            {loading || isProcessing ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                {needsApproval ? "Approving & Purchasing..." : "Purchasing..."}
              </>
            ) : !isOnSepolia ? (
              "Switch to Sepolia"
            ) : gctlDataLoading ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Loading Data...
              </>
            ) : gctlPrice <= 0 ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Loading Price...
              </>
            ) : inputError ? (
              "Fix Errors Above"
            ) : !inputAmount ? (
              "Enter Amount to Buy GCTL"
            ) : (
              dynamicButtonText
            )}
          </Button>
        )}

        {/* Network Warning */}
        {!isOnSepolia && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-red-700 font-medium text-sm">
              <span className="text-red-500">⚠</span>
              <span>Please switch to Sepolia Testnet to purchase GCTL</span>
            </div>
          </div>
        )}

        {/* Details Toggle */}
        <div className="border-t border-border pt-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors p-3 rounded-lg hover:bg-muted/50"
          >
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4" />
              <span>How It Works</span>
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${
                showDetails ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showDetails && (
            <div className="mt-3 bg-blue-50/50 border border-blue-200 rounded-lg p-4 space-y-3 text-sm">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900 mb-1">
                    Off-chain Purchase
                  </p>
                  <p className="text-blue-700">
                    No gas fees required. GCTL is credited to your account
                    database, not minted on-chain yet.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900 mb-1">
                    Processing Time
                  </p>
                  <p className="text-blue-700">
                    GCTL is credited within ~1 minute of your USDC transaction
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-900 mb-1">
                    Non-transferable
                  </p>
                  <p className="text-blue-700">
                    Until GLOW V2 phase 2, but can be staked to regions
                    immediately
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
