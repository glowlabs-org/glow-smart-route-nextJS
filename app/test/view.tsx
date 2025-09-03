"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownUp, Loader2 } from "lucide-react";
import {
  useAccount,
  usePublicClient,
  useChainId,
  useWalletClient,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits, parseUnits, parseAbi, erc20Abi, zeroAddress } from "viem";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { DECIMALS_BY_TOKEN, getAddresses } from "@glowlabs-org/utils/browser";
import { publicClient } from "@/web3/web3/clients/publicClient";

const SDKAddresses = getAddresses(parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!));

const UNISWAP_V2_FACTORY = SDKAddresses.UNISWAP_V2_FACTORY;

const SEPOLIA_ADDRESSES = {
  USDG: SDKAddresses.USDG_UNISWAP,
  GLOW: SDKAddresses.GLW_UNISWAP,
  UNISWAP_V2_ROUTER: SDKAddresses.UNISWAP_V2_ROUTER,
  UNISWAP_V2_FACTORY: SDKAddresses.UNISWAP_V2_FACTORY,
};

const DECIMALS = {
  USDG: DECIMALS_BY_TOKEN.USDG,
  GLOW: DECIMALS_BY_TOKEN.GLW,
};

// Reuse ABIs from useLiquidityPositions pattern
const PairAbi = parseAbi([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
]);

const RouterAbi = parseAbi([
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)",
]);

