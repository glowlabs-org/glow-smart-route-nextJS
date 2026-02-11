import { Header } from "@/components/header";
import StatsView from "./view";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { HydrationWrapper } from "../components/hydration-wrapper";
import { PageWrapper } from "../components/page-wrapper";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { hubGet } from "@/lib/api/hub-client";
import { getControlRouter, getRegionRouter } from "@/lib/api/control-routers";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { addresses, SDKAddresses } from "@/web3/constants/addresses";
import { getCurrentWeekNumber } from "@/lib/rewards/weekly-delegations";
import { formatUnits, parseAbi, erc20Abi, zeroAddress } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";

export const metadata: Metadata = buildPageMetadata({
  title: "Protocol Stats",
  description:
    "Track Glow protocol metrics, supply, and network performance in real time.",
  path: "/stats",
});
export const revalidate = 30;

const PairAbi = parseAbi([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
]);

const UNISWAP_V2_FACTORY = SDKAddresses.UNISWAP_V2_FACTORY;
const GLW_ADDRESS = SDKAddresses.GLW_UNISWAP;
const USDG_ADDRESS = SDKAddresses.USDG_UNISWAP;
const ENDOWMENT_WALLET = SDKAddresses.ENDOWMENT_WALLET;

let pairAddressCache: `0x${string}` | null = null;

