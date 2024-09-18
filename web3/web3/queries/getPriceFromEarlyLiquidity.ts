import { addresses } from '@/web3/constants/addresses'
import { EarlyLiquidityABI } from '@glowlabs-org/guarded-launch-abis'
import { formatUnits } from 'viem'
import { publicClient } from '../clients/publicClient'

export async function getPriceFromEarlyLiquidity() {
    const earlyLiquidityContract = {
        address: addresses.earlyLiquidity,
        abi: EarlyLiquidityABI,
    }

    const currentPriceInEarlyLiquidity = (await publicClient.readContract({
        address: earlyLiquidityContract.address,
        abi: earlyLiquidityContract.abi,
        functionName: 'getCurrentPrice',
    })) as bigint

    return Number(formatUnits(currentPriceInEarlyLiquidity, 6)) * 100
}
