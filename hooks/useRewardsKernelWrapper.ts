"use client";

import { useCallback, useState } from "react";
import { useWalletClient, usePublicClient } from "wagmi";
import { toast } from "sonner";
import { getContract } from "viem";
import {
  useRewardsKernel,
  type ClaimPayoutParams,
  type TokenAndAmount,
  RewardsKernelError,
  getAddresses,
} from "@glowlabs-org/utils/browser";
import { MinerPoolAndGCAABI } from "@glowlabs-org/guarded-launch-abis";
import { addresses } from "@/web3/constants/addresses";
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
    v1Proof: `0x${string}`[],
    v2Proof: `0x${string}`[],
    fromAddress: `0x${string}`,
    glwWeight?: string
  ) => Promise<string | null>;
  claimAllRewards: (
    weeklyData: Array<{
      week: number;
      rewards: ClaimableReward[];
      nonce: bigint;
      v1Proof: `0x${string}`[];
      v2Proof: `0x${string}`[];
      fromAddress: `0x${string}`;
      glwWeight?: string;
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

  // MinerPoolAndGCA contract for GLW inflation claims
  const minerPoolContract =
    publicClient && walletClient
      ? getContract({
          address: addresses.gcaAndMinerPoolContract as `0x${string}`,
          abi: MinerPoolAndGCAABI,
          client: { wallet: walletClient, public: publicClient },
        })
      : null;

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

  // Claim GLW inflation rewards from MinerPoolAndGCA contract
  const claimGlwInflation = useCallback(
    async (
      week: number,
      glwWeight: string,
      v1Proof: `0x${string}`[],
      userAddress: `0x${string}`
    ): Promise<string | null> => {
      if (!minerPoolContract) {
        toast.error("Contract not available");
        return null;
      }

      try {
        const bucketId = BigInt(week);

        // Check if already claimed
        const bitmap = (await minerPoolContract.read.bucketClaimBitmap([
          bucketId,
          userAddress,
        ])) as bigint;
        const alreadyClaimed =
          (bitmap & (BigInt(1) << BigInt(week % 256))) > BigInt(0);

        if (alreadyClaimed) {
          return null; // Silently skip already claimed
        }

        // Check if bucket is finalized
        const isFinalized = await minerPoolContract.read.isBucketFinalized([
          bucketId,
        ]);
        if (!isFinalized) {
          toast.error(`Week ${week} not yet finalized for GLW claims`);
          return null;
        }

        // Simulate to detect reverts before submitting the transaction
        try {
          await minerPoolContract.simulate.claimRewardFromBucket(
            [
              bucketId,
              BigInt(glwWeight),
              BigInt(0), // usdcWeight is always 0 for v2
              v1Proof,
              BigInt(0), // index is always 0 for current reports
              userAddress,
              true, // claimFromInflation
              "0x", // no delegation signature
            ],
            { account: userAddress }
          );
        } catch (simError: any) {
          const simMessage =
            simError?.message ||
            simError?.shortMessage ||
            simError?.cause?.shortMessage ||
            "";

          if (simMessage.includes("UserAlreadyClaimed")) {
            return null; // Silently skip
          } else if (simMessage.includes("BucketNotFinalized")) {
            toast.error("GLW rewards not yet finalized");
          } else if (simMessage.includes("InvalidProof")) {
            toast.error("Invalid proof for GLW claim");
          } else if (simMessage.includes("User rejected")) {
            toast.info("Transaction cancelled");
          } else {
            toast.error("Failed to simulate GLW inflation claim", {
              description: simMessage || "Unknown error",
            });
          }
          return null;
        }

        // Execute claim (bucketId, glwWeight, usdcWeight, proof, index, user, claimFromInflation, signature)
        const txHash = await minerPoolContract.write.claimRewardFromBucket([
          bucketId,
          BigInt(glwWeight),
          BigInt(0), // usdcWeight is always 0 for v2
          v1Proof,
          BigInt(0), // index is always 0 for current reports
          userAddress,
          true, // claimFromInflation
          "0x", // no delegation signature
        ]);

        return txHash;
      } catch (error: any) {
        console.error("GLW inflation claim error:", error);

        if (error.message?.includes("UserAlreadyClaimed")) {
          return null; // Silently skip
        } else if (error.message?.includes("BucketNotFinalized")) {
          toast.error("GLW rewards not yet finalized");
        } else if (error.message?.includes("InvalidProof")) {
          toast.error("Invalid proof for GLW claim");
        } else if (error.message?.includes("User rejected")) {
          toast.info("Transaction cancelled");
        } else {
          toast.error("Failed to claim GLW inflation", {
            description: error.message || "Unknown error",
          });
        }

        return null;
      }
    },
    [minerPoolContract]
  );

  // Claim protocol deposit rewards from RewardsKernel contract
  const claimProtocolDeposits = useCallback(
    async (
      week: number,
      rewards: ClaimableReward[],
      nonce: bigint,
      v2Proof: `0x${string}`[],
      fromAddress: `0x${string}`,
      toAddress: `0x${string}`
    ): Promise<string | null> => {
      if (rewards.length === 0) return null;

      try {
        // Check if already claimed
        const isClaimed = await rewardsKernel.isClaimed(toAddress, nonce);
        if (isClaimed) {
          return null; // Silently skip already claimed
        }

        // Check if finalized
        const finalized = await rewardsKernel.isFinalized(nonce);
        if (!finalized) {
          toast.error(`Week ${week} protocol deposits not yet finalized`);
          return null;
        }

        // Build claim parameters
        const claimParams = await buildClaimParams(
          rewards,
          nonce,
          v2Proof,
          fromAddress,
          toAddress
        );

        // Execute claim
        const txHash = await rewardsKernel.claimPayout(claimParams);
        return txHash;
      } catch (error: any) {
        console.error("Protocol deposit claim error:", error);

        if (error.message?.includes(RewardsKernelError.ALREADY_CLAIMED)) {
          return null; // Silently skip
        } else if (error.message?.includes(RewardsKernelError.NOT_FINALIZED)) {
          toast.error("Protocol deposits not yet finalized");
        } else if (error.message?.includes(RewardsKernelError.NONCE_REJECTED)) {
          toast.error("This reward distribution was rejected");
        } else if (error.message?.includes("User rejected")) {
          toast.info("Transaction cancelled");
        } else {
          toast.error("Failed to claim protocol deposits", {
            description: error.message || "Unknown error",
          });
        }

        return null;
      }
    },
    [rewardsKernel, buildClaimParams]
  );

  // Claim rewards for a specific week (handles both GLW inflation and protocol deposits)
  const claimWeekRewards = useCallback(
    async (
      week: number,
      rewards: ClaimableReward[],
      nonce: bigint,
      v1Proof: `0x${string}`[],
      v2Proof: `0x${string}`[],
      fromAddress: `0x${string}`,
      glwWeight?: string
    ): Promise<string | null> => {
      if (!walletClient?.account?.address) {
        toast.error("Please connect your wallet");
        return null;
      }

      setIsClaimingWeek(week);

      try {
        const userAddress = walletClient.account.address as `0x${string}`;
        const txHashes: string[] = [];

        // Separate GLW inflation from protocol deposits
        const glwInflationRewards = rewards.filter(
          (r) => r.type === "glowInflation"
        );
        const protocolDepositRewards = rewards.filter(
          (r) => r.type === "protocolDeposit"
        );

        // Claim GLW inflation if present
        if (glwInflationRewards.length > 0 && glwWeight) {
          const glwTxHash = await claimGlwInflation(
            week,
            glwWeight,
            v1Proof,
            userAddress
          );
          if (glwTxHash) txHashes.push(glwTxHash);
        }

        // Claim protocol deposits if present
        if (protocolDepositRewards.length > 0) {
          const pdTxHash = await claimProtocolDeposits(
            week,
            protocolDepositRewards,
            nonce,
            v2Proof,
            fromAddress,
            userAddress
          );
          if (pdTxHash) txHashes.push(pdTxHash);
        }

        if (txHashes.length > 0) {
          toast.success(`Successfully claimed week ${week} rewards`, {
            description: `${txHashes.length} transaction(s) completed`,
          });
          return txHashes[0]; // Return first tx hash for compatibility
        } else {
          toast.info(`Week ${week} rewards already claimed or unavailable`);
          return null;
        }
      } catch (error: any) {
        console.error("Claim error:", error);
        toast.error("Failed to claim rewards", {
          description: error.message || "Unknown error",
        });
        return null;
      } finally {
        setIsClaimingWeek(null);
      }
    },
    [walletClient, claimGlwInflation, claimProtocolDeposits]
  );

  // Claim all available rewards
  const claimAllRewards = useCallback(
    async (
      weeklyData: Array<{
        week: number;
        rewards: ClaimableReward[];
        nonce: bigint;
        v1Proof: `0x${string}`[];
        v2Proof: `0x${string}`[];
        fromAddress: `0x${string}`;
        glwWeight?: string;
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
              weekData.v1Proof,
              weekData.v2Proof,
              weekData.fromAddress,
              weekData.glwWeight
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
