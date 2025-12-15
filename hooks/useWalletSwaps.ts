"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAbi, formatUnits, decodeEventLog } from "viem";
import { useChainId } from "wagmi";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { DECIMALS_BY_TOKEN, getAddresses } from "@glowlabs-org/utils/browser";
import { glowUSDGPair } from "@/web3/constants/pairs/UniV2Pairs";

if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
  throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
}

const SDKAddresses = getAddresses(parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!));
const USDG_ADDRESS = SDKAddresses.USDG_UNISWAP;

const PairAbi = parseAbi([
  "function token0() view returns (address)",
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
]);

export interface SwapEvent {
  txHash: `0x${string}`;
  timestamp: number;
  glwIn: number;
  glwOut: number;
  usdgIn: number;
  usdgOut: number;
  blockNumber: bigint;
}

export interface SwapTotals {
  totalGlwIn: number;
  totalGlwOut: number;
  totalUsdgIn: number;
  totalUsdgOut: number;
}

export interface WalletSwapsData {
  swaps: SwapEvent[];
  totals: SwapTotals;
}

const DAYS_TO_FETCH = 90;
const BLOCKS_PER_DAY = 7200; // Approximate for Ethereum mainnet (12s block time)
const BLOCKS_TO_FETCH = DAYS_TO_FETCH * BLOCKS_PER_DAY;

async function getBlockTimestamp(blockNumber: bigint): Promise<number> {
  try {
    const block = await publicClient.getBlock({ blockNumber });
    return Number(block.timestamp) * 1000;
  } catch {
    return Date.now();
  }
}

async function fetchWalletSwaps(
  walletAddress: `0x${string}`,
  pairAddress: `0x${string}`
): Promise<WalletSwapsData> {
  const currentBlock = await publicClient.getBlockNumber();
  const fromBlock = currentBlock - BigInt(BLOCKS_TO_FETCH);

  const token0 = (await publicClient.readContract({
    address: pairAddress,
    abi: PairAbi,
    functionName: "token0",
  })) as `0x${string}`;

  const isToken0USDG = token0.toLowerCase() === USDG_ADDRESS.toLowerCase();

  const walletLower = walletAddress.toLowerCase();

  const allLogs = await publicClient.getLogs({
    address: pairAddress,
    event: parseAbi([
      "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
    ])[0],
    fromBlock,
    toBlock: "latest",
  });

  const swaps: SwapEvent[] = [];
  const processedTxHashes = new Set<string>();

  for (const log of allLogs) {
    if (!log.transactionHash || processedTxHashes.has(log.transactionHash)) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: PairAbi,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== "Swap") continue;

      const args = decoded.args as {
        sender: `0x${string}`;
        amount0In: bigint;
        amount1In: bigint;
        amount0Out: bigint;
        amount1Out: bigint;
        to: `0x${string}`;
      };

      const tx = await publicClient.getTransaction({
        hash: log.transactionHash,
      });
      const txFrom = tx.from.toLowerCase();

      const isWalletInvolved =
        txFrom === walletLower ||
        args.sender.toLowerCase() === walletLower ||
        args.to.toLowerCase() === walletLower;

      if (!isWalletInvolved) continue;

      processedTxHashes.add(log.transactionHash);

      const timestamp = await getBlockTimestamp(log.blockNumber);

      let glwIn = 0;
      let glwOut = 0;
      let usdgIn = 0;
      let usdgOut = 0;

      if (isToken0USDG) {
        usdgIn = Number(formatUnits(args.amount0In, DECIMALS_BY_TOKEN.USDG));
        glwIn = Number(formatUnits(args.amount1In, DECIMALS_BY_TOKEN.GLW));
        usdgOut = Number(formatUnits(args.amount0Out, DECIMALS_BY_TOKEN.USDG));
        glwOut = Number(formatUnits(args.amount1Out, DECIMALS_BY_TOKEN.GLW));
      } else {
        glwIn = Number(formatUnits(args.amount0In, DECIMALS_BY_TOKEN.GLW));
        usdgIn = Number(formatUnits(args.amount1In, DECIMALS_BY_TOKEN.USDG));
        glwOut = Number(formatUnits(args.amount0Out, DECIMALS_BY_TOKEN.GLW));
        usdgOut = Number(formatUnits(args.amount1Out, DECIMALS_BY_TOKEN.USDG));
      }

      swaps.push({
        txHash: log.transactionHash,
        timestamp,
        glwIn,
        glwOut,
        usdgIn,
        usdgOut,
        blockNumber: log.blockNumber,
      });
    } catch (error) {
      console.error("Error processing swap log:", error);
    }
  }

  swaps.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));

  const totals: SwapTotals = {
    totalGlwIn: swaps.reduce((sum, s) => sum + s.glwIn, 0),
    totalGlwOut: swaps.reduce((sum, s) => sum + s.glwOut, 0),
    totalUsdgIn: swaps.reduce((sum, s) => sum + s.usdgIn, 0),
    totalUsdgOut: swaps.reduce((sum, s) => sum + s.usdgOut, 0),
  };

  return { swaps, totals };
}

export function useWalletSwaps(walletAddress: string | undefined) {
  const chainId = useChainId();
  const pairAddress = glowUSDGPair.pairAddress;

  const { data, isLoading, isFetching, error } = useQuery<WalletSwapsData>({
    queryKey: ["wallet-swaps", chainId, walletAddress],
    enabled: Boolean(walletAddress && pairAddress),
    queryFn: () =>
      fetchWalletSwaps(walletAddress as `0x${string}`, pairAddress),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  return {
    swaps: data?.swaps ?? [],
    totals: data?.totals ?? {
      totalGlwIn: 0,
      totalGlwOut: 0,
      totalUsdgIn: 0,
      totalUsdgOut: 0,
    },
    isLoading,
    isFetching,
    error,
  };
}
