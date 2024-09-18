import { ChainlinkPriceOracleABI } from '../abis/ChainlinkPriceOracle.abi'
import { env } from '@/web3/env'
import { publicClient } from '../clients/publicClient'
const ethToUsdOracles = [
    {
        chainId: 1,
        address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' as `0x${string}`,
    },
    {
        chainId: 5,
        address: '0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e' as `0x${string}`,
    },
]

const chainId = parseInt(env.deploymentChain)

const oracle = ethToUsdOracles.find((oracle) => oracle.chainId === chainId)
if (!oracle) throw new Error(`No oracle found for chainId ${chainId}`)

export const currentEthPriceBase8 = async () => {
    const result = (await publicClient.readContract({
        address: oracle.address,
        abi: ChainlinkPriceOracleABI,
        functionName: 'latestAnswer',
    })) as bigint

    return result.toString()
}

export const currentEthPriceFloat = async () => {
    const result = (await publicClient.readContract({
        address: oracle.address,
        abi: ChainlinkPriceOracleABI,
        functionName: 'latestAnswer',
    })) as bigint

    const res = Number(result.toString()) / 10 ** 8
    return res
}
