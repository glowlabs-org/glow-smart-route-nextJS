"use client";

import * as React from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import {
  buildStakeMessage,
  stakeControlEIP712Domain,
  stakeEIP712Types,
  type Currency,
  useForwarder,
} from "@glowlabs-org/utils/browser";
import type { StepStatus } from "@/components/transaction-stepper";
import { getControlRouter } from "@/lib/api/control-routers";
import { useGctlApi } from "@/hooks/control-gctl";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";

const DEFAULT_SLIPPAGE_BPS = 100n;
const ETH_QUOTE_PROBE_WEI = 10n ** 17n; // 0.1 ETH
const MAX_APPROVAL_AMOUNT = (1n << 256n) - 1n;

export interface GctlPreparationStepUpdaterExtras {
  errorMessage?: string;
}

export type GctlPreparationStepUpdater = (
  stepId: string,
  status: StepStatus,
  extras?: GctlPreparationStepUpdaterExtras
) => void;

export interface StakeExistingGctlParams {
  regionId: number;
  amountAtomic: bigint;
  stepIds?: {
    sign?: string;
    submit?: string;
    refresh?: string;
  };
  updateStepStatus?: GctlPreparationStepUpdater;
}

export interface MintAndStakeGctlParams {
  regionId: number;
  sourceCurrency: "USDC" | "USDG" | "ETH";
  amountAtomic?: bigint;
  amountInWei?: bigint;
  targetUsdcAmountAtomic?: bigint;
  slippageBps?: bigint;
  approvalAmount?: bigint;
  stepIds?: {
    swapEthToUsdc?: string;
    checkAllowance?: string;
    approve?: string;
    mintAndStake?: string;
  };
  updateStepStatus?: GctlPreparationStepUpdater;
}

function markStep(
  updateStepStatus: GctlPreparationStepUpdater | undefined,
  stepId: string | undefined,
  status: StepStatus,
  extras?: GctlPreparationStepUpdaterExtras
) {
  if (!updateStepStatus || !stepId) return;
  updateStepStatus(stepId, status, extras);
}

