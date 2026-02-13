import "server-only";

import { unstable_cache } from "next/cache";
import { formatUnits } from "viem";

import { mainnetPublicClient } from "@/web3/web3/clients/publicClient";
import { UniswapV2PairAbi } from "@/web3/web3/abis/UniswapV2Pair.abi";
import { addresses } from "@/web3/constants/addresses";
import { getPriceFromEarlyLiquidity } from "@/web3/web3/queries/getPriceFromEarlyLiquidity";

const glowPairAddress = "0x6fa09ffc45f1ddc95c1bc192956717042f142c5d" as const;
const DEFAULT_PONDER_URL =
  "https://glow-ponder-listener-2-production.up.railway.app";
const DEFAULT_HUB_URL = "https://gca-crm-backend-production-1f2a.up.railway.app";

function getPonderUrl(): string {
  return process.env.NEXT_PUBLIC_POSITIONS_API_BASE || DEFAULT_PONDER_URL;
}

function getHubUrl(): string {
  return process.env.NEXT_PUBLIC_HUB_URL || DEFAULT_HUB_URL;
}

interface GlowCirculatingSnapshotRow {
  week: number;
  circulating_wei: string;
  breakdown: {
    total_supply_wei: string;
    vaulted_delegated_wei: string;
  };
}

interface GlowCirculatingSnapshotResponse {
  series?: GlowCirculatingSnapshotRow[];
}

interface ActivelyDelegatedByWeekResponse {
  byWeek?: Record<string, string>;
}

function parseWeiToBigInt(value: string | null | undefined): bigint | null {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function deriveAdjustedCirculatingWei(
  latest: GlowCirculatingSnapshotRow,
  delegatedByWeekWei: string | null
): bigint {
  const baseCirculatingWei = parseWeiToBigInt(latest.circulating_wei) ?? 0n;
  const snapshotVaultedWei =
    parseWeiToBigInt(latest.breakdown.vaulted_delegated_wei) ?? 0n;
  const delegatedOverrideWei = parseWeiToBigInt(delegatedByWeekWei);

  if (delegatedOverrideWei === null) {
    return baseCirculatingWei;
  }

  const adjusted = baseCirculatingWei + snapshotVaultedWei - delegatedOverrideWei;
  return adjusted > 0n ? adjusted : 0n;
}

async function fetchDelegatedByWeekWei(week: number): Promise<string | null> {
  const search = new URLSearchParams();
  search.set("startWeek", String(week));
  search.set("endWeek", String(week));

  const response = await fetch(
    `${getHubUrl()}/fractions/actively-delegated-by-week?${search.toString()}`,
    { next: { revalidate: 120 } }
  );
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as ActivelyDelegatedByWeekResponse;
  const byWeek = payload?.byWeek;
  if (!byWeek || typeof byWeek !== "object") {
    return null;
  }

  const weekKey = String(week);
  const value = byWeek[weekKey];
  return typeof value === "string" ? value : null;
}

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
  const snapshotRes = await fetch(
    `${getPonderUrl()}/glow/circulating?range=1w&includePartialWeek=true`,
    { next: { revalidate: 60 } }
  );
  if (!snapshotRes.ok) {
    throw new Error("Failed to fetch circulating snapshot", {
      cause: snapshotRes,
    });
  }

  const snapshotData =
    (await snapshotRes.json()) as GlowCirculatingSnapshotResponse;
  const latest = snapshotData?.series?.[snapshotData.series.length - 1];
  if (!latest) {
    throw new Error("No circulating snapshot rows returned");
  }
  const delegatedByWeekWei = await fetchDelegatedByWeekWei(latest.week);

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
  const adjustedCirculatingWei = deriveAdjustedCirculatingWei(
    latest,
    delegatedByWeekWei
  );
  const circulatingSupply = Number(formatUnits(adjustedCirculatingWei, 18));
  const totalSupply = Number(
    formatUnits(BigInt(latest.breakdown.total_supply_wei), 18)
  );
  const marketCap = circulatingSupply * glowPrice;

  return {
    glowPrice,
    uniswapPrice: glowPriceUniswap,
    lowestGlowPrice: glowPrice,
    earlyLiquidityPrice: currentPriceInEarlyLiquidityFloat,
    circulatingSupply,
    marketCap,
    totalSupply,
    usdcRewardPool: String(usdgFloat),
    currentWeekActiveFarms: undefined,
    totalProtocolFeesLast30days: undefined,
    totalProtocolFeesLast90days: undefined,
    totalProtocolFeesLastYear: undefined,
  };
}

const chainId = Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "1");

export const getCachedHeadlineStats = unstable_cache(
  async () => await fetchHeadlineStatsUncached(),
  ["headline-stats", String(chainId)],
  { revalidate: 30, tags: ["headline-stats"] }
);
