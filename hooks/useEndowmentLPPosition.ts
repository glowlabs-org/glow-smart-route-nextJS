"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAbi, erc20Abi, formatUnits } from "viem";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { DECIMALS_BY_TOKEN, getAddresses } from "@glowlabs-org/utils/browser";
import { useChainId } from "wagmi";

const PairAbi = parseAbi([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
]);

if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
  throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
}

const SDKAddresses = getAddresses(parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!));
const UNISWAP_V2_FACTORY = SDKAddresses.UNISWAP_V2_FACTORY;
const GLW_ADDRESS = SDKAddresses.GLW_UNISWAP;
const USDG_ADDRESS = SDKAddresses.USDG_UNISWAP;
const ENDOWMENT_WALLET = SDKAddresses.ENDOWMENT_WALLET;

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
      args: [GLW_ADDRESS, USDG_ADDRESS],
    })) as `0x${string}`;

    if (addr && addr !== "0x0000000000000000000000000000000000000000") {
      pairAddressCache = addr;
      return addr;
    }
    return null;
  } catch {
    return null;
  }
}

export function useEndowmentLPPosition(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};
  const chainId = useChainId();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["endowment-lp-position", chainId, ENDOWMENT_WALLET],
    queryFn: async () => {
      const pairAddr = await getPairAddressCached();
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

      if (lpBalance === BigInt(0) || totalSupply === BigInt(0)) {
        return { glw: 0, usdg: 0, lpBalance: 0 };
      }

      // Determine which reserve is which token
      const isToken0USDG = token0.toLowerCase() === USDG_ADDRESS.toLowerCase();
      const usdgReserve = isToken0USDG ? reserve0 : reserve1;
      const glwReserve = isToken0USDG ? reserve1 : reserve0;

      // Calculate endowment's share of the pool
      const endowmentGlw =
        lpBalance > BigInt(0)
          ? Number(
              formatUnits(
                (glwReserve * lpBalance) / totalSupply,
                DECIMALS_BY_TOKEN.GLW
              )
            )
          : 0;

      const endowmentUsdg =
        lpBalance > BigInt(0)
          ? Number(
              formatUnits(
                (usdgReserve * lpBalance) / totalSupply,
                DECIMALS_BY_TOKEN.USDG
              )
            )
          : 0;

      return {
        glw: endowmentGlw,
        usdg: endowmentUsdg,
        lpBalance: Number(formatUnits(lpBalance, 12)), // LP tokens have 12 decimals
      };
    },
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 30_000 : false,
    refetchOnMount: enabled,
    refetchOnWindowFocus: false,
  });

  return {
    endowmentGlw: data?.glw ?? 0,
    endowmentUsdg: data?.usdg ?? 0,
    endowmentLpBalance: data?.lpBalance ?? 0,
    isLoading,
    isFetching,
  };
}
