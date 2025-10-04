import { addresses, SDKAddresses } from "../addresses";

const sources = ["univ2"] as const;
export type Source = (typeof sources)[number];
export type Token = {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
};
export type Pair = {
  token0: Token;
  token1: Token;
  pairAddress: `0x${string}`;
  source: Source;
};

const usdg: Token = {
  address: SDKAddresses.USDG,
  decimals: 6,
  symbol: "USDG",
};

const glow: Token = {
  address: addresses.glow,
  decimals: 18,
  symbol: "GLOW",
};

export function getPair(
  tokenA: Token,
  tokenB: Token,
  pairAddress: `0x${string}`,
  source: Source
): Pair {
  const token0 =
    BigInt(tokenA.address) < BigInt(tokenB.address) ? tokenA : tokenB;
  const token1 =
    BigInt(tokenA.address) < BigInt(tokenB.address) ? tokenB : tokenA;
  return {
    token0,
    token1,
    pairAddress,
    source,
  };
}

export const glowUSDGPair = getPair(
  glow,
  usdg,
  "0x6fa09ffc45f1ddc95c1bc192956717042f142c5d",
  "univ2"
);
