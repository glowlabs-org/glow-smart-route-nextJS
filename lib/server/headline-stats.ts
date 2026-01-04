import "server-only";

import { unstable_cache } from "next/cache";
import { formatUnits } from "viem";

import { mainnetPublicClient } from "@/web3/web3/clients/publicClient";
import { UniswapV2PairAbi } from "@/web3/web3/abis/UniswapV2Pair.abi";
import { addresses } from "@/web3/constants/addresses";
import { getPriceFromEarlyLiquidity } from "@/web3/web3/queries/getPriceFromEarlyLiquidity";

const glowPairAddress = "0x6fa09ffc45f1ddc95c1bc192956717042f142c5d" as const;

export interface HeadlineStats {
  glowPrice: number;
  uniswapPrice: number;
  lowestGlowPrice: number;
  earlyLiquidityPrice: number;
  circulatingSupply: number;
  marketCap: number;
  totalSupply: number;
  usdcRewardPool: string;
  currentWeekActiveFarms?: unknown;
  totalProtocolFeesLast30days?: unknown;
  totalProtocolFeesLast90days?: unknown;
  totalProtocolFeesLastYear?: unknown;
}

async function fetchHeadlineStatsUncached(): Promise<HeadlineStats> {
  const res = await fetch(
    "https://glow-green-api.simonnfts.workers.dev/headline-stats"
  );
  if (!res.ok) throw new Error("Failed to fetch headline stats", { cause: res });

  const data = (await res.json()) as any;
  if (!data || typeof data !== "object")
    throw new Error("Invalid data returned from headline stats API");

  const [token0Reserves, token1Reserves] = (await mainnetPublicClient.readContract(
    {
      address: glowPairAddress,
      abi: UniswapV2PairAbi,
      functionName: "getReserves",
    }
  )) as [bigint, bigint, bigint];

  const currentPriceInEarlyLiquidityFloat =
    await getPriceFromEarlyLiquidity(mainnetPublicClient);

  const glowReserves =
    BigInt(addresses.usdg) > BigInt(addresses.glow) ? token0Reserves : token1Reserves;
  const usdgReserves =
    BigInt(addresses.usdg) > BigInt(addresses.glow) ? token1Reserves : token0Reserves;

  const glowFloat = Number(formatUnits(glowReserves, 18));
  const usdgFloat = Number(formatUnits(usdgReserves, 6));
  const glowPriceUniswap = usdgFloat / glowFloat;
  const glowPrice = Math.min(glowPriceUniswap, currentPriceInEarlyLiquidityFloat);

  return {
    glowPrice,
    uniswapPrice: glowPriceUniswap,
    lowestGlowPrice: glowPrice,
    earlyLiquidityPrice: Number(data.earlyLiquidityPrice),
    circulatingSupply: Number(data.circulatingSupply),
    marketCap: Number(data.marketCap),
    totalSupply: Number(data.totalSupply),
    usdcRewardPool: String(data.usdcRewardPool),
    currentWeekActiveFarms: data.currentWeekActiveFarms,
    totalProtocolFeesLast30days: data.totalProtocolFeesLast30days,
    totalProtocolFeesLast90days: data.totalProtocolFeesLast90days,
    totalProtocolFeesLastYear: data.totalProtocolFeesLastYear,
  };
}

const chainId = Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "1");

export const getCachedHeadlineStats = unstable_cache(
  async () => await fetchHeadlineStatsUncached(),
  ["headline-stats", String(chainId)],
  { revalidate: 30, tags: ["headline-stats"] }
);


