import { Result, Ok, Err } from "ts-results";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { parseAbi } from "viem";

export type Reserves = {
  reserveTokenA: bigint;
  reserveTokenB: bigint;
};
export async function getReserves({
  tokenA,
  tokenB,
  pairAddress,
  signer,
}: {
  tokenA: string;
  tokenB: string;
  pairAddress: string;
  signer?: any; // not used; kept for backward compatibility
}): Promise<Result<Reserves, string>> {
  try {
    const UNISWAP_V2_PAIR_ABI = parseAbi([
      "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    ]);
    const [reserve0, reserve1] = (await publicClient.readContract({
      address: pairAddress as `0x${string}`,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: "getReserves",
    })) as readonly [bigint, bigint, number];

    const tokenAIsToken0 = tokenA.toLowerCase() < tokenB.toLowerCase();
    const reserveTokenA = tokenAIsToken0 ? reserve0 : reserve1;
    const reserveTokenB = tokenAIsToken0 ? reserve1 : reserve0;
    const returnObj = {
      reserveTokenA,
      reserveTokenB,
    };
    return new Ok(returnObj);
  } catch (err) {
    return new Err("Error getting reserves");
  }
}
