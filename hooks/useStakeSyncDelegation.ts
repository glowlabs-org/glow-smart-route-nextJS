// sGCTL stake-sync + delegation-with-retry for the deposit dialog. Polls the
// region's available staked GCTL until the freshly-minted/staked balance
// indexes, then submits the signed delegation, retrying on insufficient-stake.
// Extracted verbatim from deposit-dialog.tsx (behavior-preserving).
import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchWalletRegionAvailableStake } from "@/hooks/control-wallets";
import { getControlRouter } from "@/lib/api/control-routers";
import { QUERY_KEYS } from "@/hooks/query-keys";
import type { StepStatus } from "@/components/transaction-stepper";
import {
  getErrorMessage,
  isRetriableStakeSyncRefreshError,
  parseAvailableStakeSnapshot,
  type DepositSelectedCurrency,
  type SgctlSourceMode,
} from "../app/marketplace/deposit-dialog-utils";

function isInsufficientAvailableStakedError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.includes("Insufficient available staked GCTL in region");
}


export function useStakeSyncDelegation({
  runtimeSelectedCurrency,
  address,
  regionId,
  invalidateGctlQueries,
  refetchAvailableStake,
  refetchWalletDetails,
  dd,
  updateStepStatus,
}: {
  runtimeSelectedCurrency: DepositSelectedCurrency;
  address: `0x${string}` | undefined;
  regionId: number | null;
  invalidateGctlQueries: () => unknown;
  refetchAvailableStake: () => Promise<unknown>;
  refetchWalletDetails: () => Promise<unknown>;
  dd: { stakeSyncUnableToVerify: string; stakeSyncBalanceUpdating: string };
  updateStepStatus: (
    stepId: string,
    status: StepStatus,
    extras?: {
      txHash?: string;
      errorMessage?: string;
      deactivateStepIds?: string[];
      clearStartedAt?: boolean;
    },
  ) => void;
}) {
  const queryClient = useQueryClient();

  const fetchFreshAvailableStake = React.useCallback(async () => {
    if (!address || !regionId) return null;
    const payload = await fetchWalletRegionAvailableStake(address, regionId);
    return parseAvailableStakeSnapshot(payload);
  }, [address, regionId]);

  const waitForStakeSyncBeforeDelegation = React.useCallback(
    async (requiredAmount: bigint) => {
      if (
        runtimeSelectedCurrency !== "SGCTL" ||
        !address ||
        !regionId ||
        requiredAmount <= 0n
      ) {
        return;
      }

      // The first 30s are usually spent waiting on block confirmation, so
      // front-loading 1s polling just burns requests. Use a staged schedule:
      // 0-30s: every 10s, 30-60s: every 5s, 60-90s: every 2s.
      const pollDelaysMs = [
        ...Array(3).fill(10_000),
        ...Array(6).fill(5_000),
        ...Array(15).fill(2_000),
      ];
      let hasFreshStakeRead = false;
      let lastRetriableError: unknown = null;
      let lastAvailableStake = 0n;

      await invalidateGctlQueries();
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.wallets.details(address),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.wallets.availableStake(address, regionId),
      });

      for (let attempt = 0; attempt <= pollDelaysMs.length; attempt += 1) {
        const [freshRegionStakeResult] = await Promise.allSettled([
          fetchFreshAvailableStake(),
          refetchAvailableStake().catch(() => null),
          refetchWalletDetails().catch(() => null),
        ]);

        if (freshRegionStakeResult.status === "fulfilled") {
          const freshRegionStake = freshRegionStakeResult.value;
          hasFreshStakeRead = true;
          lastAvailableStake = freshRegionStake?.availableStakedGctl ?? 0n;

          if (lastAvailableStake >= requiredAmount) {
            return;
          }
        } else if (
          isRetriableStakeSyncRefreshError(freshRegionStakeResult.reason)
        ) {
          lastRetriableError = freshRegionStakeResult.reason;
        } else {
          throw freshRegionStakeResult.reason;
        }

        if (attempt < pollDelaysMs.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, pollDelaysMs[attempt]),
          );
        }
      }

      if (!hasFreshStakeRead && lastRetriableError) {
        throw new Error(dd.stakeSyncUnableToVerify);
      }

      throw new Error(dd.stakeSyncBalanceUpdating);
    },
    [
      address,
      dd,
      fetchFreshAvailableStake,
      invalidateGctlQueries,
      queryClient,
      refetchAvailableStake,
      refetchWalletDetails,
      regionId,
      runtimeSelectedCurrency,
    ],
  );

  const delegateSgctlWithRetry = React.useCallback(
    async (params: {
      applicationId: string;
      fractionId: string;
      amount: bigint;
      signature: string;
      deadline: string;
      nonce: string;
      sourceMode: SgctlSourceMode | null;
    }) => {
      const maxAttempts = params.sourceMode === "staked" ? 1 : 3;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          return await getControlRouter().delegateSgctl({
            wallet: address as string,
            applicationId: params.applicationId,
            fractionId: params.fractionId,
            amount: params.amount.toString(),
            signature: params.signature,
            deadline: params.deadline,
            nonce: params.nonce,
          });
        } catch (error) {
          const shouldRetry =
            attempt < maxAttempts - 1 &&
            isInsufficientAvailableStakedError(error) &&
            params.sourceMode !== "staked";

          if (!shouldRetry) {
            throw error;
          }

          updateStepStatus("INDEX_STAKE", "confirming", {
            deactivateStepIds: ["DELEGATE_SGCTL"],
          });
          await waitForStakeSyncBeforeDelegation(params.amount);
          updateStepStatus("INDEX_STAKE", "completed");
          updateStepStatus("DELEGATE_SGCTL", "confirming");
        }
      }

      throw new Error("Failed to delegate SGCTL after stake sync retries.");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateStepStatus kept out of deps to preserve the original component-scope memoization (behavior-preserving extraction)
    [address, waitForStakeSyncBeforeDelegation],
  );

  return { waitForStakeSyncBeforeDelegation, delegateSgctlWithRetry };
}
