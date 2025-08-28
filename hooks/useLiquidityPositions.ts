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
  // Optional fields enriched from API
  apiMultiplier?: number;
  accumulatedGlowRewards?: number; // GLW
  totalLiquidityFeesEarnedLP?: number; // LP tokens (decimals 12)
  totalLiquidityFeesEarnedUSDG?: number; // USDG equivalent
  liquidityIncentiveApy?: number; // percent
  feesApy?: number; // percent
  combinedApy?: number; // percent
}

interface LiquidityPoolReserves {
  glw: number;
  usdg: number;
}

interface UseLiquidityPositionsOptions {
  initialPositions?: Position[];
  priceRatio?: number; // USDG per 1 GLW
  poolReserves?: LiquidityPoolReserves;
  feeApyPercent?: number;
  epochSeconds?: number;
  slippageBps?: number; // 100 = 1%
}

const SECONDS_IN_YEAR = 365 * 24 * 60 * 60;
const LP_DECIMALS = 12; // liquidity token = 12

// API response shapes
interface ApiFeeTrackerItem {
  liquidity: string;
  startRoiIndex: string;
  endRoiIndex: string | null;
}
interface ApiPositionItem {
  liquidity: string; // LP tokens (decimals 12)
  timestamp: string; // seconds
  lastSavedMultiplier: number;
  accumulatedGlowRewards: string; // number-like string
  feeTracker: ApiFeeTrackerItem[];
  combinedAPY: string;
  multiplier: number;
  totalLiquidityFeesEarned: string; // LP tokens
  feesAPY: string;
  liquidityIncentiveAPY: string;
}
interface ApiPositionsResponse {
  feeReturnAnnualized: number;
  positionsWithApy: ApiPositionItem[];
  totalGlwRewardsEarned: string;
  totalAccruedLiquidityProviderFees?: string;
}

const DEFAULT_POSITIONS: Position[] = [];

if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
  throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
}

const SDKAddresses = getAddresses(parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!));

const UNISWAP_V2_ROUTER = SDKAddresses.UNISWAP_V2_ROUTER;
const UNISWAP_V2_FACTORY = SDKAddresses.UNISWAP_V2_FACTORY;

