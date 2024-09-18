import { MinerPoolAndGCAABI } from '@glowlabs-org/guarded-launch-abis'
import { publicClient } from '@/web3/clients/publicClient'
import { addresses } from '@glowlabs-org/guarded-launch-abis'

export const getRewardInBucket = async (bucket: number) => {
    try {
        const result = await publicClient.readContract({
            address: addresses.gcaAndMinerPoolContract,
            abi: MinerPoolAndGCAABI,
            functionName: 'reward',
            args: [bucket],
        })
        const res = result as {
            inheritedFromLastWeek: string
            amountInBucket: bigint
            reward: bigint
        }
        return res.amountInBucket.toString()
    } catch (e) {
        console.log(e)
        return `0`
    }
}
