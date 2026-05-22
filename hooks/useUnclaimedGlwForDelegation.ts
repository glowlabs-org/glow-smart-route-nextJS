"use client";

import * as React from "react";
import { useClaimableRewards } from "@/hooks/control-wallets";
import { useRewardsKernelWrapper } from "@/hooks/useRewardsKernelWrapper";
import { weekToNonce } from "@/hooks/useMerkleProofs";
import type { ClaimableGlwItem } from "@/app/marketplace/deposit-dialog-utils";

export interface UseUnclaimedGlwForDelegationResult {
  totalGlwWei: bigint;
  items: ClaimableGlwItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

interface InflationCandidate {
  week: number;
  glwAmountWei: bigint;
}

interface PdCandidate {
  week: number;
  nonce: bigint;
  glwAmountWei: bigint;
}

/**
 * Aggregates the GLW the connected wallet could deliver into a delegation
 * by claiming unclaimed inflation weeks plus PD weeks paid in GLW.
 *
 * Claimed-status is resolved through `checkIfGlwClaimed` / `checkIfClaimed`,
 * which consult the off-chain claims index and fall back to an on-chain read.
 * That fallback matters: the positions indexer returns a null bucket id for
 * minerPool (inflation) claims, so the index alone never knows which weeks of
 * emissions a wallet already claimed and the pool would over-count every
 * finalized inflation week. The same helpers back the standalone claims panel,
 * keeping the two surfaces consistent.
 *
 * Pure data: no proofs are fetched here. The submission flow fetches
 * per-week merkle proofs only for the selected subset.
 */
export function useUnclaimedGlwForDelegation(
  walletAddress?: string,
): UseUnclaimedGlwForDelegationResult {
  const normalizedAddress = walletAddress?.toLowerCase() as
    | `0x${string}`
    | undefined;
  const claimable = useClaimableRewards(walletAddress);
  const { checkIfClaimed, checkIfGlwClaimed } = useRewardsKernelWrapper();

  // Finalized weeks that carry GLW-denominated rewards, before filtering out
  // anything already claimed. Memoized so the resolver effect below only
  // re-runs when the underlying reward set actually changes.
  const { inflationCandidates, pdCandidates } = React.useMemo(() => {
    const inflation: InflationCandidate[] = [];
    const pd: PdCandidate[] = [];

    for (const week of claimable.weeklyBreakdown) {
      if (!week.isFinalized) continue;

      let nonce: bigint;
      try {
        nonce = weekToNonce(week.week);
      } catch {
        continue;
      }

      const inflationReward = week.rewards.find(
        (r) => r.type === "glowInflation",
      );
      if (inflationReward && inflationReward.amountRaw !== "0") {
        try {
          inflation.push({
            week: week.week,
            glwAmountWei: BigInt(inflationReward.amountRaw),
          });
        } catch {
          // Skip malformed amounts rather than crash the dialog.
        }
      }

      const pdGlwReward = week.rewards.find(
        (r) => r.type === "protocolDeposit" && r.currency === "GLW",
      );
      if (pdGlwReward && pdGlwReward.amountRaw !== "0") {
        try {
          pd.push({
            week: week.week,
            nonce,
            glwAmountWei: BigInt(pdGlwReward.amountRaw),
          });
        } catch {
          // Skip malformed amounts.
        }
      }
    }

    return { inflationCandidates: inflation, pdCandidates: pd };
  }, [claimable.weeklyBreakdown]);

  const [items, setItems] = React.useState<ClaimableGlwItem[]>([]);
  const [isResolving, setIsResolving] = React.useState(false);
  const [isResolveError, setIsResolveError] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    if (
      !normalizedAddress ||
      (inflationCandidates.length === 0 && pdCandidates.length === 0)
    ) {
      setItems([]);
      setIsResolving(false);
      setIsResolveError(false);
      return;
    }

    setIsResolving(true);
    setIsResolveError(false);

    (async () => {
      try {
        const [inflationClaimed, pdClaimed] = await Promise.all([
          Promise.all(
            inflationCandidates.map((candidate) =>
              // The minerPool v1 bucket id is week + 1.
              checkIfGlwClaimed(candidate.week + 1, normalizedAddress).catch(
                () => false,
              ),
            ),
          ),
          Promise.all(
            pdCandidates.map((candidate) =>
              checkIfClaimed(normalizedAddress, candidate.nonce).catch(
                () => false,
              ),
            ),
          ),
        ]);

        if (cancelled) return;

        const next: ClaimableGlwItem[] = [];
        inflationCandidates.forEach((candidate, idx) => {
          if (!inflationClaimed[idx]) {
            next.push({
              week: candidate.week,
              source: "glowInflation",
              glwAmountWei: candidate.glwAmountWei,
            });
          }
        });
        pdCandidates.forEach((candidate, idx) => {
          if (!pdClaimed[idx]) {
            next.push({
              week: candidate.week,
              source: "protocolDeposit",
              glwAmountWei: candidate.glwAmountWei,
            });
          }
        });

        setItems(next);
        setIsResolving(false);
      } catch (error) {
        if (cancelled) return;
        console.error(
          "Failed to resolve unclaimed GLW for delegation",
          error,
        );
        setItems([]);
        setIsResolving(false);
        setIsResolveError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    normalizedAddress,
    inflationCandidates,
    pdCandidates,
    refreshTick,
    checkIfClaimed,
    checkIfGlwClaimed,
  ]);

  const totalGlwWei = React.useMemo(() => {
    let sum = 0n;
    for (const item of items) sum += item.glwAmountWei;
    return sum;
  }, [items]);

  const refetch = React.useCallback(() => {
    claimable.refetch();
    setRefreshTick((tick) => tick + 1);
  }, [claimable]);

  return {
    totalGlwWei,
    items,
    isLoading: claimable.isLoading || isResolving,
    isError: claimable.isError || isResolveError,
    refetch,
  };
}
