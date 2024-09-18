import { parseAbi } from 'viem'

const chainlinkPriceOracleAbi = [
    'function latestAnswer() external view returns (int256)',
]

export const ChainlinkPriceOracleABI = parseAbi(chainlinkPriceOracleAbi)