export function useGctlPreparationOrchestrator(options?: {
  enabled?: boolean;
}) {
  const { enabled = true } = options ?? {};
  const { address, isConnected } = useAccount();
  const { signer } = useEthersSigner();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID);

  const {
    gctlPriceNumber,
    gctlBalance,
    isGctlBalanceLoading,
    stakeGctlMutation,
    invalidateAllQueries,
    fetchTransferDetails,
  } = useGctlApi(address, { enabled });

  const { estimateEthToUsdc, swapEthToUsdc } = useSwapETHToUSDC();

  const {
    checkTokenAllowance,
    checkTokenBalance,
    approveToken,
    mintGCTLAndStake,
    isProcessing,
  } = useForwarder(
    signer || undefined,
    chainId,
    publicClient,
    walletClient ?? undefined
  );

  const getLatestNonce = React.useCallback(async () => {
    if (!address) throw new Error("Wallet not connected");
    return await getControlRouter().fetchLastNonce(address);
  }, [address]);

  const estimateEthForUsdcTarget = React.useCallback(
    async (targetUsdcAmountAtomic: bigint, slippageBps: bigint) => {
      if (targetUsdcAmountAtomic <= 0n) {
        throw new Error("Invalid USDC amount required for swap");
      }

      const probeRes = await estimateEthToUsdc({
        amountInWei: ETH_QUOTE_PROBE_WEI,
        slippageBps,
      });

      if (!probeRes.ok) {
        throw new Error(String(probeRes.val));
      }
      if (probeRes.val.amountOutUsdc <= 0n) {
        throw new Error("Failed to quote ETH to USDC");
      }

      let amountInWei =
        (ETH_QUOTE_PROBE_WEI * targetUsdcAmountAtomic) /
        probeRes.val.amountOutUsdc;
      amountInWei = (amountInWei * 102n) / 100n;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const refinedRes = await estimateEthToUsdc({
          amountInWei,
          slippageBps,
        });
        if (refinedRes.ok && refinedRes.val.amountOutMinUsdc >= targetUsdcAmountAtomic) {
          return amountInWei;
        }
        amountInWei = (amountInWei * 105n) / 100n;
      }

      return amountInWei;
    },
    [estimateEthToUsdc]
  );

  const stakeExistingGctlToRegion = React.useCallback(
    async (params: StakeExistingGctlParams) => {
      if (!isConnected || !address || !signer) {
        throw new Error("Wallet not connected");
      }
      if (!Number.isFinite(chainId)) {
        throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
      }
      if (params.amountAtomic <= 0n) {
        throw new Error("Invalid GCTL amount");
      }

      const latestNonce = await getLatestNonce();
      const nonce = (Number(latestNonce) + 1).toString();
      const deadline = Math.floor(Date.now() / 1000 + 3600).toString();

      markStep(params.updateStepStatus, params.stepIds?.sign, "waiting_signature");

      const signatureMessage = buildStakeMessage({
        nonce,
        amount: params.amountAtomic.toString(),
        toZoneId: String(params.regionId),
        deadline,
      });

      const eip712Types = stakeEIP712Types as unknown as Record<string, any[]>;
      const signature = await signer.signTypedData(
        stakeControlEIP712Domain(chainId),
        eip712Types,
        signatureMessage
      );

      if (!signature) {
        throw new Error("Failed to sign message");
      }

      markStep(params.updateStepStatus, params.stepIds?.sign, "completed");
      markStep(params.updateStepStatus, params.stepIds?.submit, "confirming");

      await stakeGctlMutation.mutateAsync({
        wallet: address,
        amount: params.amountAtomic.toString(),
        nonce,
        deadline,
        signature,
        regionId: params.regionId,
      });

      markStep(params.updateStepStatus, params.stepIds?.submit, "completed");

      if (params.stepIds?.refresh) {
        markStep(params.updateStepStatus, params.stepIds.refresh, "confirming");
        await invalidateAllQueries();
        markStep(params.updateStepStatus, params.stepIds.refresh, "completed");
      }

      return {
        nonce,
        deadline,
        amountAtomic: params.amountAtomic,
      } as const;
    },
    [
      address,
      chainId,
      getLatestNonce,
      invalidateAllQueries,
      isConnected,
      signer,
      stakeGctlMutation,
    ]
  );

  const mintAndStakeGctlToRegion = React.useCallback(
    async (params: MintAndStakeGctlParams) => {
      if (!isConnected || !address || !signer) {
        throw new Error("Wallet not connected");
      }
      if (!Number.isFinite(chainId)) {
        throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
      }

      const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      let amountAtomic = params.amountAtomic ?? 0n;
      let mintCurrency = params.sourceCurrency as Currency;

      if (params.sourceCurrency === "ETH") {
        const amountInWei =
          params.amountInWei ??
          (params.targetUsdcAmountAtomic
            ? await estimateEthForUsdcTarget(params.targetUsdcAmountAtomic, slippageBps)
            : 0n);

        if (amountInWei <= 0n) {
          throw new Error("Invalid ETH amount");
        }

        markStep(
          params.updateStepStatus,
          params.stepIds?.swapEthToUsdc,
          "confirming"
        );
        const swapResult = await swapEthToUsdc({
          amountInWei,
          slippageBps,
        });
        if (!swapResult.ok) {
          throw new Error(String(swapResult.val));
        }
        if (swapResult.val.usdcReceived <= 0n) {
          throw new Error("ETH swap returned 0 USDC");
        }
        amountAtomic = swapResult.val.usdcReceived;
        mintCurrency = "USDC";
        markStep(
          params.updateStepStatus,
          params.stepIds?.swapEthToUsdc,
          "completed"
        );
      }

      if (amountAtomic <= 0n) {
        throw new Error("Please enter a valid amount.");
      }

      if (params.sourceCurrency !== "ETH") {
        const tokenBalance = await checkTokenBalance(address, mintCurrency);
        if (tokenBalance < amountAtomic) {
          throw new Error("Insufficient balance to complete this transaction.");
        }
      }

      markStep(
        params.updateStepStatus,
        params.stepIds?.checkAllowance,
        "confirming"
      );
      const allowance = await checkTokenAllowance(address, mintCurrency);
      markStep(
        params.updateStepStatus,
        params.stepIds?.checkAllowance,
        "completed"
      );

      const approvalAmount = params.approvalAmount ?? MAX_APPROVAL_AMOUNT;
      if (allowance < amountAtomic) {
        markStep(
          params.updateStepStatus,
          params.stepIds?.approve,
          "waiting_signature"
        );
        await approveToken(approvalAmount, mintCurrency);
        markStep(params.updateStepStatus, params.stepIds?.approve, "completed");
      } else {
        markStep(params.updateStepStatus, params.stepIds?.approve, "completed");
      }

      markStep(
        params.updateStepStatus,
        params.stepIds?.mintAndStake,
        "waiting_signature"
      );
      markStep(
        params.updateStepStatus,
        params.stepIds?.mintAndStake,
        "confirming"
      );
      const txHash = await mintGCTLAndStake(
        amountAtomic,
        address,
        params.regionId,
        mintCurrency
      );
      markStep(
        params.updateStepStatus,
        params.stepIds?.mintAndStake,
        "completed"
      );

      return {
        txHash,
        amountAtomic,
        mintCurrency,
      } as const;
    },
    [
      address,
      approveToken,
      chainId,
      checkTokenAllowance,
      checkTokenBalance,
      estimateEthForUsdcTarget,
      isConnected,
      mintGCTLAndStake,
      signer,
      swapEthToUsdc,
    ]
  );

  return {
    gctlPriceNumber,
    gctlBalance,
    isGctlBalanceLoading,
    isProcessing,
    estimateEthToUsdc,
    invalidateAllQueries,
    fetchTransferDetails,
    getLatestNonce,
    stakeExistingGctlToRegion,
    mintAndStakeGctlToRegion,
  } as const;
}
