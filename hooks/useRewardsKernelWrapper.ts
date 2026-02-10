"use client";

import React from "react";
import { useCallback, useState } from "react";
import { useWalletClient, usePublicClient } from "wagmi";
import { toast } from "sonner";
import { getContract } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRewardsKernel,
  type ClaimPayoutParams,
  type TokenAndAmount,
  RewardsKernelError,
  getAddresses,
} from "@glowlabs-org/utils/browser";
import { MinerPoolAndGCAABI } from "@glowlabs-org/guarded-launch-abis";
import { addresses } from "@/web3/constants/addresses";
import type { ClaimableReward } from "./control-wallets";
import * as Sentry from "@sentry/nextjs";
import { getSmartAccountStatus } from "@/web3/web3/utils/detectSmartAccount";
import {
  DEFAULT_WALLET_CLAIMS_LIMIT,
  fetchWalletRewardClaimsIndex,
  type WalletRewardClaimsIndex,
} from "@/lib/api/wallet-reward-claims-index";

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

const POSITIONS_API_BASE =
  process.env.NEXT_PUBLIC_POSITIONS_API_BASE || "http://localhost:42069";

export type ClaimStage = "inflation" | "protocolDeposits";

export type ClaimStageStatus =
  | "pending"
  | "inProgress"
  | "success"
  | "skipped"
  | "error";

export interface ClaimProgressUpdate {
  stage: ClaimStage;
  status: ClaimStageStatus;
  txHash?: string | null;
  message?: string;
}

export interface ClaimWeekRewardsOptions {
  onProgress?: (update: ClaimProgressUpdate) => void;
}

type ClaimAttemptResult =
  | {
      status: "success";
      txHash: string;
      message?: string;
    }
  | {
      status: "skipped";
      txHash?: string;
      message?: string;
    }
  | {
      status: "error";
      txHash?: string;
      message?: string;
    };

export interface UseRewardsKernelWrapperResult {
  claimWeekRewards: (
    week: number,
    rewards: ClaimableReward[],
    nonce: bigint,
    v1Proof: `0x${string}`[],
    v2Proof: `0x${string}`[],
    fromAddress: `0x${string}`,
    glwWeight?: string,
    onchainAssetsEarned?: Array<{
      asset: string;
      assetAddress: `0x${string}`;
      amount: string;
    }>,
    options?: ClaimWeekRewardsOptions
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
      onchainAssetsEarned?: Array<{
        asset: string;
        assetAddress: `0x${string}`;
        amount: string;
      }>;
    }>
  ) => Promise<string[]>;
  isClaimingWeek: number | null;
  isClaimingAll: boolean;
  checkIfClaimed: (
    userAddress: `0x${string}`,
    nonce: bigint
  ) => Promise<boolean>;
  isFinalized: (nonce: bigint) => Promise<boolean>;
  checkIfGlwClaimed: (
    week: number,
    userAddress: `0x${string}`
  ) => Promise<boolean>;
  checkSmartAccount: () => Promise<boolean>;
}

function asLowerHexAddress(value: `0x${string}`): `0x${string}` {
  return value.toLowerCase() as `0x${string}`;
}

