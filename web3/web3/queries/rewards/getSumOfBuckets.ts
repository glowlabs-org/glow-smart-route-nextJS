/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/ban-types */
import { addresses } from '@/web3/constants/addresses'
import { PublicClient } from 'viem'
import { publicClient } from '../../clients/publicClient'
import { getProtocolWeek } from './getProtocolWeek'
import { formatUnits } from 'ethers/lib/utils'
import { minerPoolAndGCAAbi } from '@/web3/constants/abis/MinerPoolAndGCA.abi'

/**
 * Get weekly rewards for a given week range
 * @param client - the viem client
 * @param weekStart - the start week
 * @param weekEnd - the end week(inclusive)
 */
export type GetWeeklyRewardsForWeeksArgs = {
    client: PublicClient
    weekStart: number
    weekEnd: number
}

type RewardCallResult = {
    inheritedFromLastWeek: boolean
    amountInBucket: BigInt
    amountToDeduct: BigInt
}
export type RewardWithWeekSerialized = {
    amountInBucket: string
    amountToDeduct: string
    weekNumber: number
}
export async function getWeeklyRewardsForWeeksMulticall({
    client,
    weekStart,
    weekEnd,
}: GetWeeklyRewardsForWeeksArgs) {
    const contract = {
        address: addresses.gcaAndMinerPoolContract,
        abi: minerPoolAndGCAAbi,
    }
    //@ts-ignore
    const results = await client.multicall({
        contracts: Array.from({ length: weekEnd - weekStart + 1 }, (_, i) => ({
            ...contract,
            functionName: 'reward',
            args: [weekStart + i],
        })),
    })

    const rewards: RewardWithWeekSerialized[] = []
    for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.error) {
            //push a 0
            rewards.push({
                amountInBucket: '0',
                amountToDeduct: '0',
                weekNumber: weekStart + rewards.length,
            })
            continue
        }
        //@ts-ignore
        const res = result.result! as RewardCallResult
        rewards.push({
            amountInBucket: res.amountInBucket.toString(),
            amountToDeduct: res.amountToDeduct.toString(),
            weekNumber: weekStart + rewards.length,
        })
    }

    const sumOfBuckets = rewards.reduce((acc, reward) => {
        return acc + BigInt(reward.amountInBucket)
    }, BigInt(0))
    // console.log(rewards)
    return { rewards, sumOfBuckets: sumOfBuckets.toString() }
}

export const getSumOfBuckets = async () => {
    const { sumOfBuckets } = await getWeeklyRewardsForWeeksMulticall({
        client: publicClient,
        weekStart: getProtocolWeek(),
        weekEnd: getProtocolWeek() + 208,
    })

    const sumOfBucketsDisplayNumber = formatUnits(BigInt(sumOfBuckets), 6)
    return sumOfBucketsDisplayNumber
}
