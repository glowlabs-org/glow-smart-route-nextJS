import { formatEther, getAddress, type Address, type Hash } from "viem";
import React from "react";
import { useContracts } from "./useContracts";
import { useEthersSigner } from "./useEthersSigner";
import { Result, Ok, Err } from "ts-results";
import { waitForTransactionReceipt } from "@/lib/wait-for-transaction-receipt";
import { useWalletClient } from "wagmi";
import { publicClient } from "@/web3/web3/clients/publicClient";
import {
  getSmartAccountStatus,
  isSmartAccountPreflightReusable,
  isSmartAccountBlocked,
  SMART_ACCOUNT_UNSUPPORTED_MESSAGE,
  type SmartAccountPreflight,
  type SmartAccountStatus,
} from "@/web3/web3/utils/detectSmartAccount";
import {
  getTransactionOperationCancellation,
  type AssertTransactionActive,
} from "@/lib/transaction-operation";
import { isDeterministicAllowanceResetError } from "@/lib/erc20-approval";
import { synchronizePrerequisiteBalance } from "@/lib/prerequisite-balance";
import {
  WALLET_INTERACTION_TIMEOUT_MESSAGE,
  isWalletInteractionTimeoutError,
} from "@/lib/rpc-error-utils";
import {
  withWalletRequestAction,
  type WalletRequestObserver,
} from "@/lib/wallet-request";

const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1);

export enum SwapUSDCToUSDGError {
  CONTRACTS_NOT_AVAILABLE = "Contracts not available",
  SIGNER_NOT_AVAILABLE = "Signer not available",
  UNKNOWN_ERROR = "Unknown error",
  INSUFFICIENT_USDC_BALANCE = "Insufficient USDC balance",
  APPROVAL_FAILED = "Failed to approve USDC",
  SWAP_FAILED = "Failed to swap USDC to USDG",
  TRANSACTION_REJECTED = "Transaction was rejected",
}

export interface SwapUSDCToUSDGSuccess {
  txHash: `0x${string}`;
}

export interface SwapUSDCToUSDGOptions {
  expectedAccount?: Address;
  prerequisiteTxHashes?: Hash[];
  assertTransactionActive?: AssertTransactionActive;
  smartAccountPreflight?: SmartAccountPreflight;
  walletRequest?: WalletRequestObserver;
}

// Helper function to parse errors
function parseSwapError(error: any): string {
  if (isWalletInteractionTimeoutError(error)) {
    return WALLET_INTERACTION_TIMEOUT_MESSAGE;
  }

  // Check for user rejection
  if (
    error?.code === 4001 ||
    error?.message?.includes("rejected") ||
    error?.message?.includes("denied")
  ) {
    return SwapUSDCToUSDGError.TRANSACTION_REJECTED;
  }

  // Check for RPC errors
  if (error?.code === -32603 || error?.error?.code === -32603) {
    // Internal JSON-RPC error often means the transaction would fail
    const message = error?.error?.message || error?.message || "";
    if (message.includes("insufficient")) {
      return SwapUSDCToUSDGError.INSUFFICIENT_USDC_BALANCE;
    }
    // Try to extract more specific error from data
    if (error?.data?.message) {
      return `Transaction failed: ${error.data.message}`;
    }
    if (error?.error?.data?.message) {
      return `Transaction failed: ${error.error.data.message}`;
    }
    return `Transaction would fail. Please try again or contact support.`;
  }

  // Check for specific error messages
  if (error?.message) {
    // Check for timeout errors
    if (
      error.message.includes("timeout") ||
      error.message.includes("Timeout")
    ) {
      return "Transaction confirmation timed out. The transaction may have succeeded - please check your wallet.";
    }
    if (
      error.message.includes("insufficient funds") ||
      error.message.includes("insufficient balance")
    ) {
      return SwapUSDCToUSDGError.INSUFFICIENT_USDC_BALANCE;
    }
    if (error.message.includes("approve")) {
      return SwapUSDCToUSDGError.APPROVAL_FAILED;
    }
    return error.message;
  }

  return SwapUSDCToUSDGError.UNKNOWN_ERROR;
}

