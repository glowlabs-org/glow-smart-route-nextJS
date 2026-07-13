import { useEffect, useRef } from "react";
import {
  OFFCHAIN_FRACTIONS_ABI,
  OffchainFractionsError,
  parseViemError,
  type BuyFractionsParams,
  useOffchainFractions as useSdkOffchainFractions,
} from "@glowlabs-org/utils/browser";
import type { Address, Hash, PublicClient, WalletClient } from "viem";
import {
  DelayedConfirmationError,
  waitForTransactionReceipt,
} from "@/lib/wait-for-transaction-receipt";
import {
  assertWalletClientAccount,
  assertWalletClientForOrder,
  assertWalletClientOnExpectedChain,
  getExpectedChain,
  getExpectedChainId,
} from "@/lib/wallet-chain";
import {
  getTransactionOperationCancellation,
  type AssertTransactionActive,
} from "@/lib/transaction-operation";
import { validateFractionPurchaseTerms } from "@/lib/fraction-order";
import { synchronizePrerequisiteBalance } from "@/lib/prerequisite-balance";
import {
  WALLET_INTERACTION_TIMEOUT_MESSAGE,
  isWalletInteractionTimeoutError,
} from "@/lib/rpc-error-utils";
import {
  withWalletRequestAction,
  writeContractWithWalletLifecycle,
  type WalletRequestObserver,
} from "@/lib/wallet-request";

const ERC20_APPROVAL_ABI = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const ALLOWANCE_NOT_VISIBLE_ERROR =
  "Your token approval is confirmed but not visible to the next transaction yet. Please wait a moment and retry.";
const SPLIT_CONFIRMATION_DELAYED_MESSAGE =
  "Transaction submitted but confirmation is delayed. Please refresh before retrying.";
const FRACTION_READ_CHAIN_MISMATCH_MESSAGE =
  "Miner purchase reads are not on the configured network. Refresh and try again.";

interface ExpectedFractionPurchaseTerms {
  expectedPaymentToken: Address;
  expectedRequiredAmount: bigint;
  assertTransactionActive?: AssertTransactionActive;
}

function toErrorWithCause(error: unknown, extras?: { txHash?: string }): Error {
  const message =
    isWalletInteractionTimeoutError(error)
      ? WALLET_INTERACTION_TIMEOUT_MESSAGE
      : parseViemError(error) ||
        (error instanceof Error ? error.message : "Unknown error");
  const wrapped = new Error(message, error instanceof Error ? { cause: error } : undefined);

  if (error && typeof error === "object" && typeof (error as { name?: unknown }).name === "string") {
    wrapped.name = (error as { name: string }).name;
  }

  if (!(error instanceof Error) && error !== undefined) {
    (wrapped as Error & { cause?: unknown }).cause = error;
  }

  if (extras?.txHash) {
    (wrapped as Error & { txHash?: string }).txHash = extras.txHash;
  }

  return wrapped;
}

function toDelayedConfirmationError(error: unknown, txHash: string): Error {
  const wrapped = new Error(
    SPLIT_CONFIRMATION_DELAYED_MESSAGE,
    error instanceof Error ? { cause: error } : undefined,
  );

  if (!(error instanceof Error) && error !== undefined) {
    (wrapped as Error & { cause?: unknown }).cause = error;
  }

  (wrapped as Error & { txHash?: string }).txHash = txHash;

  return wrapped;
}

