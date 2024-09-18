import { parseAbi } from 'viem'

const minimalPairAbi = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
]

export const UniswapV2PairAbi = parseAbi(minimalPairAbi)