export default function TestView() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [fromToken, setFromToken] = useState<"USDG" | "GLOW">("USDG");
  const [toToken, setToToken] = useState<"USDG" | "GLOW">("GLOW");
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [slippage, setSlippage] = useState(1); // 1% default slippage
  const [loading, setLoading] = useState(false);
  const [reserves, setReserves] = useState<{
    usdg: bigint;
    glow: bigint;
  } | null>(null);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [newGlowPrice, setNewGlowPrice] = useState<number>(0);
  const [tokenBalances, setTokenBalances] = useState<{
    usdg: bigint;
    glow: bigint;
  }>({ usdg: BigInt(0), glow: BigInt(0) });
  const [needsApproval, setNeedsApproval] = useState(false);
  const [pairAddress, setPairAddress] = useState<`0x${string}` | null>(null);
  const [pairInfo, setPairInfo] = useState<{
    totalSupply: bigint;
    userLpBalance: bigint;
  }>({ totalSupply: BigInt(0), userLpBalance: BigInt(0) });
  const [liquidityInfo, setLiquidityInfo] = useState<{
    currentLiquidity: number;
    estimatedLiquidity: number;
  }>({ currentLiquidity: 0, estimatedLiquidity: 0 });

  // Check if we're on Sepolia
  const isOnSepolia = chainId === 11155111;

  // Helper functions similar to useLiquidityPositions
  const orderReservesByTokenSymbols = useCallback(
    (params: {
      token0: string;
      usdGAddress: string;
      reserve0: bigint;
      reserve1: bigint;
    }) => {
      const { token0, usdGAddress, reserve0, reserve1 } = params;
      const isToken0USDG = token0.toLowerCase() === usdGAddress.toLowerCase();
      const usdgReserve = isToken0USDG ? reserve0 : reserve1;
      const glowReserve = isToken0USDG ? reserve1 : reserve0;
      return { usdgReserve, glowReserve };
    },
    []
  );

  // Fetch token balances
  const fetchBalances = async () => {
    if (!publicClient || !address || !isOnSepolia) {
      console.log("fetchBalances skipped:", {
        hasPublicClient: !!publicClient,
        address,
        isOnSepolia,
        chainId,
      });
      return;
    }

    console.log("Fetching balances for address:", address);
    console.log("Token addresses:", {
      USDG: SEPOLIA_ADDRESSES.USDG,
      GLOW: SEPOLIA_ADDRESSES.GLOW,
    });

    try {
      console.log("📖 Reading balances directly...");

      console.log("📖 Calling USDG balanceOf...");
      const usdgBalance = (await publicClient.readContract({
        address: SEPOLIA_ADDRESSES.USDG as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
      console.log("📖 USDG balance received:", usdgBalance.toString());

      console.log("📖 Calling GLOW balanceOf...");
      const glowBalance = (await publicClient.readContract({
        address: SEPOLIA_ADDRESSES.GLOW as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
      console.log("📖 GLOW balance received:", glowBalance.toString());

      console.log("Balances fetched:", {
        usdg: usdgBalance.toString(),
        glow: glowBalance.toString(),
        usdgFormatted: formatUnits(usdgBalance, DECIMALS.USDG),
        glowFormatted: formatUnits(glowBalance, DECIMALS.GLOW),
      });

      setTokenBalances({ usdg: usdgBalance, glow: glowBalance });
    } catch (error) {
      console.error("Error fetching balances:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  };

  // Check if approval is needed
  const checkApproval = async () => {
    if (!publicClient || !address || !inputAmount || !isOnSepolia) return;

    try {
      const tokenAddress =
        fromToken === "USDG" ? SEPOLIA_ADDRESSES.USDG : SEPOLIA_ADDRESSES.GLOW;
      const amount = parseUnits(inputAmount, DECIMALS[fromToken]);

      const allowance = (await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, SEPOLIA_ADDRESSES.UNISWAP_V2_ROUTER as `0x${string}`],
      })) as bigint;

      setNeedsApproval(allowance < amount);
    } catch (error) {
      console.error("Error checking approval:", error);
    }
  };

  // Execute approval
  const handleApprove = async () => {
    if (!walletClient || !address) return;

    setLoading(true);
    try {
      const tokenAddress =
        fromToken === "USDG" ? SEPOLIA_ADDRESSES.USDG : SEPOLIA_ADDRESSES.GLOW;
      const amount = parseUnits(inputAmount, DECIMALS[fromToken]);

      const hash = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [SEPOLIA_ADDRESSES.UNISWAP_V2_ROUTER as `0x${string}`, amount],
      });

      toast.info("Approval transaction submitted");
      await publicClient?.waitForTransactionReceipt({ hash });
      toast.success("Approval successful!");
      setNeedsApproval(false);
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Approval failed");
    } finally {
      setLoading(false);
    }
  };

  // Execute swap
  const handleSwap = async () => {
    if (!walletClient || !address || !inputAmount || !outputAmount) return;

    setLoading(true);
    try {
      const amountIn = parseUnits(inputAmount, DECIMALS[fromToken]);
      const slippageBps = BigInt(Math.round(slippage * 100)); // percent -> bps
      const minAmountOut =
        (parseUnits(outputAmount, DECIMALS[toToken]) *
          (BigInt(10_000) - slippageBps)) /
        BigInt(10_000);
      const path =
        fromToken === "USDG"
          ? [SEPOLIA_ADDRESSES.USDG, SEPOLIA_ADDRESSES.GLOW]
          : [SEPOLIA_ADDRESSES.GLOW, SEPOLIA_ADDRESSES.USDG];
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 minutes

      const hash = await walletClient.writeContract({
        address: SEPOLIA_ADDRESSES.UNISWAP_V2_ROUTER as `0x${string}`,
        abi: RouterAbi,
        functionName: "swapExactTokensForTokens",
        args: [amountIn, minAmountOut, path, address, deadline],
      });

      toast.info("Swap transaction submitted");
      await publicClient?.waitForTransactionReceipt({ hash });
      toast.success("Swap successful!");

      // Reset form and refresh balances
      setInputAmount("");
      setOutputAmount("");
      await fetchBalances();
      await fetchReserves();
    } catch (error) {
      console.error("Error swapping:", error);
      toast.error("Swap failed");
    } finally {
      setLoading(false);
    }
  };

  // Resolve pair via factory (matching useLiquidityPositions pattern)
  const resolvePairAddress = useCallback(async (): Promise<
    `0x${string}` | null
  > => {
    console.log("📊 resolvePairAddress called");
    if (!publicClient) return null;
    try {
      if (UNISWAP_V2_FACTORY) {
        const addr = (await publicClient.readContract({
          address: UNISWAP_V2_FACTORY as `0x${string}`,
          abi: parseAbi([
            "function getPair(address tokenA, address tokenB) external view returns (address pair)",
          ]),
          functionName: "getPair",
          args: [SEPOLIA_ADDRESSES.GLOW, SEPOLIA_ADDRESSES.USDG],
        })) as `0x${string}`;
        console.log("📊 Pair address received:", addr);
        if (addr && addr !== zeroAddress) return addr;
      }
      // fallback to constant or throw
      throw new Error("Pair not found");
    } catch {
      throw new Error("Pair not found");
    }
  }, [publicClient]);

  // Fetch reserves from Uniswap V2 pair
  const fetchReserves = useCallback(async () => {
    if (!publicClient || !isOnSepolia) {
      return;
    }

    try {
      const pairAddr = await resolvePairAddress();
      setPairAddress(pairAddr);
      if (!pairAddr) {
        console.log("Pair not found via factory");
        return;
      }

      console.log("Fetching reserves from pair:", pairAddr);

      // Use multicall for efficiency
      const contracts = [
        {
          address: pairAddr,
          abi: PairAbi,
          functionName: "token0",
        },
        {
          address: pairAddr,
          abi: PairAbi,
          functionName: "getReserves",
        },
        {
          address: pairAddr,
          abi: erc20Abi,
          functionName: "totalSupply",
        },
        ...(address
          ? [
              {
                address: pairAddr,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [address],
              },
            ]
          : []),
      ];

      const results = await publicClient.multicall({
        contracts,
        allowFailure: false,
      });

      const token0 = results[0] as `0x${string}`;
      const [reserve0, reserve1] = results[1] as readonly [
        bigint,
        bigint,
        number
      ];
      const totalSupply = results[2] as bigint;
      const userLpBalance = address ? (results[3] as bigint) : BigInt(0);

      console.log("📊 Raw reserves:", {
        reserve0: reserve0.toString(),
        reserve1: reserve1.toString(),
        token0,
        totalSupply: totalSupply.toString(),
        userLpBalance: userLpBalance.toString(),
      });

      // Use helper to order reserves
      const { usdgReserve, glowReserve } = orderReservesByTokenSymbols({
        token0,
        usdGAddress: SEPOLIA_ADDRESSES.USDG,
        reserve0,
        reserve1,
      });

      const finalReserves = {
        usdg: usdgReserve,
        glow: glowReserve,
      };

      console.log("Processed reserves:", {
        usdg: finalReserves.usdg.toString(),
        glow: finalReserves.glow.toString(),
        usdgFormatted: formatUnits(finalReserves.usdg, DECIMALS.USDG),
        glowFormatted: formatUnits(finalReserves.glow, DECIMALS.GLOW),
      });

      setReserves(finalReserves);
      setPairInfo({ totalSupply, userLpBalance });
    } catch (error) {
      console.error("Error fetching reserves:", error);
      if (error instanceof Error && error.message === "Pair not found") {
        toast.error("Liquidity pair not found on this network");
      } else {
        toast.error("Failed to fetch pool reserves");
      }
    }
  }, [
    publicClient,
    isOnSepolia,
    chainId,
    address,
    resolvePairAddress,
    orderReservesByTokenSymbols,
  ]);

  // Calculate output amount using constant product formula
  const calculateOutputAmount = (input: string) => {
    if (!reserves || !input || parseFloat(input) === 0) {
      setOutputAmount("");
      setPriceImpact(0);
      setNewGlowPrice(0);
      setLiquidityInfo({ currentLiquidity: 0, estimatedLiquidity: 0 });
      return;
    }

    try {
      const inputBigInt = parseUnits(input, DECIMALS[fromToken]);

      // Get reserves based on swap direction
      const reserveIn = fromToken === "USDG" ? reserves.usdg : reserves.glow;
      const reserveOut = fromToken === "USDG" ? reserves.glow : reserves.usdg;

      // Uniswap V2 formula: amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
      const amountInWithFee = inputBigInt * BigInt(997);
      const numerator = amountInWithFee * reserveOut;
      const denominator = reserveIn * BigInt(1000) + amountInWithFee;
      const amountOut = numerator / denominator;

      // Calculate current liquidity (L = sqrt(x * y))
      // Convert to proper decimal format for calculation
      const usdgReserveFloat = Number(
        formatUnits(reserves.usdg, DECIMALS.USDG)
      );
      const glowReserveFloat = Number(
        formatUnits(reserves.glow, DECIMALS.GLOW)
      );
      const currentLiquidity = Math.sqrt(usdgReserveFloat * glowReserveFloat);

      // Calculate new reserves after swap (accounting for the fee already applied in amountOut calculation)
      const newReserveIn = reserveIn + inputBigInt;
      const newReserveOut = reserveOut - amountOut;

      // Map back to USDG and GLOW reserves
      const newUsdgReserve =
        fromToken === "USDG" ? newReserveIn : newReserveOut;
      const newGlowReserve =
        fromToken === "USDG" ? newReserveOut : newReserveIn;

      // Convert new reserves to decimal format and calculate estimated liquidity
      const newUsdgReserveFloat = Number(
        formatUnits(newUsdgReserve, DECIMALS.USDG)
      );
      const newGlowReserveFloat = Number(
        formatUnits(newGlowReserve, DECIMALS.GLOW)
      );
      const estimatedLiquidity = Math.sqrt(
        newUsdgReserveFloat * newGlowReserveFloat
      );

      // Store liquidity info
      setLiquidityInfo({
        currentLiquidity,
        estimatedLiquidity,
      });

      // Calculate price impact for any swap involving GLOW
      if (fromToken === "GLOW" || toToken === "GLOW") {
        // Convert reserves to proper decimal format for price calculation
        const usdgReserveFormatted = Number(
          formatUnits(reserves.usdg, DECIMALS.USDG)
        );
        const glowReserveFormatted = Number(
          formatUnits(reserves.glow, DECIMALS.GLOW)
        );

        // Current price (USDG per GLOW)
        const currentGlowPrice = usdgReserveFormatted / glowReserveFormatted;

        // Calculate new reserves after swap (in formatted units)
        const amountInFormatted = Number(
          formatUnits(inputBigInt, DECIMALS[fromToken])
        );
        const amountOutFormatted = Number(
          formatUnits(amountOut, DECIMALS[toToken])
        );

        const newReserveInFormatted =
          fromToken === "USDG"
            ? usdgReserveFormatted + amountInFormatted
            : glowReserveFormatted + amountInFormatted;

        const newReserveOutFormatted =
          fromToken === "USDG"
            ? glowReserveFormatted - amountOutFormatted
            : usdgReserveFormatted - amountOutFormatted;

        console.log("🧮 Price calculation debug:", {
          fromToken,
          toToken,
          currentGlowPrice,
          usdgReserveFormatted,
          glowReserveFormatted,
          amountInFormatted,
          amountOutFormatted,
          newReserveInFormatted,
          newReserveOutFormatted,
        });

        // New price after swap (always USDG per GLOW)
        const newUsdgReserve =
          fromToken === "USDG" ? newReserveInFormatted : newReserveOutFormatted;
        const newGlowReserve =
          fromToken === "USDG" ? newReserveOutFormatted : newReserveInFormatted;
        const newGlowPrice = newUsdgReserve / newGlowReserve;

        console.log("🧮 New Glow price calculated:", {
          newUsdgReserve,
          newGlowReserve,
          newGlowPrice,
        });

        // Calculate price impact
        const impact =
          ((newGlowPrice - currentGlowPrice) / currentGlowPrice) * 100;
        setPriceImpact(Math.abs(impact));

        // Store the new price for display
        setNewGlowPrice(newGlowPrice);
      } else {
        setPriceImpact(0);
        setNewGlowPrice(0);
      }

      setOutputAmount(formatUnits(amountOut, DECIMALS[toToken]));
    } catch (error) {
      console.error("Error calculating output:", error);
      setOutputAmount("");
      setPriceImpact(0);
      setNewGlowPrice(0);
    }
  };

  // Switch tokens
  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setInputAmount(outputAmount);
    setOutputAmount(inputAmount);
    setPriceImpact(0);
    setNewGlowPrice(0);
    setLiquidityInfo({ currentLiquidity: 0, estimatedLiquidity: 0 });
  };

  // Handle input change
  const handleInputChange = (value: string) => {
    setInputAmount(value);
    calculateOutputAmount(value);
  };

  // Get current price
  const getCurrentPrice = useCallback(() => {
    if (!reserves) return { usdgPerGlow: 0, glowPerUsdg: 0 };

    const usdgReserve = Number(formatUnits(reserves.usdg, DECIMALS.USDG));
    const glowReserve = Number(formatUnits(reserves.glow, DECIMALS.GLOW));

    return {
      usdgPerGlow: usdgReserve / glowReserve,
      glowPerUsdg: glowReserve / usdgReserve,
    };
  }, [reserves]);

  // Fetch reserves on mount and when chain changes
  useEffect(() => {
    console.log("🚀 Reserve fetch effect triggered:", { isOnSepolia, chainId });
    if (isOnSepolia) {
      console.log("🚀 Calling fetchReserves from useEffect");
      fetchReserves();
      console.log("🚀 Setting up interval for fetchReserves");
      const interval = setInterval(() => {
        console.log("🔄 Interval calling fetchReserves");
        fetchReserves();
      }, 10000); // Refresh every 10 seconds
      return () => {
        console.log("🚀 Cleaning up fetchReserves interval");
        clearInterval(interval);
      };
    } else {
      console.log("🚀 Not on Sepolia, skipping fetchReserves");
    }
  }, [isOnSepolia]);

  // Recalculate when reserves change
  useEffect(() => {
    if (inputAmount) {
      console.log("Recalculating output amount for input:", inputAmount);
      calculateOutputAmount(inputAmount);
    }
  }, [reserves, inputAmount, fromToken, toToken]);

  // Fetch balances when connected
  useEffect(() => {
    console.log("Balance fetch effect triggered:", {
      isConnected,
      isOnSepolia,
      address,
    });
    if (isConnected && isOnSepolia && address) {
      fetchBalances();
    }
  }, [isConnected, isOnSepolia, address]);

  // Check approval when input changes
  useEffect(() => {
    if (inputAmount && isConnected) {
      console.log("Checking approval for amount:", inputAmount);
      checkApproval();
    }
  }, [inputAmount, fromToken, isConnected]);

  // Format number with locale string
  const formatWithCommas = (value: string, decimals: number = 2) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0";
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const prices = getCurrentPrice();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold mb-2">USDG/Glow Test Swap</h1>
          <p className="text-gray-600">Sepolia Testnet</p>
        </div>

        {!isOnSepolia && (
          <div className="mb-4 p-4 border border-orange-500 bg-orange-50 rounded-lg">
            <p className="text-sm text-orange-800">
              Please switch to Sepolia testnet to use this page.
            </p>
          </div>
        )}

        <div className="flex justify-between mb-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                console.log("🧪 TEST: Only calling fetchBalances");
                try {
                  await fetchBalances();
                  console.log("🧪 TEST: fetchBalances completed");
                } catch (error) {
                  console.log("🧪 TEST: fetchBalances failed:", error);
                }
              }}
              disabled={!isOnSepolia || !isConnected}
            >
              Test Balances
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                console.log("🧪 TEST: Only calling fetchReserves");
                try {
                  await fetchReserves();
                  console.log("🧪 TEST: fetchReserves completed");
                } catch (error) {
                  console.log("🧪 TEST: fetchReserves failed:", error);
                }
              }}
              disabled={!isOnSepolia}
            >
              Test Reserves
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                console.log("🧪 Manual refresh triggered");
                try {
                  await fetchBalances();
                  await fetchReserves();
                  console.log("🧪 Manual refresh completed");
                } catch (error) {
                  console.log("🧪 Manual refresh failed:", error);
                }
              }}
              disabled={!isOnSepolia}
            >
              Refresh All
            </Button>
          </div>
          <ConnectButton />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Swap Tokens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Price Display */}
            {reserves && (
              <div className="bg-gray-100 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold text-sm text-gray-700">
                  Current Price
                </h3>
                <div className="text-sm">
                  <span className="text-gray-600">GLOW = </span>
                  <span className="font-mono font-semibold">
                    ${prices.usdgPerGlow.toFixed(6)}
                  </span>
                </div>
              </div>
            )}

            {/* From Token */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>From</Label>
                {isConnected && (
                  <span className="text-sm text-gray-600">
                    Balance:{" "}
                    {formatUnits(
                      fromToken === "USDG"
                        ? tokenBalances.usdg
                        : tokenBalances.glow,
                      DECIMALS[fromToken]
                    )}
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={inputAmount}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" className="w-24" disabled>
                  {fromToken}
                </Button>
              </div>
            </div>

            {/* Switch Button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={switchTokens}
                className="rounded-full"
              >
                <ArrowDownUp className="h-4 w-4" />
              </Button>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>To (estimated)</Label>
                {isConnected && (
                  <span className="text-sm text-gray-600">
                    Balance:{" "}
                    {formatUnits(
                      toToken === "USDG"
                        ? tokenBalances.usdg
                        : tokenBalances.glow,
                      DECIMALS[toToken]
                    )}
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={outputAmount}
                  readOnly
                  className="flex-1 bg-gray-50"
                />
                <Button variant="outline" className="w-24" disabled>
                  {toToken}
                </Button>
              </div>
            </div>

            {/* Price Impact and Liquidity Info - show when any swap involves Glow */}
            {(fromToken === "GLOW" || toToken === "GLOW") &&
              priceImpact > 0 && (
                <div className="bg-yellow-50 p-3 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Price Impact</span>
                    <span
                      className={`text-sm font-semibold ${
                        priceImpact > 5
                          ? "text-red-600"
                          : priceImpact > 2
                          ? "text-yellow-600"
                          : "text-green-600"
                      }`}
                    >
                      {priceImpact.toFixed(2)}%
                    </span>
                  </div>
                  {inputAmount && outputAmount && newGlowPrice > 0 && (
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>
                        Glow price before swap: ${prices.usdgPerGlow.toFixed(6)}
                      </div>
                      <div>
                        Glow price after swap: ${newGlowPrice.toFixed(6)}
                      </div>
                    </div>
                  )}
                  {liquidityInfo.currentLiquidity > 0 && (
                    <div className="pt-2 border-t border-yellow-200">
                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="font-semibold">Liquidity (√(x·y))</div>
                        <div>
                          Current liquidity:{" "}
                          {liquidityInfo.currentLiquidity.toFixed(6)}
                        </div>
                        <div>
                          Est. liquidity after swap:{" "}
                          {liquidityInfo.estimatedLiquidity.toFixed(6)}
                        </div>
                        <div className="text-gray-500">
                          Delta:{" "}
                          {liquidityInfo.estimatedLiquidity >
                          liquidityInfo.currentLiquidity
                            ? "+"
                            : ""}
                          {(
                            liquidityInfo.estimatedLiquidity -
                            liquidityInfo.currentLiquidity
                          ).toFixed(6)}
                        </div>
                        <div className="text-gray-500">
                          Change:{" "}
                          {(
                            ((liquidityInfo.estimatedLiquidity -
                              liquidityInfo.currentLiquidity) /
                              liquidityInfo.currentLiquidity) *
                            100
                          ).toFixed(4)}
                          %
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            {/* Slippage Settings */}
            <div className="space-y-2">
              <Label>Slippage Tolerance: {slippage}%</Label>
              <input
                type="range"
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value))}
                min="0.1"
                max="5"
                step="0.1"
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0.1%</span>
                <span>5%</span>
              </div>
            </div>

            {/* Swap Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={needsApproval ? handleApprove : handleSwap}
              disabled={
                !isConnected ||
                !isOnSepolia ||
                !inputAmount ||
                !outputAmount ||
                loading
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {needsApproval ? "Approving..." : "Swapping..."}
                </>
              ) : !isConnected ? (
                "Connect Wallet"
              ) : !isOnSepolia ? (
                "Switch to Sepolia"
              ) : !inputAmount || !outputAmount ? (
                "Enter an amount"
              ) : needsApproval ? (
                `Approve ${fromToken}`
              ) : (
                "Swap"
              )}
            </Button>

            {/* Pool Info */}
            {reserves && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-1 text-sm text-gray-600">
                <h4 className="font-semibold text-gray-700">Pool Reserves</h4>
                <div>
                  USDG:{" "}
                  {formatWithCommas(formatUnits(reserves.usdg, DECIMALS.USDG))}
                </div>
                <div>
                  GLOW:{" "}
                  {formatWithCommas(formatUnits(reserves.glow, DECIMALS.GLOW))}
                </div>
                <div>
                  Current Liquidity (√(x·y)):{" "}
                  {Math.sqrt(
                    Number(formatUnits(reserves.usdg, DECIMALS.USDG)) *
                      Number(formatUnits(reserves.glow, DECIMALS.GLOW))
                  ).toFixed(6)}
                </div>
                <div className="mt-2 pt-2 border-t">
                  <div className="font-semibold text-gray-700">
                    LP Token Info
                  </div>
                  <div>
                    Total Supply:{" "}
                    {formatWithCommas(formatUnits(pairInfo.totalSupply, 12))} LP
                  </div>
                  {address && (
                    <div>
                      Your Balance:{" "}
                      {formatWithCommas(
                        formatUnits(pairInfo.userLpBalance, 12)
                      )}{" "}
                      LP
                      {pairInfo.totalSupply > BigInt(0) && (
                        <span className="text-xs ml-1">
                          (
                          {(
                            (Number(pairInfo.userLpBalance) /
                              Number(pairInfo.totalSupply)) *
                            100
                          ).toFixed(4)}
                          %)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Debug Info */}
            <details className="mt-4 p-4 bg-gray-100 rounded-lg">
              <summary className="cursor-pointer font-semibold text-gray-700">
                Debug Info
              </summary>
              <div className="mt-2 space-y-2 text-xs text-gray-600 font-mono">
                <div>Connected: {isConnected ? "Yes" : "No"}</div>
                <div>Address: {address || "Not connected"}</div>
                <div>Chain ID: {chainId}</div>
                <div>Is Sepolia: {isOnSepolia ? "Yes" : "No"}</div>
                <div>Has PublicClient: {publicClient ? "Yes" : "No"}</div>
                <div>Has WalletClient: {walletClient ? "Yes" : "No"}</div>
                <div className="mt-2">Contract Addresses:</div>
                <div className="ml-2">USDG: {SEPOLIA_ADDRESSES.USDG}</div>
                <div className="ml-2">GLOW: {SEPOLIA_ADDRESSES.GLOW}</div>

                <div className="ml-2">
                  Pair (resolved): {pairAddress || "Not found"}
                </div>
                <div className="ml-2">
                  Router: {SEPOLIA_ADDRESSES.UNISWAP_V2_ROUTER}
                </div>
                <div className="mt-2">Balances (raw):</div>
                <div className="ml-2">
                  USDG: {tokenBalances.usdg.toString()}
                </div>
                <div className="ml-2">
                  GLOW: {tokenBalances.glow.toString()}
                </div>
                <div className="mt-2">Reserves (raw):</div>
                <div className="ml-2">
                  USDG: {reserves?.usdg.toString() || "Not loaded"}
                </div>
                <div className="ml-2">
                  GLOW: {reserves?.glow.toString() || "Not loaded"}
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
