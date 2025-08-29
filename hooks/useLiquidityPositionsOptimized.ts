"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  parseAbi,
  erc20Abi,
  zeroAddress,
  formatEther,
  formatUnits,
} from "viem";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { DECIMALS_BY_TOKEN, getAddresses } from "@glowlabs-org/utils/browser";
import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";
import { getSmartAccountStatus } from "@/web3/web3/utils/detectSmartAccount";
import { toast } from "sonner";
import Decimal from "decimal.js";

// Types
export interface Position {
  id: string;
  pair: "GLW/USDG";
  glwAmount: number;
  usdgAmount: number;
  apy: number;
  poolSharePct: number;
  createdAt: number;
  initialGlw: number;
  initialUsdg: number;
  apiMultiplier?: number;
  accumulatedGlowRewards: number;
  totalLiquidityFeesEarnedLP?: number;
  liquidityIncentiveApy?: number;
  feesApy: number;
  combinedApy: number;
}

interface LiquidityPoolReserves {
  glw: number;
  usdg: number;
}

interface ApiPositionItem {
  liquidity: string;
  timestamp: string;
  lastSavedMultiplier: number;
  accumulatedGlowRewards: string;
  feeTracker: any[];
  combinedAPY: string;
  multiplier: number;
  totalLiquidityFeesEarned: string;
  feesAPY: string;
  liquidityIncentiveAPY: string;
}

interface ApiPositionsResponse {
  feeReturnAnnualized: number;
  positionsWithApy: ApiPositionItem[];
  totalGlwRewardsEarned: string;
  totalAccruedLiquidityProviderFees?: string;
  totalTokenSupply?: string; // Total LP token supply
  totalLiquidity?: string; // Total value locked
}

// Constants
const SECONDS_IN_YEAR = 365 * 24 * 60 * 60;
const LP_DECIMALS = 12;
const DEFAULT_SLIPPAGE_BPS = 100; // 1%

if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
  throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
}

const SDKAddresses = getAddresses(parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!));
const UNISWAP_V2_ROUTER = SDKAddresses.UNISWAP_V2_ROUTER;
const UNISWAP_V2_FACTORY = SDKAddresses.UNISWAP_V2_FACTORY;

// Shared ABIs
const RouterAbi = parseAbi([
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)",
  "function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB)",
]);

const PairAbi = parseAbi([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function mint(address to) returns (uint liquidity)",
]);

// Helper functions
function normalizeApyToPercent(input: unknown): number {
  const num = typeof input === "string" ? Number(input) : (input as number);
  if (!Number.isFinite(num) || num < 0) return 0;
  const pct = num * 100;
  return Math.min(pct, 10000);
}

function toUnits(n: number, decimals: number) {
  if (!Number.isFinite(n)) return BigInt(0);
  const base = new Decimal(10).pow(decimals);
  const scaled = new Decimal(n).mul(base).toFixed(0, Decimal.ROUND_DOWN);
  return BigInt(scaled);
}

function applySlippage(amount: bigint, bps: number) {
  return (amount * BigInt(10_000 - bps)) / BigInt(10_000);
}

