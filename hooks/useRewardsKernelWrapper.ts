"use client";

import { useCallback, useState } from "react";
import { useWalletClient, usePublicClient } from "wagmi";
import { toast } from "sonner";
import {
  useRewardsKernel,
  type ClaimPayoutParams,
  type TokenAndAmount,
  RewardsKernelError,
  getAddresses,
} from "@glowlabs-org/utils/browser";
import type { ClaimableReward } from "./useClaimableRewards";

if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
  throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
}

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID);

// Get SDK addresses for tokens
const SDKAddresses = getAddresses(CHAIN_ID);

// Token addresses mapping
const TOKEN_ADDRESSES: Record<string, `0x${string}`> = {
  GLW: SDKAddresses.GLW_UNISWAP as `0x${string}`,
  USDC: SDKAddresses.USDC as `0x${string}`,
  USDG: SDKAddresses.USDG_UNISWAP as `0x${string}`,
};

export interface UseRewardsKernelWrapperResult {
  claimWeekRewards: (
    week: number,
    rewards: ClaimableReward[],
    nonce: bigint,
    proof: `0x${string}`[],
    fromAddress: `0x${string}`
  ) => Promise<string | null>;
  claimAllRewards: (
    weeklyData: Array<{
      week: number;
      rewards: ClaimableReward[];
      nonce: bigint;
      proof: `0x${string}`[];
      fromAddress: `0x${string}`;
    }>
  ) => Promise<string[]>;
  isClaimingWeek: number | null;
  isClaimingAll: boolean;
  checkIfClaimed: (
    userAddress: `0x${string}`,
    nonce: bigint
  ) => Promise<boolean>;
  isFinalized: (nonce: bigint) => Promise<boolean>;
}

