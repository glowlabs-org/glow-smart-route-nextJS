import { publicClient } from '../clients/publicClient'

import { UniswapV2PairAbi } from '../abis/UniswapV2Pair.abi'
import { addresses } from '@/web3/constants/addresses'
import { formatUnits } from 'viem'
import { getGlowMarketCap } from './getGlowMarketCap'
import { getPriceFromEarlyLiquidity } from './getPriceFromEarlyLiquidity'
import { gccToUSDCPair } from '@/web3/constants/pairs/UniV2Pairs'
import { getGCCTotalCirculatingSupply } from './gcc/getGCCTotalCirculatingSupply'
import { getSumOfBuckets } from './rewards/getSumOfBuckets'
import { amountUSDCNeededForImpactPoints } from './impact-points/amountUSDCNeededForImpactPoints'

// import {EarlyLiquidityABI} from "@glo"
const glowPairAddress = '0x6fa09ffc45f1ddc95c1bc192956717042f142c5d'
export async function getHeadlineStats() {
    const [token0ReservesGCCPair, token1ReservesGCCPair] =
        (await publicClient.readContract({
            address: gccToUSDCPair.pairAddress,
            abi: UniswapV2PairAbi,
            functionName: 'getReserves',
        })) as [bigint, bigint, bigint]

    const gccReserves =
        BigInt(addresses.gcc) < BigInt(addresses.usdg)
            ? token0ReservesGCCPair
            : token1ReservesGCCPair
    const usdgReservesGCC =
        BigInt(addresses.gcc) < BigInt(addresses.usdg)
            ? token1ReservesGCCPair
            : token0ReservesGCCPair
    const gccFloat = Number(formatUnits(gccReserves, 18))
    const usdgFloatGCC = Number(formatUnits(usdgReservesGCC, 6))
    console.log({ gccFloat, usdgFloatGCC })
    const gccPriceUniswap = usdgFloatGCC / gccFloat

    const [token0Reserves, token1Reserves] = (await publicClient.readContract({
        address: glowPairAddress,
        abi: UniswapV2PairAbi,
        functionName: 'getReserves',
    })) as [bigint, bigint, bigint]

    const currentPriceInEarlyLiquidityFloat = await getPriceFromEarlyLiquidity()

    const glowReserves =
        BigInt(addresses.usdg) > BigInt(addresses.glow)
            ? token0Reserves
            : token1Reserves
    const usdgReserves =
        BigInt(addresses.usdg) > BigInt(addresses.glow)
            ? token1Reserves
            : token0Reserves
    const glowFloat = Number(formatUnits(glowReserves, 18))
    const usdgFloat = Number(formatUnits(usdgReserves, 6))
    const glowPriceUniswap = usdgFloat / glowFloat
    const glowPrice = Math.min(
        glowPriceUniswap,
        currentPriceInEarlyLiquidityFloat
    )

    const lowestGlowPrice = Math.min(
        glowPrice,
        currentPriceInEarlyLiquidityFloat
    )

    const { circulatingSupply, marketCap, totalSupply } =
        await getGlowMarketCap(lowestGlowPrice)

    const sumOfBuckets = await getSumOfBuckets()
    // const allProtocolFees = await getAllProtocolFeePayments()
    const gccCirculatingSupplyBigNumber =
        await getGCCTotalCirculatingSupply(publicClient)
    const gccCirculatingSupply = Number(
        formatUnits(gccCirculatingSupplyBigNumber.circulatingSupply, 18)
    )

    console.log('here5!')


    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    // const totalProtocolFeesLast30days = allProtocolFees
    //     .filter((fee) => fee.date >= thirtyDaysAgo / 1000)
    //     .reduce((acc, fee) => acc + Number(fee.revenueUSD), 0)

    const impactPowerPointsPrice = (await amountUSDCNeededForImpactPoints(1))
        .amountUSDCNeededNumber

    return {
        glowPrice: lowestGlowPrice, // use the lower of the two prices (current price in early liquidity or uniswap price
        uniswapPrice: glowPriceUniswap,
        gccPrice: gccPriceUniswap,
        earlyLiquidityPrice: currentPriceInEarlyLiquidityFloat,
        circulatingSupply,
        marketCap,
        totalSupply,
        // allProtocolFees,
        usdcRewardPool: sumOfBuckets,
        gccCirculatingSupply,
        // currentWeekActiveFarms: numActiveFarms,
        // totalProtocolFeesLast30days,
        impactPowerPointsPrice,
    }
}