export function useRewardsKernelWrapper(): UseRewardsKernelWrapperResult {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [isClaimingWeek, setIsClaimingWeek] = useState<number | null>(null);
  const [isClaimingAll, setIsClaimingAll] = useState(false);

  const rewardsKernel = useRewardsKernel(
    walletClient || undefined,
    publicClient || undefined,
    CHAIN_ID
  );

  // MinerPoolAndGCA contract (read-only; does not require a connected wallet)
  const minerPoolReadContract = React.useMemo(() => {
    if (!publicClient) return null;
    return getContract({
      address: addresses.gcaAndMinerPoolContract as `0x${string}`,
      abi: MinerPoolAndGCAABI,
      client: { public: publicClient },
    });
  }, [publicClient]);

  // MinerPoolAndGCA contract (write-enabled; requires connected wallet)
  const minerPoolWriteContract = React.useMemo(() => {
    if (!publicClient || !walletClient) return null;
    return getContract({
      address: addresses.gcaAndMinerPoolContract as `0x${string}`,
      abi: MinerPoolAndGCAABI,
      client: { wallet: walletClient, public: publicClient },
    });
  }, [publicClient, walletClient]);

  const getWalletClaimIndex = useCallback(
    async (walletAddress: `0x${string}`) => {
      const addressLower = asLowerHexAddress(walletAddress);
      const queryKey = [
        "wallet-reward-claims-index",
        CHAIN_ID,
        addressLower,
        DEFAULT_WALLET_CLAIMS_LIMIT,
      ] as const;

      const cached =
        queryClient.getQueryData<WalletRewardClaimsIndex>(queryKey);
      if (cached) return cached;

      return await queryClient.fetchQuery({
        queryKey,
        queryFn: () =>
          fetchWalletRewardClaimsIndex({
            walletAddress: addressLower,
            limit: DEFAULT_WALLET_CLAIMS_LIMIT,
            baseUrl: POSITIONS_API_BASE,
          }),
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: 1,
      });
    },
    [queryClient]
  );

  // Helper to build claim parameters from onchain assets earned
  const buildClaimParams = useCallback(
    async (
      onchainAssetsEarned: Array<{
        asset: string;
        assetAddress: `0x${string}`;
        amount: string;
      }>,
      nonce: bigint,
      proof: `0x${string}`[],
      fromAddress: `0x${string}`,
      toAddress: `0x${string}`
    ): Promise<ClaimPayoutParams> => {
      const tokensAndAmounts: TokenAndAmount[] = [];
      const isGuardedToken: boolean[] = [];
      const toCounterfactual: boolean[] = [];

      // Use onchainAssetsEarned directly to ensure we include ALL tokens,
      // even those with amount "0" (required for merkle proof verification)
      onchainAssetsEarned.forEach((asset) => {
        tokensAndAmounts.push({
          token: asset.assetAddress,
          amount: BigInt(asset.amount),
        });

        // GLW and USDG are guarded tokens
        isGuardedToken.push(asset.asset === "GLW" || asset.asset === "USDG");
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
    ): Promise<ClaimAttemptResult> => {
      if (!minerPoolWriteContract) {
        toast.error("Contract not available");
        return { status: "error", message: "Contract not available" };
      }

      const bucketWeek = week + 1;
      const bucketId = BigInt(bucketWeek);
      const captureInflationError = (
        errorToCapture: unknown,
        extra?: Record<string, unknown>
      ) => {
        if (typeof window === "undefined") return;
        const normalizedError =
          errorToCapture instanceof Error
            ? errorToCapture
            : new Error(
                typeof errorToCapture === "string"
                  ? errorToCapture
                  : "GLW emission rewards claim error"
              );
        Sentry.captureException(normalizedError, {
          tags: {
            claimStage: "inflation",
          },
          extra: {
            requestedWeek: week,
            bucketWeek,
            bucketId: bucketId.toString(),
            userAddress,
            glwWeight,
            proofLength: v1Proof.length,
            proofPreview: v1Proof.slice(0, Math.min(2, v1Proof.length)),
            ...(extra ?? {}),
          },
        });
      };

      try {
        // Check if already claimed
        const bitmap = (await minerPoolWriteContract.read.bucketClaimBitmap([
          bucketId,
          userAddress,
        ])) as bigint;
        const alreadyClaimed =
          (bitmap & (BigInt(1) << BigInt(bucketWeek % 256))) > BigInt(0);

        if (alreadyClaimed) {
          return {
            status: "skipped",
            message: "Emission rewards already claimed",
          };
        }

        // Check if bucket is finalized
        const isFinalized = await minerPoolWriteContract.read.isBucketFinalized(
          [bucketId]
        );
        if (!isFinalized) {
          toast.error(`Week ${week} not yet finalized for GLW claims`);
          return {
            status: "error",
            message: "GLW rewards not yet finalized",
          };
        }

        // Simulate to detect reverts before submitting the transaction
        try {
          await minerPoolWriteContract.simulate.claimRewardFromBucket(
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
            return {
              status: "skipped",
              message: "Emission rewards already claimed",
            };
          } else if (simMessage.includes("BucketNotFinalized")) {
            toast.error("GLW rewards not yet finalized");
            captureInflationError(simError, {
              phase: "simulate",
              simMessage,
            });
            return {
              status: "error",
              message: "GLW rewards not yet finalized",
            };
          } else if (simMessage.includes("InvalidProof")) {
            toast.error("Invalid proof for GLW claim");
            captureInflationError(simError, {
              phase: "simulate",
              simMessage,
            });
            return {
              status: "error",
              message: "Invalid proof for GLW claim",
            };
          } else if (simMessage.includes("User rejected")) {
            toast.info("Transaction cancelled");
            return { status: "error", message: "Transaction cancelled" };
          } else {
            toast.error("Failed to simulate GLW emission rewards claim", {
              description: simMessage || "Unknown error",
            });
            captureInflationError(simError, {
              phase: "simulate",
              simMessage,
            });
            return {
              status: "error",
              message: simMessage || "Failed to simulate GLW claim",
            };
          }
        }

        // Execute claim (bucketId, glwWeight, usdcWeight, proof, index, user, claimFromInflation, signature)
        const txHash = await minerPoolWriteContract.write.claimRewardFromBucket(
          [
            bucketId,
            BigInt(glwWeight),
            BigInt(0), // usdcWeight is always 0 for v2
            v1Proof,
            BigInt(0), // index is always 0 for current reports
            userAddress,
            true, // claimFromInflation
            "0x", // no delegation signature
          ]
        );

        return {
          status: "success",
          txHash,
          message: "Emission rewards claimed",
        };
      } catch (error: any) {
        console.error("GLW emission rewards claim error:", error);
        const errorMessage =
          error?.message ||
          error?.shortMessage ||
          error?.cause?.shortMessage ||
          "Unknown error";

        if (errorMessage.includes("UserAlreadyClaimed")) {
          return {
            status: "skipped",
            message: "Emission rewards already claimed",
          };
        } else if (errorMessage.includes("BucketNotFinalized")) {
          toast.error("GLW rewards not yet finalized");
          captureInflationError(error, {
            phase: "write",
            errorMessage,
          });
          return {
            status: "error",
            message: "GLW rewards not yet finalized",
          };
        } else if (errorMessage.includes("InvalidProof")) {
          toast.error("Invalid proof for GLW claim");
          captureInflationError(error, {
            phase: "write",
            errorMessage,
          });
          return {
            status: "error",
            message: "Invalid proof for GLW claim",
          };
        } else if (errorMessage.includes("User rejected")) {
          toast.info("Transaction cancelled");
          return { status: "error", message: "Transaction cancelled" };
        }

        toast.error("Failed to claim GLW emission rewards", {
          description: errorMessage,
        });
        captureInflationError(error, {
          phase: "write",
          errorMessage,
        });

        return {
          status: "error",
          message: errorMessage,
        };
      }
    },
    [minerPoolWriteContract]
  );

  // Claim protocol deposit rewards from RewardsKernel contract
  const claimProtocolDeposits = useCallback(
    async (
      week: number,
      onchainAssetsEarned: Array<{
        asset: string;
        assetAddress: `0x${string}`;
        amount: string;
      }>,
      nonce: bigint,
      v2Proof: `0x${string}`[],
      fromAddress: `0x${string}`,
      toAddress: `0x${string}`
    ): Promise<ClaimAttemptResult> => {
      if (onchainAssetsEarned.length === 0) {
        return {
          status: "skipped",
          message: "No protocol deposit rewards available",
        };
      }

      try {
        // Check if already claimed
        const isClaimed = await rewardsKernel.isClaimed(toAddress, nonce);
        if (isClaimed) {
          return {
            status: "skipped",
            message: "Protocol deposit rewards already claimed",
          };
        }

        // Check if finalized
        const finalized = await rewardsKernel.isFinalized(nonce);
        if (!finalized) {
          toast.error(`Week ${week} protocol deposits not yet finalized`);
          return {
            status: "error",
            message: "Protocol deposits not yet finalized",
          };
        }

        // Build claim parameters from onchain assets
        const claimParams = await buildClaimParams(
          onchainAssetsEarned,
          nonce,
          v2Proof,
          fromAddress,
          toAddress
        );

        // Execute claim
        const txHash = await rewardsKernel.claimPayout(claimParams);
        return {
          status: "success",
          txHash,
          message: "Protocol deposit rewards claimed",
        };
      } catch (error: any) {
        console.error("Protocol deposit claim error:", error);
        const errorMessage =
          error?.message ||
          error?.shortMessage ||
          error?.cause?.shortMessage ||
          error?.cause?.message ||
          "Unknown error";

        if (errorMessage.includes(RewardsKernelError.ALREADY_CLAIMED)) {
          return {
            status: "skipped",
            message: "Protocol deposit rewards already claimed",
          };
        } else if (errorMessage.includes(RewardsKernelError.NOT_FINALIZED)) {
          toast.error("Protocol deposits not yet finalized");
          return {
            status: "error",
            message: "Protocol deposits not yet finalized",
          };
        } else if (errorMessage.includes(RewardsKernelError.NONCE_REJECTED)) {
          toast.error("This reward distribution was rejected");
          return {
            status: "error",
            message: "This reward distribution was rejected",
          };
        } else if (errorMessage.includes("User rejected")) {
          toast.info("Transaction cancelled");
          return { status: "error", message: "Transaction cancelled" };
        } else if (/device disconnected during action/i.test(errorMessage)) {
          toast.error("Wallet disconnected", {
            description: "Reconnect your wallet/device and try again.",
          });
          return {
            status: "error",
            message: "Wallet disconnected. Please reconnect and try again.",
          };
        }

        toast.error("Failed to claim protocol deposits", {
          description: errorMessage,
        });

        return {
          status: "error",
          message: errorMessage,
        };
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
      glwWeight?: string,
      onchainAssetsEarned?: Array<{
        asset: string;
        assetAddress: `0x${string}`;
        amount: string;
      }>,
      options?: ClaimWeekRewardsOptions
    ): Promise<string | null> => {
      if (!walletClient?.account?.address) {
        toast.error("Please connect your wallet");
        return null;
      }

      setIsClaimingWeek(week);

      const notifyProgress = (update: ClaimProgressUpdate) =>
        options?.onProgress?.(update);

      try {
        const userAddress = walletClient.account.address as `0x${string}`;
        const txHashes: string[] = [];
        let encounteredError = false;

        // Separate GLW inflation from protocol deposits
        const glwInflationRewards = rewards.filter(
          (r) => r.type === "glowInflation"
        );
        const hasProtocolDepositRewards = rewards.some(
          (r) => r.type === "protocolDeposit"
        );

        // Claim GLW inflation if present
        if (glwInflationRewards.length > 0) {
          if (!glwWeight) {
            encounteredError = true;
            notifyProgress({
              stage: "inflation",
              status: "error",
              message: "Missing GLW weight for emission rewards claim",
            });
          } else {
            notifyProgress({
              stage: "inflation",
              status: "inProgress",
            });

            const glwResult = await claimGlwInflation(
              week,
              glwWeight,
              v1Proof,
              userAddress
            );

            if (glwResult.status === "success" && glwResult.txHash) {
              notifyProgress({
                stage: "inflation",
                status: "inProgress",
                txHash: glwResult.txHash,
                message: "Waiting for confirmation",
              });
              try {
                await publicClient?.waitForTransactionReceipt({
                  hash: glwResult.txHash as `0x${string}`,
                  confirmations: 1,
                });
              } catch (error) {
                console.error("Error waiting for GLW receipt:", error);
              }
              notifyProgress({
                stage: "inflation",
                status: "success",
                txHash: glwResult.txHash,
                message: "Transaction confirmed",
              });
              txHashes.push(glwResult.txHash);
            } else if (glwResult.status === "error") {
              encounteredError = true;
              notifyProgress({
                stage: "inflation",
                status: "error",
                message: glwResult.message,
              });
            } else {
              notifyProgress({
                stage: "inflation",
                status: "skipped",
                message: glwResult.message ?? "No emission rewards this week",
              });
            }
          }
        } else {
          notifyProgress({
            stage: "inflation",
            status: "skipped",
            message: "No emission rewards this week",
          });
        }

        // Claim protocol deposits if present
        // Use onchainAssetsEarned from merkle proof if provided, otherwise skip
        if (hasProtocolDepositRewards && onchainAssetsEarned) {
          notifyProgress({
            stage: "protocolDeposits",
            status: "inProgress",
          });

          const pdResult = await claimProtocolDeposits(
            week,
            onchainAssetsEarned,
            nonce,
            v2Proof,
            fromAddress,
            userAddress
          );

          if (pdResult.status === "success" && pdResult.txHash) {
            notifyProgress({
              stage: "protocolDeposits",
              status: "inProgress",
              txHash: pdResult.txHash,
              message: "Waiting for confirmation",
            });
            try {
              await publicClient?.waitForTransactionReceipt({
                hash: pdResult.txHash as `0x${string}`,
                confirmations: 1,
              });
            } catch (error) {
              console.error("Error waiting for PD receipt:", error);
            }
            notifyProgress({
              stage: "protocolDeposits",
              status: "success",
              txHash: pdResult.txHash,
              message: "Transaction confirmed",
            });
            txHashes.push(pdResult.txHash);
          } else if (pdResult.status === "error") {
            encounteredError = true;
            notifyProgress({
              stage: "protocolDeposits",
              status: "error",
              message: pdResult.message,
            });
          } else {
            notifyProgress({
              stage: "protocolDeposits",
              status: "skipped",
              message:
                pdResult.message ?? "No protocol deposit rewards this week",
            });
          }
        } else {
          notifyProgress({
            stage: "protocolDeposits",
            status: "skipped",
            message: "No protocol deposit rewards this week",
          });
        }

        if (txHashes.length > 0) {
          toast.success(`Successfully claimed week ${week} rewards`, {
            description: `${txHashes.length} transaction(s) completed`,
          });
          return txHashes[0]; // Return first tx hash for compatibility
        }

        if (!encounteredError) {
          toast.info(`Week ${week} rewards already claimed or unavailable`);
        }

        return null;
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
    [walletClient, publicClient, claimGlwInflation, claimProtocolDeposits]
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
        onchainAssetsEarned?: Array<{
          asset: string;
          assetAddress: `0x${string}`;
          amount: string;
        }>;
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
              weekData.glwWeight,
              weekData.onchainAssetsEarned
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
      const addressLower = asLowerHexAddress(userAddress);
      const nonceStr = nonce.toString();

      try {
        const idx = await getWalletClaimIndex(addressLower);
        if (idx.indexingComplete) return idx.claimedV2Nonces.has(nonceStr);
      } catch (error) {
        console.error("Error checking claim status via API:", error);
      }

      try {
        return await rewardsKernel.isClaimed(addressLower, nonce);
      } catch (error) {
        console.error("Error checking claim status:", error);
        return false;
      }
    },
    [getWalletClaimIndex, rewardsKernel]
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

  // Check if GLW inflation is claimed for a specific week
  const checkIfGlwClaimed = useCallback(
    async (week: number, userAddress: `0x${string}`): Promise<boolean> => {
      const addressLower = asLowerHexAddress(userAddress);
      const bucketWeekStr = BigInt(week).toString();

      try {
        const idx = await getWalletClaimIndex(addressLower);
        if (idx.indexingComplete && idx.hasMinerPoolBucketIds) {
          return idx.claimedV1Buckets.has(bucketWeekStr);
        }
      } catch (error) {
        console.error("Error checking GLW claim status via API:", error);
      }

      if (!minerPoolReadContract) return false;

      try {
        const bucketId = BigInt(week);
        const bitmap = (await minerPoolReadContract.read.bucketClaimBitmap([
          bucketId,
          addressLower,
        ])) as bigint;
        return (bitmap & (BigInt(1) << BigInt(week % 256))) > BigInt(0);
      } catch (error) {
        console.error("Error checking GLW claim status:", error);
        return false;
      }
    },
    [getWalletClaimIndex, minerPoolReadContract]
  );

  // Check if the connected wallet is a smart account
  const checkSmartAccount = useCallback(async (): Promise<boolean> => {
    if (!walletClient?.account?.address) {
      return false;
    }

    try {
      const status = await getSmartAccountStatus({
        address: walletClient.account.address,
        walletClient,
        getBytecode: publicClient?.getBytecode,
      });

      return (
        status.isEip7702Delegated ||
        status.hasWalletAABatching ||
        status.isContractWallet
      );
    } catch (error) {
      console.error("Error checking smart account status:", error);
      return false;
    }
  }, [walletClient, publicClient]);

  return {
    claimWeekRewards,
    claimAllRewards,
    isClaimingWeek,
    isClaimingAll,
    checkIfClaimed,
    isFinalized,
    checkIfGlwClaimed,
    checkSmartAccount,
  };
}
