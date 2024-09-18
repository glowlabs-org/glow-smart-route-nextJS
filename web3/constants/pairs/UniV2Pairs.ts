
import { addresses } from '../addresses'

const sources = ['univ2'] as const
export type Source = (typeof sources)[number]
export type Token = {
    address: `0x${string}`
    decimals: number
    symbol: string
}
export type Pair = {
    token0: Token
    token1: Token
    pairAddress: `0x${string}`
    source: Source
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const weth: Token = {
    address: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6' as `0x${string}`,
    decimals: 18,
    symbol: 'WETH',
}

const gcc: Token = {
    address: addresses.gcc,
    decimals: 18,
    symbol: 'GCC',
}

const usdc: Token = {
    address: addresses.usdg, //TODO:! THis is usdg
    decimals: 6,
    symbol: 'USDC',
}

const glow: Token = {
    address: addresses.glow,
    decimals: 18,
    symbol: 'GLOW',
}

export function getPair(
    tokenA: Token,
    tokenB: Token,
    pairAddress: `0x${string}`,
    source: Source
): Pair {
    const token0 =
        BigInt(tokenA.address) < BigInt(tokenB.address) ? tokenA : tokenB
    const token1 =
        BigInt(tokenA.address) < BigInt(tokenB.address) ? tokenB : tokenA
    return {
        token0,
        token1,
        pairAddress,
        source,
    }
}

export const gccToUSDCPair = getPair(
    gcc,
    usdc,
    '0xeEd0974404f635AA5E5F6e4793D1a417798F164e', //TODO: This is on mainnet , everything else is on testnet
    'univ2'
)

//TODO: Update this address
const gccWethPair = getPair(
    gcc,
    weth,
    '0x2abdb6bE663AD8B72573C873412220640c8eb0Ba',
    'univ2'
)
export const UniV2Pairs: Pair[] = [gccToUSDCPair, gccWethPair]

export const glowUSDGPair = getPair(
    glow,
    usdc,
    '0x6fa09ffc45f1ddc95c1bc192956717042f142c5d',
    'univ2'
)