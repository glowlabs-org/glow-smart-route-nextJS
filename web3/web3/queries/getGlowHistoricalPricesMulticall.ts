/* eslint-disable @typescript-eslint/ban-ts-comment */
import { formatUnits } from 'viem'
import { UniswapV2PairAbi } from '../abis/UniswapV2Pair.abi'
import { publicClient } from '../clients/publicClient'
import { glowUSDGPair} from '@/web3/constants/pairs/UniV2Pairs'
import { getPriceFromEarlyLiquidity } from './getPriceFromEarlyLiquidity'

export async function getReserves(_blockNumber: bigint | 'latest') {
    const blockNumber =
        _blockNumber === 'latest'
            ? await publicClient.getBlockNumber()
            : BigInt(_blockNumber)
    try {
        const call = await publicClient.readContract({
            address: glowUSDGPair.pairAddress,
            abi: UniswapV2PairAbi,
            functionName: 'getReserves',
            blockNumber: blockNumber,
        })

        const result = call as [bigint, bigint, bigint]
        const serializedResult = {
            source: 'univ2',
            pair: glowUSDGPair.pairAddress,
            token0: glowUSDGPair.token0,
            token1: glowUSDGPair.token1,
            //@ts-ignore
            reserve0: (result[0] as bigint).toString(),
            //@ts-ignore
            reserve1: (result[1] as bigint).toString(),
            blockNumber: blockNumber.toString(),
        }
        return serializedResult
    } catch (err) {
        console.log(err)
    }
}

export async function getGlowHistoricalPricesMulticall() {
    const startingBlock = BigInt(18809519)
    const currentBlock = BigInt(19284367)
    const step = BigInt(1000) //15000 seconds
    const serializedResults = []
    const totalSteps = (currentBlock - startingBlock) / step
    for (let i = startingBlock; i < currentBlock; i += step) {
        const currentStep = (i - startingBlock) / step
        console.log(
            `Processing block ${i.toString()} (${currentStep}/${totalSteps})`
        )
        try {
            serializedResults.push(await getReserves(i))
        } catch (err) {
            //push an err
            serializedResults.push({
                source: 'univ2',
                pair: glowUSDGPair.pairAddress,
                token0: glowUSDGPair.token0,
                token1: glowUSDGPair.token1,
                //@ts-ignore
                reserve0: (BigInt(0) as bigint).toString(),
                //@ts-ignore
                reserve1: (BigInt(0) as bigint).toString(),
                blockNumber: i.toString(),
            })
        }
    }
    // //Write it
    // fs.writeFileSync(
    //     'glowUSDGPair.json',
    //     JSON.stringify(serializedResults, null, 4)
    // )
    return serializedResults
}

export type Price = {
    price: string
    timestamp: string
    blockNumber: string
}
//glow is token 1
export async function calculateGlowPrice(
    glowReserve: bigint,
    usdgReserve: bigint,
    blockNumber: bigint
): Promise<Price> {
    const reservesA = formatUnits(glowReserve, 18)
    const reservesB = formatUnits(usdgReserve, 6)
    const blockInfo = await publicClient.getBlock({ blockNumber })
    const price = Number(reservesB.toString()) / Number(reservesA.toString())
    return {
        price: price.toString(),
        timestamp: `${Number(blockInfo.timestamp.toString())}`,
        blockNumber: blockNumber.toString(),
    }
}

export async function getMostRecentGlowPrice() {
    const reserves = await getReserves('latest')
    if (!reserves) throw new Error('No reserves found')
    const glowReserve = BigInt(reserves.reserve1)
    const usdgReserve = BigInt(reserves.reserve0)
    const blockNumber = BigInt(reserves.blockNumber)
    const uniswapPrice = await calculateGlowPrice(
        glowReserve,
        usdgReserve,
        blockNumber
    )

    const glowPriceFromEarlyLiquidity = await getPriceFromEarlyLiquidity()
    const uniswapPriceFloat = Number(uniswapPrice.price)
    //Return the lower of the two prices
    if (glowPriceFromEarlyLiquidity < uniswapPriceFloat) {
        return {
            price: glowPriceFromEarlyLiquidity.toString(),
            timestamp: uniswapPrice.timestamp,
            blockNumber: uniswapPrice.blockNumber,
        }
    } else {
        return uniswapPrice
    }
}