async function getPairAddress(): Promise<`0x${string}` | null> {
  if (pairAddressCache) return pairAddressCache;
  try {
    const addr = (await publicClient.readContract({
      address: UNISWAP_V2_FACTORY,
      abi: parseAbi([
        "function getPair(address tokenA, address tokenB) external view returns (address pair)",
      ]),
      functionName: "getPair",
      args: [GLW_ADDRESS, USDG_ADDRESS],
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

async function fetchSpotPriceOnchain() {
  try {
    const pairAddr = await getPairAddress();
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

    const isToken0USDG =
      token0.toLowerCase() === USDG_ADDRESS.toLowerCase();
    const usdgReserve = isToken0USDG ? reserve0 : reserve1;
    const glwReserve = isToken0USDG ? reserve1 : reserve0;

    const usdg = Number(
      formatUnits(usdgReserve, DECIMALS_BY_TOKEN.USDG)
    );
    const glw = Number(formatUnits(glwReserve, DECIMALS_BY_TOKEN.GLW));
    const spotPrice = glw > 0 ? usdg / glw : 0;

    return {
      spotPrice: Number.isFinite(spotPrice) ? spotPrice : 0,
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function fetchPoolInfo() {
  const pairAddr = await getPairAddress();
  if (!pairAddr) throw new Error("Pair not found");

  const [token0, [reserve0, reserve1]] = await publicClient.multicall({
    contracts: [
      { address: pairAddr, abi: PairAbi, functionName: "token0" },
      { address: pairAddr, abi: PairAbi, functionName: "getReserves" },
    ],
    allowFailure: false,
  });

  const isToken0USDG =
    (token0 as string).toLowerCase() === USDG_ADDRESS.toLowerCase();
  const usdgReserve = isToken0USDG ? reserve0 : reserve1;
  const glwReserve = isToken0USDG ? reserve1 : reserve0;

  const glw = Number(
    formatUnits(glwReserve as bigint, DECIMALS_BY_TOKEN.GLW)
  );
  const usdg = Number(
    formatUnits(usdgReserve as bigint, DECIMALS_BY_TOKEN.USDG)
  );
  const price = glw > 0 ? usdg / glw : 0;

  return { reserves: { glw, usdg }, price };
}

async function fetchEndowmentLpPosition() {
  const pairAddr = await getPairAddress();
  if (!pairAddr) {
    return { glw: 0, usdg: 0, lpBalance: 0 };
  }

  const mc = await publicClient.multicall({
    contracts: [
      { address: pairAddr, abi: PairAbi, functionName: "token0" },
      { address: pairAddr, abi: PairAbi, functionName: "getReserves" },
      { address: pairAddr, abi: erc20Abi, functionName: "totalSupply" },
      {
        address: pairAddr,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [ENDOWMENT_WALLET as `0x${string}`],
      },
    ],
    allowFailure: false,
  });

  const token0 = mc[0] as `0x${string}`;
  const [reserve0, reserve1] = mc[1] as readonly [bigint, bigint, number];
  const totalSupply = mc[2] as bigint;
  const lpBalance = mc[3] as bigint;

  if (lpBalance === 0n || totalSupply === 0n) {
    return { glw: 0, usdg: 0, lpBalance: 0 };
  }

  const isToken0USDG =
    token0.toLowerCase() === USDG_ADDRESS.toLowerCase();
  const usdgReserve = isToken0USDG ? reserve0 : reserve1;
  const glwReserve = isToken0USDG ? reserve1 : reserve0;

  const endowmentGlw = Number(
    formatUnits(
      (glwReserve * lpBalance) / totalSupply,
      DECIMALS_BY_TOKEN.GLW
    )
  );
  const endowmentUsdg = Number(
    formatUnits(
      (usdgReserve * lpBalance) / totalSupply,
      DECIMALS_BY_TOKEN.USDG
    )
  );

  return {
    glw: endowmentGlw,
    usdg: endowmentUsdg,
    lpBalance: Number(formatUnits(lpBalance, 12)),
  };
}

async function fetchTotalMinerClaimed() {
  const base = process.env.NEXT_PUBLIC_POSITIONS_API_BASE;
  if (!base) throw new Error("NEXT_PUBLIC_POSITIONS_API_BASE is not set");
  const url = new URL("/rewards/total-glow-payouts", base);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ponder total payouts error ${res.status}: ${text}`);
  }
  const payload = (await res.json()) as {
    totalGlowPayouts?: string;
    indexingComplete?: boolean;
    error?: string;
  };
  if (!payload.indexingComplete) {
    throw new Error(payload.error ?? "Ponder is still indexing");
  }
  return BigInt(payload.totalGlowPayouts ?? "0");
}

async function fetchGlowMarketCap(glowPrice: number) {
  const calls = [
    {
      address: addresses.glow,
      abi: erc20Abi,
      functionName: "totalSupply",
    },
    {
      address: addresses.glow,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [addresses.carbonCreditAuction],
    },
    {
      address: addresses.glow,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [addresses.grantsTreasury],
    },
    {
      address: addresses.glow,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [addresses.vetoCouncilContract],
    },
    {
      address: addresses.glow,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [addresses.gcaAndMinerPoolContract],
    },
    {
      address: addresses.glow,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [addresses.glow],
    },
    {
      address: addresses.glow,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [addresses.earlyLiquidity],
    },
    {
      address: addresses.glow,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [SDKAddresses.ENDOWMENT_WALLET],
    },
  ];

  const multicall = await publicClient.multicall({ contracts: calls });
  const results = multicall.map((result, index) => ({
    result: result.result as bigint,
    call: calls[index],
  }));

  const [
    totalSupply,
    carbonCreditAuctionBalance,
    grantsContractBalance,
    vetoCouncilContractBalance,
    minerPoolAndGcaContractBalance,
    glowStakedOrLockedBalance,
    earlyLiquidityBalance,
    endowmentBalance,
  ] = results;

  const vaultBalanceResponse = await hubGet<{ totalGlwDelegatedWei: string }>(
    "/fractions/total-actively-delegated"
  );
  const vaultBalanceWei = BigInt(
    vaultBalanceResponse?.totalGlwDelegatedWei ?? "0"
  );

  const totalMinerClaimedGlow = await fetchTotalMinerClaimed();
  const currentWeek = getCurrentWeekNumber();
  const inflationToMinerPerWeek = 175_000;
  const totalAllocatedToMiners =
    BigInt(currentWeek * inflationToMinerPerWeek) * 1_000_000_000_000_000_000n;
  let yetToBeClaimedFromMiners =
    totalAllocatedToMiners - totalMinerClaimedGlow;
  if (yetToBeClaimedFromMiners < 0n) yetToBeClaimedFromMiners = 0n;

  let circulatingSupply =
    totalSupply.result -
    carbonCreditAuctionBalance.result -
    grantsContractBalance.result -
    vetoCouncilContractBalance.result -
    minerPoolAndGcaContractBalance.result +
    yetToBeClaimedFromMiners -
    glowStakedOrLockedBalance.result -
    earlyLiquidityBalance.result -
    vaultBalanceWei -
    endowmentBalance.result;
  if (circulatingSupply < 0n) circulatingSupply = 0n;

  const circulatingSupplyFormatted = Number(
    formatUnits(circulatingSupply, 18)
  );
  const marketCap = circulatingSupplyFormatted * (glowPrice || 0);

  return {
    circulatingSupply: circulatingSupplyFormatted,
    marketCap,
    totalSupply: Number(formatUnits(totalSupply.result, 18)),
  };
}

async function fetchPositionsApi<T>(path: string): Promise<T | null> {
  const base = process.env.NEXT_PUBLIC_POSITIONS_API_BASE;
  if (!base) return null;
  const url = new URL(path, base);
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export default async function StatsPage() {
  const queryClient = new QueryClient();
  const chainId = Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "1");
  const hasHub = Boolean(process.env.NEXT_PUBLIC_HUB_URL);
  const hasControl = Boolean(process.env.NEXT_PUBLIC_CONTROL_API_URL);
  const hasPositions = Boolean(process.env.NEXT_PUBLIC_POSITIONS_API_BASE);

  let spotPriceData: { spotPrice: number; updatedAt: number } | null = null;
  try {
    spotPriceData = await fetchSpotPriceOnchain();
  } catch {
    spotPriceData = null;
  }
  if (spotPriceData) {
    queryClient.setQueryData(
      QUERY_KEYS.prices.glowSpot(),
      spotPriceData
    );
  }

  const seedQuery = async <T,>(
    queryKey: readonly unknown[],
    fetcher: () => Promise<T | null | undefined>
  ) => {
    try {
      const data = await fetcher();
      if (data !== null && data !== undefined) {
        queryClient.setQueryData(queryKey, data);
      }
    } catch {
      // Best-effort hydration; fall back to client fetch on failure.
    }
  };

  const prefetches: Promise<unknown>[] = [];

  if (hasHub) {
    prefetches.push(
      seedQuery(QUERY_KEYS.fractions.summary(), () =>
        hubGet("/fractions/summary")
      )
    );
    prefetches.push(
      seedQuery(QUERY_KEYS.fractions.totalActivelyDelegated(), () =>
        hubGet("/fractions/total-actively-delegated")
      )
    );
    prefetches.push(
      seedQuery(QUERY_KEYS.activity.splits(100, undefined, undefined), () =>
        hubGet("/fractions/splits-activity", { params: { limit: 100 } })
      )
    );
    prefetches.push(
      seedQuery(QUERY_KEYS.activity.splits(10, undefined, "launchpad"), () =>
        hubGet("/fractions/splits-activity-by-type", {
          params: { limit: 10, fractionType: "launchpad" },
        })
      )
    );
    prefetches.push(
      seedQuery(QUERY_KEYS.activity.splits(10, undefined, "mining-center"), () =>
        hubGet("/fractions/splits-activity-by-type", {
          params: { limit: 10, fractionType: "mining-center" },
        })
      )
    );
    prefetches.push(
      seedQuery(["completed-farms", false], async () => {
        const url = `${process.env.NEXT_PUBLIC_HUB_URL}/applications/completed/summary`;
        const res = await fetch(url, {
          headers: { "content-type": "application/json" },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as unknown;
        return Array.isArray(data) ? data : [];
      })
    );

    const launchpadFilters = {
      sortBy: "publishedOnAuctionTimestamp",
      sortOrder: "desc",
      paymentCurrency: "GLW",
    };
    const miningFilters = {
      sortBy: "publishedOnAuctionTimestamp",
      sortOrder: "desc",
      paymentCurrency: "USDC",
      type: "mining-center",
    };

    prefetches.push(
      seedQuery(QUERY_KEYS.listings.sponsor(launchpadFilters), () =>
        hubGet("/applications/sponsor-listings-applications", {
          params: launchpadFilters,
        })
      )
    );
    prefetches.push(
      seedQuery(QUERY_KEYS.listings.sponsor(miningFilters), () =>
        hubGet("/applications/sponsor-listings-applications", {
          params: miningFilters,
        })
      )
    );
  }

  if (hasControl) {
    prefetches.push(
      seedQuery(["regions"], () => (getRegionRouter() as any).fetchRegions())
    );
    prefetches.push(
      seedQuery(["regions", "active-summary"], () =>
        (getRegionRouter() as any).fetchActiveSummary()
      )
    );
    prefetches.push(
      seedQuery(["gctl-price"], () =>
        (getControlRouter() as any).fetchGctlPrice()
      )
    );
    prefetches.push(
      seedQuery(["glw-price"], () =>
        (getControlRouter() as any).fetchGlwPrice()
      )
    );
    prefetches.push(
      seedQuery(["gctl-circulating-supply"], () =>
        (getControlRouter() as any).fetchCirculatingSupply()
      )
    );
    prefetches.push(
      seedQuery(["gctl-holders-count", chainId], () =>
        (getControlRouter() as any).fetchHoldersCount()
      )
    );
  }

  prefetches.push(
    seedQuery(["pool-info", chainId], () => fetchPoolInfo())
  );
  prefetches.push(
    seedQuery(["endowment-lp-position", chainId, ENDOWMENT_WALLET], () =>
      fetchEndowmentLpPosition()
    )
  );

  if (hasHub && hasPositions) {
    prefetches.push(
      seedQuery(QUERY_KEYS.prices.marketCap(), () =>
        fetchGlowMarketCap(spotPriceData?.spotPrice ?? 0)
      )
    );
  }

  if (hasPositions) {
    prefetches.push(
      seedQuery(["glow-edgap-price"], () =>
        fetchPositionsApi("/get-edgaps")
      )
    );
    prefetches.push(
      seedQuery(["pool-activity", "7d", "15min"], () =>
        fetchPositionsApi("/get-pool-activity?range=7d&interval=15min")
      )
    );
    prefetches.push(
      seedQuery(["edgap-series", "7d"], () =>
        fetchPositionsApi("/get-edgap-series?range=7d")
      )
    );
  }

  await Promise.allSettled(prefetches);
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationWrapper state={dehydratedState}>
      <PageWrapper>
        <Header withIsScrolled={true} />
        <StatsView />
      </PageWrapper>
    </HydrationWrapper>
  );
}
