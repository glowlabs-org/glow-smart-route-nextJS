import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { UniswapV2PairAbi } from "../abis/UniswapV2Pair.abi";
import { addresses } from "@/web3/constants/addresses";
import { formatUnits } from "viem";
import { getGlowMarketCap } from "./getGlowMarketCap";
import { getPriceFromEarlyLiquidity } from "./getPriceFromEarlyLiquidity";
import { getSumOfBuckets } from "./rewards/getSumOfBuckets";

// Create mainnet client for server-side calls
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.MAINNET_RPC_URL),
});

// import {EarlyLiquidityABI} from "@glo"
const glowPairAddress = "0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";
export async function getHeadlineStats() {
  const [token0Reserves, token1Reserves] = (await mainnetClient.readContract({
    address: glowPairAddress,
    abi: UniswapV2PairAbi,
    functionName: "getReserves",
  })) as [bigint, bigint, bigint];

  const currentPriceInEarlyLiquidityFloat = await getPriceFromEarlyLiquidity(
    mainnetClient
  );

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

  const lowestGlowPrice = Math.min(
    glowPrice,
    currentPriceInEarlyLiquidityFloat
  );

  const { circulatingSupply, marketCap, totalSupply } = await getGlowMarketCap(
    lowestGlowPrice,
    mainnetClient
  );

  const sumOfBuckets = await getSumOfBuckets(mainnetClient);

  return {
    glowPrice: lowestGlowPrice, // use the lower of the two prices (current price in early liquidity or uniswap price
    uniswapPrice: glowPriceUniswap,
    earlyLiquidityPrice: currentPriceInEarlyLiquidityFloat,
    circulatingSupply,
    marketCap,
    totalSupply,
    usdcRewardPool: sumOfBuckets,
  };
}
