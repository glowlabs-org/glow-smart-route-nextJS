"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownUp, Loader2 } from "lucide-react";
import { useAccount, usePublicClient, useChainId, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits, parseUnits } from "viem";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

// GLOW_ADDRESS = "0x8e27016D0B866a56CE74A1a280c749dD679bb0Fa"
// USDG_ADDRESS = "0x2a085A3aEA8982396533327c854753Ce521B666d"
// ROUTER_ADDRESS = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"
// PAIR_ADDRESS = "0xAB222Ee0781b624516FddB440A1DdCaeE87C2408"
// Sepolia testnet addresses - You'll need to update these with actual Sepolia addresses
const SEPOLIA_ADDRESSES = {
  USDG: "0x2a085A3aEA8982396533327c854753Ce521B666d", // Replace with actual Sepolia USDG address
  GLOW: "0x8e27016D0B866a56CE74A1a280c749dD679bb0Fa", // Replace with actual Sepolia Glow address
  UNISWAP_V2_PAIR: "0xAB222Ee0781b624516FddB440A1DdCaeE87C2408", // Replace with actual Sepolia pair address
  UNISWAP_V2_ROUTER: "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3", // Replace with actual Sepolia router address
};

const DECIMALS = {
  USDG: 6,
  GLOW: 18,
};

