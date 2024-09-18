/* eslint-disable @typescript-eslint/ban-ts-comment */
import { UniV2Pairs } from '@/web3/constants/pairs/UniV2Pairs'
import { UniswapV2PairAbi } from '../abis/UniswapV2Pair.abi'
import { publicClient } from '../clients/publicClient'
export const univ2ContractsWithMultiCall = UniV2Pairs.map((pair) => {
    return {
        address: pair.pairAddress as `0x${string}`,
        abi: UniswapV2PairAbi,
        functioName: 'getReserves',
    }
})

export async function getReservesMulticall() {
    const results = await publicClient.multicall({
        //@ts-ignore
        contracts: univ2ContractsWithMultiCall,
    })
    const succesfulResults = results.filter(
        (result) => result.result != undefined
    )
    const serializedResults = succesfulResults.map((result, index) => {
        return {
            source: 'univ2',
            pair: UniV2Pairs[index].pairAddress,
            token0: UniV2Pairs[index].token0,
            token1: UniV2Pairs[index].token1,
            //@ts-ignore
            reserve0: (result.result[0] as bigint).toString(),
            //@ts-ignore
            reserve1: (result.result[1] as bigint).toString(),
        }
    })
    return serializedResults
}