export function useLiquidityPositions(options?: UseLiquidityPositionsOptions) {
  const feeApyPercent = options?.feeApyPercent ?? 6; // mock exchange fee APY in percent
  const epochSeconds = options?.epochSeconds ?? 7 * 24 * 60 * 60;
  const defaultSlippageBps = options?.slippageBps ?? 100; // 1%

  const chainId = useChainId();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const queryClient = useQueryClient();
  const [dynamicPriceRatio, setDynamicPriceRatio] = React.useState<number>(
    options?.priceRatio ?? 0
  );
  const [dynamicPoolReserves, setDynamicPoolReserves] =
    React.useState<LiquidityPoolReserves>(
      options?.poolReserves ?? { glw: 0, usdg: 0 }
    );
  const [poolReservesVersion, setPoolReservesVersion] = React.useState(0);
  const [poolReservesUpdatedAt, setPoolReservesUpdatedAt] = React.useState(0);

  const {
    data: positions = [],
    isLoading: isPositionsLoading,
    isFetching: isPositionsFetching,
    isPending: isPositionsPending,
  } = useQuery<Position[]>({
    queryKey: ["lp-positions", chainId, address],
    enabled: Boolean(address),
    queryFn: fetchUserPositions,
    staleTime: 15_000,
    refetchInterval: (q) => {
      const d = (q as any)?.state?.data as Position[] | undefined;
      return Array.isArray(d) && d.length > 0 ? 30_000 : 5_000;
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchIntervalInBackground: true,
    retry: 2,
  });

  // Fetch API totals separately to avoid setState inside queryFn loops
  const positionsApiQuery = useQuery<ApiPositionsResponse | null>({
    queryKey: ["lp-positions-api", chainId, address],
    enabled: Boolean(address),
    queryFn: async () => fetchPositionsFromApi(address as `0x${string}`),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  });

  // Memoized API totals (no setState) to avoid update loops
  const totalAccumulatedGlw = React.useMemo(() => {
    const api = positionsApiQuery.data;
    if (!api?.totalGlwRewardsEarned) return 0;
    try {
      return new Decimal(
        formatUnits(
          BigInt(api.totalGlwRewardsEarned || "0"),
          DECIMALS_BY_TOKEN.GLW
        )
      ).toNumber();
    } catch {
      return 0;
    }
  }, [positionsApiQuery.data]);

  const totalAccruedLiquidityProviderFees = React.useMemo(() => {
    const api = positionsApiQuery.data;
    if (!api?.totalAccruedLiquidityProviderFees) return 0;
    try {
      return new Decimal(
        formatUnits(
          BigInt(api.totalAccruedLiquidityProviderFees || "0"),
          LP_DECIMALS
        )
      ).toNumber();
    } catch {
      return 0;
    }
  }, [positionsApiQuery.data]);
  const [now, setNow] = React.useState<number>(Date.now());

  // Derived values are computed via memo to avoid update loops
  const [
    /* deprecated state removed */
  ] = React.useState<void>();

  const [showIncentiveDialog, setShowIncentiveDialog] = React.useState(false);

  // ---- API helpers ----
  function normalizeApyToPercent(input: unknown): number {
    const num = typeof input === "string" ? Number(input) : (input as number);
    if (!Number.isFinite(num) || num < 0) return 0;
    // API returns APY as decimal (e.g., 0.121 for 12.1%), convert to percent
    const pct = num * 100;
    return Math.min(pct, 10000); // Cap at 10000% to avoid UI issues
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
      const json = (await res.json()) as ApiPositionsResponse;
      return json;
    } catch {
      return null;
    }
  }

  // No animated totals; only loyalty bonus moves in real-time

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    try {
      const dialogAck = window.localStorage.getItem("lp_dialog_ack");
      if (dialogAck !== "1") setShowIncentiveDialog(true);
    } catch {}
  }, []);

  function acknowledgeIncentiveDialog() {
    try {
      window.localStorage.setItem("lp_dialog_ack", "1");
    } catch {}
    setShowIncentiveDialog(false);
  }

  function onIncentiveDialogOpenChange(open: boolean) {
    if (!open) {
      acknowledgeIncentiveDialog();
      return;
    }
    setShowIncentiveDialog(true);
  }

  function getLoyaltyMultiplier(createdAt: number) {
    const days = Math.max(0, (now - createdAt) / (1000 * 60 * 60 * 24));
    return Math.pow(days, 0.176091259) || 0;
  }

  const RouterAbi = React.useMemo(
    () =>
      parseAbi([
        "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)",
        "function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB)",
      ]),
    []
  );

  const PairAbi = React.useMemo(
    () =>
      parseAbi([
        "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
        "function token0() view returns (address)",
        "function token1() view returns (address)",
        "function mint(address to) returns (uint liquidity)",
      ]),
    []
  );

  const tokenDecimals = React.useMemo(
    () => ({ glw: DECIMALS_BY_TOKEN.GLW, usdg: DECIMALS_BY_TOKEN.USDG }),
    []
  );

  // Cache the pair address to avoid repeated factory lookups
  const pairAddressRef = React.useRef<`0x${string}` | null>(null);
  async function getPairAddressCached(): Promise<`0x${string}` | null> {
    if (pairAddressRef.current) return pairAddressRef.current;
    try {
      const addr = await resolvePairAddress();
      pairAddressRef.current = addr;
      return addr;
    } catch {
      return null;
    }
  }

  // ---- Pure helpers (no React state) ----
  function orderReservesByTokenSymbols(params: {
    token0: string;
    usdGAddress: string;
    reserve0: bigint;
    reserve1: bigint;
  }) {
    const { token0, usdGAddress, reserve0, reserve1 } = params;
    const isToken0USDG = token0.toLowerCase() === usdGAddress.toLowerCase();
    const usdgReserve = isToken0USDG ? reserve0 : reserve1;
    const glwReserve = isToken0USDG ? reserve1 : reserve0;
    return { usdgReserve, glwReserve };
  }

  function scaleReservesToFloat(params: {
    usdgReserve: bigint;
    glwReserve: bigint;
    decimals: { glw: number; usdg: number };
  }) {
    const { usdgReserve, glwReserve, decimals } = params;
    const base = new Decimal(10);
    const usdg = new Decimal(usdgReserve.toString())
      .div(base.pow(decimals.usdg))
      .toNumber();
    const glw = new Decimal(glwReserve.toString())
      .div(base.pow(decimals.glw))
      .toNumber();
    return { usdg, glw };
  }

  async function fetchReservesFloats(pairAddr: `0x${string}`) {
    const token0 = (await publicClient.readContract({
      address: pairAddr,
      abi: PairAbi,
      functionName: "token0",
    })) as `0x${string}`;
    const [reserve0, reserve1] = (await publicClient.readContract({
      address: pairAddr,
      abi: PairAbi,
      functionName: "getReserves",
    })) as readonly [bigint, bigint, number];
    const { usdgReserve, glwReserve } = orderReservesByTokenSymbols({
      token0,
      usdGAddress: SDKAddresses.USDG,
      reserve0,
      reserve1,
    });
    return scaleReservesToFloat({
      usdgReserve,
      glwReserve,
      decimals: tokenDecimals,
    });
  }

  function computePriceRatioFromFloats(params: { glw: number; usdg: number }) {
    const { glw, usdg } = params;
    if (!Number.isFinite(glw) || glw <= 0) return 0;
    return new Decimal(usdg).div(glw).toNumber();
  }

  function computeLiquidityToRemove({
    userLp,
    percentage,
  }: {
    userLp: bigint;
    percentage: number;
  }) {
    return (userLp * BigInt(Math.floor(percentage))) / BigInt(100);
  }

  function computeRemoveOutputsFloats({
    usdgReserve,
    glwReserve,
    totalSupply,
    liquidityToRemove,
  }: {
    usdgReserve: bigint;
    glwReserve: bigint;
    totalSupply: bigint;
    liquidityToRemove: bigint;
  }) {
    const amountUSDG = (usdgReserve * liquidityToRemove) / totalSupply;
    const amountGLW = (glwReserve * liquidityToRemove) / totalSupply;
    return scaleReservesToFloat({
      usdgReserve: amountUSDG,
      glwReserve: amountGLW,
      decimals: tokenDecimals,
    });
  }

  async function resolvePairAddress(): Promise<`0x${string}` | null> {
    try {
      if (UNISWAP_V2_FACTORY) {
        const addr = (await publicClient.readContract({
          address: UNISWAP_V2_FACTORY,
          abi: parseAbi([
            "function getPair(address tokenA, address tokenB) external view returns (address pair)",
          ]),
          functionName: "getPair",
          args: [SDKAddresses.GLW, SDKAddresses.USDG],
        })) as `0x${string}`;

        if (addr && addr !== zeroAddress) return addr;
      }
      // fallback to constant
      throw new Error("Pair not found");
    } catch {
      throw new Error("Pair not found");
    }
  }

  function haveReservesMeaningfullyChanged(
    prev: LiquidityPoolReserves,
    next: LiquidityPoolReserves
  ) {
    const epsGLW = Math.max(1e-9, Math.abs(prev.glw) * 0.0001);
    const epsUSDG = Math.max(1e-9, Math.abs(prev.usdg) * 0.0001);
    return (
      Math.abs(prev.glw - next.glw) > epsGLW ||
      Math.abs(prev.usdg - next.usdg) > epsUSDG
    );
  }

  async function fetchPoolInfoOnce() {
    try {
      const pairAddr = (await resolvePairAddress()) as `0x${string}` | null;

      if (!pairAddr) return;
      const { glw: glwFloat, usdg: usdgFloat } = await fetchReservesFloats(
        pairAddr
      );
      const nextReserves = { glw: glwFloat, usdg: usdgFloat };
      setDynamicPriceRatio(
        computePriceRatioFromFloats({ glw: glwFloat, usdg: usdgFloat })
      );
      setDynamicPoolReserves((prev) => {
        const changed = haveReservesMeaningfullyChanged(prev, nextReserves);
        if (changed) {
          setPoolReservesVersion((v) => v + 1);
          setPoolReservesUpdatedAt(Date.now());
          return nextReserves;
        }
        return prev;
      });
    } catch (e) {
      console.error("Error fetching pool info", e);
    }
  }

  async function fetchUserPositions(): Promise<Position[]> {
    console.log("fetchUserPositions");
    try {
      if (!address) return [];
      const pairAddr = (await getPairAddressCached()) as `0x${string}` | null;
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
      const { usdgReserve, glwReserve } = orderReservesByTokenSymbols({
        token0,
        usdGAddress: SDKAddresses.USDG,
        reserve0,
        reserve1,
      });
      const totalSupply = mc[2] as bigint;
      const userLp = mc[3] as bigint;

      if (userLp === BigInt(0) || totalSupply === BigInt(0)) return [];

      const { usdg, glw } = computeRemoveOutputsFloats({
        usdgReserve,
        glwReserve,
        totalSupply,
        liquidityToRemove: userLp,
      });

      const sharePct = Number((userLp * BigInt(10000)) / totalSupply) / 100;

      // Fetch API for APY/multiplier/fees (do not set local state here)
      let apiData: ApiPositionsResponse | null = null;
      try {
        apiData = await fetchPositionsFromApi(address as `0x${string}`);
      } catch {}

      const positions: Position[] = [];

      if (
        apiData &&
        Array.isArray(apiData.positionsWithApy) &&
        apiData.positionsWithApy.length > 0
      ) {
        // Create a position for each API entry (FILO queue - newest first)
        // Sort by timestamp descending (newest first)
        const sortedApiPositions = [...apiData.positionsWithApy].sort(
          (a, b) => {
            const tsA = Number(a.timestamp) || 0;
            const tsB = Number(b.timestamp) || 0;
            return tsB - tsA; // Descending order (newest first)
          }
        );

        for (let i = 0; i < sortedApiPositions.length; i++) {
          const apiPos = sortedApiPositions[i];

          // Parse liquidity amount to determine position size
          let liquidityAmount = BigInt(0);
          try {
            liquidityAmount = BigInt(apiPos.liquidity || "0");
          } catch {}

          // Compute exact underlying amounts for this position from reserves
          const posAmounts = computeRemoveOutputsFloats({
            usdgReserve,
            glwReserve,
            totalSupply,
            liquidityToRemove: liquidityAmount,
          });
          const positionGlw = posAmounts.glw;
          const positionUsdg = posAmounts.usdg;

          // Pool share percentage for this position
          const positionSharePct =
            Number((liquidityAmount * BigInt(10000)) / totalSupply) / 100;

          // Parse accumulated rewards
          let accGlow = 0;
          try {
            accGlow = new Decimal(
              formatUnits(
                BigInt(apiPos.accumulatedGlowRewards || "0"),
                DECIMALS_BY_TOKEN.GLW
              )
            ).toNumber();
          } catch {}

          let accFeesLP = 0;
          try {
            accFeesLP = new Decimal(
              formatUnits(
                BigInt(apiPos.totalLiquidityFeesEarned || "0"),
                LP_DECIMALS
              )
            ).toNumber();
          } catch {}

          const tsMs = Number(apiPos.timestamp) * 1000;
          const createdAt =
            Number.isFinite(tsMs) && tsMs > 0 ? tsMs : Date.now();

          positions.push({
            id: `p${i + 1}`,
            pair: "GLW/USDG",
            glwAmount: positionGlw,
            usdgAmount: positionUsdg,
            apy: normalizeApyToPercent(apiPos.combinedAPY),
            poolSharePct: Math.min(100, Math.max(0, positionSharePct)),
            createdAt,
            initialGlw: positionGlw,
            initialUsdg: positionUsdg,
            apiMultiplier: apiPos.multiplier,
            accumulatedGlowRewards: accGlow,
            totalLiquidityFeesEarnedLP: accFeesLP,
            totalLiquidityFeesEarnedUSDG: accFeesLP,
            liquidityIncentiveApy: normalizeApyToPercent(
              apiPos.liquidityIncentiveAPY
            ),
            feesApy: normalizeApyToPercent(apiPos.feesAPY),
            combinedApy: normalizeApyToPercent(apiPos.combinedAPY),
          });
        }
      } else {
        // Fallback: create single position if no API data
        positions.push({
          id: "p1",
          pair: "GLW/USDG",
          glwAmount: glw,
          usdgAmount: usdg,
          apy: 12.1,
          poolSharePct: Math.min(100, Math.max(0, sharePct)),
          createdAt: Date.now(),
          initialGlw: glw,
          initialUsdg: usdg,
        });
      }

      return positions;
    } catch (e) {
      return [];
    }
  }

  // React Query: keep pool reserves fresh every 30s
  const { data: poolInfo } = useQuery<{
    reserves: { glw: number; usdg: number };
    price: number;
  }>({
    queryKey: ["pool-info", chainId],
    queryFn: async () => {
      const pairAddr = (await getPairAddressCached()) as `0x${string}` | null;
      if (!pairAddr) throw new Error("Pair not found");
      const { glw, usdg } = await fetchReservesFloats(pairAddr);
      return {
        reserves: { glw, usdg },
        price: computePriceRatioFromFloats({ glw, usdg }),
      };
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  });

  React.useEffect(() => {
    if (!poolInfo) return;
    const nextReserves = poolInfo.reserves;
    setDynamicPriceRatio(poolInfo.price);
    setDynamicPoolReserves((prev) => {
      const changed = haveReservesMeaningfullyChanged(prev, nextReserves);
      if (changed) {
        setPoolReservesVersion((v) => v + 1);
        setPoolReservesUpdatedAt(Date.now());
        return nextReserves;
      }
      return prev;
    });
  }, [poolInfo]);

  function toUnits(n: number, decimals: number) {
    if (!Number.isFinite(n)) return BigInt(0);
    const base = new Decimal(10).pow(decimals);
    const scaled = new Decimal(n).mul(base).toFixed(0, Decimal.ROUND_DOWN);
    return BigInt(scaled);
  }

  function applySlippage(amount: bigint, bps: number) {
    return (amount * BigInt(10_000 - bps)) / BigInt(10_000);
  }

  // ---- ERC20 allowance helpers ----
  async function readTokenAllowance({
    token,
    owner,
    spender,
  }: {
    token: `0x${string}`;
    owner: `0x${string}`;
    spender: `0x${string}`;
  }): Promise<bigint> {
    try {
      return (await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [owner, spender],
      })) as bigint;
    } catch {
      return BigInt(0);
    }
  }

  async function estimateApprovalGasIfInsufficient({
    token,
    owner,
    spender,
    requiredAmount,
  }: {
    token: `0x${string}`;
    owner: `0x${string}`;
    spender: `0x${string}`;
    requiredAmount: bigint;
  }): Promise<bigint> {
    try {
      const current = await readTokenAllowance({ token, owner, spender });
      if (current >= requiredAmount) return BigInt(0);
      const gas = await publicClient.estimateContractGas({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, requiredAmount],
        account: owner,
      });
      return gas;
    } catch {
      return BigInt(0);
    }
  }

  async function ensureMaxAllowanceIfNeeded({
    token,
    owner,
    spender,
    requiredAmount,
  }: {
    token: `0x${string}`;
    owner: `0x${string}`;
    spender: `0x${string}`;
    requiredAmount: bigint;
  }) {
    const current = await readTokenAllowance({ token, owner, spender });
    if (current >= requiredAmount) return;
    const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1);
    const hash = await walletClient!.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, MAX_UINT256],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error("Approval failed");
    }
  }

  // UniswapV2-style quote helper (pure): given A and reserves, return optimal B
  function quoteAmountB({
    amountA,
    reserveA,
    reserveB,
  }: {
    amountA: number;
    reserveA: number;
    reserveB: number;
  }): number {
    if (!Number.isFinite(amountA) || amountA <= 0) return 0;
    if (!Number.isFinite(reserveA) || reserveA <= 0) return 0;
    if (!Number.isFinite(reserveB) || reserveB <= 0) return 0;
    return new Decimal(amountA).mul(reserveB).div(reserveA).toNumber();
  }

  // Public API: quote the counterpart amount to match pool ratio
  function quoteOtherAmount(params: {
    fromToken: "GLW" | "USDG";
    amount: number;
  }): number {
    const { fromToken, amount } = params;
    if (fromToken === "GLW")
      return quoteAmountB({
        amountA: amount,
        reserveA: dynamicPoolReserves.glw,
        reserveB: dynamicPoolReserves.usdg,
      });
    return quoteAmountB({
      amountA: amount,
      reserveA: dynamicPoolReserves.usdg,
      reserveB: dynamicPoolReserves.glw,
    });
  }

  function wouldAddLiquidityLikelyFail({
    glw,
    usdg,
  }: {
    glw: number;
    usdg: number;
  }): boolean {
    if (
      !Number.isFinite(glw) ||
      !Number.isFinite(usdg) ||
      glw <= 0 ||
      usdg <= 0
    )
      return false;
    const reserveGLW = dynamicPoolReserves.glw;
    const reserveUSDG = dynamicPoolReserves.usdg;
    if (!Number.isFinite(reserveGLW) || !Number.isFinite(reserveUSDG))
      return false;
    if (reserveGLW <= 0 || reserveUSDG <= 0) return false;

    const slippage = new Decimal(defaultSlippageBps).div(10_000);
    const amountAMin = new Decimal(glw).mul(new Decimal(1).minus(slippage));
    const amountBMin = new Decimal(usdg).mul(new Decimal(1).minus(slippage));

    const ratio = new Decimal(reserveUSDG).div(reserveGLW);
    if (!ratio.isFinite() || ratio.lte(0)) return false;
    const amountBOptimal = new Decimal(glw).mul(ratio);
    if (amountBOptimal.lte(usdg)) {
      const usedA = new Decimal(glw);
      const usedB = amountBOptimal;
      return usedA.lt(amountAMin) || usedB.lt(amountBMin);
    } else {
      const amountAOptimal = new Decimal(usdg).div(ratio);
      const usedA = amountAOptimal;
      const usedB = new Decimal(usdg);
      return usedA.lt(amountAMin) || usedB.lt(amountBMin);
    }
  }

  async function quoteRemoveLiquidityForPercentage(
    percentage: number
  ): Promise<{ glw: number; usdg: number } | null> {
    try {
      if (!address) return { glw: 0, usdg: 0 };
      if (!Number.isFinite(percentage) || percentage <= 0)
        return { glw: 0, usdg: 0 };
      const pairAddr = (await getPairAddressCached()) as `0x${string}` | null;
      if (!pairAddr) return null;
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
      const { usdgReserve, glwReserve } = orderReservesByTokenSymbols({
        token0,
        usdGAddress: SDKAddresses.USDG,
        reserve0,
        reserve1,
      });
      const totalSupply = mc[2] as bigint;
      const userLp = mc[3] as bigint;
      if (userLp === BigInt(0) || totalSupply === BigInt(0))
        return { glw: 0, usdg: 0 };

      const liquidityToRemove = computeLiquidityToRemove({
        userLp,
        percentage,
      });
      if (liquidityToRemove <= BigInt(0)) return { glw: 0, usdg: 0 };

      const { usdg, glw } = computeRemoveOutputsFloats({
        usdgReserve,
        glwReserve,
        totalSupply,
        liquidityToRemove,
      });
      return { glw, usdg };
    } catch {
      return null;
    }
  }

  async function estimateAddLiquidityNetworkCostUSD({
    glw,
    usdg,
  }: {
    glw: number;
    usdg: number;
  }): Promise<number | null> {
    try {
      if (!walletClient?.account?.address) return null;
      if (!UNISWAP_V2_ROUTER) return null;

      const account = walletClient.account.address as `0x${string}`;
      const router = UNISWAP_V2_ROUTER as `0x${string}`;
      const GLW = SDKAddresses.GLW as `0x${string}`;
      const USDG = SDKAddresses.USDG as `0x${string}`;

      const amountAGlow = toUnits(glw, tokenDecimals.glw);
      const amountBUsdg = toUnits(usdg, tokenDecimals.usdg);

      let totalGas = BigInt(0);
      // Estimate approvals if needed
      totalGas += await estimateApprovalGasIfInsufficient({
        token: GLW,
        owner: account,
        spender: router,
        requiredAmount: amountAGlow,
      });
      totalGas += await estimateApprovalGasIfInsufficient({
        token: USDG,
        owner: account,
        spender: router,
        requiredAmount: amountBUsdg,
      });

      // Use conservative fallback for addLiquidity gas.
      const FALLBACK_ADD_LIQUIDITY_GAS = BigInt(220_000);
      totalGas += FALLBACK_ADD_LIQUIDITY_GAS;

      const gasPrice = await publicClient.getGasPrice();
      const costWei = totalGas * gasPrice;
      const costEth = Number(formatEther(costWei));
      const ethPrice = (await getEthPriceInUSD()) ?? 0;
      const costUSD = costEth * ethPrice;
      return costUSD;
    } catch (e) {
      return null;
    }
  }

  async function estimateRemoveLiquidityNetworkCostUSD({
    percentage,
  }: {
    percentage: number;
  }): Promise<number | null> {
    try {
      if (!walletClient?.account?.address) return null;
      if (!UNISWAP_V2_ROUTER) return null;

      const account = walletClient.account.address as `0x${string}`;
      const router = UNISWAP_V2_ROUTER as `0x${string}`;
      const pairAddr = (await resolvePairAddress()) as `0x${string}` | null;
      if (!pairAddr) return null;

      const userLp = (await publicClient.readContract({
        address: pairAddr,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account],
      })) as bigint;
      if (userLp === BigInt(0)) return 0;

      const liquidityToRemove = computeLiquidityToRemove({
        userLp,
        percentage,
      });
      if (liquidityToRemove <= BigInt(0)) return 0;

      let totalGas = BigInt(0);
      // LP approval if needed
      totalGas += await estimateApprovalGasIfInsufficient({
        token: pairAddr,
        owner: account,
        spender: router,
        requiredAmount: liquidityToRemove,
      });

      // Conservative fallback gas for removeLiquidity
      const FALLBACK_REMOVE_LIQUIDITY_GAS = BigInt(190_000);
      totalGas += FALLBACK_REMOVE_LIQUIDITY_GAS;

      const gasPrice = await publicClient.getGasPrice();
      const costWei = totalGas * gasPrice;
      const costEth = Number(formatEther(costWei));
      const ethPrice = (await getEthPriceInUSD()) ?? 0;
      const costUSD = costEth * ethPrice;
      return costUSD;
    } catch (e) {
      return null;
    }
  }

  function getRewardsEstimatesGLW(p: Position) {
    // Prefer API accumulated value for finalized component
    const finalizedFromApi = Number.isFinite(p.accumulatedGlowRewards)
      ? (p.accumulatedGlowRewards as number)
      : 0;
    return {
      finalized: finalizedFromApi,

      multiplier: getLoyaltyMultiplier(p.createdAt),
    };
  }

  const derivedRewards = React.useMemo(() => {
    const finalizedById: Record<string, number> = {};
    const pendingById: Record<string, number> = {};
    const rateById: Record<string, number> = {};
    const feesById: Record<string, number> = {};
    const feeRateById: Record<string, number> = {};

    let finalizedSum = 0;
    for (const p of positions) {
      const r = getRewardsEstimatesGLW(p);
      finalizedSum += r.finalized;
      finalizedById[p.id] = r.finalized;
      rateById[p.id] = r.multiplier;

      const positionValueInUSDG =
        p.usdgAmount + p.glwAmount * (dynamicPriceRatio || 0);
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now - p.createdAt) / 1000)
      );
      const feesApy = Number.isFinite(p.feesApy)
        ? (p.feesApy as number)
        : feeApyPercent;
      const feeRatePerSecond =
        ((feesApy / 100) * positionValueInUSDG) / SECONDS_IN_YEAR;
      const feesAccrued = Number.isFinite(p.totalLiquidityFeesEarnedLP)
        ? (p.totalLiquidityFeesEarnedLP as number)
        : feeRatePerSecond * elapsedSeconds;
      feesById[p.id] = feesAccrued;
      feeRateById[p.id] = feeRatePerSecond;
    }

    return {
      rewardsEarnedGlw: finalizedSum,
      positionFinalizedMap: finalizedById,
      positionPendingMap: pendingById,
      positionRateMap: rateById,
      positionFeesMap: feesById,
      positionFeeRateMap: feeRateById,
    } as const;
  }, [positions, now, dynamicPriceRatio, feeApyPercent, epochSeconds]);

  // Single ticking source of truth is `now`. We avoid a second interval
  // to prevent update cascades and depth issues.

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
      if (!UNISWAP_V2_ROUTER)
        throw new Error("Uniswap router not configured for this network");

      try {
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
            `${reason}. Please disable Smart Account/EIP-7702 for this network before adding liquidity.`
          );
          throw new Error(
            `${reason}. Disable Smart Account (MetaMask) or EIP-7702 and try again.`
          );
        }
      } catch (err: any) {
        if (
          err?.message?.includes("Disable Smart Account") ||
          err?.message?.includes("EIP-7702")
        ) {
          throw err;
        }
        toast.error(
          "Could not verify Smart Account status. If this fails, disable Smart Account and try again."
        );
      }

      const amountAGlow = toUnits(glw, tokenDecimals.glw);
      const amountBUsdg = toUnits(usdg, tokenDecimals.usdg);
      const desiredA = amountAGlow;
      const desiredB = amountBUsdg;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      const [glwBalance, usdgBalance] = (await Promise.all([
        publicClient.readContract({
          address: SDKAddresses.GLW,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }),
        publicClient.readContract({
          address: SDKAddresses.USDG,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }),
      ])) as [bigint, bigint];
      if (glwBalance < amountAGlow) {
        throw new Error("Insufficient GLW balance");
      }
      if (usdgBalance < amountBUsdg) {
        throw new Error("Insufficient USDG balance");
      }

      let amountAMin: bigint;
      let amountBMin: bigint;
      try {
        const pairAddr = (await publicClient.readContract({
          address: UNISWAP_V2_FACTORY,
          abi: parseAbi([
            "function getPair(address tokenA, address tokenB) external view returns (address pair)",
          ]),
          functionName: "getPair",
          args: [SDKAddresses.GLW, SDKAddresses.USDG],
        })) as `0x${string}`;

        if (pairAddr && pairAddr !== zeroAddress) {
          amountAMin = applySlippage(desiredA, defaultSlippageBps);
          amountBMin = applySlippage(desiredB, defaultSlippageBps);
        } else {
          amountAMin = applySlippage(desiredA, defaultSlippageBps);
          amountBMin = applySlippage(desiredB, defaultSlippageBps);
        }
      } catch (e) {
        amountAMin = applySlippage(desiredA, defaultSlippageBps);
        amountBMin = applySlippage(desiredB, defaultSlippageBps);
      }

      await ensureMaxAllowanceIfNeeded({
        token: SDKAddresses.GLW as `0x${string}`,
        owner: address as `0x${string}`,
        spender: UNISWAP_V2_ROUTER as `0x${string}`,
        requiredAmount: amountAGlow,
      });
      await ensureMaxAllowanceIfNeeded({
        token: SDKAddresses.USDG as `0x${string}`,
        owner: address as `0x${string}`,
        spender: UNISWAP_V2_ROUTER as `0x${string}`,
        requiredAmount: amountBUsdg,
      });

      let hash: `0x${string}`;
      try {
        const { request } = await publicClient.simulateContract({
          address: UNISWAP_V2_ROUTER,
          abi: RouterAbi,
          functionName: "addLiquidity",
          args: [
            SDKAddresses.GLW,
            SDKAddresses.USDG,
            desiredA,
            desiredB,
            amountAMin,
            amountBMin,
            address as `0x${string}`,
            deadline,
          ],
          account: address as `0x${string}`,
        });
        hash = await walletClient.writeContract(request);
      } catch (e: any) {
        const spender = UNISWAP_V2_ROUTER;
        const msg =
          e?.shortMessage || e?.message || "addLiquidity simulation failed";
        throw new Error(
          `UniswapV2Router02 could not pull tokens via transferFrom. Ensure allowance is set for spender ${spender} and balances are sufficient. Details: ${msg} (see Router02 docs: https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02)`
        );
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        const err: any = new Error("Transaction reverted");
        err.txHash = hash;
        err.cause = "reverted";
        throw err;
      }

      return hash;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["lp-positions", chainId, address],
        }),
        queryClient.invalidateQueries({ queryKey: ["pool-info", chainId] }),
      ]);
    },
  });

  const removeLiquidityMutation = useMutation({
    mutationKey: ["remove-liquidity", chainId, address],
    mutationFn: async (percentage: number): Promise<`0x${string}`> => {
      if (!walletClient || !address) {
        throw new Error("Wallet not connected");
      }
      if (!UNISWAP_V2_ROUTER)
        throw new Error("Uniswap router not configured for this network");
      const pairAddr = (await resolvePairAddress()) as `0x${string}` | null;
      if (!pairAddr) throw new Error("Pair not found");

      const lpBalance = (await publicClient.readContract({
        address: pairAddr,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })) as bigint;
      if (lpBalance === BigInt(0)) {
        throw new Error("Your liquidity position is empty");
      }

      const liquidityToRemove =
        (lpBalance * BigInt(Math.floor(percentage))) / BigInt(100);
      if (liquidityToRemove <= BigInt(0)) {
        throw new Error("You cannot remove 0% of your liquidity");
      }

      const [reserve0, reserve1] = (await publicClient.readContract({
        address: pairAddr,
        abi: PairAbi,
        functionName: "getReserves",
      })) as readonly [bigint, bigint, number];
      const token0 = (await publicClient.readContract({
        address: pairAddr,
        abi: PairAbi,
        functionName: "token0",
      })) as `0x${string}`;
      const isToken0USDG =
        token0.toLowerCase() === SDKAddresses.USDG.toLowerCase();
      const usdgReserve = isToken0USDG ? reserve0 : reserve1;
      const glwReserve = isToken0USDG ? reserve1 : reserve0;
      const totalSupply = (await publicClient.readContract({
        address: pairAddr,
        abi: erc20Abi,
        functionName: "totalSupply",
      })) as bigint;
      const amountGlowExpected = (glwReserve * liquidityToRemove) / totalSupply;
      const amountUsdgExpected =
        (usdgReserve * liquidityToRemove) / totalSupply;

      const amountGlowMin = applySlippage(
        amountGlowExpected,
        defaultSlippageBps
      );
      const amountUsdgMin = applySlippage(
        amountUsdgExpected,
        defaultSlippageBps
      );

      const lpAllowance = (await publicClient.readContract({
        address: pairAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address as `0x${string}`, UNISWAP_V2_ROUTER],
      })) as bigint;
      if (lpAllowance < liquidityToRemove) {
        await walletClient.writeContract({
          address: pairAddr,
          abi: erc20Abi,
          functionName: "approve",
          args: [UNISWAP_V2_ROUTER, liquidityToRemove],
        });
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
      const hash = await walletClient.writeContract({
        address: UNISWAP_V2_ROUTER,
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["lp-positions", chainId, address],
        }),
        queryClient.invalidateQueries({ queryKey: ["pool-info", chainId] }),
      ]);
    },
  });

  async function addLiquidity({
    glw,
    usdg,
  }: {
    glw: number;
    usdg: number;
  }): Promise<`0x${string}`> {
    return addLiquidityMutation.mutateAsync({ glw, usdg });
  }

  async function removeLiquidity(percentage: number) {
    return removeLiquidityMutation.mutateAsync(percentage);
  }

  return {
    // state
    positions,
    now,
    isPositionsLoading,
    isPositionsFetching,
    isPositionsPending,
    // rewards
    rewardsEarnedGlw: derivedRewards.rewardsEarnedGlw,
    totalAccumulatedGlw, // Total GLW rewards from API
    totalAccruedLiquidityProviderFees,

    positionFinalizedMap: derivedRewards.positionFinalizedMap,
    positionPendingMap: derivedRewards.positionPendingMap,
    positionRateMap: derivedRewards.positionRateMap,
    positionFeesMap: derivedRewards.positionFeesMap,
    positionFeeRateMap: derivedRewards.positionFeeRateMap,
    // params
    priceRatio: dynamicPriceRatio,
    poolReserves: dynamicPoolReserves,
    poolReservesVersion,
    poolReservesUpdatedAt,
    // helpers
    getLoyaltyMultiplier,
    getRewardsEstimatesGLW,
    wouldAddLiquidityLikelyFail,
    quoteRemoveLiquidityForPercentage,
    // actions
    addLiquidity,
    removeLiquidity,
    estimateAddLiquidityNetworkCostUSD,
    estimateRemoveLiquidityNetworkCostUSD,
    quoteOtherAmount,
    // mutations
    addLiquidityMutation,
    removeLiquidityMutation,
    // dialogs
    showIncentiveDialog,
    acknowledgeIncentiveDialog,
    onIncentiveDialogOpenChange,
    // tx state
    isAddingLiquidity: addLiquidityMutation.isPending,
    isRemovingLiquidity: removeLiquidityMutation.isPending,
  };
}
