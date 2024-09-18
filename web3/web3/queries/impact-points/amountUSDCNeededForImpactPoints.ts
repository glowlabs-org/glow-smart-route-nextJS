import { publicClient } from '@/web3/web3/clients/publicClient'
import { gccToUSDCPair } from '@/web3/constants/pairs/UniV2Pairs'
import { UniswapV2PairAbi } from '@/web3/web3/abis/UniswapV2Pair.abi'

// const MAGNIFIER = BigInt(10 ** 12)
// const IMPACT_POINTS_DECIMALS = BigInt(12)
// const USDC_DECIMALS = BigInt(6)
export const amountUSDCNeededForImpactPoints = async (
    amountImpactPointsDesired: number
) => {
    const guess = BigInt(1) * BigInt(10 ** 6)
    const { reserveGCC, reserveUSDC } = await getReserves()
    const impactPointsReceiving = await findImpactPowerFromUSDC(
        guess,
        reserveUSDC,
        reserveGCC
    )

    const precision4ToNumberImpactPointsReceiving =
        Number(impactPointsReceiving / BigInt(10 ** 8)) / 1e4

    const impactPointsPerUSDC = precision4ToNumberImpactPointsReceiving
    console.info({ impactPointsPerUSDC })
    const amountUSDCNeededNumber =
        amountImpactPointsDesired / impactPointsPerUSDC

    let amountUSDCNeededBN = BigInt(
        Math.floor(amountUSDCNeededNumber * 10 ** 6)
    )

    let secondEstimate = findImpactPowerFromUSDC(
        amountUSDCNeededBN,
        reserveUSDC,
        reserveGCC
    )
    const amountImpactPointsNeededBigNumber =
        BigInt(Math.floor(amountImpactPointsDesired * 1e4)) * BigInt(10 ** 8)
    let tries = 0

    while (
        !inRange(
            secondEstimate,
            amountImpactPointsNeededBigNumber,
            (amountImpactPointsNeededBigNumber * BigInt(101)) / BigInt(100)
        )
    ) {
        if (tries > 10000) {
            throw new Error('Too many tries')
        }
        if (secondEstimate > amountImpactPointsNeededBigNumber) {
            amountUSDCNeededBN =
                (amountUSDCNeededBN * BigInt(999)) / BigInt(1000)
        } else {
            amountUSDCNeededBN =
                (amountUSDCNeededBN * BigInt(1005)) / BigInt(1000)
        }
        secondEstimate = findImpactPowerFromUSDC(
            amountUSDCNeededBN,
            reserveUSDC,
            reserveGCC
        )
        ++tries
    }

    return {
        amountUSDCNeededNumber,
        amountUSDCNeededBigNumber: amountUSDCNeededBN.toString(),
        expectedImpactPointsBigNumber: secondEstimate.toString(),
        expectedImpactPointsNumber:
            Number(secondEstimate / BigInt(10 ** 8)) / 1e4,
    }
}

function inRange(value: bigint, min: bigint, max: bigint) {
    return value >= min && value <= max
}

const getReserves = async () => {
    const reserves = await publicClient.readContract({
        address: gccToUSDCPair.pairAddress,
        abi: UniswapV2PairAbi,
        functionName: 'getReserves',
    })

    console

    const [reserve0, reserve1] = reserves as [bigint, bigint]
    const reserveGCC =
        BigInt(gccToUSDCPair.token0.address) <
        BigInt(gccToUSDCPair.token1.address)
            ? reserve0
            : reserve1
    const reserveUSDC = reserveGCC === reserve0 ? reserve1 : reserve0
    console.log({ reserveGCC, reserveUSDC })
    return { reserveGCC, reserveUSDC }
}

function sqrt(x: bigint): bigint {
    if (x < BigInt(256)) {
        for (let i = BigInt(0); i * i <= x; i++) {
            if (i * i === x) return i
        }
        return BigInt(0)
    }

    let y: bigint = x
    let z: bigint = BigInt(181)

    if (y >= BigInt(0x10000000000000000000000000000000000)) {
        y >>= BigInt(128)
        z <<= BigInt(64)
    }
    if (y >= BigInt(0x1000000000000000000)) {
        y >>= BigInt(64)
        z <<= BigInt(32)
    }
    if (y >= 0x10000000000) {
        y >>= BigInt(32)
        z <<= BigInt(16)
    }
    if (y >= BigInt(0x1000000)) {
        y >>= BigInt(16)
        z <<= BigInt(8)
    }

    z = (z * (y + BigInt(65536))) >> BigInt(18)

    for (let i = 0; i < 7; i++) {
        z = (z + x / z) >> BigInt(1)
    }

    z -= x / z < z ? BigInt(1) : BigInt(0)
    return z
}

export function findOptimalAmountToSwap(
    amountToCommit: bigint,
    totalReservesOfToken: bigint
): bigint {
    const a = sqrt(totalReservesOfToken) + BigInt(1)
    const b = sqrt(
        BigInt(3988000) * amountToCommit +
            BigInt(3988009) * totalReservesOfToken
    )
    const c = BigInt(1997) * totalReservesOfToken
    const d = BigInt(1994)

    if (c > a * b) {
        throw new Error('Precision loss leads to underflow')
    }

    const res = (a * b - c) / d
    return res
}

export function getAmountOut(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint
): bigint {
    if (amountIn <= BigInt(0)) {
        throw new Error('UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT')
    }
    if (reserveIn <= BigInt(0) || reserveOut <= BigInt(0)) {
        throw new Error('UniswapV2Library: INSUFFICIENT_LIQUIDITY')
    }

    const amountInWithFee = amountIn * BigInt(997)
    const numerator = amountInWithFee * reserveOut
    const denominator = reserveIn * BigInt(1000) + amountInWithFee
    const amountOut = numerator / denominator

    return amountOut
}

export const findImpactPowerFromUSDC = (
    amountUSDC: bigint,
    reservesUSDC: bigint,
    reservesGCC: bigint
) => {
    const optimalAmountToSwap = findOptimalAmountToSwap(
        amountUSDC,
        reservesUSDC
    )
    const amountGCC = getAmountOut(
        optimalAmountToSwap,
        reservesUSDC,
        reservesGCC
    )
    console.log({ amountUSDC, reservesUSDC })
    const usdcLeftover = amountUSDC - optimalAmountToSwap
    const impactPower = sqrt(amountGCC * usdcLeftover)
    return impactPower
}
