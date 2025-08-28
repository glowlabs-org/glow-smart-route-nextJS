import { mainnetPublicClient } from "../clients/publicClient";

import { UniswapV2PairAbi } from "../abis/UniswapV2Pair.abi";
import { addresses } from "@/web3/constants/addresses";
import { formatUnits } from "viem";
import { getPriceFromEarlyLiquidity } from "./getPriceFromEarlyLiquidity";

// import {EarlyLiquidityABI} from "@glo"
const glowPairAddress = "0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";
export async function getHeadlineStats() {
  // Prefer remote API when available for faster, consistent stats
  try {
    const res = await fetch(
      "https://glow-green-api.simonnfts.workers.dev/headline-stats",
      { next: { revalidate: 30 } }
    );
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && typeof data === "object") {
        const [token0Reserves, token1Reserves] =
          (await mainnetPublicClient.readContract({
            address: glowPairAddress,
            abi: UniswapV2PairAbi,
            functionName: "getReserves",
          })) as [bigint, bigint, bigint];

        const currentPriceInEarlyLiquidityFloat =
          await getPriceFromEarlyLiquidity(mainnetPublicClient);

        const glowReserves =
          BigInt(addresses.usdg) > BigInt(addresses.glow)
            ? token0Reserves
            : token1Reserves;
        const usdgReserves =
          BigInt(addresses.usdg) > BigInt(addresses.glow)
            ? token1Reserves
            : token0Reserves;
        const glowFloat = Number(formatUnits(glowReserves, 18));
        const usdgFloat = Number(formatUnits(usdgReserves, 6));
        const glowPriceUniswap = usdgFloat / glowFloat;
        const glowPrice = Math.min(
          glowPriceUniswap,
          currentPriceInEarlyLiquidityFloat
        );

        return {
          glowPrice: glowPrice,
          uniswapPrice: glowPriceUniswap,
          lowestGlowPrice: glowPrice,

          earlyLiquidityPrice: Number(data.earlyLiquidityPrice),
          circulatingSupply: Number(data.circulatingSupply),
          marketCap: Number(data.marketCap),
          totalSupply: Number(data.totalSupply),
          usdcRewardPool: String(data.usdcRewardPool),

          // Additional fields that might be useful to consumers
          currentWeekActiveFarms: data.currentWeekActiveFarms,
          totalProtocolFeesLast30days: data.totalProtocolFeesLast30days,
          totalProtocolFeesLast90days: data.totalProtocolFeesLast90days,
          totalProtocolFeesLastYear: data.totalProtocolFeesLastYear,
        };
      }
      throw new Error("No data returned from API");
    }
    throw new Error("No data returned from API", { cause: res });
  } catch (error) {
    console.error("Error fetching headline stats", error);
    throw error;
  }
}