async function fetchPositionsFromApi(
  addr: string
): Promise<ApiPositionsResponse | null> {
  try {
    const base =
      process.env.NEXT_PUBLIC_POSITIONS_API_BASE || "http://localhost:42069";
    const res = await fetch(`${base}/get-liquidity-positions/${addr}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Singleton pair address cache
let pairAddressCache: `0x${string}` | null = null;
async function getPairAddressCached(): Promise<`0x${string}` | null> {
  if (pairAddressCache) return pairAddressCache;
  try {
    const addr = (await publicClient.readContract({
      address: UNISWAP_V2_FACTORY,
      abi: parseAbi([
        "function getPair(address tokenA, address tokenB) external view returns (address pair)",
      ]),
      functionName: "getPair",
      args: [SDKAddresses.GLW, SDKAddresses.USDG],
    })) as `0x${string}`;

    if (addr && addr !== zeroAddress) {
      pairAddressCache = addr;
      return addr;
    }
    return null;
  } catch {
    return null;
  }
}

// ============= SPLIT HOOKS FOR BETTER PERFORMANCE =============

// 1. Pool Info Hook - Fetches pool reserves and price
export function usePoolInfo() {
  const chainId = useChainId();

  const { data, isLoading } = useQuery({
    queryKey: ["pool-info", chainId],
    queryFn: async () => {
      const pairAddr = await getPairAddressCached();
      if (!pairAddr) throw new Error("Pair not found");

      const [token0, [reserve0, reserve1]] = await publicClient.multicall({
        contracts: [
          { address: pairAddr, abi: PairAbi, functionName: "token0" },
          { address: pairAddr, abi: PairAbi, functionName: "getReserves" },
        ],
        allowFailure: false,
      });

      const isToken0USDG =
        (token0 as string).toLowerCase() === SDKAddresses.USDG.toLowerCase();
      const usdgReserve = isToken0USDG ? reserve0 : reserve1;
      const glwReserve = isToken0USDG ? reserve1 : reserve0;

      const glw = Number(
        formatUnits(glwReserve as bigint, DECIMALS_BY_TOKEN.GLW)
      );
      const usdg = Number(
        formatUnits(usdgReserve as bigint, DECIMALS_BY_TOKEN.USDG)
      );
      const price = usdg / glw;

      return { reserves: { glw, usdg }, price };
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  return {
    poolReserves: data?.reserves ?? { glw: 0, usdg: 0 },
    priceRatio: data?.price ?? 0,
    isLoading,
  };
}

// 2. User Positions Hook - Fetches user LP positions
export function useUserPositions() {
  const chainId = useChainId();
  const { address } = useAccount();

  const {
    data: positions = [],
    isLoading,
    isFetching,
    isPending,
  } = useQuery<Position[]>({
    queryKey: ["lp-positions", chainId, address],
    enabled: Boolean(address),
    queryFn: async () => {
      if (!address) return [];
      const pairAddr = await getPairAddressCached();
      if (!pairAddr) return [];

      const mc = await publicClient.multicall({
        contracts: [
          { address: pairAddr, abi: PairAbi, functionName: "token0" },
          { address: pairAddr, abi: PairAbi, functionName: "getReserves" },
          { address: pairAddr, abi: erc20Abi, functionName: "totalSupply" },
          {
            address: pairAddr,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          },
        ],
        allowFailure: false,
      });

      const token0 = mc[0] as `0x${string}`;
      const [reserve0, reserve1] = mc[1] as readonly [bigint, bigint, number];
      const totalSupply = mc[2] as bigint;
      const userLp = mc[3] as bigint;

      if (userLp === BigInt(0) || totalSupply === BigInt(0)) return [];

      // Calculate reserves ordering
      const isToken0USDG =
        token0.toLowerCase() === SDKAddresses.USDG.toLowerCase();
      const usdgReserve = isToken0USDG ? reserve0 : reserve1;
      const glwReserve = isToken0USDG ? reserve1 : reserve0;

      // Fetch API data for enrichment
      const apiData = await fetchPositionsFromApi(address as `0x${string}`);
      if (!apiData?.positionsWithApy?.length) {
        // No positions from API, return empty array
        return [];
      }

      // Process API positions
      const positions: Position[] = apiData.positionsWithApy
        .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
        .map((apiPos, i) => {
          // Parse liquidity amount to determine position size
          let liquidityAmount = BigInt(0);
          try {
            liquidityAmount = BigInt(apiPos.liquidity || "0");
          } catch {}

          // Compute exact underlying amounts for this position from reserves
          const positionGlw =
            liquidityAmount > BigInt(0)
              ? Number(
                  formatUnits(
                    (glwReserve * liquidityAmount) / totalSupply,
                    DECIMALS_BY_TOKEN.GLW
                  )
                )
              : 0;
          const positionUsdg =
            liquidityAmount > BigInt(0)
              ? Number(
                  formatUnits(
                    (usdgReserve * liquidityAmount) / totalSupply,
                    DECIMALS_BY_TOKEN.USDG
                  )
                )
              : 0;

          // Pool share percentage for this position
          const positionSharePct =
            liquidityAmount > BigInt(0)
              ? Number((liquidityAmount * BigInt(10000)) / totalSupply) / 100
              : 0;

          return {
            id: `p${i + 1}`,
            pair: "GLW/USDG" as const,
            glwAmount: positionGlw,
            usdgAmount: positionUsdg,
            apy: normalizeApyToPercent(apiPos.combinedAPY),
            poolSharePct: Math.min(100, Math.max(0, positionSharePct)),
            createdAt: Number(apiPos.timestamp) * 1000,
            initialGlw: positionGlw,
            initialUsdg: positionUsdg,
            apiMultiplier: apiPos.multiplier,
            accumulatedGlowRewards: Number(
              formatUnits(
                BigInt(apiPos.accumulatedGlowRewards || "0"),
                DECIMALS_BY_TOKEN.GLW
              )
            ),
            totalLiquidityFeesEarnedLP: Number(
              formatUnits(
                BigInt(apiPos.totalLiquidityFeesEarned || "0"),
                LP_DECIMALS
              )
            ),
            liquidityIncentiveApy: normalizeApyToPercent(
              apiPos.liquidityIncentiveAPY
            ),
            feesApy: normalizeApyToPercent(apiPos.feesAPY),
            combinedApy: normalizeApyToPercent(apiPos.combinedAPY),
          };
        });

      return positions;
    },
    staleTime: 15_000,
    refetchInterval: (query) => {
      const data = query.state.data as Position[] | undefined;
      return data?.length ? 30_000 : 5_000;
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  return { positions, isLoading, isFetching, isPending };
}

// 3. API Totals Hook - Fetches total rewards from API
export function useApiTotals() {
  const chainId = useChainId();
  const { address } = useAccount();
  const { poolReserves, priceRatio } = usePoolInfo();

  const { data } = useQuery<ApiPositionsResponse | null>({
    queryKey: ["lp-positions-api", chainId, address],
    enabled: Boolean(address),
    queryFn: () => fetchPositionsFromApi(address as `0x${string}`),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch LP token total supply for value calculations
  const { data: lpTokenSupply } = useQuery({
    queryKey: ["lp-token-supply", chainId],
    queryFn: async () => {
      const pairAddr = await getPairAddressCached();
      if (!pairAddr) return BigInt(0);

      return await publicClient.readContract({
        address: pairAddr,
        abi: erc20Abi,
        functionName: "totalSupply",
      });
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const totalAccumulatedGlw = React.useMemo(() => {
    if (!data?.totalGlwRewardsEarned) return 0;
    try {
      return Number(
        formatUnits(BigInt(data.totalGlwRewardsEarned), DECIMALS_BY_TOKEN.GLW)
      );
    } catch {
      return 0;
    }
  }, [data]);

  const totalFeeRewardsLP = React.useMemo(() => {
    if (!data?.totalAccruedLiquidityProviderFees) return 0;
    try {
      return Number(
        formatUnits(BigInt(data.totalAccruedLiquidityProviderFees), LP_DECIMALS)
      );
    } catch {
      return 0;
    }
  }, [data]);

  // Calculate the dollar value of LP token rewards
  const totalFeeRewardsLPValue = React.useMemo(() => {
    if (
      totalFeeRewardsLP === 0 ||
      !poolReserves.glw ||
      !poolReserves.usdg ||
      !lpTokenSupply ||
      lpTokenSupply === BigInt(0)
    ) {
      return 0;
    }

    try {
      // Calculate total pool value in USDG
      // GLW value in USDG + USDG value = Total Value Locked (TVL)
      const glwValueInUsdg = poolReserves.glw * priceRatio;
      const totalPoolValueInUsdg = glwValueInUsdg + poolReserves.usdg;

      // Convert totalSupply to number with LP_DECIMALS
      const totalSupplyFormatted = Number(
        formatUnits(lpTokenSupply, LP_DECIMALS)
      );

      // Calculate value per LP token
      const valuePerLPToken = totalPoolValueInUsdg / totalSupplyFormatted;

      // Calculate the dollar value of the user's LP rewards
      const lpRewardsValue = totalFeeRewardsLP * valuePerLPToken;

      return lpRewardsValue;
    } catch (error) {
      console.error("Error calculating LP rewards value:", error);
      return 0;
    }
  }, [totalFeeRewardsLP, poolReserves, priceRatio, lpTokenSupply]);

  return { totalAccumulatedGlw, totalFeeRewardsLP, totalFeeRewardsLPValue };
}

// 4. Liquidity Mutations Hook
export function useLiquidityMutations() {
  const chainId = useChainId();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  const addLiquidityMutation = useMutation({
    mutationKey: ["add-liquidity", chainId, address],
    mutationFn: async ({
      glw,
      usdg,
    }: {
      glw: number;
      usdg: number;
    }): Promise<`0x${string}`> => {
      if (!walletClient || !address) {
        throw new Error("Wallet not connected");
      }
      if (!UNISWAP_V2_ROUTER) {
        throw new Error("Uniswap router not configured");
      }

      // Check for smart account
      const status = await getSmartAccountStatus({
        address: address as `0x${string}`,
        walletClient,
        getBytecode: publicClient.getBytecode,
      });

      if (
        status.isEip7702Delegated ||
        status.hasWalletAABatching ||
        status.isContractWallet
      ) {
        const reason = status.isEip7702Delegated
          ? "EIP-7702 delegation detected"
          : status.isContractWallet
          ? "Smart contract account detected"
          : "Account Abstraction capabilities detected";
        toast.error(
          `${reason}. Please disable Smart Account/EIP-7702 for this network.`
        );
        throw new Error(reason);
      }

      const amountAGlow = toUnits(glw, DECIMALS_BY_TOKEN.GLW);
      const amountBUsdg = toUnits(usdg, DECIMALS_BY_TOKEN.USDG);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      // Check balances
      const [glwBalance, usdgBalance] = await publicClient.multicall({
        contracts: [
          {
            address: SDKAddresses.GLW,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          },
          {
            address: SDKAddresses.USDG,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          },
        ],
        allowFailure: false,
      });

      if ((glwBalance as bigint) < amountAGlow) {
        throw new Error("Insufficient GLW balance");
      }
      if ((usdgBalance as bigint) < amountBUsdg) {
        throw new Error("Insufficient USDG balance");
      }

      // Ensure allowances
      const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1);
      const router = UNISWAP_V2_ROUTER as `0x${string}`;

      // Check and set GLW allowance
      const glwAllowance = await publicClient.readContract({
        address: SDKAddresses.GLW,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address as `0x${string}`, router],
      });

      if (glwAllowance < amountAGlow) {
        const hash = await walletClient.writeContract({
          address: SDKAddresses.GLW,
          abi: erc20Abi,
          functionName: "approve",
          args: [router, MAX_UINT256],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // Check and set USDG allowance
      const usdgAllowance = await publicClient.readContract({
        address: SDKAddresses.USDG,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address as `0x${string}`, router],
      });

      if (usdgAllowance < amountBUsdg) {
        const hash = await walletClient.writeContract({
          address: SDKAddresses.USDG,
          abi: erc20Abi,
          functionName: "approve",
          args: [router, MAX_UINT256],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // Add liquidity
      const amountAMin = applySlippage(amountAGlow, DEFAULT_SLIPPAGE_BPS);
      const amountBMin = applySlippage(amountBUsdg, DEFAULT_SLIPPAGE_BPS);

      const { request } = await publicClient.simulateContract({
        address: router,
        abi: RouterAbi,
        functionName: "addLiquidity",
        args: [
          SDKAddresses.GLW,
          SDKAddresses.USDG,
          amountAGlow,
          amountBUsdg,
          amountAMin,
          amountBMin,
          address as `0x${string}`,
          deadline,
        ],
        account: address as `0x${string}`,
      });

      const hash = await walletClient.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        throw new Error("Transaction reverted");
      }

      return hash;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lp-positions"] });
      queryClient.invalidateQueries({ queryKey: ["pool-info"] });
    },
  });

  const removeLiquidityMutation = useMutation({
    mutationKey: ["remove-liquidity", chainId, address],
    mutationFn: async (percentage: number): Promise<`0x${string}`> => {
      if (!walletClient || !address) {
        throw new Error("Wallet not connected");
      }
      if (!UNISWAP_V2_ROUTER) {
        throw new Error("Uniswap router not configured");
      }

      const pairAddr = await getPairAddressCached();
      if (!pairAddr) throw new Error("Pair not found");

      const lpBalance = await publicClient.readContract({
        address: pairAddr,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });

      if (lpBalance === BigInt(0)) {
        throw new Error("No liquidity position");
      }

      const liquidityToRemove =
        (lpBalance * BigInt(Math.floor(percentage))) / BigInt(100);
      if (liquidityToRemove <= BigInt(0)) {
        throw new Error("Invalid percentage");
      }

      // Get reserves for calculating minimum amounts
      const [token0, [reserve0, reserve1], totalSupply] =
        await publicClient.multicall({
          contracts: [
            { address: pairAddr, abi: PairAbi, functionName: "token0" },
            { address: pairAddr, abi: PairAbi, functionName: "getReserves" },
            { address: pairAddr, abi: erc20Abi, functionName: "totalSupply" },
          ],
          allowFailure: false,
        });

      const isToken0USDG =
        (token0 as string).toLowerCase() === SDKAddresses.USDG.toLowerCase();
      const usdgReserve = isToken0USDG ? reserve0 : reserve1;
      const glwReserve = isToken0USDG ? reserve1 : reserve0;

      const amountGlowExpected =
        ((glwReserve as bigint) * liquidityToRemove) / (totalSupply as bigint);
      const amountUsdgExpected =
        ((usdgReserve as bigint) * liquidityToRemove) / (totalSupply as bigint);

      const amountGlowMin = applySlippage(
        amountGlowExpected,
        DEFAULT_SLIPPAGE_BPS
      );
      const amountUsdgMin = applySlippage(
        amountUsdgExpected,
        DEFAULT_SLIPPAGE_BPS
      );

      // Approve LP tokens
      const router = UNISWAP_V2_ROUTER as `0x${string}`;
      const lpAllowance = await publicClient.readContract({
        address: pairAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address as `0x${string}`, router],
      });

      if (lpAllowance < liquidityToRemove) {
        const hash = await walletClient.writeContract({
          address: pairAddr,
          abi: erc20Abi,
          functionName: "approve",
          args: [router, liquidityToRemove],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // Remove liquidity
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
      const hash = await walletClient.writeContract({
        address: router,
        abi: RouterAbi,
        functionName: "removeLiquidity",
        args: [
          SDKAddresses.GLW,
          SDKAddresses.USDG,
          liquidityToRemove,
          amountGlowMin,
          amountUsdgMin,
          address as `0x${string}`,
          deadline,
        ],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lp-positions"] });
      queryClient.invalidateQueries({ queryKey: ["pool-info"] });
    },
  });

  return {
    addLiquidity: addLiquidityMutation.mutateAsync,
    removeLiquidity: removeLiquidityMutation.mutateAsync,
    isAddingLiquidity: addLiquidityMutation.isPending,
    isRemovingLiquidity: removeLiquidityMutation.isPending,
  };
}

// 5. Helper functions that don't need to be in a hook
export function getLoyaltyMultiplier(createdAt: number, now: number) {
  const days = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
  return Math.pow(days, 0.176091259) || 0;
}

export function quoteOtherAmount(params: {
  fromToken: "GLW" | "USDG";
  amount: number;
  reserves: { glw: number; usdg: number };
}): number {
  const { fromToken, amount, reserves } = params;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(reserves.glw) || reserves.glw <= 0) return 0;
  if (!Number.isFinite(reserves.usdg) || reserves.usdg <= 0) return 0;

  if (fromToken === "GLW") {
    return (amount * reserves.usdg) / reserves.glw;
  } else {
    return (amount * reserves.glw) / reserves.usdg;
  }
}

export function wouldAddLiquidityLikelyFail(params: {
  glw: number;
  usdg: number;
  reserves: { glw: number; usdg: number };
  slippageBps?: number;
}): boolean {
  const { glw, usdg, reserves, slippageBps = DEFAULT_SLIPPAGE_BPS } = params;

  if (
    !Number.isFinite(glw) ||
    !Number.isFinite(usdg) ||
    glw <= 0 ||
    usdg <= 0
  ) {
    return false;
  }

  if (!Number.isFinite(reserves.glw) || !Number.isFinite(reserves.usdg)) {
    return false;
  }

  if (reserves.glw <= 0 || reserves.usdg <= 0) return false;

  const slippage = slippageBps / 10_000;
  const ratio = reserves.usdg / reserves.glw;
  const amountBOptimal = glw * ratio;

  if (amountBOptimal <= usdg) {
    const usedA = glw;
    const usedB = amountBOptimal;
    return usedA < glw * (1 - slippage) || usedB < usdg * (1 - slippage);
  } else {
    const amountAOptimal = usdg / ratio;
    const usedA = amountAOptimal;
    const usedB = usdg;
    return usedA < glw * (1 - slippage) || usedB < usdg * (1 - slippage);
  }
}

// 6. APY Estimation Hook - Estimates APY for given liquidity amounts
export function useApyEstimate(glwAmount: number, usdgAmount: number) {
  const chainId = useChainId();
  const { poolReserves } = usePoolInfo();

  const { data: apyEstimate, isLoading } = useQuery({
    queryKey: ["apy-estimate", chainId, glwAmount, usdgAmount, poolReserves],
    enabled:
      glwAmount > 0 &&
      usdgAmount > 0 &&
      poolReserves.glw > 0 &&
      poolReserves.usdg > 0,
    queryFn: async () => {
      try {
        // Calculate liquidity delta for the pool
        // Liquidity in Uniswap V2 is sqrt(reserve0 * reserve1)
        // The API expects the liquidity delta (change in liquidity)

        // Convert amounts to proper units
        const glwUnits = toUnits(glwAmount, DECIMALS_BY_TOKEN.GLW);
        const usdgUnits = toUnits(usdgAmount, DECIMALS_BY_TOKEN.USDG);
        const glwReserveUnits = toUnits(
          poolReserves.glw,
          DECIMALS_BY_TOKEN.GLW
        );
        const usdgReserveUnits = toUnits(
          poolReserves.usdg,
          DECIMALS_BY_TOKEN.USDG
        );

        // Calculate current liquidity: sqrt(reserve0 * reserve1)
        const currentLiquiditySquared = glwReserveUnits * usdgReserveUnits;

        // Helper function to calculate bigint square root
        const bigIntSqrt = (n: bigint): bigint => {
          if (n === BigInt(0)) return BigInt(0);
          let x = n;
          let y = (x + BigInt(1)) / BigInt(2);
          while (y < x) {
            x = y;
            y = (x + n / x) / BigInt(2);
          }
          return x;
        };

        const currentLiquidity = bigIntSqrt(currentLiquiditySquared);

        // Calculate new reserves after adding liquidity
        // We need to determine the actual amounts that will be added based on the current ratio
        const currentRatio =
          Number(formatUnits(usdgReserveUnits, DECIMALS_BY_TOKEN.USDG)) /
          Number(formatUnits(glwReserveUnits, DECIMALS_BY_TOKEN.GLW));

        let actualGlwUnits: bigint;
        let actualUsdgUnits: bigint;

        // Determine which token is the limiting factor
        const requiredUsdg = Number(glwAmount) * currentRatio;
        const requiredGlw = Number(usdgAmount) / currentRatio;

        if (requiredUsdg <= Number(usdgAmount)) {
          // GLW is the limiting factor
          actualGlwUnits = glwUnits;
          actualUsdgUnits = toUnits(requiredUsdg, DECIMALS_BY_TOKEN.USDG);
        } else {
          // USDG is the limiting factor
          actualGlwUnits = toUnits(requiredGlw, DECIMALS_BY_TOKEN.GLW);
          actualUsdgUnits = usdgUnits;
        }

        // Calculate new reserves
        const newGlwReserves = glwReserveUnits + actualGlwUnits;
        const newUsdgReserves = usdgReserveUnits + actualUsdgUnits;

        // Calculate new liquidity: sqrt(newReserve0 * newReserve1)
        const newLiquiditySquared = newGlwReserves * newUsdgReserves;
        const newLiquidity = bigIntSqrt(newLiquiditySquared);

        // Calculate liquidity delta
        const liquidityDelta = newLiquidity - currentLiquidity;

        // Fetch APY estimate from API
        const base =
          process.env.NEXT_PUBLIC_POSITIONS_API_BASE ||
          "http://localhost:42069";
        const res = await fetch(
          `${base}/estimate-apy?liquidity=${liquidityDelta.toString()}`,
          {
            cache: "no-store",
          }
        );

        if (!res.ok) return null;

        const data = await res.json();

        // Extract the first position's APY data
        const position = data.positionsWithApy?.[0];
        if (!position) return null;

        return {
          combinedApy: normalizeApyToPercent(position.combinedAPY),
          feesApy: normalizeApyToPercent(position.feesAPY),
          liquidityIncentiveApy: normalizeApyToPercent(
            position.liquidityIncentiveAPY
          ),
          liquidityDelta: liquidityDelta.toString(),
        };
      } catch (error) {
        console.error("Error estimating APY:", error);
        return null;
      }
    },
    staleTime: 10_000, // Cache for 10 seconds
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return { apyEstimate, isLoading };
}

// 7. Incentive Dialog State Hook (local state management)
export function useIncentiveDialogState() {
  const [showDialog, setShowDialog] = React.useState(false);

  React.useEffect(() => {
    try {
      const dialogAck = window.localStorage.getItem("lp_dialog_ack");
      if (dialogAck !== "1") setShowDialog(true);
    } catch {}
  }, []);

  const acknowledge = React.useCallback(() => {
    try {
      window.localStorage.setItem("lp_dialog_ack", "1");
    } catch {}
    setShowDialog(false);
  }, []);

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) acknowledge();
      else setShowDialog(true);
    },
    [acknowledge]
  );

  return { showDialog, acknowledge, onOpenChange };
}

// Main composite hook for backwards compatibility
export function useLiquidityPositions() {
  const { poolReserves, priceRatio, isLoading: isPoolLoading } = usePoolInfo();
  const {
    positions,
    isLoading: isPositionsLoading,
    isFetching,
    isPending,
  } = useUserPositions();
  const { totalAccumulatedGlw, totalFeeRewardsLP, totalFeeRewardsLPValue } =
    useApiTotals();
  const {
    addLiquidity,
    removeLiquidity,
    isAddingLiquidity,
    isRemovingLiquidity,
  } = useLiquidityMutations();
  const { showDialog, acknowledge, onOpenChange } = useIncentiveDialogState();

  // Only update time for loyalty bonus calculation - nothing else should animate
  // Update every second for smooth loyalty bonus animation
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000); // Update every second for live loyalty bonus
    return () => clearInterval(id);
  }, []);

  // Calculate position-specific values
  const positionFinalizedMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    positions.forEach((p) => {
      map[p.id] = p.accumulatedGlowRewards;
    });
    return map;
  }, [positions]);

  const positionFeesLP = React.useMemo(() => {
    const map: Record<string, number> = {};
    positions.forEach((p) => {
      map[p.id] = p.totalLiquidityFeesEarnedLP ?? 0;
    });
    return map;
  }, [positions]);

  return {
    // State
    positions,
    now,
    isPositionsLoading,
    isPositionsFetching: isFetching,
    isPositionsPending: isPending,

    // Rewards
    totalAccumulatedGlw,
    totalFeeRewardsLP,
    totalFeeRewardsLPValue,
    positionFinalizedMap,
    positionFeesLP,

    // Pool info
    priceRatio,
    poolReserves,

    // Helpers
    getLoyaltyMultiplier: (createdAt: number) =>
      getLoyaltyMultiplier(createdAt, now),
    quoteOtherAmount: (params: { fromToken: "GLW" | "USDG"; amount: number }) =>
      quoteOtherAmount({ ...params, reserves: poolReserves }),
    wouldAddLiquidityLikelyFail: (params: { glw: number; usdg: number }) =>
      wouldAddLiquidityLikelyFail({ ...params, reserves: poolReserves }),

    // Actions
    addLiquidity,
    removeLiquidity,

    // Dialog state
    showIncentiveDialog: showDialog,
    acknowledgeIncentiveDialog: acknowledge,
    onIncentiveDialogOpenChange: onOpenChange,

    // Transaction state
    isAddingLiquidity,
    isRemovingLiquidity,
  };
}