export function useRewardsKernelWrapper(): UseRewardsKernelWrapperResult {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isClaimingWeek, setIsClaimingWeek] = useState<number | null>(null);
  const [isClaimingAll, setIsClaimingAll] = useState(false);

  const rewardsKernel = useRewardsKernel(
    walletClient || undefined,
    publicClient || undefined,
    CHAIN_ID
  );

  // Helper to build claim parameters from rewards data
  const buildClaimParams = useCallback(
    async (
      rewards: ClaimableReward[],
      nonce: bigint,
      proof: `0x${string}`[],
      fromAddress: `0x${string}`,
      toAddress: `0x${string}`
    ): Promise<ClaimPayoutParams> => {
      const tokensAndAmounts: TokenAndAmount[] = [];
      const isGuardedToken: boolean[] = [];
      const toCounterfactual: boolean[] = [];

      // Group rewards by currency and sum amounts
      const currencyTotals = new Map<string, bigint>();

      rewards.forEach((reward) => {
        const current = currencyTotals.get(reward.currency) || BigInt(0);
        currencyTotals.set(reward.currency, current + BigInt(reward.amountRaw));
      });

      // Build token arrays
      currencyTotals.forEach((amount, currency) => {
        const tokenAddress = TOKEN_ADDRESSES[currency];
        if (!tokenAddress) {
          throw new Error(`Unknown token: ${currency}`);
        }

        tokensAndAmounts.push({
          token: tokenAddress,
          amount,
        });

        // GLW is a guarded token
        isGuardedToken.push(currency === "GLW");
        // For now, don't use counterfactual addresses
        toCounterfactual.push(false);
      });

      return {
        nonce,
        proof,
        tokensAndAmounts,
        from: fromAddress,
        to: toAddress,
        isGuardedToken,
        toCounterfactual,
      };
    },
    []
  );

  // Claim rewards for a specific week
  const claimWeekRewards = useCallback(
    async (
      week: number,
      rewards: ClaimableReward[],
      nonce: bigint,
      proof: `0x${string}`[],
      fromAddress: `0x${string}`
    ): Promise<string | null> => {
      if (!walletClient?.account?.address) {
        toast.error("Please connect your wallet");
        return null;
      }

      setIsClaimingWeek(week);

      try {
        // Check if already claimed
        const isClaimed = await rewardsKernel.isClaimed(
          walletClient.account.address as `0x${string}`,
          nonce
        );

        if (isClaimed) {
          toast.error(`Week ${week} rewards already claimed`);
          return null;
        }

        // Check if finalized
        const finalized = await rewardsKernel.isFinalized(nonce);
        if (!finalized) {
          toast.error(`Week ${week} rewards not yet finalized`);
          return null;
        }

        // Build claim parameters
        const claimParams = await buildClaimParams(
          rewards,
          nonce,
          proof,
          fromAddress,
          walletClient.account.address as `0x${string}`
        );

        // Execute claim
        const txHash = await rewardsKernel.claimPayout(claimParams);

        toast.success(`Successfully claimed week ${week} rewards`, {
          description: `Transaction: ${txHash.slice(0, 8)}...${txHash.slice(
            -6
          )}`,
        });

        return txHash;
      } catch (error: any) {
        console.error("Claim error:", error);

        // Handle specific errors
        if (error.message?.includes(RewardsKernelError.ALREADY_CLAIMED)) {
          toast.error("These rewards have already been claimed");
        } else if (error.message?.includes(RewardsKernelError.NOT_FINALIZED)) {
          toast.error("These rewards are not yet finalized");
        } else if (error.message?.includes(RewardsKernelError.NONCE_REJECTED)) {
          toast.error("This reward distribution was rejected");
        } else if (error.message?.includes("User rejected")) {
          toast.info("Transaction cancelled");
        } else {
          toast.error("Failed to claim rewards", {
            description: error.message || "Unknown error",
          });
        }

        return null;
      } finally {
        setIsClaimingWeek(null);
      }
    },
    [walletClient, rewardsKernel, buildClaimParams]
  );

  // Claim all available rewards
  const claimAllRewards = useCallback(
    async (
      weeklyData: Array<{
        week: number;
        rewards: ClaimableReward[];
        nonce: bigint;
        proof: `0x${string}`[];
        fromAddress: `0x${string}`;
      }>
    ): Promise<string[]> => {
      if (!walletClient?.account?.address) {
        toast.error("Please connect your wallet");
        return [];
      }

      setIsClaimingAll(true);
      const successfulClaims: string[] = [];
      const failedWeeks: number[] = [];

      try {
        // Process each week sequentially
        for (const weekData of weeklyData) {
          try {
            const txHash = await claimWeekRewards(
              weekData.week,
              weekData.rewards,
              weekData.nonce,
              weekData.proof,
              weekData.fromAddress
            );

            if (txHash) {
              successfulClaims.push(txHash);
            } else {
              failedWeeks.push(weekData.week);
            }
          } catch (error) {
            console.error(`Failed to claim week ${weekData.week}:`, error);
            failedWeeks.push(weekData.week);
          }
        }

        // Show summary
        if (successfulClaims.length > 0 && failedWeeks.length === 0) {
          toast.success(
            `Successfully claimed rewards from ${successfulClaims.length} weeks`
          );
        } else if (successfulClaims.length > 0 && failedWeeks.length > 0) {
          toast.warning(
            `Claimed ${successfulClaims.length} weeks, ${failedWeeks.length} failed`,
            {
              description: `Failed weeks: ${failedWeeks.join(", ")}`,
            }
          );
        } else {
          toast.error("Failed to claim any rewards");
        }

        return successfulClaims;
      } finally {
        setIsClaimingAll(false);
      }
    },
    [walletClient, claimWeekRewards]
  );

  // Check if rewards have been claimed
  const checkIfClaimed = useCallback(
    async (userAddress: `0x${string}`, nonce: bigint): Promise<boolean> => {
      try {
        return await rewardsKernel.isClaimed(userAddress, nonce);
      } catch (error) {
        console.error("Error checking claim status:", error);
        return false;
      }
    },
    [rewardsKernel]
  );

  // Check if nonce is finalized
  const isFinalized = useCallback(
    async (nonce: bigint): Promise<boolean> => {
      try {
        return await rewardsKernel.isFinalized(nonce);
      } catch (error) {
        console.error("Error checking finalization:", error);
        return false;
      }
    },
    [rewardsKernel]
  );

  return {
    claimWeekRewards,
    claimAllRewards,
    isClaimingWeek,
    isClaimingAll,
    checkIfClaimed,
    isFinalized,
  };
}
