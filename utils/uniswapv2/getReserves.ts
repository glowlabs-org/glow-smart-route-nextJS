import { BigNumber } from "ethers";
import { Result, Ok, Err } from "ts-results";
import { type Signer } from "ethers";
import {
  UnifapV2Pair__factory,
  UnifapV2Pair,
} from "@glowlabs-org/guarded-launch-ethers-sdk";

export type Reserves = {
  reserveTokenA: BigNumber;
  reserveTokenB: BigNumber;
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
  signer: Signer;
}): Promise<Result<Reserves, string>> {
  try {
    const pair: UnifapV2Pair = UnifapV2Pair__factory.connect(
      pairAddress,
      signer
    );
    const [reserve0, reserve1] = await pair.getReserves();
    const reserveTokenA = BigInt(tokenA) > BigInt(tokenB) ? reserve1 : reserve0;
    const reserveTokenB = BigInt(tokenA) > BigInt(tokenB) ? reserve0 : reserve1;
    const returnObj = {
      reserveTokenA,
      reserveTokenB,
    };
    return new Ok(returnObj);
  } catch (err) {
    return new Err("Error getting reserves");
  }
}
