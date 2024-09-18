/* eslint-disable @typescript-eslint/ban-ts-comment */
import { PublicClient } from 'viem'
import { getERC20Balance, getERC20TotalSupply } from '../erc20'
import {
    addresses,
    CarbonCreditDescendingPriceAuctionABI,
} from '@glowlabs-org/guarded-launch-abis'
export async function getGCCTotalCirculatingSupply(client: PublicClient) {
    const gccTtoalSupply = await getERC20TotalSupply({
        client: client,
        tokenAddress: addresses.gcc,
    })

    const gccOwnedByCarbonCreditAuction = await getERC20Balance({
        client: client,
        tokenAddress: addresses.gcc,
        accountAddress: addresses.carbonCreditAuction,
    })

    //@ts-ignore
    const carbonCreditAuctionBalance =
        ((await client.readContract({
            address: addresses.carbonCreditAuction,
            abi: CarbonCreditDescendingPriceAuctionABI,
            functionName: 'unitsForSale',
        })) as bigint) * BigInt(1e6)

    const circulatingSupply =
        gccTtoalSupply -
        gccOwnedByCarbonCreditAuction +
        carbonCreditAuctionBalance

    return {
        circulatingSupply: circulatingSupply,
    }
}
