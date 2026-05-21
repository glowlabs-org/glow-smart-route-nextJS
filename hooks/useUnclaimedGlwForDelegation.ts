"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useClaimableRewards } from "@/hooks/control-wallets";
import {
  DEFAULT_WALLET_CLAIMS_LIMIT,
  buildWalletRewardClaimsIndex,
  fetchWalletRewardClaims,
  walletRewardClaimsQueryKey,
} from "@/lib/api/wallet-reward-claims-index";
import { weekToNonce } from "@/hooks/useMerkleProofs";
import type { ClaimableGlwItem } from "@/app/marketplace/deposit-dialog-utils";

const POSITIONS_API_BASE =
  process.env.NEXT_PUBLIC_POSITIONS_API_BASE || "http://localhost:42069";

export interface UseUnclaimedGlwForDelegationResult {
  totalGlwWei: bigint;
  items: ClaimableGlwItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Aggregates the GLW the connected wallet could deliver into a delegation
 * by claiming unclaimed inflation weeks plus PD weeks paid in GLW.
 *
 * Pure data: no proofs are fetched here. The submission flow fetches
 * per-week merkle proofs only for the selected subset.
 */
export function useUnclaimedGlwForDelegation(
  walletAddress?: string,
): UseUnclaimedGlwForDelegationResult {
  const normalizedAddress = walletAddress?.toLowerCase();
  const claimable = useClaimableRewards(walletAddress);

  const claimsIndexQuery = useQuery({
    queryKey: normalizedAddress
      ? walletRewardClaimsQueryKey(
          normalizedAddress,
          DEFAULT_WALLET_CLAIMS_LIMIT,
        )
      : (["wallet-reward-claims", "disabled"] as const),
    queryFn: async () => {
      if (!normalizedAddress) throw new Error("walletAddress is required");
      return fetchWalletRewardClaims({
        walletAddress: normalizedAddress as `0x${string}`,
        limit: DEFAULT_WALLET_CLAIMS_LIMIT,
        baseUrl: POSITIONS_API_BASE,
      });
    },
    enabled: Boolean(normalizedAddress),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });

  const items = React.useMemo<ClaimableGlwItem[]>(() => {
    if (!claimable.weeklyBreakdown.length) return [];
    const index = claimsIndexQuery.data
      ? buildWalletRewardClaimsIndex(claimsIndexQuery.data)
      : null;

    const result: ClaimableGlwItem[] = [];
    for (const week of claimable.weeklyBreakdown) {
      if (!week.isFinalized) continue;

      let v2Nonce: string | null = null;
      try {
        v2Nonce = weekToNonce(week.week).toString();
      } catch {
        continue;
      }
      // The minerPool v1 bucket id is week + 1 (see useRewardsKernelWrapper's
      // claim path and checkIfGlwClaimed, which queries claimedV1Buckets with
      // week + 1). Without the +1 the already-claimed lookup never matches and
      // every finalized inflation week is mis-counted as still claimable.
      const v1Bucket = BigInt(week.week + 1).toString();

      const pdAlreadyClaimed = Boolean(
        index?.indexingComplete && index.claimedV2Nonces.has(v2Nonce),
      );
      const inflationAlreadyClaimed = Boolean(
        index?.indexingComplete &&
          index.hasMinerPoolBucketIds &&
          index.claimedV1Buckets.has(v1Bucket),
      );

      if (!inflationAlreadyClaimed) {
        const inflationReward = week.rewards.find(
          (r) => r.type === "glowInflation",
        );
        if (inflationReward && inflationReward.amountRaw !== "0") {
          try {
            result.push({
              week: week.week,
              source: "glowInflation",
              glwAmountWei: BigInt(inflationReward.amountRaw),
            });
          } catch {
            // Skip malformed amounts rather than crash the dialog.
          }
        }
      }

      if (!pdAlreadyClaimed) {
        const pdGlwReward = week.rewards.find(
          (r) => r.type === "protocolDeposit" && r.currency === "GLW",
        );
        if (pdGlwReward && pdGlwReward.amountRaw !== "0") {
          try {
            result.push({
              week: week.week,
              source: "protocolDeposit",
              glwAmountWei: BigInt(pdGlwReward.amountRaw),
            });
          } catch {
            // Skip malformed amounts.
          }
        }
      }
    }
    return result;
  }, [claimable.weeklyBreakdown, claimsIndexQuery.data]);

  const totalGlwWei = React.useMemo(() => {
    let sum = 0n;
    for (const item of items) sum += item.glwAmountWei;
    return sum;
  }, [items]);

  const refetch = React.useCallback(() => {
    claimable.refetch();
    claimsIndexQuery.refetch();
  }, [claimable, claimsIndexQuery]);

  return {
    totalGlwWei,
    items,
    isLoading: claimable.isLoading || claimsIndexQuery.isLoading,
    isError: claimable.isError || claimsIndexQuery.isError,
    refetch,
  };
}
