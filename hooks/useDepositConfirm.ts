// The deposit confirmation orchestrator extracted from deposit-dialog.tsx
// (behavior-preserving). Owns the full on-chain flow: preflight, sGCTL stake +
// EIP-712 sign + delegate, ETH/USDC/GLW swaps with slippage buffers, unclaimed-
// reward merkle claims, buyFractions, optimistic + fresh post-success sync, and
// error classification/telemetry. All reactive inputs are passed in as deps.
import React from "react";
import { parseUnits, type WalletClient } from "viem";
import { useAccount } from "wagmi";
import type { QueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/nextjs";
import { toast } from "sonner";
import {
  buildDelegateSgctlMessage,
  delegateSgctlEIP712Types,
  stakeControlEIP712Domain,
} from "@glowlabs-org/utils/browser";
import { getControlRouter } from "@/lib/api/control-routers";
import { trackEvent } from "@/lib/telemetry";
import { bucketUsd } from "@/lib/telemetry-buckets";
import { getStoredReferralAttribution } from "@/lib/referral-attribution";
import { useLang } from "@/lib/i18n";
import { type StepStatus } from "@/components/transaction-stepper";
import {
  useSponsorApplication,
  type AuctionApplication,
  type FractionSplitsSummary,
} from "@/hooks";
import {
  fetchWeeklyReportData,
  getHotWalletAddress,
  weekToNonce,
  type ReadableLeafReward,
} from "@/hooks/useMerkleProofs";
import type { ClaimableReward } from "@/hooks/control-wallets";
import { QUERY_KEYS } from "@/hooks/query-keys";
import {
  resolveGlwRemainingSteps,
  resolveSgctlRemainingUnits,
} from "@/hooks/hub-listings";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { useSwap } from "@/hooks/useSwap";
import { useGctlPreparationOrchestrator } from "@/hooks/useGctlPreparationOrchestrator";
import { useUnclaimedGlwForDelegation } from "@/hooks/useUnclaimedGlwForDelegation";
import { useRewardsKernelWrapper } from "@/hooks/useRewardsKernelWrapper";
import { usePatchedOffchainFractions } from "@/hooks/usePatchedOffchainFractions";
import {
  usePostSuccessSync,
  updateApplicationAfterSuccessfulPurchase,
} from "@/hooks/usePostSuccessSync";
import { useStakeSyncDelegation } from "@/hooks/useStakeSyncDelegation";
import {
  calculateAffordability,
  calculateSuccessMetrics,
  resolveDelegationStepAtomic,
  initializeTransactionSteps,
  withInternalRpcRetry,
  findErrorInMessage,
  getErrorCode,
  getErrorMessage,
  getSwapVolatilityErrorMessage,
  getInitialPositionValueGuard,
  isDelayedSplitConfirmationErrorMessage,
  isInternalRpcError,
  CONTRACT_ERROR_MESSAGES,
  RPC_INTERNAL_ERROR_MESSAGE,
  SPLIT_CONFIRMATION_DELAYED_MESSAGE,
  MIN_INITIAL_POSITION_USD,
  type ClaimSetSelection,
  type DepositPaymentMethod,
  type DepositSelectedCurrency,
  type SgctlSourceMode,
  type SuccessMetrics,
  type TransactionStep,
} from "../app/marketplace/deposit-dialog-utils";

export type Phase =
  | "review"
  | "processing"
  | "success"
  | "error"
  | "pending_confirmation";

/**
 * The wallet's CUMULATIVE units in the CURRENT delegation leg after a
 * successful transaction, read from the refreshed splits-by-wallet summary.
 * The sGCTL and GLW legs are counted in different units (sGCTL units vs GLW
 * steps) and must never be summed, so pick the field matching the leg. USDC
 * (miner) purchases live on the GLW-step leg.
 */
function resolveLegCumulativeSteps(
  summary: FractionSplitsSummary,
  currency: DepositSelectedCurrency,
): number {
  return currency === "SGCTL"
    ? summary.sgctlUnitsPurchased
    : summary.glwStepsPurchased;
}

interface UseDepositConfirmDeps {
  application: AuctionApplication | null;
  onSuccess?: () => void;

  quantity: number;
  selectedPaymentMethod: DepositPaymentMethod;
  isSubmitting: boolean;
  txHash: string | null;

  setLiveApplication: React.Dispatch<React.SetStateAction<AuctionApplication | null>>;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
  setQuantityInput: React.Dispatch<React.SetStateAction<string>>;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setPhase: React.Dispatch<React.SetStateAction<Phase>>;
  setTransactionSteps: React.Dispatch<React.SetStateAction<TransactionStep[]>>;
  setTxHash: React.Dispatch<React.SetStateAction<string | null>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setIsInsufficientSharesError: React.Dispatch<React.SetStateAction<boolean>>;
  setSuccessMetrics: React.Dispatch<React.SetStateAction<SuccessMetrics | null>>;

  submitInFlightRef: React.MutableRefObject<boolean>;
  stepsRef: React.MutableRefObject<TransactionStep[]>;
  submittedQuantityRef: React.MutableRefObject<number | null>;

  isConnected: boolean;
  address: `0x${string}` | undefined;
  connector: ReturnType<typeof useAccount>["connector"];
  chainId: number;
  signer: ReturnType<typeof useEthersSigner>["signer"];
  walletClient: WalletClient | undefined;
  queryClient: QueryClient;
  glwSpotPrice: number;
  ethSpotPrice: number;
  usdcBalance: bigint | null | undefined;
  glwBalance: bigint | null | undefined;
  ethBalance: bigint | null | undefined;
  refetchBalances: () => void;
  swapEthToUsdc: ReturnType<typeof useSwapETHToUSDC>["swapEthToUsdc"];
  estimateEthToUsdc: ReturnType<typeof useSwapETHToUSDC>["estimateEthToUsdc"];
  swapUSDCToUSDG: ReturnType<typeof useSwapUSDCToUSDG>["swapUSDCToUSDG"];
  swapUsdgToGlow: ReturnType<typeof useSwap>["swap"];
  stakeExistingGctlToRegion: ReturnType<typeof useGctlPreparationOrchestrator>["stakeExistingGctlToRegion"];
  mintAndStakeGctlToRegion: ReturnType<typeof useGctlPreparationOrchestrator>["mintAndStakeGctlToRegion"];
  unclaimedGlw: ReturnType<typeof useUnclaimedGlwForDelegation>;
  rewardsKernelWrapper: ReturnType<typeof useRewardsKernelWrapper>;
  claimSetSelection: ClaimSetSelection;
  invalidatePostSuccessQueries: ReturnType<typeof usePostSuccessSync>["invalidatePostSuccessQueries"];
  syncFreshPostSuccessCaches: ReturnType<typeof usePostSuccessSync>["syncFreshPostSuccessCaches"];
  schedulePostSuccessRefreshes: ReturnType<typeof usePostSuccessSync>["schedulePostSuccessRefreshes"];
  applyOptimisticPostSuccessUpdates: ReturnType<typeof usePostSuccessSync>["applyOptimisticPostSuccessUpdates"];
  waitForStakeSyncBeforeDelegation: ReturnType<typeof useStakeSyncDelegation>["waitForStakeSyncBeforeDelegation"];
  delegateSgctlWithRetry: ReturnType<typeof useStakeSyncDelegation>["delegateSgctlWithRetry"];
  fractionsHook: ReturnType<typeof usePatchedOffchainFractions>;
  sponsorMutation: ReturnType<typeof useSponsorApplication>;

  effectiveApplication: AuctionApplication | null;
  runtimeSelectedCurrency: DepositSelectedCurrency;
  regionId: number | null;
  controlChainId: number;
  delegationStepAtomic: bigint | null;
  gctlPriceNumber: number;
  gctlWalletBalance: bigint;
  stakedGctlBalance: bigint;
  sgctlSourceMode: SgctlSourceMode | null;
  isCheckingInitialPositionEligibility: boolean;
  initialPositionValueGuard: ReturnType<typeof getInitialPositionValueGuard>;
  initialPositionMinimumMessage: string;
  isPreparingWalletAuthorization: boolean;
  sgctlRequiredAmount: bigint;
  sgctlShortfall: bigint;

  fetchLatestApplication: () => Promise<AuctionApplication | null | undefined>;
  handleSmartAccountCheck: () => Promise<boolean>;
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
  confirmPurchaseInSplits: (
    expectedAdditionalSteps: number,
  ) => Promise<FractionSplitsSummary>;

  dd: ReturnType<typeof useLang>["t"]["routes"]["depositDialog"];
}

export function useDepositConfirm(deps: UseDepositConfirmDeps) {
  const {
    application,
    onSuccess,
    quantity,
    selectedPaymentMethod,
    isSubmitting,
    txHash,
    setLiveApplication,
    setQuantity,
    setQuantityInput,
    setIsSubmitting,
    setPhase,
    setTransactionSteps,
    setTxHash,
    setErrorMessage,
    setIsInsufficientSharesError,
    setSuccessMetrics,
    submitInFlightRef,
    stepsRef,
    submittedQuantityRef,
    isConnected,
    address,
    connector,
    chainId,
    signer,
    walletClient,
    queryClient,
    glwSpotPrice,
    ethSpotPrice,
    usdcBalance,
    glwBalance,
    ethBalance,
    refetchBalances,
    swapEthToUsdc,
    estimateEthToUsdc,
    swapUSDCToUSDG,
    swapUsdgToGlow,
    stakeExistingGctlToRegion,
    mintAndStakeGctlToRegion,
    unclaimedGlw,
    rewardsKernelWrapper,
    claimSetSelection,
    invalidatePostSuccessQueries,
    syncFreshPostSuccessCaches,
    schedulePostSuccessRefreshes,
    applyOptimisticPostSuccessUpdates,
    waitForStakeSyncBeforeDelegation,
    delegateSgctlWithRetry,
    fractionsHook,
    sponsorMutation,
    effectiveApplication,
    runtimeSelectedCurrency,
    regionId,
    controlChainId,
    delegationStepAtomic,
    gctlPriceNumber,
    gctlWalletBalance,
    stakedGctlBalance,
    sgctlSourceMode,
    isCheckingInitialPositionEligibility,
    initialPositionValueGuard,
    initialPositionMinimumMessage,
    isPreparingWalletAuthorization,
    sgctlRequiredAmount,
    sgctlShortfall,
    fetchLatestApplication,
    handleSmartAccountCheck,
    updateStepStatus,
    confirmPurchaseInSplits,
    dd,
  } = deps;

  const handleConfirm = async () => {
    if (!isConnected || !effectiveApplication?.activeFraction) return;
    if (isCheckingInitialPositionEligibility) {
      toast.message(dd.toastCheckingEligibility);
      return;
    }
    if (initialPositionValueGuard.isBlocked) {
      toast.error(initialPositionMinimumMessage);
      return;
    }
    if (isPreparingWalletAuthorization) {
      toast.message(
        runtimeSelectedCurrency === "SGCTL"
          ? dd.toastPreparingSigner
          : dd.toastPreparingConnection,
      );
      return;
    }

    if (submitInFlightRef.current || isSubmitting) return;
    submitInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      // Lock the CTA before any async preflight work so repeat clicks cannot queue
      // duplicate purchase flows while wallet checks and listing refreshes run.
      const isSafe = await handleSmartAccountCheck();
      if (!isSafe) return;

      const currentApplication =
        (await fetchLatestApplication()) ?? effectiveApplication;
      const activeFraction = currentApplication?.activeFraction;
      if (!currentApplication || !activeFraction) return;

      setLiveApplication(currentApplication);

      const availableSteps =
        runtimeSelectedCurrency === "SGCTL"
          ? resolveSgctlRemainingUnits(activeFraction)
          : resolveGlwRemainingSteps(activeFraction);
      if (availableSteps <= 0) {
        toast.error(dd.toastListingNoLongerAvailable);
        return;
      }
      if (quantity > availableSteps) {
        setQuantity(availableSteps);
        setQuantityInput(availableSteps.toString());
        toast.error(dd.toastStepsRemaining(String(availableSteps)));
        return;
      }

      const isUnclaimedRewardsPayment =
        selectedPaymentMethod === "UNCLAIMED_REWARDS";
      const isSwapDelegate =
        runtimeSelectedCurrency === "GLW" &&
        selectedPaymentMethod !== "GLW" &&
        !isUnclaimedRewardsPayment;
      const currentDelegationStepAtomic = resolveDelegationStepAtomic({
        activeFraction,
        applicationPriceQuotes: currentApplication.applicationPriceQuotes,
        selectedCurrency: runtimeSelectedCurrency,
      });
      const currentAffordability = calculateAffordability({
        activeFraction,
        delegationStepAtomic: currentDelegationStepAtomic,
        quantity,
        selectedCurrency: runtimeSelectedCurrency,
        selectedPaymentMethod,
        glwSpotPrice,
        gctlSpotPrice: gctlPriceNumber,
        ethSpotPrice,
        glwBalance: glwBalance ?? 0n,
        gctlBalance: gctlWalletBalance,
        stakedGctlBalance,
        usdcBalance: usdcBalance ?? 0n,
        ethBalance: ethBalance ?? 0n,
        unclaimedGlwBalance: unclaimedGlw.totalGlwWei,
      });
      const currentSgctlRequiredAmount =
        currentAffordability.requiredByMethod.SGCTL ?? 0n;
      const currentSgctlShortfall =
        currentSgctlRequiredAmount > stakedGctlBalance
          ? currentSgctlRequiredAmount - stakedGctlBalance
          : 0n;

      submittedQuantityRef.current = quantity;
      setPhase("processing");
      setErrorMessage(null);

      const userAddress = address as `0x${string}`;

      const steps = initializeTransactionSteps(
        runtimeSelectedCurrency,
        selectedPaymentMethod,
        {
          sgctlSource: sgctlSourceMode ?? undefined,
        },
      );
      stepsRef.current = steps;
      setTransactionSteps(steps);

      if (runtimeSelectedCurrency === "SGCTL") {
        if (!signer && !walletClient) {
          throw new Error("Wallet signer not available");
        }
        if (!Number.isFinite(controlChainId)) {
          throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
        }
        if (!regionId) {
          throw new Error("Region not available for this application");
        }

        if (sgctlSourceMode === "wallet_gctl") {
          await stakeExistingGctlToRegion({
            regionId,
            amountAtomic: currentSgctlShortfall,
            stepIds: {
              sign: "STAKE_GCTL",
              submit: "STAKE_GCTL",
            },
            updateStepStatus,
          });
          updateStepStatus("STAKE_GCTL", "completed");
        } else if (sgctlSourceMode === "mint_usdc") {
          const requiredUsdc = currentAffordability.requiredByMethod.USDC;
          if (requiredUsdc == null || requiredUsdc <= 0n) {
            throw new Error("Unable to determine the USDC amount required");
          }
          await mintAndStakeGctlToRegion({
            regionId,
            sourceCurrency: "USDC",
            amountAtomic: requiredUsdc,
            stepIds: {
              checkAllowance: "MINT_AND_STAKE_GCTL",
              approve: "MINT_AND_STAKE_GCTL",
              mintAndStake: "MINT_AND_STAKE_GCTL",
            },
            updateStepStatus,
          });
          updateStepStatus("MINT_AND_STAKE_GCTL", "completed");
        } else if (sgctlSourceMode === "mint_eth") {
          const requiredUsdc = currentAffordability.requiredByMethod.USDC;
          if (requiredUsdc == null || requiredUsdc <= 0n) {
            throw new Error("Unable to determine the USDC amount required");
          }
          updateStepStatus("SWAP_ETH_TO_USDC", "waiting_signature");
          const mintResult = await mintAndStakeGctlToRegion({
            regionId,
            sourceCurrency: "ETH",
            targetUsdcAmountAtomic: requiredUsdc,
            stepIds: {
              swapEthToUsdc: "SWAP_ETH_TO_USDC",
              checkAllowance: "MINT_AND_STAKE_GCTL",
              approve: "MINT_AND_STAKE_GCTL",
              mintAndStake: "MINT_AND_STAKE_GCTL",
            },
            updateStepStatus,
          });
          await refetchBalances();
          updateStepStatus("MINT_AND_STAKE_GCTL", "completed");
        }

        if (sgctlSourceMode !== "staked") {
          updateStepStatus("INDEX_STAKE", "confirming");
          await waitForStakeSyncBeforeDelegation(currentSgctlRequiredAmount);
          updateStepStatus("INDEX_STAKE", "completed");
        }

        updateStepStatus("DELEGATE_SGCTL", "waiting_signature");
        const latestNonce = await getControlRouter().fetchLastNonce(
          address as string,
        );
        const nonce = (Number(latestNonce) + 1).toString();
        // 24h window so the signed payload survives idle tabs / queued retries.
        // The nonce + per-wallet uniqueness guarantee prevents replay; deadline
        // length is purely a "submit by when" bound. Server caps at 7 days.
        const deadline = Math.floor(
          Date.now() / 1000 + 24 * 60 * 60,
        ).toString();
        const signatureMessage = buildDelegateSgctlMessage({
          nonce,
          amount: currentSgctlRequiredAmount.toString(),
          applicationId: currentApplication.id,
          fractionId: activeFraction.id,
          deadline,
        });

        const delegateTypes = delegateSgctlEIP712Types as unknown as Record<
          string,
          any[]
        >;
        const signature = signer
          ? await signer.signTypedData(
              stakeControlEIP712Domain(controlChainId),
              delegateTypes,
              signatureMessage,
            )
          : await walletClient!.signTypedData({
              account: userAddress,
              domain: stakeControlEIP712Domain(controlChainId),
              types: delegateTypes as any,
              primaryType: "DelegateSgctl",
              message: signatureMessage as any,
            });

        if (!signature) {
          throw new Error("Failed to sign SGCTL delegation");
        }

        updateStepStatus("DELEGATE_SGCTL", "confirming");
        const delegationResult = await delegateSgctlWithRetry({
          applicationId: currentApplication.id,
          fractionId: activeFraction.id,
          amount: currentSgctlRequiredAmount,
          signature,
          deadline,
          nonce,
          sourceMode: sgctlSourceMode,
        });
        updateStepStatus("DELEGATE_SGCTL", "completed");
        updateStepStatus("CONFIRM_TX", "confirming");

        const confirmedSplitsSummary = await confirmPurchaseInSplits(quantity);
        const confirmedApplication =
          (await fetchLatestApplication()) ?? currentApplication;
        setLiveApplication(confirmedApplication);
        setSuccessMetrics(
          calculateSuccessMetrics(
            confirmedApplication?.activeFraction ?? activeFraction,
            quantity,
            runtimeSelectedCurrency,
            resolveLegCumulativeSteps(
              confirmedSplitsSummary,
              runtimeSelectedCurrency,
            ),
          ),
        );

        await sponsorMutation.mutateAsync({
          applicationId: currentApplication.id,
          amount: currentSgctlRequiredAmount,
          currency: runtimeSelectedCurrency,
          txHash: delegationResult.delegationId,
          onSuccess: async () => {
            applyOptimisticPostSuccessUpdates({
              txHash: delegationResult.delegationId,
              application: confirmedApplication,
              fallbackApplication: currentApplication,
              quantity,
              amount: currentSgctlRequiredAmount,
              currency: runtimeSelectedCurrency,
            });
            await invalidatePostSuccessQueries(activeFraction.id);
            await syncFreshPostSuccessCaches();
            schedulePostSuccessRefreshes();
            updateStepStatus("CONFIRM_TX", "completed");
            setPhase("success");
            setTxHash(null);

            trackEvent("marketplace_deposit_success", {
              currency: runtimeSelectedCurrency,
              payment_method: selectedPaymentMethod,
              listing_type: "delegations",
              delegation_source: sgctlSourceMode,
              delegation_id: delegationResult.delegationId,
              application_id: currentApplication.id,
              fraction_id: activeFraction.id,
              quantity,
              tx_hash: null,
              farm_name: currentApplication.farmName ?? null,
              zone_name: currentApplication.zone?.name ?? null,
              referral_code:
                getStoredReferralAttribution()?.referralCode ?? null,
            });

            toast.success(dd.toastDelegationSuccess);
            onSuccess?.();
          },
        });

        return;
      }

      let requiredUsdc = 0n;
      if (selectedPaymentMethod === "ETH") {
        if (runtimeSelectedCurrency === "USDC") {
          requiredUsdc = BigInt(activeFraction.stepPrice) * BigInt(quantity);
        } else {
          const glwNeeded =
            (currentDelegationStepAtomic ?? 0n) * BigInt(quantity);
          const glwPrice = parseUnits(glwSpotPrice.toFixed(6), 6);
          const rawUsdcCost = (glwNeeded * glwPrice) / BigInt(1e18);
          requiredUsdc = (rawUsdcCost * 102n) / 100n;
        }
      }

      // --- 1. ETH Payment Handling (Swap to USDC) ---
      if (selectedPaymentMethod === "ETH") {
        if (requiredUsdc <= 0n) {
          throw new Error("Invalid USDC amount required for swap");
        }

        updateStepStatus("SWAP_ETH_TO_USDC", "waiting_signature");

        // Estimate ETH needed for the required USDC amount
        const probeWei = parseUnits("0.1", 18);
        const probeRes = await estimateEthToUsdc({
          amountInWei: probeWei,
          slippageBps: 100n,
        });

        if (!probeRes.ok) throw new Error("Failed to quote ETH to USDC");
        if (probeRes.val.amountOutUsdc <= 0n)
          throw new Error("Failed to quote ETH to USDC");

        // Calculate required ETH with buffer
        let amountInWei =
          (probeWei * requiredUsdc) / probeRes.val.amountOutUsdc;
        amountInWei = (amountInWei * 102n) / 100n; // +2% buffer

        // Refine estimate (simple retry loop)
        for (let i = 0; i < 3; i++) {
          const res = await estimateEthToUsdc({
            amountInWei,
            slippageBps: 100n,
          });
          if (res.ok && res.val.amountOutMinUsdc >= requiredUsdc) break;
          amountInWei = (amountInWei * 105n) / 100n; // +5% bump
        }

        updateStepStatus("SWAP_ETH_TO_USDC", "confirming");
        const swapRes = await swapEthToUsdc({
          amountInWei,
          slippageBps: 100n,
        });
        if (!swapRes.ok) throw new Error(swapRes.val);
        await refetchBalances();
        updateStepStatus("SWAP_ETH_TO_USDC", "completed");
      }

      // --- 2. Swap USDC to GLW (if delegating via swap) ---
      if (isSwapDelegate) {
        // Calculate needed GLW
        const glwNeeded =
          (currentDelegationStepAtomic ?? 0n) * BigInt(quantity);
        // Estimate USDC needed: GLW * Price * 1.02 (2% buffer)
        const glwPrice = parseUnits(glwSpotPrice.toFixed(6), 6);
        const usdcNeeded =
          (((glwNeeded * glwPrice) / BigInt(1e18)) * 102n) / 100n;

        // Swap USDC -> USDG
        updateStepStatus("SWAP_USDC_TO_USDG", "waiting_signature");
        updateStepStatus("SWAP_USDC_TO_USDG", "confirming");
        const usdcSwapRes = await swapUSDCToUSDG(usdcNeeded);
        if (!usdcSwapRes.ok) throw new Error(usdcSwapRes.val);
        updateStepStatus("SWAP_USDC_TO_USDG", "completed");

        // Swap USDG -> GLW (Uniswap)
        updateStepStatus("SWAP_USDG_TO_GLOW", "waiting_signature");
        updateStepStatus("SWAP_USDG_TO_GLOW", "confirming");
        const glowSwapRes = await swapUsdgToGlow({
          amount: usdcNeeded,
          slippagePercentTenThousandDenominator: 100n, // 1%
        });
        if (!glowSwapRes.ok) throw new Error(glowSwapRes.val);
        updateStepStatus("SWAP_USDG_TO_GLOW", "completed");

        // We should now have enough GLW.
        updateStepStatus("DELEGATE_GLW", "waiting_signature");
      } else if (isUnclaimedRewardsPayment) {
        if (claimSetSelection.shortfallGlwWei > 0n) {
          throw new Error(
            "Not enough unclaimed GLW to fund this delegation. Lower the amount or pick another payment method.",
          );
        }

        const fromAddress = getHotWalletAddress();
        const allSelectedWeeks = Array.from(
          new Set(
            [
              ...claimSetSelection.pdWeeks,
              ...claimSetSelection.inflationWeeks,
            ].map((w) => w.week),
          ),
        );

        const userProofsByWeek = new Map<number, ReadableLeafReward>();
        for (const week of allSelectedWeeks) {
          const data = await fetchWeeklyReportData(week);
          const proof = data.readableLeaves.find(
            (leaf) =>
              leaf.user.toLowerCase() === userAddress.toLowerCase(),
          );
          if (!proof) {
            throw new Error(
              `Missing merkle proof for week ${week}. Please retry in a moment.`,
            );
          }
          userProofsByWeek.set(week, proof);
        }

        if (claimSetSelection.pdWeeks.length > 0) {
          const pdWeeklyData = claimSetSelection.pdWeeks.map((item) => {
            const proof = userProofsByWeek.get(item.week)!;
            return {
              week: item.week,
              nonce: weekToNonce(item.week),
              v2Proof: proof.v2MerkleProof as `0x${string}`[],
              fromAddress,
              onchainAssetsEarned: proof.onchainAssetsEarned,
            };
          });
          const pdResult =
            await rewardsKernelWrapper.claimAllProtocolDepositsInOneTx(
              pdWeeklyData,
            );
          // The wrapper may report no new tx hash because every selected
          // week was already claimed on-chain (e.g., a previous attempt
          // landed but the user retried before the indexer caught up). That
          // is functionally success for the delegate-from-rewards path — the
          // GLW from those PD weeks is already in the wallet — so only fail
          // when the wrapper neither broadcast a tx nor saw matching
          // already-claimed weeks.
          const pdEffectiveCovered =
            pdResult.txHash != null ||
            pdResult.alreadyClaimedWeeks.length === pdWeeklyData.length;
          if (!pdEffectiveCovered) {
            throw new Error("Failed to claim protocol deposit rewards");
          }
        }

        for (const item of claimSetSelection.inflationWeeks) {
          const proof = userProofsByWeek.get(item.week)!;
          const inflationOnlyRewards: ClaimableReward[] = [
            {
              week: item.week,
              currency: "GLW",
              amount: "",
              amountRaw: proof.glowInflationEarned,
              type: "glowInflation",
            },
          ];
          const txHash = await rewardsKernelWrapper.claimWeekRewards(
            item.week,
            inflationOnlyRewards,
            weekToNonce(item.week),
            proof.v1MerkleProof as `0x${string}`[],
            proof.v2MerkleProof as `0x${string}`[],
            fromAddress,
            proof.glowInflationEarnedLeafWeight,
            undefined,
            {
              suppressWeekSuccessToast: true,
              throwOnUserRejected: true,
            },
          );
          if (!txHash) {
            throw new Error(
              `Failed to claim emission rewards for week ${item.week}`,
            );
          }
        }

        await refetchBalances();
        unclaimedGlw.refetch();

        updateStepStatus("BUY_FRACTIONS", "waiting_signature");
      } else {
        updateStepStatus("BUY_FRACTIONS", "waiting_signature");
      }

      // --- 3. Purchase Fractions (Delegate or Buy Miner) ---
      // Verify balance check skipped (handled by hook/metamask will fail if insufficient)
      // For "Swap & Delegate", we just bought GLW.
      // For "Buy Miner", we have USDC.

      const activeStepId = isSwapDelegate ? "DELEGATE_GLW" : "BUY_FRACTIONS";
      updateStepStatus(activeStepId, "confirming");

      const txHash = await withInternalRpcRetry(
        () =>
          fractionsHook.buyFractions({
            creator: activeFraction.owner,
            id: activeFraction.id,
            stepsToBuy: BigInt(quantity),
            minStepsToBuy: BigInt(quantity),
            refundTo: userAddress,
            creditTo: userAddress,
            useCounterfactualAddressForRefund: false,
          }),
        {
          maxRetries: 1,
          delayMs: 1500,
          onRetry: (attempt) => {
            trackEvent("rpc_internal_error_retry", {
              attempt,
              step: activeStepId,
              application_id: application?.id ?? null,
              fraction_id: activeFraction.id,
            });
          },
        },
      );

      updateStepStatus(activeStepId, "completed", { txHash });

      // --- 4. Confirm & Sponsor ---
      updateStepStatus("CONFIRM_TX", "confirming");
      setTxHash(txHash);

      const costBigInt =
        runtimeSelectedCurrency === "USDC"
          ? BigInt(activeFraction.stepPrice) * BigInt(quantity)
          : (currentDelegationStepAtomic ?? 0n) * BigInt(quantity);

      const optimisticApplication = updateApplicationAfterSuccessfulPurchase(
        currentApplication,
        quantity,
        runtimeSelectedCurrency,
      );

      setLiveApplication(optimisticApplication);
      setSuccessMetrics(
        calculateSuccessMetrics(
          activeFraction,
          quantity,
          runtimeSelectedCurrency,
        ),
      );
      applyOptimisticPostSuccessUpdates({
        txHash,
        application: optimisticApplication,
        fallbackApplication: currentApplication,
        quantity,
        amount: costBigInt,
        currency: runtimeSelectedCurrency,
      });
      updateStepStatus("CONFIRM_TX", "completed", { txHash });
      setPhase("success");

      // USD ticket-size bucket for cohort analysis (whale vs retail).
      // Revenue itself is owned by the backend pol/revenue sync, not here,
      // to avoid double-counting in Umami's Revenue report.
      const usdTicket =
        runtimeSelectedCurrency === "USDC"
          ? Number(costBigInt) / 1e6
          : null;

      trackEvent("marketplace_deposit_success", {
        currency: runtimeSelectedCurrency,
        payment_method: selectedPaymentMethod,
        listing_type:
          runtimeSelectedCurrency === "USDC" ? "miners" : "delegations",
        application_id: currentApplication.id,
        fraction_id: activeFraction.id,
        quantity,
        tx_hash: txHash,
        farm_name: currentApplication.farmName ?? null,
        zone_name: currentApplication.zone?.name ?? null,
        amount_usd_bucket:
          usdTicket != null ? bucketUsd(usdTicket) : null,
        referral_code:
          getStoredReferralAttribution()?.referralCode ?? null,
      });

      toast.success(
        runtimeSelectedCurrency === "USDC"
          ? dd.toastMinersPurchased
          : dd.toastDelegationSuccess,
      );
      onSuccess?.();

      void (async () => {
        try {
          const confirmedSplitsSummary =
            await confirmPurchaseInSplits(quantity);
          const confirmedApplication =
            (await fetchLatestApplication()) ?? optimisticApplication;
          setLiveApplication(confirmedApplication);
          // Re-slice the success ring once the refreshed splits summary is
          // available: highlight the wallet's CUMULATIVE units in the current
          // leg instead of only this transaction's slice. Use the fresh
          // post-transaction fraction so the ring's total fill reflects the
          // current sold count. The immediate this-tx ring set above stays
          // visible until this resolves.
          const cumulativeMetrics = calculateSuccessMetrics(
            confirmedApplication?.activeFraction ?? activeFraction,
            quantity,
            runtimeSelectedCurrency,
            resolveLegCumulativeSteps(
              confirmedSplitsSummary,
              runtimeSelectedCurrency,
            ),
          );
          if (cumulativeMetrics) {
            setSuccessMetrics(cumulativeMetrics);
          }

          await sponsorMutation.mutateAsync({
            applicationId: currentApplication.id,
            amount: costBigInt,
            currency: runtimeSelectedCurrency,
            txHash,
            onSuccess: async () => {
              await invalidatePostSuccessQueries(activeFraction.id);
              await syncFreshPostSuccessCaches();
              schedulePostSuccessRefreshes();
            },
          });
        } catch (backgroundError) {
          console.error(
            "Post-success split confirmation sync failed:",
            backgroundError,
          );
          Sentry.captureException(
            backgroundError instanceof Error
              ? backgroundError
              : new Error(String(backgroundError)),
            {
              tags: {
                marketplaceStage: "post_success_sync",
                delegationAsset:
                  application?.activeFraction?.delegationAsset ?? "none",
                delegationPhase:
                  application?.activeFraction?.delegationPhase ?? "none",
              },
              extra: {
                currency: runtimeSelectedCurrency,
                paymentMethod: selectedPaymentMethod,
                applicationId: currentApplication.id,
                fractionId: activeFraction.id,
                quantity,
                txHash,
              },
            },
          );

          schedulePostSuccessRefreshes();
        }
      })();
    } catch (e: any) {
      console.error(e);
      const rawMsg = getErrorMessage(e) || dd.processingTransactionFailedFallback;
      const errorTxHash =
        typeof e?.txHash === "string"
          ? e.txHash
          : typeof e?.cause?.txHash === "string"
            ? e.cause.txHash
            : null;

      // Check multiple places where viem might store the custom error name
      const errorName =
        e?.cause?.data?.errorName ||
        e?.cause?.name ||
        e?.name ||
        e?.data?.errorName ||
        "";
      const errorCode = getErrorCode(e);
      const isRpcInternal = isInternalRpcError(e);

      // Resolve currently active step first so step-specific error mappers can use it
      const currentSteps = stepsRef.current;
      const activeStep = currentSteps.find(
        (s) => s.status === "waiting_signature" || s.status === "confirming",
      );
      const isDelayedSplitConfirmation =
        isDelayedSplitConfirmationErrorMessage(rawMsg);

      if (isDelayedSplitConfirmation) {
        trackEvent("marketplace_deposit_confirmation_delayed", {
          currency: runtimeSelectedCurrency,
          payment_method: selectedPaymentMethod,
          listing_type:
            runtimeSelectedCurrency === "USDC" ? "miners" : "delegations",
          delegation_source: sgctlSourceMode,
          application_id: application?.id ?? null,
          fraction_id: application?.activeFraction?.id ?? null,
          quantity,
          tx_hash: errorTxHash ?? txHash ?? null,
          failed_step: activeStep?.id ?? null,
        });

        setTxHash(errorTxHash ?? txHash ?? null);
        setPhase("pending_confirmation");
        setErrorMessage(rawMsg);
        setIsInsufficientSharesError(false);
        return;
      }

      // Look up user-friendly error message from the mapping
      const knownError = CONTRACT_ERROR_MESSAGES[errorName];
      const errorConfig = knownError || findErrorInMessage(rawMsg);
      const swapVolatilityMessage = getSwapVolatilityErrorMessage(
        rawMsg,
        activeStep?.id,
      );
      const msg = isRpcInternal
        ? RPC_INTERNAL_ERROR_MESSAGE
        : errorConfig?.message || swapVolatilityMessage || rawMsg;
      const shouldRefresh = isRpcInternal
        ? false
        : (errorConfig?.shouldRefresh ?? false);

      if (shouldRefresh) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.listings.allSponsors,
        });
      }

      // Mark the current active step as error (using ref to avoid stale closure)
      if (activeStep) {
        updateStepStatus(activeStep.id, "error", { errorMessage: msg });
      } else if (currentSteps.length > 0) {
        // If no active step found, mark the first idle step as error
        const firstIdleStep = currentSteps.find((s) => s.status === "idle");
        if (firstIdleStep) {
          updateStepStatus(firstIdleStep.id, "error", { errorMessage: msg });
        }
      }

      const isUserRejected =
        rawMsg.includes("User rejected") || rawMsg.includes("user rejected");

      const hasCustomMessage = Boolean(errorConfig || swapVolatilityMessage);

      if (!isUserRejected) {
        trackEvent("marketplace_deposit_error", {
          currency: runtimeSelectedCurrency,
          payment_method: selectedPaymentMethod,
          listing_type:
            runtimeSelectedCurrency === "USDC" ? "miners" : "delegations",
          delegation_source: sgctlSourceMode,
          application_id: application?.id ?? null,
          fraction_id: application?.activeFraction?.id ?? null,
          quantity,
          failed_step: activeStep?.id ?? null,
          error_message: rawMsg.slice(0, 200),
          error_name: errorName || null,
        });

        // Report to Sentry
        const normalizedError =
          e instanceof Error ? e : new Error(String(rawMsg));
        Sentry.captureException(normalizedError, {
          tags: {
            marketplaceStage: "deposit",
            delegationAsset:
              application?.activeFraction?.delegationAsset ?? "none",
            delegationPhase:
              application?.activeFraction?.delegationPhase ?? "none",
          },
          extra: {
            currency: runtimeSelectedCurrency,
            paymentMethod: selectedPaymentMethod,
            delegationSource: sgctlSourceMode,
            applicationId: application?.id,
            fractionId: application?.activeFraction?.id,
            regionId,
            applicationPaymentCurrency: application?.paymentCurrency ?? null,
            activeFractionDelegationAsset:
              application?.activeFraction?.delegationAsset ?? null,
            activeFractionDelegationPhase:
              application?.activeFraction?.delegationPhase ?? null,
            delegationStepAtomic: delegationStepAtomic?.toString() ?? null,
            sgctlRequiredAmount:
              runtimeSelectedCurrency === "SGCTL"
                ? sgctlRequiredAmount.toString()
                : null,
            sgctlShortfall:
              runtimeSelectedCurrency === "SGCTL"
                ? sgctlShortfall.toString()
                : null,
            quantity,
            failedStep: activeStep?.id,
            errorName: errorName || null,
            errorCode: errorCode ?? null,
            isInternalRpcError: isRpcInternal,
            walletClientChainId: walletClient?.chain?.id ?? null,
            walletClientAccount: walletClient?.account?.address ?? null,
            connectorName: connector?.name ?? null,
            walletAddress: address,
          },
        });
      }

      setPhase("error");
      setErrorMessage(msg);
      setIsInsufficientSharesError(shouldRefresh);
      if (isUserRejected) {
        toast.error(dd.toastTransactionRejected);
      } else if (!hasCustomMessage) {
        toast.error(msg);
      }
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return { handleConfirm };
}
