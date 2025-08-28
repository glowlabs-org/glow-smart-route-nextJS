"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { animate, useMotionValue, useMotionValueEvent } from "framer-motion";
import { parseAbi, erc20Abi, zeroAddress, formatEther } from "viem";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { DECIMALS_BY_TOKEN, getAddresses } from "@glowlabs-org/utils/browser";
import seedGlowUsdgPairOnSepolia from "@/web3/web3/create-and-seed-pair";
import { getEthPriceInUSD } from "@/utils/getEthPriceInUSD";
import { getSmartAccountStatus } from "@/web3/web3/utils/detectSmartAccount";
import { toast } from "sonner";

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

const DEFAULT_POSITIONS: Position[] = [
  {
    id: "p1",
    pair: "GLW/USDG",
    glwAmount: 1200.5,
    usdgAmount: 820.25,
    apy: 12.1,
    poolSharePct: 0.22,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
    initialGlw: 1200.5,
    initialUsdg: 820.25,
  },
];

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
  const positionsInitial = options?.initialPositions ?? DEFAULT_POSITIONS;
  const { data: positions = positionsInitial } = useQuery<Position[]>({
    queryKey: ["lp-positions", chainId, address, poolReservesVersion],
    enabled: Boolean(address),
    queryFn: fetchUserPositions,
    initialData: positionsInitial,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });
  const [now, setNow] = React.useState<number>(Date.now());

  const [rewardsEarnedGlw, setRewardsEarnedGlw] = React.useState<number>(0);
  const animatedRewards = useMotionValue(0);
  const [animatedRewardsDisplay, setAnimatedRewardsDisplay] = React.useState(0);
  const [totalRatePerSec, setTotalRatePerSec] = React.useState(0);
  const [feesRatePerSec, setFeesRatePerSec] = React.useState(0);

  const [positionFinalizedMap, setPositionFinalizedMap] = React.useState<
    Record<string, number>
  >({});
  const [positionPendingMap, setPositionPendingMap] = React.useState<
    Record<string, number>
  >({});
  const [positionRateMap, setPositionRateMap] = React.useState<
    Record<string, number>
  >({});
  const [positionFeesMap, setPositionFeesMap] = React.useState<
    Record<string, number>
  >({});
  const [positionFeeRateMap, setPositionFeeRateMap] = React.useState<
    Record<string, number>
  >({});

  const [showIncentiveDialog, setShowIncentiveDialog] = React.useState(false);

  const lastAnimatedUpdateRef = React.useRef(0);
  useMotionValueEvent(animatedRewards, "change", (v) => {
    const nowMs =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (nowMs - lastAnimatedUpdateRef.current >= 100) {
      lastAnimatedUpdateRef.current = nowMs;
      setAnimatedRewardsDisplay(v);
    }
  });

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
    const usdg = Number(usdgReserve) / 10 ** decimals.usdg;
    const glw = Number(glwReserve) / 10 ** decimals.glw;
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
    return glw > 0 ? usdg / glw : 0;
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
    try {
      if (!address) return positionsInitial;
      const pairAddr = (await resolvePairAddress()) as `0x${string}` | null;
      if (!pairAddr) return [];

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

      const totalSupply = (await publicClient.readContract({
        address: pairAddr,
        abi: erc20Abi,
        functionName: "totalSupply",
      })) as bigint;
      const userLp = (await publicClient.readContract({
        address: pairAddr,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })) as bigint;

      if (userLp === BigInt(0) || totalSupply === BigInt(0)) return [];

      const { usdg, glw } = computeRemoveOutputsFloats({
        usdgReserve,
        glwReserve,
        totalSupply,
        liquidityToRemove: userLp,
      });

      let createdAt = Date.now();
      let initialGlw = glw;
      let initialUsdg = usdg;
      try {
        const createdKey = `lp_created_at_${chainId}_${address}`;
        const initKey = `lp_initial_${chainId}_${address}`;
        const storedCreated = window.localStorage.getItem(createdKey);
        const storedInit = window.localStorage.getItem(initKey);
        if (storedCreated) createdAt = Number(storedCreated) || createdAt;
        if (storedInit) {
          const parsed = JSON.parse(storedInit) as {
            glw: number;
            usdg: number;
          };
          if (Number.isFinite(parsed?.glw)) initialGlw = parsed.glw;
          if (Number.isFinite(parsed?.usdg)) initialUsdg = parsed.usdg;
        } else {
          window.localStorage.setItem(createdKey, String(createdAt));
          window.localStorage.setItem(
            initKey,
            JSON.stringify({ glw: initialGlw, usdg: initialUsdg })
          );
        }
      } catch {}

      const sharePct = Number((userLp * BigInt(10000)) / totalSupply) / 100;
      const pos: Position = {
        id: "p1",
        pair: "GLW/USDG",
        glwAmount: glw,
        usdgAmount: usdg,
        apy: 12.1,
        poolSharePct: Math.min(100, Math.max(0, sharePct)),
        createdAt,
        initialGlw,
        initialUsdg,
      };
      return [pos];
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
      const pairAddr = (await resolvePairAddress()) as `0x${string}` | null;
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
    refetchOnWindowFocus: true,
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
    const [intPart, fracPart = ""] = String(n).split(".");
    const normalized =
      (intPart + (fracPart + "0".repeat(decimals)).slice(0, decimals)).replace(
        /^0+/,
        ""
      ) || "0";
    return BigInt(normalized);
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
    return (amountA * reserveB) / reserveA;
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

    const slippage = defaultSlippageBps / 10_000;
    const amountAMin = glw * (1 - slippage);
    const amountBMin = usdg * (1 - slippage);

    const ratio = reserveUSDG / reserveGLW;
    if (!Number.isFinite(ratio) || ratio <= 0) return false;
    const amountBOptimal = glw * ratio;
    if (amountBOptimal <= usdg) {
      const usedA = glw;
      const usedB = amountBOptimal;
      return usedA < amountAMin || usedB < amountBMin;
    } else {
      const amountAOptimal = usdg / ratio;
      const usedA = amountAOptimal;
      const usedB = usdg;
      return usedA < amountAMin || usedB < amountBMin;
    }
  }

  async function quoteRemoveLiquidityForPercentage(
    percentage: number
  ): Promise<{ glw: number; usdg: number } | null> {
    try {
      if (!address) return { glw: 0, usdg: 0 };
      if (!Number.isFinite(percentage) || percentage <= 0)
        return { glw: 0, usdg: 0 };
      const pairAddr = (await resolvePairAddress()) as `0x${string}` | null;
      if (!pairAddr) return null;

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

      const totalSupply = (await publicClient.readContract({
        address: pairAddr,
        abi: erc20Abi,
        functionName: "totalSupply",
      })) as bigint;
      const userLp = (await publicClient.readContract({
        address: pairAddr,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })) as bigint;
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
    const apyPerSecond = p.apy / 100 / (365 * 24 * 60 * 60);
    const elapsedSeconds = Math.max(0, Math.floor((now - p.createdAt) / 1000));
    const multiplier = getLoyaltyMultiplier(p.createdAt);

    const completedEpochs = Math.floor(elapsedSeconds / epochSeconds);
    const finalizedSeconds = completedEpochs * epochSeconds;
    const pendingSeconds = elapsedSeconds - finalizedSeconds;

    const finalized =
      p.glwAmount * apyPerSecond * finalizedSeconds * multiplier;
    const pending = p.glwAmount * apyPerSecond * pendingSeconds * multiplier;
    const ratePerSecond = p.glwAmount * apyPerSecond * multiplier;

    return { finalized, pending, multiplier, ratePerSecond };
  }

  React.useEffect(() => {
    let finalizedSum = 0;
    let totalRate = 0;
    let totalNowAccum = 0;
    const finalizedById: Record<string, number> = {};
    const pendingById: Record<string, number> = {};
    const rateById: Record<string, number> = {};
    const feesById: Record<string, number> = {};
    const feeRateById: Record<string, number> = {};
    let totalFeeRate = 0;

    for (const p of positions) {
      const r = getRewardsEstimatesGLW(p);
      finalizedSum += r.finalized;
      totalRate += r.ratePerSecond;
      totalNowAccum += r.finalized + r.pending;
      finalizedById[p.id] = r.finalized;
      pendingById[p.id] = r.pending;
      rateById[p.id] = r.ratePerSecond;

      const positionValueInUSDG =
        p.usdgAmount + p.glwAmount * (dynamicPriceRatio || 0);
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now - p.createdAt) / 1000)
      );
      const feeRatePerSecond =
        ((feeApyPercent / 100) * positionValueInUSDG) / SECONDS_IN_YEAR;
      const feesAccrued = feeRatePerSecond * elapsedSeconds;
      feesById[p.id] = feesAccrued;
      feeRateById[p.id] = feeRatePerSecond;
      totalFeeRate += feeRatePerSecond;
    }

    setRewardsEarnedGlw(finalizedSum);
    setTotalRatePerSec(totalRate);
    setPositionFinalizedMap(finalizedById);
    setPositionPendingMap(pendingById);
    setPositionRateMap(rateById);
    setPositionFeesMap(feesById);
    setPositionFeeRateMap(feeRateById);
    setFeesRatePerSec(totalFeeRate);

    animatedRewards.set(totalNowAccum);
    const tick = setInterval(() => {
      const target = animatedRewards.get() + totalRate;
      animate(animatedRewards, target, { duration: 0.8, ease: "easeOut" });
    }, 1000);
    return () => clearInterval(tick);
  }, [positions, now, dynamicPriceRatio, feeApyPercent, epochSeconds]);

  React.useEffect(() => {
    const id = setInterval(() => {
      setPositionPendingMap((prev) => {
        const next: Record<string, number> = {};
        for (const key of Object.keys(prev))
          next[key] = prev[key] + (positionRateMap[key] || 0);
        return next;
      });
      setPositionFeesMap((prev) => {
        const next: Record<string, number> = {};
        for (const key of Object.keys(positionFeeRateMap)) {
          const current = prev[key] ?? 0;
          next[key] = current + (positionFeeRateMap[key] || 0);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [positionRateMap, positionFeeRateMap]);

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
    // rewards
    rewardsEarnedGlw,
    animatedRewardsDisplay,
    totalRatePerSec,
    feesRatePerSec,
    positionFinalizedMap,
    positionPendingMap,
    positionRateMap,
    positionFeesMap,
    positionFeeRateMap,
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
