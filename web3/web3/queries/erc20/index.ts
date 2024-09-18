import { PublicClient } from 'viem'
import { erc20Abi } from 'viem'

/**
 * Get total supply of the token
 * @param client - the viem client
 */
export type GetTotalSupplyArgs = {
    client: PublicClient
    tokenAddress: `0x${string}`
}

export async function getERC20TotalSupply({
    client,
    tokenAddress,
}: GetTotalSupplyArgs) {
    const contract = {
        address: tokenAddress,
        abi: erc20Abi,
    }
    const result = await client.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: 'totalSupply',
    })
    return result as bigint
}

export async function getERC20Balance({
    client,
    tokenAddress,
    accountAddress,
}: GetTotalSupplyArgs & { accountAddress: `0x${string}` }) {
    const contract = {
        address: tokenAddress,
        abi: erc20Abi,
    }
    const result = await client.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: 'balanceOf',
        args: [accountAddress],
    })
    return result as bigint
}