// Uniswap V2 Pair ABI for getReserves
const PAIR_ABI = [
  {
    constant: true,
    inputs: [],
    name: "getReserves",
    outputs: [
      { name: "_reserve0", type: "uint112" },
      { name: "_reserve1", type: "uint112" },
      { name: "_blockTimestampLast", type: "uint32" },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "token0",
    outputs: [{ name: "", type: "address" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "token1",
    outputs: [{ name: "", type: "address" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

// Uniswap V2 Router ABI for swaps
const ROUTER_ABI = [
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForTokens",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// ERC20 ABI for approvals
const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "account", type: "address" },
    ],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export default function TestView() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  
  const [fromToken, setFromToken] = useState<"USDG" | "GLOW">("USDG");
  const [toToken, setToToken] = useState<"USDG" | "GLOW">("GLOW");
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [slippage, setSlippage] = useState(1); // 1% default slippage
  const [loading, setLoading] = useState(false);
  const [reserves, setReserves] = useState<{ usdg: bigint; glow: bigint } | null>(null);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [newGlowPrice, setNewGlowPrice] = useState<number>(0);
  const [tokenBalances, setTokenBalances] = useState<{ usdg: bigint; glow: bigint }>({ usdg: BigInt(0), glow: BigInt(0) });
  const [needsApproval, setNeedsApproval] = useState(false);

  // Check if we're on Sepolia
  const isOnSepolia = chainId === 11155111;

  // Log initial state
  useEffect(() => {
    console.log("TestView mounted with state:", {
      address,
      isConnected,
      chainId,
      isOnSepolia,
      hasPublicClient: !!publicClient,
      hasWalletClient: !!walletClient,
      contractAddresses: SEPOLIA_ADDRESSES,
      rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "default public RPC"
    });
  }, [address, isConnected, chainId, isOnSepolia, publicClient, walletClient]);

  // Fetch token balances
  const fetchBalances = async () => {
    if (!publicClient || !address || !isOnSepolia) {
      console.log("fetchBalances skipped:", { 
        hasPublicClient: !!publicClient, 
        address, 
        isOnSepolia,
        chainId 
      });
      return;
    }

    console.log("Fetching balances for address:", address);
    console.log("Token addresses:", {
      USDG: SEPOLIA_ADDRESSES.USDG,
      GLOW: SEPOLIA_ADDRESSES.GLOW
    });

    try {
      console.log("📖 Reading balances directly...");
      
      console.log("📖 Calling USDG balanceOf...");
      const usdgBalance = await publicClient.readContract({
        address: SEPOLIA_ADDRESSES.USDG as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      }) as bigint;
      console.log("📖 USDG balance received:", usdgBalance.toString());

      console.log("📖 Calling GLOW balanceOf...");
      const glowBalance = await publicClient.readContract({
        address: SEPOLIA_ADDRESSES.GLOW as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      }) as bigint;
      console.log("📖 GLOW balance received:", glowBalance.toString());

      console.log("Balances fetched:", {
        usdg: usdgBalance.toString(),
        glow: glowBalance.toString(),
        usdgFormatted: formatUnits(usdgBalance, DECIMALS.USDG),
        glowFormatted: formatUnits(glowBalance, DECIMALS.GLOW)
      });

      setTokenBalances({ usdg: usdgBalance, glow: glowBalance });
    } catch (error) {
      console.error("Error fetching balances:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack
      });
    }
  };

  // Check if approval is needed
  const checkApproval = async () => {
    if (!publicClient || !address || !inputAmount || !isOnSepolia) return;

    try {
      const tokenAddress = fromToken === "USDG" ? SEPOLIA_ADDRESSES.USDG : SEPOLIA_ADDRESSES.GLOW;
      const amount = parseUnits(inputAmount, DECIMALS[fromToken]);

      const allowance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, SEPOLIA_ADDRESSES.UNISWAP_V2_ROUTER as `0x${string}`],
      }) as bigint;

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
      const tokenAddress = fromToken === "USDG" ? SEPOLIA_ADDRESSES.USDG : SEPOLIA_ADDRESSES.GLOW;
      const amount = parseUnits(inputAmount, DECIMALS[fromToken]);

      const hash = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
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
      const minAmountOut = parseUnits(outputAmount, DECIMALS[toToken]) * BigInt(100 - slippage * 10) / BigInt(100);
      const path = fromToken === "USDG" 
        ? [SEPOLIA_ADDRESSES.USDG, SEPOLIA_ADDRESSES.GLOW]
        : [SEPOLIA_ADDRESSES.GLOW, SEPOLIA_ADDRESSES.USDG];
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 minutes

      const hash = await walletClient.writeContract({
        address: SEPOLIA_ADDRESSES.UNISWAP_V2_ROUTER as `0x${string}`,
        abi: ROUTER_ABI,
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

  // Fetch reserves from Uniswap V2 pair
  const fetchReserves = async () => {
    console.log("🔥 FETCHRESERVES CALLED! 🔥");
    if (!publicClient || !isOnSepolia) {
      console.log("fetchReserves skipped:", { 
        hasPublicClient: !!publicClient, 
        isOnSepolia,
        chainId 
      });
      return;
    }

    console.log("Fetching reserves from pair:", SEPOLIA_ADDRESSES.UNISWAP_V2_PAIR);

    try {
      console.log("📊 Reading reserves directly...");
      
      console.log("📊 Calling getReserves...");
      const reservesResult = await publicClient.readContract({
        address: SEPOLIA_ADDRESSES.UNISWAP_V2_PAIR as `0x${string}`,
        abi: PAIR_ABI,
        functionName: "getReserves",
      }) as [bigint, bigint, number];

      console.log("📊 Raw reserves received:", {
        reserve0: reservesResult[0].toString(),
        reserve1: reservesResult[1].toString(),
        timestamp: reservesResult[2]
      });

      const [reserve0, reserve1] = reservesResult;

      console.log("📊 Calling token0...");
      const token0 = await publicClient.readContract({
        address: SEPOLIA_ADDRESSES.UNISWAP_V2_PAIR as `0x${string}`,
        abi: PAIR_ABI,
        functionName: "token0",
      }) as `0x${string}`;
      console.log("📊 token0 received:", token0);

      console.log("📊 Calling token1...");
      const token1 = await publicClient.readContract({
        address: SEPOLIA_ADDRESSES.UNISWAP_V2_PAIR as `0x${string}`,
        abi: PAIR_ABI,
        functionName: "token1",
      }) as `0x${string}`;
      console.log("📊 token1 received:", token1);

      console.log("Pair tokens:", { token0, token1 });

      // Determine which reserve is USDG and which is GLOW
      const isToken0USDG = token0.toLowerCase() === SEPOLIA_ADDRESSES.USDG.toLowerCase();
      
      const finalReserves = {
        usdg: isToken0USDG ? reserve0 : reserve1,
        glow: isToken0USDG ? reserve1 : reserve0,
      };

      console.log("Processed reserves:", {
        usdg: finalReserves.usdg.toString(),
        glow: finalReserves.glow.toString(),
        usdgFormatted: formatUnits(finalReserves.usdg, DECIMALS.USDG),
        glowFormatted: formatUnits(finalReserves.glow, DECIMALS.GLOW),
        isToken0USDG
      });

      setReserves(finalReserves);
    } catch (error) {
      console.error("Error fetching reserves:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      toast.error("Failed to fetch pool reserves");
    }
  };

  // Calculate output amount using constant product formula
  const calculateOutputAmount = (input: string) => {
    if (!reserves || !input || parseFloat(input) === 0) {
      setOutputAmount("");
      setPriceImpact(0);
      setNewGlowPrice(0);
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
      
      // Calculate price impact for any swap involving GLOW
      if (fromToken === "GLOW" || toToken === "GLOW") {
        // Convert reserves to proper decimal format for price calculation
        const usdgReserveFormatted = Number(formatUnits(reserves.usdg, DECIMALS.USDG));
        const glowReserveFormatted = Number(formatUnits(reserves.glow, DECIMALS.GLOW));
        
        // Current price (USDG per GLOW)
        const currentGlowPrice = usdgReserveFormatted / glowReserveFormatted;
        
        // Calculate new reserves after swap (in formatted units)
        const amountInFormatted = Number(formatUnits(inputBigInt, DECIMALS[fromToken]));
        const amountOutFormatted = Number(formatUnits(amountOut, DECIMALS[toToken]));
        
        const newReserveInFormatted = fromToken === "USDG" 
          ? usdgReserveFormatted + amountInFormatted
          : glowReserveFormatted + amountInFormatted;
        
        const newReserveOutFormatted = fromToken === "USDG" 
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
          newReserveOutFormatted
        });
        
        // New price after swap (always USDG per GLOW)
        const newUsdgReserve = fromToken === "USDG" ? newReserveInFormatted : newReserveOutFormatted;
        const newGlowReserve = fromToken === "USDG" ? newReserveOutFormatted : newReserveInFormatted;
        const newGlowPrice = newUsdgReserve / newGlowReserve;
        
        console.log("🧮 New Glow price calculated:", {
          newUsdgReserve,
          newGlowReserve,
          newGlowPrice
        });
        
        // Calculate price impact
        const impact = ((newGlowPrice - currentGlowPrice) / currentGlowPrice) * 100;
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
    console.log("Balance fetch effect triggered:", { isConnected, isOnSepolia, address });
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
                <h3 className="font-semibold text-sm text-gray-700">Current Price</h3>
                <div className="text-sm">
                  <span className="text-gray-600">GLOW = </span>
                  <span className="font-mono font-semibold">${prices.usdgPerGlow.toFixed(6)}</span>
                </div>
              </div>
            )}

            {/* From Token */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>From</Label>
                {isConnected && (
                  <span className="text-sm text-gray-600">
                    Balance: {formatUnits(fromToken === "USDG" ? tokenBalances.usdg : tokenBalances.glow, DECIMALS[fromToken])}
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
                    Balance: {formatUnits(toToken === "USDG" ? tokenBalances.usdg : tokenBalances.glow, DECIMALS[toToken])}
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

            {/* Price Impact - show when any swap involves Glow */}
            {(fromToken === "GLOW" || toToken === "GLOW") && priceImpact > 0 && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Price Impact</span>
                  <span className={`text-sm font-semibold ${priceImpact > 5 ? 'text-red-600' : priceImpact > 2 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {priceImpact.toFixed(2)}%
                  </span>
                </div>
                {inputAmount && outputAmount && newGlowPrice > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    <div>Glow price before swap: ${prices.usdgPerGlow.toFixed(6)}</div>
                    <div>Glow price after swap: ${newGlowPrice.toFixed(6)}</div>
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
              disabled={!isConnected || !isOnSepolia || !inputAmount || !outputAmount || loading}
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
                <div>USDG: {formatUnits(reserves.usdg, DECIMALS.USDG)}</div>
                <div>GLOW: {formatUnits(reserves.glow, DECIMALS.GLOW)}</div>
              </div>
            )}

            {/* Debug Info */}
            <details className="mt-4 p-4 bg-gray-100 rounded-lg">
              <summary className="cursor-pointer font-semibold text-gray-700">Debug Info</summary>
              <div className="mt-2 space-y-2 text-xs text-gray-600 font-mono">
                <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
                <div>Address: {address || 'Not connected'}</div>
                <div>Chain ID: {chainId}</div>
                <div>Is Sepolia: {isOnSepolia ? 'Yes' : 'No'}</div>
                <div>Has PublicClient: {publicClient ? 'Yes' : 'No'}</div>
                <div>Has WalletClient: {walletClient ? 'Yes' : 'No'}</div>
                <div className="mt-2">Contract Addresses:</div>
                <div className="ml-2">USDG: {SEPOLIA_ADDRESSES.USDG}</div>
                <div className="ml-2">GLOW: {SEPOLIA_ADDRESSES.GLOW}</div>
                <div className="ml-2">Pair: {SEPOLIA_ADDRESSES.UNISWAP_V2_PAIR}</div>
                <div className="ml-2">Router: {SEPOLIA_ADDRESSES.UNISWAP_V2_ROUTER}</div>
                <div className="mt-2">Balances (raw):</div>
                <div className="ml-2">USDG: {tokenBalances.usdg.toString()}</div>
                <div className="ml-2">GLOW: {tokenBalances.glow.toString()}</div>
                <div className="mt-2">Reserves (raw):</div>
                <div className="ml-2">USDG: {reserves?.usdg.toString() || 'Not loaded'}</div>
                <div className="ml-2">GLOW: {reserves?.glow.toString() || 'Not loaded'}</div>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}