export function usePatchedOffchainFractions(
  walletClient: WalletClient | undefined,
  publicClient: PublicClient | undefined,
  chainId: number,
) {
  const sdk = useSdkOffchainFractions(walletClient, publicClient, chainId);

  // wagmi's useWalletClient() can be transiently undefined right after connect
  // (esp. with Privy) even though the wallet is connected. Keep the last
  // non-undefined walletClient so a buy clicked during that gap doesn't fail
  // with "Signer not available" (mirrors useContracts' walletClientRef).
  const walletClientRef = useRef<WalletClient | undefined>(walletClient);
  useEffect(() => {
    if (walletClient) walletClientRef.current = walletClient;
  }, [walletClient]);

  function assertConfiguredReadContext() {
    const expectedChainId = getExpectedChainId();
    if (
      chainId !== expectedChainId ||
      publicClient?.chain?.id !== expectedChainId
    ) {
      throw new Error(FRACTION_READ_CHAIN_MISMATCH_MESSAGE);
    }
  }

  async function assertPurchaseTerms(
    params: Pick<BuyFractionsParams, "creator" | "id" | "stepsToBuy">,
    options: ExpectedFractionPurchaseTerms,
  ) {
    options.assertTransactionActive?.();
    assertConfiguredReadContext();
    const fractionData = await sdk.getFraction(params.creator, params.id);
    options.assertTransactionActive?.();
    return validateFractionPurchaseTerms({
      paymentToken: fractionData.token,
      stepAmount: fractionData.step,
      stepsToBuy: params.stepsToBuy,
      expectedPaymentToken: options.expectedPaymentToken,
      expectedRequiredAmount: options.expectedRequiredAmount,
    });
  }

  async function buyFractions(
    params: BuyFractionsParams,
    // approvalBufferAtomic: extra USDC (atomic) added to the ERC-20 approval as a
    // safety margin for callers with price variance. Mining-center listings have
    // a FIXED step price, so the miner buy passes 0 to approve the exact cost.
    // onPhase: lets callers render the approve + buy as distinct steps. Emits
    // "approving"/"approved" only when an approval is actually needed, then
    // "purchasing" before the buyFractions tx.
    options?: {
      approvalBufferAtomic?: bigint;
      onPhase?: (phase: "approving" | "approved" | "purchasing") => void;
      expectedAccount?: Address;
      expectedPaymentToken?: Address;
      expectedRequiredAmount?: bigint;
      prerequisiteTxHashes?: Hash[];
      assertTransactionActive?: AssertTransactionActive;
      walletRequest?: WalletRequestObserver;
    },
  ): Promise<string> {
    const approvalBufferAtomic = options?.approvalBufferAtomic ?? 10_000_000n;
    const onPhase = options?.onPhase;
    const assertTransactionActive = options?.assertTransactionActive;
    assertTransactionActive?.();
    const activeWalletClient = walletClient ?? walletClientRef.current;
    if (!activeWalletClient) {
      throw new Error(OffchainFractionsError.SIGNER_NOT_AVAILABLE);
    }
    if (!activeWalletClient.account) {
      throw new Error("Wallet client must have an account");
    }
    assertWalletClientOnExpectedChain(activeWalletClient);
    if (options?.expectedAccount) {
      assertWalletClientAccount(activeWalletClient, options.expectedAccount);
    }
    assertTransactionActive?.();
    if (!publicClient) {
      throw new Error("Public client not available");
    }
    assertConfiguredReadContext();

    try {
      const {
        creator,
        id,
        stepsToBuy,
        minStepsToBuy,
        refundTo,
        creditTo,
        useCounterfactualAddressForRefund,
      } = params;

      if (!creator || !id || !refundTo || !creditTo) {
        throw new Error(OffchainFractionsError.INVALID_PARAMETERS);
      }

      if (stepsToBuy === 0n) {
        throw new Error("stepsToBuy must be greater than zero");
      }

      if (minStepsToBuy === 0n) {
        throw new Error("minStepsToBuy must be greater than zero");
      }

      const fractionData = await sdk.getFraction(creator, id);
      assertTransactionActive?.();
      const hasExpectedTerms =
        options?.expectedPaymentToken !== undefined ||
        options?.expectedRequiredAmount !== undefined;
      if (
        hasExpectedTerms &&
        (options?.expectedPaymentToken === undefined ||
          options.expectedRequiredAmount === undefined)
      ) {
        throw new Error("Expected fraction purchase terms are incomplete.");
      }
      const requiredAmount = hasExpectedTerms
        ? validateFractionPurchaseTerms({
            paymentToken: fractionData.token,
            stepAmount: fractionData.step,
            stepsToBuy,
            expectedPaymentToken: options!.expectedPaymentToken!,
            expectedRequiredAmount: options!.expectedRequiredAmount!,
          }).requiredAmount
        : stepsToBuy * fractionData.step;
      const owner = activeWalletClient.account.address;

      const prerequisiteTxHashes = options?.prerequisiteTxHashes ?? [];
      const balancePromise =
        prerequisiteTxHashes.length > 0
          ? synchronizePrerequisiteBalance({
              prerequisiteTxHashes,
              waitForReceipt: (hash) =>
                publicClient.waitForTransactionReceipt({
                  hash,
                  confirmations: 1,
                  retryCount: 8,
                  retryDelay: 1_000,
                }),
              minimumBalance: requiredAmount,
              readBalance: () =>
                sdk.checkTokenBalance(owner, fractionData.token),
              assertTransactionActive,
            })
          : sdk.checkTokenBalance(owner, fractionData.token);
      const allowancePromise = sdk.checkTokenAllowance(
        owner,
        fractionData.token,
      );
      const [balance, initialAllowance] = await Promise.all([
        balancePromise,
        allowancePromise,
      ]);
      assertTransactionActive?.();
      if (balance < requiredAmount) {
        throw new Error(OffchainFractionsError.INSUFFICIENT_BALANCE);
      }

      let allowance = initialAllowance;
      if (allowance < requiredAmount) {
        onPhase?.("approving");
        const approvalAmount = requiredAmount + approvalBufferAtomic;
        assertWalletClientOnExpectedChain(activeWalletClient);
        if (options?.expectedAccount) {
          assertWalletClientAccount(activeWalletClient, options.expectedAccount);
        }
        await assertWalletClientForOrder(
          activeWalletClient,
          options?.expectedAccount,
        );
        assertTransactionActive?.();
        const approveHash = await writeContractWithWalletLifecycle(
          activeWalletClient,
          {
            address: fractionData.token as Address,
            abi: ERC20_APPROVAL_ABI,
            functionName: "approve",
            args: [sdk.addresses.OFFCHAIN_FRACTIONS as Address, approvalAmount],
            chain: getExpectedChain(),
            account: activeWalletClient.account,
          },
          withWalletRequestAction(
            options?.walletRequest,
            "approve_fraction_payment",
          ),
        );
        assertTransactionActive?.();

        await waitForTransactionReceipt(approveHash);
        assertTransactionActive?.();

        const maxAllowanceChecks = 5;
        const allowanceCheckDelayMs = 500;

        for (let i = 0; i < maxAllowanceChecks; i += 1) {
          allowance = await sdk.checkTokenAllowance(owner, fractionData.token);
          assertTransactionActive?.();
          if (allowance >= requiredAmount) {
            break;
          }
          if (i < maxAllowanceChecks - 1) {
            await new Promise((resolve) => setTimeout(resolve, allowanceCheckDelayMs));
            assertTransactionActive?.();
          }
        }

        if (allowance < requiredAmount) {
          throw new Error(ALLOWANCE_NOT_VISIBLE_ERROR);
        }
        onPhase?.("approved");
      }

      onPhase?.("purchasing");
      // Reuse the simulated request so the wallet does not re-estimate against stale allowance state.
      const { request } = await publicClient.simulateContract({
        address: sdk.addresses.OFFCHAIN_FRACTIONS as Address,
        abi: OFFCHAIN_FRACTIONS_ABI,
        functionName: "buyFractions",
        args: [
          creator as Address,
          id as `0x${string}`,
          stepsToBuy,
          minStepsToBuy,
          refundTo as Address,
          creditTo as Address,
          useCounterfactualAddressForRefund,
        ],
        account: activeWalletClient.account,
      });
      assertTransactionActive?.();

      assertWalletClientOnExpectedChain(activeWalletClient);
      if (options?.expectedAccount) {
        assertWalletClientAccount(activeWalletClient, options.expectedAccount);
      }
      await assertWalletClientForOrder(
        activeWalletClient,
        options?.expectedAccount,
      );
      assertTransactionActive?.();
      const hash = await writeContractWithWalletLifecycle(
        activeWalletClient,
        {
          ...request,
          chain: getExpectedChain(),
          account: activeWalletClient.account,
        },
        withWalletRequestAction(options?.walletRequest, "buy_fractions"),
      );
      assertTransactionActive?.();

      try {
        await waitForTransactionReceipt(hash);
        assertTransactionActive?.();
      } catch (error) {
        if (error instanceof DelayedConfirmationError) {
          // Re-wrap with the buyFractions-specific user message while keeping
          // the typed error class so the dialog can recognize it.
          throw toDelayedConfirmationError(error, hash);
        }
        throw toErrorWithCause(error, { txHash: hash });
      }

      return hash;
    } catch (error) {
      const cancellation = getTransactionOperationCancellation(
        error,
        assertTransactionActive,
      );
      if (cancellation) throw cancellation;
      throw toErrorWithCause(error);
    }
  }

  return {
    ...sdk,
    assertPurchaseTerms,
    buyFractions,
  };
}