export const useSwapUSDCToUSDG = () => {
  const { signer } = useEthersSigner();
  const { data: walletClient } = useWalletClient();
  const { usdc, usdg, isReady } = useContracts(signer);
  const [lastTxHash, setLastTxHash] = React.useState<`0x${string}` | null>(null);
  const lastTxHashRef = React.useRef<`0x${string}` | null>(null);

  const resetLastTxHash = React.useCallback(() => {
    lastTxHashRef.current = null;
    setLastTxHash(null);
  }, []);

  const estimateGasForswapUSDCToUSDG = async (
    amount: bigint,
    ethPriceInUSD: number | null
  ): Promise<Result<string, string>> => {
    try {
      if (!usdc || !usdg)
        return new Err(SwapUSDCToUSDGError.CONTRACTS_NOT_AVAILABLE);
      if (!signer) return new Err(SwapUSDCToUSDGError.SIGNER_NOT_AVAILABLE);
      if (amount <= BigInt(0)) return new Err("Amount must be greater than 0");
      const signerAddress = await signer.getAddress();
      const [smartStatus, usdcGasPrice, allowance] = await Promise.all([
        getSmartAccountStatus({
          address: signerAddress as `0x${string}`,
          chainId: walletClient?.chain?.id,
          walletClient,
          getBytecode: publicClient.getBytecode,
        }).catch(() => null),
        usdc.provider.getGasPrice(),
        usdc.allowance(signerAddress, usdg.address),
      ]);
      if (isSmartAccountBlocked(smartStatus)) {
        return new Err(SMART_ACCOUNT_UNSUPPORTED_MESSAGE);
      }
      let totalEstimatedGas = BigInt(0);
      if (allowance < amount) {
        const estimatedGas = await usdc.estimateGas.approve(
          usdg.address,
          MAX_UINT256
        );

        const estimatedCost = estimatedGas * BigInt(usdcGasPrice);
        totalEstimatedGas = totalEstimatedGas + estimatedCost;
      }

      // 85k upper-bound matches observed mainnet averages for the USDG
      // mint-on-USDC path (single storage write + event). The prior 100k
      // over-padded the fee estimate by ~15% vs real execution.
      const estimatedGas = BigInt(85000);

      const estimatedCost = estimatedGas * BigInt(usdcGasPrice);
      totalEstimatedGas = totalEstimatedGas + estimatedCost;

      if (ethPriceInUSD) {
        const estimatedCostInEth = formatEther(totalEstimatedGas);
        const estimatedCostInUSD = (
          parseFloat(estimatedCostInEth) * ethPriceInUSD
        ).toFixed(2);
        return new Ok(estimatedCostInUSD);
      } else {
        return new Err(
          "Could not fetch the ETH price to calculate cost in USD."
        );
      }
    } catch (e: any) {
      return new Err(SwapUSDCToUSDGError.UNKNOWN_ERROR);
    }
  };

  const swapUSDCToUSDG = async (
    amount: bigint,
    options?: SwapUSDCToUSDGOptions,
  ): Promise<Result<SwapUSDCToUSDGSuccess, SwapUSDCToUSDGError | string>> => {
    try {
      if (!usdc || !usdg || !isReady)
        return new Err(SwapUSDCToUSDGError.CONTRACTS_NOT_AVAILABLE);
      if (!signer) return new Err(SwapUSDCToUSDGError.SIGNER_NOT_AVAILABLE);
      if (amount <= BigInt(0)) {
        return new Err("Amount must be greater than 0");
      }

      const expectedAccount = options?.expectedAccount;
      const assertTransactionActive = options?.assertTransactionActive;
      assertTransactionActive?.();
      const signerAddress = await signer.getAddress();
      assertTransactionActive?.();
      if (
        expectedAccount &&
        getAddress(signerAddress) !== getAddress(expectedAccount)
      ) {
        return new Err("Wallet account changed during this order.");
      }
      const prerequisiteTxHashes = options?.prerequisiteTxHashes ?? [];
      const chainId = walletClient?.chain?.id;
      const smartStatusPromise: Promise<SmartAccountStatus | null> =
        isSmartAccountPreflightReusable({
          preflight: options?.smartAccountPreflight,
          address: signerAddress as Address,
          chainId,
        })
          ? Promise.resolve(options?.smartAccountPreflight?.status ?? null)
          : getSmartAccountStatus({
              address: signerAddress as `0x${string}`,
              chainId,
              walletClient,
              getBytecode: publicClient.getBytecode,
            }).catch(() => null);
      const usdcBalancePromise =
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
              minimumBalance: amount,
              readBalance: () => usdc.balanceOf(signerAddress),
              assertTransactionActive,
            })
          : usdc.balanceOf(signerAddress);
      const allowancePromise = usdc.allowance(signerAddress, usdg.address);
      const [smartStatus, usdcBalance, allowance] = await Promise.all([
        smartStatusPromise,
        usdcBalancePromise,
        allowancePromise,
      ]);
      assertTransactionActive?.();

      if (isSmartAccountBlocked(smartStatus)) {
        return new Err(SMART_ACCOUNT_UNSUPPORTED_MESSAGE);
      }

      if (usdcBalance < amount) {
        return new Err(SwapUSDCToUSDGError.INSUFFICIENT_USDC_BALANCE);
      }

      if (allowance < amount) {
        try {
          try {
            const tx = await usdc.approve(
              usdg.address,
              MAX_UINT256,
              expectedAccount,
              assertTransactionActive,
              withWalletRequestAction(
                options?.walletRequest,
                "approve_usdc",
              ),
            );
            assertTransactionActive?.();
            lastTxHashRef.current = tx.hash as `0x${string}`;
            setLastTxHash(tx.hash as `0x${string}`);
            await waitForTransactionReceipt(tx.hash as `0x${string}`);
            assertTransactionActive?.();
          } catch (approvalErr: any) {
            const cancellation = getTransactionOperationCancellation(
              approvalErr,
              assertTransactionActive,
            );
            if (cancellation) throw cancellation;
            // Some tokens require setting allowance to 0 before raising it.
            if (isDeterministicAllowanceResetError(approvalErr)) {
              const resetTx = await usdc.approve(
                usdg.address,
                BigInt(0),
                expectedAccount,
                assertTransactionActive,
                withWalletRequestAction(
                  options?.walletRequest,
                  "reset_usdc_approval",
                ),
              );
              assertTransactionActive?.();
              lastTxHashRef.current = resetTx.hash as `0x${string}`;
              setLastTxHash(resetTx.hash as `0x${string}`);
              await waitForTransactionReceipt(resetTx.hash as `0x${string}`);
              assertTransactionActive?.();

              const tx = await usdc.approve(
                usdg.address,
                MAX_UINT256,
                expectedAccount,
                assertTransactionActive,
                withWalletRequestAction(
                  options?.walletRequest,
                  "approve_usdc_after_reset",
                ),
              );
              assertTransactionActive?.();
              lastTxHashRef.current = tx.hash as `0x${string}`;
              setLastTxHash(tx.hash as `0x${string}`);
              await waitForTransactionReceipt(tx.hash as `0x${string}`);
              assertTransactionActive?.();
            } else {
              throw approvalErr;
            }
          }
        } catch (approvalError: any) {
          const cancellation = getTransactionOperationCancellation(
            approvalError,
            assertTransactionActive,
          );
          if (cancellation) throw cancellation;
          return new Err(parseSwapError(approvalError));
        }
      }

      // Perform the swap
      try {
        const tx = await usdg.swap(
          signerAddress,
          amount,
          expectedAccount,
          assertTransactionActive,
          withWalletRequestAction(options?.walletRequest, "swap_usdc_to_usdg"),
        );
        assertTransactionActive?.();

        if (!tx || !tx.hash) {
          return new Err(
            "Failed to get transaction hash from swap. Please try again."
          );
        }
        lastTxHashRef.current = tx.hash as `0x${string}`;
        setLastTxHash(tx.hash as `0x${string}`);

        await waitForTransactionReceipt(tx.hash as `0x${string}`);
        assertTransactionActive?.();
        return new Ok({ txHash: tx.hash as `0x${string}` });
      } catch (swapError: any) {
        const cancellation = getTransactionOperationCancellation(
          swapError,
          assertTransactionActive,
        );
        if (cancellation) throw cancellation;
        if (isWalletInteractionTimeoutError(swapError)) {
          return new Err(WALLET_INTERACTION_TIMEOUT_MESSAGE);
        }
        // Check if it's a timeout error
        if (
          swapError?.message?.includes("timeout") ||
          swapError?.message?.includes("Timeout")
        ) {
          return new Err(
            "Transaction submitted but confirmation timed out. Please check your wallet to verify if the swap completed successfully."
          );
        }

        // Check if it's a simulation/validation error from ethers
        if (swapError?.code === "UNPREDICTABLE_GAS_LIMIT") {
          return new Err(
            "Transaction would fail on-chain. Please check your balance and try again."
          );
        }
        return new Err(parseSwapError(swapError));
      }
    } catch (e: any) {
      const cancellation = getTransactionOperationCancellation(
        e,
        options?.assertTransactionActive,
      );
      if (cancellation) throw cancellation;
      return new Err(parseSwapError(e));
    }
  };

  return {
    swapUSDCToUSDG,
    estimateGasForswapUSDCToUSDG,
    lastTxHash,
    lastTxHashRef,
    resetLastTxHash,
  };
};
